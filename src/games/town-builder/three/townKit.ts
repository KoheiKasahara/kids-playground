import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// 3D の まちを くみたてる どうぐ。
// うごかない ものは ざいりょうごとに 1つの かたちへ まとめ（えがく かいすうを へらす）、
// うごく ものだけ べつの Mesh に する。つくった かたち・ざいりょうは さいごに まとめて すてる。

export type V3 = readonly [number, number, number]
export type Mat = string | THREE.Material

/** よるに ひかる ざいりょう。 */
export type GlowKind = 'window' | 'windowOff' | 'bulb' | 'red' | 'headlight' | 'tail'

type GlowSpec = { day: string; night: string; emissive: string; dayGlow: number; nightGlow: number }

const GLOWS: Record<GlowKind, GlowSpec> = {
  window: { day: '#cfeefe', night: '#3d4770', emissive: '#ffd76a', dayGlow: 0, nightGlow: 1.35 },
  windowOff: { day: '#cfeefe', night: '#262d48', emissive: '#000000', dayGlow: 0, nightGlow: 0 },
  bulb: { day: '#fff3b0', night: '#fff3b0', emissive: '#ffe680', dayGlow: 0.15, nightGlow: 2.2 },
  red: { day: '#ff6b6b', night: '#ff6b6b', emissive: '#ff2d2d', dayGlow: 0.35, nightGlow: 2.2 },
  headlight: { day: '#fffbe6', night: '#fffbe6', emissive: '#fff4c2', dayGlow: 0, nightGlow: 2.6 },
  tail: { day: '#e03131', night: '#e03131', emissive: '#ff3b3b', dayGlow: 0, nightGlow: 1.6 },
}

const ZERO: V3 = [0, 0, 0]
const ONE: V3 = [1, 1, 1]
const scratch = {
  position: new THREE.Vector3(),
  quaternion: new THREE.Quaternion(),
  euler: new THREE.Euler(),
  scale: new THREE.Vector3(),
}

export function matrixOf(at: V3 = ZERO, rot: V3 = ZERO, scale: V3 = ONE): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    scratch.position.set(at[0], at[1], at[2]),
    scratch.quaternion.setFromEuler(scratch.euler.set(rot[0], rot[1], rot[2])),
    scratch.scale.set(scale[0], scale[1], scale[2]),
  )
}

/** まとめられる よう、どの かたちも index なし・position と normal だけに そろえる。 */
function normalize(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry
  if (flat !== geometry) geometry.dispose()
  for (const name of Object.keys(flat.attributes)) if (name !== 'position' && name !== 'normal') flat.deleteAttribute(name)
  if (!flat.attributes.normal) flat.computeVertexNormals()
  flat.clearGroups()
  return flat
}

/** そこが y=0 の さんかくの やね（むねは x じく、はば・たかさ・おくゆき 1）。 */
function gableGeometry(): THREE.BufferGeometry {
  const l = -0.5
  const r = 0.5
  const positions = [
    // まえの やねめん
    l, 0, 0.5, r, 0, 0.5, r, 1, 0, l, 0, 0.5, r, 1, 0, l, 1, 0,
    // うしろの やねめん
    r, 0, -0.5, l, 0, -0.5, l, 1, 0, r, 0, -0.5, l, 1, 0, r, 1, 0,
    // よこの さんかく
    r, 0, 0.5, r, 0, -0.5, r, 1, 0,
    l, 0, -0.5, l, 0, 0.5, l, 1, 0,
    // そこ
    l, 0, -0.5, r, 0, -0.5, r, 0, 0.5, l, 0, -0.5, r, 0, 0.5, l, 0, 0.5,
  ]
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  return geometry
}

/** (cx, cz) を まんなかに した、a0〜a1 ラジアンの わの いた（カーブの みち・せんろ）。 */
function arcGeometry(cx: number, cz: number, inner: number, outer: number, a0: number, a1: number, y0: number, y1: number): THREE.BufferGeometry {
  const steps = 10
  const positions: number[] = []
  const at = (radius: number, angle: number, y: number) => [cx + Math.cos(angle) * radius, y, cz + Math.sin(angle) * radius]
  // かくどが ふえる むきなら 0→3→2→1 の じゅんで おもてが そと（うえ）を むく。へる むきなら ぎゃく。
  const flip = a1 < a0
  const quad = ([a, b, c, d]: number[][]) => {
    const [p, q, r, s] = flip ? [a, b, c, d] : [a, d, c, b]
    positions.push(...p, ...q, ...r, ...p, ...r, ...s)
  }
  for (let step = 0; step < steps; step += 1) {
    const s = a0 + ((a1 - a0) * step) / steps
    const e = a0 + ((a1 - a0) * (step + 1)) / steps
    quad([at(inner, s, y1), at(outer, s, y1), at(outer, e, y1), at(inner, e, y1)])
    quad([at(outer, s, y0), at(outer, e, y0), at(outer, e, y1), at(outer, s, y1)])
    quad([at(inner, s, y0), at(inner, s, y1), at(inner, e, y1), at(inner, e, y0)])
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  return geometry
}

type Batch = { material: THREE.Material; cast: boolean; parts: { geometry: THREE.BufferGeometry; matrix: THREE.Matrix4 }[] }

export class TownKit {
  private readonly geos = new Map<string, THREE.BufferGeometry>()
  private readonly mats = new Map<string, THREE.Material>()
  private readonly batches = new Map<string, Batch>()
  private readonly glows: { material: THREE.MeshStandardMaterial; spec: GlowSpec }[] = []
  private readonly owned: { dispose(): void }[] = []

  // ---------------- ざいりょう ----------------

  mat(color: string, options: { rough?: number; metal?: number; opacity?: number } = {}): THREE.Material {
    const key = `${color}|${options.rough ?? ''}|${options.metal ?? ''}|${options.opacity ?? ''}`
    let material = this.mats.get(key)
    if (!material) {
      const transparent = options.opacity !== undefined && options.opacity < 1
      material = new THREE.MeshStandardMaterial({
        color,
        roughness: options.rough ?? 0.82,
        metalness: options.metal ?? 0,
        transparent,
        opacity: options.opacity ?? 1,
        depthWrite: !transparent,
      })
      this.mats.set(key, material)
    }
    return material
  }

  glow(kind: GlowKind): THREE.Material {
    const key = `glow:${kind}`
    let material = this.mats.get(key)
    if (!material) {
      const spec = GLOWS[kind]
      const standard = new THREE.MeshStandardMaterial({ color: spec.day, roughness: 0.35, emissive: spec.emissive, emissiveIntensity: spec.dayGlow })
      this.glows.push({ material: standard, spec })
      material = standard
      this.mats.set(key, material)
    }
    return material
  }

  /** ひるの えがきかた（0）から よるの えがきかた（1）へ。 */
  setNight(amount: number): void {
    const day = new THREE.Color()
    const night = new THREE.Color()
    for (const { material, spec } of this.glows) {
      material.color.copy(day.set(spec.day).lerp(night.set(spec.night), amount))
      material.emissiveIntensity = spec.dayGlow + (spec.nightGlow - spec.dayGlow) * amount
    }
  }

  resolve(material: Mat): THREE.Material {
    return typeof material === 'string' ? this.mat(material) : material
  }

  /** この どうぐの そとで つくって、いっしょに すてて ほしい もの。 */
  own<T extends { dispose(): void }>(item: T): T {
    this.owned.push(item)
    return item
  }

  // ---------------- かたち（どれも そこが y=0） ----------------

  private geo(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
    let geometry = this.geos.get(key)
    if (!geometry) {
      geometry = normalize(make())
      this.geos.set(key, geometry)
    }
    return geometry
  }

  box(): THREE.BufferGeometry {
    return this.geo('box', () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0))
  }

  /** はんけい 1・たかさ 1 の つつ。top は うえの はんけいの わりあい。 */
  cyl(segments = 12, top = 1): THREE.BufferGeometry {
    return this.geo(`cyl${segments}/${top.toFixed(3)}`, () => new THREE.CylinderGeometry(top, 1, 1, segments).translate(0, 0.5, 0))
  }

  cone(segments = 12): THREE.BufferGeometry {
    return this.geo(`cone${segments}`, () => new THREE.ConeGeometry(1, 1, segments).translate(0, 0.5, 0))
  }

  /** そこが 1×1 の しかくい ピラミッド。 */
  pyramid(): THREE.BufferGeometry {
    return this.geo('pyramid', () => new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0))
  }

  /** まんなかが 0 の たま。 */
  ball(detail = 0): THREE.BufferGeometry {
    return this.geo(`ball${detail}`, () => new THREE.IcosahedronGeometry(1, detail))
  }

  /** ねかせた わ（かんらんしゃの わ など）。まんなかが 0、z じくの まわり。 */
  torus(radius: number, tube: number): THREE.BufferGeometry {
    return this.geo(`torus${radius}/${tube}`, () => new THREE.TorusGeometry(radius, tube, 6, 32))
  }

  gable(): THREE.BufferGeometry {
    return this.geo('gable', gableGeometry)
  }

  arc(cx: number, cz: number, inner: number, outer: number, a0: number, a1: number, y0: number, y1: number): THREE.BufferGeometry {
    const key = ['arc', cx, cz, inner, outer, a0, a1, y0, y1].map((value) => (typeof value === 'number' ? value.toFixed(3) : value)).join('/')
    return this.geo(key, () => arcGeometry(cx, cz, inner, outer, a0, a1, y0, y1))
  }

  // ---------------- おく ----------------

  /** うごかない ものとして おく（あとで まとめる）。 */
  place(geometry: THREE.BufferGeometry, material: Mat, matrix: THREE.Matrix4, cast = true): void {
    const resolved = this.resolve(material)
    const key = `${resolved.uuid}|${cast}`
    let batch = this.batches.get(key)
    if (!batch) {
      batch = { material: resolved, cast, parts: [] }
      this.batches.set(key, batch)
    }
    batch.parts.push({ geometry, matrix })
  }

  /** うごく もの。かたちと ざいりょうは つかいまわす。 */
  mesh(geometry: THREE.BufferGeometry, material: Mat, at: V3 = ZERO, scale: V3 = ONE, rot: V3 = ZERO, cast = true): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, this.resolve(material))
    mesh.position.set(at[0], at[1], at[2])
    mesh.rotation.set(rot[0], rot[1], rot[2])
    mesh.scale.set(scale[0], scale[1], scale[2])
    mesh.castShadow = cast
    mesh.receiveShadow = true
    return mesh
  }

  /** おいた ものを ざいりょうごとに 1つの Mesh に まとめる。 */
  merge(): THREE.Mesh[] {
    const meshes: THREE.Mesh[] = []
    for (const batch of this.batches.values()) {
      const parts = batch.parts.map(({ geometry, matrix }) => geometry.clone().applyMatrix4(matrix))
      const merged = mergeGeometries(parts, false)
      parts.forEach((part) => part.dispose())
      if (!merged) continue
      merged.computeBoundingSphere()
      this.owned.push(merged)
      const mesh = new THREE.Mesh(merged, batch.material)
      mesh.castShadow = batch.cast
      mesh.receiveShadow = true
      mesh.matrixAutoUpdate = false
      meshes.push(mesh)
    }
    this.batches.clear()
    return meshes
  }

  dispose(): void {
    this.geos.forEach((geometry) => geometry.dispose())
    this.mats.forEach((material) => material.dispose())
    this.owned.forEach((item) => item.dispose())
    this.geos.clear()
    this.mats.clear()
    this.owned.length = 0
    this.glows.length = 0
    this.batches.clear()
  }
}

/**
 * ひとつの マスの なかに おく ための わく。base は マスの まんなか・むきを あらわし、
 * at の y は そこの たかさ。しょうめんは ローカルの +z。
 */
export class Frame {
  constructor(readonly kit: TownKit, readonly base: THREE.Matrix4, private readonly cast = true) {}

  put(geometry: THREE.BufferGeometry, material: Mat, at: V3, scale: V3, rot: V3 = ZERO): void {
    this.kit.place(geometry, material, this.base.clone().multiply(matrixOf(at, rot, scale)), this.cast)
  }

  box(material: Mat, size: V3, at: V3, rot?: V3): void {
    this.put(this.kit.box(), material, at, size, rot)
  }

  cyl(material: Mat, radius: number, height: number, at: V3, segments = 12, topRatio = 1, rot?: V3): void {
    this.put(this.kit.cyl(segments, topRatio), material, at, [radius, height, radius], rot)
  }

  cone(material: Mat, radius: number, height: number, at: V3, segments = 12, rot?: V3): void {
    this.put(this.kit.cone(segments), material, at, [radius, height, radius], rot)
  }

  pyramid(material: Mat, size: V3, at: V3, rot?: V3): void {
    this.put(this.kit.pyramid(), material, at, size, rot)
  }

  gable(material: Mat, size: V3, at: V3, rot?: V3): void {
    this.put(this.kit.gable(), material, at, size, rot)
  }

  ball(material: Mat, radius: number, at: V3, detail = 0, squash = 1): void {
    this.put(this.kit.ball(detail), material, at, [radius, radius * squash, radius])
  }

  /** このマスの なかで うごく もの を いれる はこ（じぶんで せかいに たす）。 */
  group(at: V3 = ZERO, rot: V3 = ZERO): THREE.Group {
    const group = new THREE.Group()
    group.matrixAutoUpdate = true
    this.base.clone().multiply(matrixOf(at, rot)).decompose(group.position, group.quaternion, group.scale)
    return group
  }
}
