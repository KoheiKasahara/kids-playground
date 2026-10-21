// 3Dの おうちを くみたてる どうぐ。おなじ いろの ざいりょう・おなじ かたちは つかいまわし、
// さいごに まとめて すてられる ように する。

import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

export type V3 = readonly [number, number, number]

export type MatOptions = {
  rough?: number
  metal?: number
  emissive?: string
  glow?: number
  opacity?: number
  map?: THREE.Texture | null
  /** ひかりで いろが かわらない（まどの そとの けしき など）。 */
  flat?: boolean
  side?: THREE.Side
}

export type PartOptions = {
  rot?: V3
  scale?: V3
  /** かげを おとさない ちいさな もの。 */
  noShadow?: boolean
}

/** うごく かざり。time は ミリ秒。 */
export type Tick = (time: number) => void

/** カメラに ちかい がわを さげて みせる かべ（なかを みる とき）。normal は そとむき。 */
export type Cutaway = { normal: THREE.Vector3; full: THREE.Object3D; low: THREE.Object3D }

/** くみたてた もの。target と radius で カメラの みる ところ と きょりを きめる。 */
export type Built = {
  root: THREE.Group
  /** はじめに みる むき（なければ ふつうの むき）。 */
  yaw?: number
  target: THREE.Vector3
  radius: number
  cutaways: Cutaway[]
  ticks: Tick[]
  dispose: () => void
}

export class Kit {
  private mats = new Map<string, THREE.Material>()
  private geos = new Map<string, THREE.BufferGeometry>()
  private texs = new Map<string, THREE.Texture | null>()

  /** え（テクスチャ）。repeat を わたすと くりかえす かずだけ かえた コピーを かえす。 */
  tex(key: string, make: () => THREE.Texture | null, repeat?: readonly [number, number]): THREE.Texture | null {
    if (!this.texs.has(key)) this.texs.set(key, make())
    const base = this.texs.get(key) ?? null
    if (!base || !repeat) return base
    const rk = `${key}@${repeat[0].toFixed(2)}x${repeat[1].toFixed(2)}`
    if (!this.texs.has(rk)) {
      const copy = base.clone()
      copy.repeat.set(repeat[0], repeat[1])
      copy.needsUpdate = true
      this.texs.set(rk, copy)
    }
    return this.texs.get(rk) ?? null
  }

  /** この どうぐで つくった ものを ぜんぶ すてる。 */
  dispose(): void {
    this.geos.forEach((g) => g.dispose())
    this.mats.forEach((m) => m.dispose())
    this.texs.forEach((t) => t?.dispose())
    this.geos.clear()
    this.mats.clear()
    this.texs.clear()
  }

  mat(color: string, o: MatOptions = {}): THREE.Material {
    const key = [color, o.rough, o.metal, o.emissive, o.glow, o.opacity, o.map?.uuid, o.flat, o.side].join('|')
    let mat = this.mats.get(key)
    if (!mat) {
      const transparent = o.opacity !== undefined && o.opacity < 1
      mat = o.flat
        ? new THREE.MeshBasicMaterial({ color, map: o.map ?? null, transparent, opacity: o.opacity ?? 1, side: o.side ?? THREE.FrontSide })
        : new THREE.MeshStandardMaterial({
          color,
          roughness: o.rough ?? .78,
          metalness: o.metal ?? 0,
          emissive: o.emissive ?? '#000000',
          emissiveIntensity: o.glow ?? 1,
          map: o.map ?? null,
          transparent,
          opacity: o.opacity ?? 1,
          depthWrite: !transparent,
          side: o.side ?? THREE.FrontSide,
        })
      this.mats.set(key, mat)
    }
    return mat
  }

  private geo(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
    let geo = this.geos.get(key)
    if (!geo) {
      geo = make()
      this.geos.set(key, geo)
    }
    return geo
  }

  box(w: number, h: number, d: number, round = 0): THREE.BufferGeometry {
    const r = Math.min(round, w / 2, h / 2, d / 2)
    const k = (n: number) => n.toFixed(3)
    return r > .001
      ? this.geo(`rb${k(w)}/${k(h)}/${k(d)}/${k(r)}`, () => new RoundedBoxGeometry(w, h, d, 2, r))
      : this.geo(`b${k(w)}/${k(h)}/${k(d)}`, () => new THREE.BoxGeometry(w, h, d))
  }

  cyl(rTop: number, rBottom: number, h: number, seg = 20, open = false, arc = Math.PI * 2): THREE.BufferGeometry {
    const k = (n: number) => n.toFixed(3)
    return this.geo(`c${k(rTop)}/${k(rBottom)}/${k(h)}/${seg}/${open}/${k(arc)}`, () => new THREE.CylinderGeometry(rTop, rBottom, h, seg, 1, open, 0, arc))
  }

  sphere(r: number, seg = 16): THREE.BufferGeometry {
    return this.geo(`s${r.toFixed(3)}/${seg}`, () => new THREE.SphereGeometry(r, seg, Math.max(6, Math.round(seg * .7))))
  }

  torus(r: number, tube: number, arc = Math.PI * 2, seg = 24): THREE.BufferGeometry {
    return this.geo(`t${r.toFixed(3)}/${tube.toFixed(3)}/${arc.toFixed(3)}/${seg}`, () => new THREE.TorusGeometry(r, tube, 8, seg, arc))
  }

  circle(r: number, seg = 28): THREE.BufferGeometry {
    return this.geo(`ci${r.toFixed(3)}/${seg}`, () => new THREE.CircleGeometry(r, seg))
  }

  plane(w: number, h: number): THREE.BufferGeometry {
    return this.geo(`p${w.toFixed(3)}/${h.toFixed(3)}`, () => new THREE.PlaneGeometry(w, h))
  }

  rock(r: number): THREE.BufferGeometry {
    return this.geo(`r${r.toFixed(3)}`, () => new THREE.DodecahedronGeometry(r, 0))
  }

  /** なまえを つけて つかいまわす とくべつな かたち。 */
  custom(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
    return this.geo(`x${key}`, make)
  }

  /** うえはんぶんの まる（XY めん）。 */
  half(r: number, seg = 24): THREE.BufferGeometry {
    return this.geo(`h${r.toFixed(3)}/${seg}`, () => new THREE.CircleGeometry(r, seg, 0, Math.PI))
  }
}

const asMat = (k: Kit, look: string | THREE.Material) => (typeof look === 'string' ? k.mat(look) : look)

export function mesh(k: Kit, geo: THREE.BufferGeometry, look: string | THREE.Material, at: V3, o: PartOptions = {}): THREE.Mesh {
  const m = new THREE.Mesh(geo, asMat(k, look))
  m.position.set(at[0], at[1], at[2])
  if (o.rot) m.rotation.set(o.rot[0], o.rot[1], o.rot[2])
  if (o.scale) m.scale.set(o.scale[0], o.scale[1], o.scale[2])
  m.castShadow = !o.noShadow
  m.receiveShadow = true
  return m
}

/** そこが y に くる はこ。 */
export function block(k: Kit, parent: THREE.Object3D, size: V3, look: string | THREE.Material, at: V3, o: PartOptions & { round?: number } = {}): THREE.Mesh {
  const m = mesh(k, k.box(size[0], size[1], size[2], o.round ?? 0), look, [at[0], at[1] + size[1] / 2, at[2]], o)
  parent.add(m)
  return m
}

/** そこが y に くる つつ。 */
export function tube(k: Kit, parent: THREE.Object3D, r: number, h: number, look: string | THREE.Material, at: V3, o: PartOptions & { top?: number; seg?: number } = {}): THREE.Mesh {
  const m = mesh(k, k.cyl(o.top ?? r, r, h, o.seg ?? 20), look, [at[0], at[1] + h / 2, at[2]], o)
  parent.add(m)
  return m
}

/** まんなかが at に くる たま。 */
export function ball(k: Kit, parent: THREE.Object3D, r: number, look: string | THREE.Material, at: V3, o: PartOptions & { seg?: number } = {}): THREE.Mesh {
  const m = mesh(k, k.sphere(r, o.seg ?? 16), look, at, o)
  parent.add(m)
  return m
}

export function group(parent: THREE.Object3D, at: V3 = [0, 0, 0], rotY = 0): THREE.Group {
  const g = new THREE.Group()
  g.position.set(at[0], at[1], at[2])
  g.rotation.y = rotY
  parent.add(g)
  return g
}

/** ふたつの いろを まぜる（t=0 で a、t=1 で b）。 */
export function mix(a: string, b: string, t: number): string {
  return `#${new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString()}`
}

/** つかった かたち・ざいりょう・え を ぜんぶ すてる。おなじ ものは いちどだけ。 */
export function disposeObject(root: THREE.Object3D): void {
  const geos = new Set<THREE.BufferGeometry>()
  const mats = new Set<THREE.Material>()
  const maps = new Set<THREE.Texture>()
  root.traverse((obj) => {
    const m = obj as THREE.Mesh
    if (m.geometry) geos.add(m.geometry)
    const list = Array.isArray(m.material) ? m.material : m.material ? [m.material] : []
    for (const mat of list) {
      mats.add(mat)
      const map = (mat as THREE.MeshStandardMaterial).map
      if (map) maps.add(map)
    }
    if (obj instanceof THREE.InstancedMesh) obj.dispose()
  })
  geos.forEach((g) => g.dispose())
  mats.forEach((m) => m.dispose())
  maps.forEach((t) => t.dispose())
}
