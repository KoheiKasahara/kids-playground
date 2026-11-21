// 動物園の地面・柵・木・岩・池・看板を、手続き的なローポリ形状で作る。
// 静的な物は頂点カラーで色付けして1つのメッシュへまとめ、描画呼び出しを減らす（iPhone の負荷対策）。

import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { SPECIES, type SpeciesId } from './species'
import { ZOO_MAP, type Enclosure, type Rock, type Tree, type ZooMap } from './zooMap'

export type Scenery = {
  group: THREE.Group
  /** カメラがめり込まないように避ける、木の葉の球。 */
  canopies: THREE.Sphere[]
  update: (time: number) => void
  dispose: () => void
}

const color = new THREE.Color()

/** 頂点カラー付きの非インデックス形状を集め、最後に1つへまとめる。 */
class Batch {
  private parts: THREE.BufferGeometry[] = []

  add(geometry: THREE.BufferGeometry, hex: string | THREE.Color, matrix: THREE.Matrix4, jitter = 0, seed = 0): void {
    const g = (geometry.index ? geometry.toNonIndexed() : geometry.clone()).applyMatrix4(matrix)
    g.deleteAttribute('uv')
    g.computeVertexNormals()
    const n = g.attributes.position.count
    const colors = new Float32Array(n * 3)
    const base = typeof hex === 'string' ? new THREE.Color(hex) : hex
    for (let tri = 0; tri < n / 3; tri++) {
      // 面ごとに明るさを少し変え、ローポリの面を読みやすくする
      const k = 1 + jitter * (hash(seed * 131 + tri) - 0.5)
      color.copy(base).multiplyScalar(k)
      for (let v = 0; v < 3; v++) colors.set([color.r, color.g, color.b], (tri * 3 + v) * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    this.parts.push(g)
    geometry.dispose()
  }

  build(material: THREE.Material): THREE.Mesh | undefined {
    if (this.parts.length === 0) return undefined
    const merged = mergeGeometries(this.parts, false)
    for (const p of this.parts) p.dispose()
    this.parts = []
    return new THREE.Mesh(merged, material)
  }
}

function hash(n: number): number {
  const s = Math.sin(n * 12.9898) * 43758.5453
  return s - Math.floor(s)
}

const m4 = (x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0, rz = 0) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz))

// ---------------------------------------------------------------------------

function groundGeometry(map: ZooMap): THREE.BufferGeometry {
  const size = map.radius * 2 + 16
  const seg = 72
  const g = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2).toNonIndexed()
  const pos = g.attributes.position as THREE.BufferAttribute
  const colors = new Float32Array(pos.count * 3)
  const grass = new THREE.Color('#9fd06a')
  const grassDark = new THREE.Color('#86bd5a')
  const sand = new THREE.Color('#efdcab')
  const edge = new THREE.Color('#7fae58')
  const tmp = new THREE.Color()
  const gates = map.enclosures.map(e => ({
    x: e.center.x + Math.sin(e.gate) * e.radius, z: e.center.z + Math.cos(e.gate) * e.radius,
  }))
  const pathDist = (x: number, z: number) => Math.min(...gates.map(g => segDist(x, z, map.plaza.x, map.plaza.z, g.x, g.z)))
  for (let tri = 0; tri < pos.count / 3; tri++) {
    let cx = 0
    let cz = 0
    for (let v = 0; v < 3; v++) {
      cx += pos.getX(tri * 3 + v) / 3
      cz += pos.getZ(tri * 3 + v) / 3
    }
    const r = Math.hypot(cx, cz)
    tmp.copy(grass).lerp(grassDark, hash(tri * 7.13) * 0.6)
    const enc = map.enclosures.find(e => Math.hypot(cx - e.center.x, cz - e.center.z) < e.radius)
    if (enc) tmp.lerp(new THREE.Color(enc.ground), 0.75).multiplyScalar(0.96 + hash(tri) * 0.08)
    const onPath = Math.hypot(cx - map.plaza.x, cz - map.plaza.z) < map.plaza.r || (!enc && pathDist(cx, cz) < 1.15)
    if (onPath) tmp.copy(sand).multiplyScalar(0.97 + hash(tri * 3.1) * 0.06)
    if (r > map.radius) tmp.lerp(edge, Math.min(1, (r - map.radius) / 6))
    for (let v = 0; v < 3; v++) colors.set([tmp.r, tmp.g, tmp.b], (tri * 3 + v) * 3)
  }
  // 園の外だけ少し起伏を付ける（動物の足元は平らのまま）
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const r = Math.hypot(x, z)
    if (r > map.radius + 1) pos.setY(i, (r - map.radius - 1) * 0.12 + (hash(Math.round(x * 3) * 977 + Math.round(z * 3)) - 0.5) * 0.25)
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  g.deleteAttribute('uv')
  g.computeVertexNormals()
  return g
}

function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax
  const dz = bz - az
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)))
  return Math.hypot(px - ax - dx * t, pz - az - dz * t)
}

function addFence(batch: Batch, e: Enclosure): void {
  const posts = Math.round((Math.PI * 2 * e.radius) / 1.15)
  const gateHalf = 1.25 / e.radius
  const angle = (i: number) => (i / posts) * Math.PI * 2
  const inGate = (a: number) => Math.abs(Math.atan2(Math.sin(a - e.gate), Math.cos(a - e.gate))) < gateHalf
  const post = (a: number, h: number, w: number) => {
    const x = e.center.x + Math.sin(a) * e.radius
    const z = e.center.z + Math.cos(a) * e.radius
    batch.add(new THREE.CylinderGeometry(w, w * 1.1, h, 6), e.fence, m4(x, h / 2, z), 0.12, Math.round(a * 100))
    batch.add(new THREE.ConeGeometry(w * 1.25, w * 1.6, 6), e.fence, m4(x, h + w * 0.8, z), 0.12)
  }
  for (let i = 0; i < posts; i++) {
    const a0 = angle(i)
    const a1 = angle(i + 1)
    if (inGate(a0) || inGate(a1)) continue
    post(a0, 0.95, 0.09)
    const x0 = e.center.x + Math.sin(a0) * e.radius
    const z0 = e.center.z + Math.cos(a0) * e.radius
    const x1 = e.center.x + Math.sin(a1) * e.radius
    const z1 = e.center.z + Math.cos(a1) * e.radius
    const len = Math.hypot(x1 - x0, z1 - z0)
    const yaw = Math.atan2(x1 - x0, z1 - z0)
    for (const y of [0.42, 0.78]) {
      batch.add(new THREE.BoxGeometry(0.07, 0.09, len), e.fence, m4((x0 + x1) / 2, y, (z0 + z1) / 2, 1, 1, 1, yaw), 0.1)
    }
  }
  // 入口の大きな柱
  for (const s of [-1, 1]) post(e.gate + s * gateHalf, 1.35, 0.14)
}

function addTree(batch: Batch, t: Tree, canopies: THREE.Sphere[], seed: number): void {
  const s = t.size
  const trunk = '#9a6a43'
  if (t.kind === 'round') {
    batch.add(new THREE.CylinderGeometry(0.16 * s, 0.24 * s, 1.6 * s, 7), trunk, m4(t.x, 0.8 * s, t.z), 0.15, seed)
    const leaves = ['#5fae4e', '#6fbf55', '#57a347']
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1 + seed
      const r = (0.95 - i * 0.12) * s
      const p = new THREE.Vector3(t.x + Math.sin(a) * 0.35 * s, (2.05 + i * 0.32) * s, t.z + Math.cos(a) * 0.35 * s)
      batch.add(new THREE.IcosahedronGeometry(r, 1), leaves[i], m4(p.x, p.y, p.z, 1, 0.9, 1, a), 0.18, seed + i)
    }
    canopies.push(new THREE.Sphere(new THREE.Vector3(t.x, 2.3 * s, t.z), 1.4 * s))
  } else if (t.kind === 'acacia') {
    // キリンの木: 高い幹と平たい傘
    batch.add(new THREE.CylinderGeometry(0.13 * s, 0.22 * s, 3.4 * s, 7), trunk, m4(t.x, 1.7 * s, t.z), 0.15, seed)
    for (const [dx, dz, rot] of [[0.5, 0.2, 0.5], [-0.45, -0.25, -0.6]]) {
      batch.add(new THREE.CylinderGeometry(0.07 * s, 0.1 * s, 1.1 * s, 6), trunk,
        m4(t.x + dx * 0.5 * s, 3.4 * s, t.z + dz * 0.5 * s, 1, 1, 1, 0, rot * 0.6, rot), 0.15)
    }
    batch.add(new THREE.IcosahedronGeometry(1.5 * s, 1), '#6aa84f', m4(t.x, 3.95 * s, t.z, 1.25, 0.32, 1.1, seed), 0.2, seed)
    batch.add(new THREE.IcosahedronGeometry(1.0 * s, 1), '#79b85a', m4(t.x + 0.5 * s, 4.25 * s, t.z - 0.3 * s, 1.2, 0.35, 1), 0.2)
    canopies.push(new THREE.Sphere(new THREE.Vector3(t.x, 4.0 * s, t.z), 1.9 * s))
  } else if (t.kind === 'palm') {
    for (let i = 0; i < 5; i++) {
      const y = (0.35 + i * 0.62) * s
      batch.add(new THREE.CylinderGeometry(0.15 * s, 0.19 * s, 0.62 * s, 7), i % 2 ? '#b0855a' : trunk,
        m4(t.x + i * 0.06 * s, y, t.z, 1, 1, 1, 0, 0, -0.05 * i), 0.1)
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + seed
      batch.add(new THREE.ConeGeometry(0.32 * s, 1.6 * s, 4), '#58a84a',
        m4(t.x + 0.3 * s + Math.sin(a) * 0.65 * s, 3.2 * s, t.z + Math.cos(a) * 0.65 * s, 1, 1, 0.35, a, Math.PI / 2 - 0.5), 0.2, i)
    }
    canopies.push(new THREE.Sphere(new THREE.Vector3(t.x, 3.2 * s, t.z), 1.4 * s))
  } else {
    const greens = ['#6cbf55', '#5aae4a', '#79c860']
    for (let i = 0; i < 4; i++) {
      const a = i * 1.7 + seed
      batch.add(new THREE.IcosahedronGeometry((0.55 - i * 0.05) * s, 1), greens[i % 3],
        m4(t.x + Math.sin(a) * 0.45 * s, (0.45 + (i % 2) * 0.2) * s, t.z + Math.cos(a) * 0.45 * s, 1, 0.85, 1, a), 0.2, i)
    }
    // 花のアクセント
    for (let i = 0; i < 3; i++) {
      const a = i * 2.2 + seed
      batch.add(new THREE.IcosahedronGeometry(0.09 * s, 0), ['#ff8fb1', '#ffd66b', '#ffffff'][i],
        m4(t.x + Math.sin(a) * 0.62 * s, 0.75 * s, t.z + Math.cos(a) * 0.62 * s), 0.05)
    }
  }
}

function addRock(batch: Batch, r: Rock, seed: number): void {
  batch.add(new THREE.DodecahedronGeometry(r.r, 0), '#b7aa98', m4(r.x, r.h * 0.4, r.z, 1, r.h / r.r, 0.9, seed), 0.22, seed)
  batch.add(new THREE.DodecahedronGeometry(r.r * 0.5, 0), '#c8bca9',
    m4(r.x + r.r * 0.7, r.h * 0.2, r.z + r.r * 0.3, 1, 0.8, 1, seed * 2), 0.22, seed + 1)
}

function addPondRim(batch: Batch, e: Enclosure): void {
  const pond = e.pond
  if (!pond) return
  const stones = Math.round(pond.r * 6)
  for (let i = 0; i < stones; i++) {
    const a = (i / stones) * Math.PI * 2
    batch.add(new THREE.DodecahedronGeometry(0.22 + hash(i) * 0.1, 0), i % 2 ? '#d9cfbf' : '#c9bda8',
      m4(pond.x + Math.sin(a) * (pond.r + 0.05), 0.06, pond.z + Math.cos(a) * (pond.r + 0.05), 1, 0.45, 1, a), 0.15, i)
  }
}

function signTexture(species: SpeciesId): THREE.CanvasTexture | undefined {
  if (typeof document === 'undefined') return undefined
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (!ctx) return undefined
  const s = (SPECIES as Partial<Record<string, (typeof SPECIES)[SpeciesId]>>)[species]
  if (!s) return undefined
  ctx.fillStyle = '#fff8e6'
  ctx.fillRect(0, 0, 256, 128)
  ctx.strokeStyle = '#a8764a'
  ctx.lineWidth = 10
  ctx.strokeRect(5, 5, 246, 118)
  ctx.font = '64px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(s.emoji, 64, 68)
  ctx.fillStyle = '#5a3d22'
  ctx.font = 'bold 44px sans-serif'
  ctx.fillText(s.name, 168, 68)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export function createScenery(map: ZooMap = ZOO_MAP): Scenery {
  const group = new THREE.Group()
  group.name = 'zoo-scenery'
  const disposables: { dispose: () => void }[] = []
  const canopies: THREE.Sphere[] = []

  const groundMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 })
  const ground = new THREE.Mesh(groundGeometry(map), groundMaterial)
  ground.receiveShadow = true
  ground.name = 'zoo-ground'
  group.add(ground)
  disposables.push(ground.geometry, groundMaterial)

  const props = new Batch()
  let seed = 1
  for (const e of map.enclosures) {
    addFence(props, e)
    e.trees.forEach(t => addTree(props, t, canopies, seed++))
    e.rocks.forEach(r => addRock(props, r, seed++))
    addPondRim(props, e)
    // 入口の看板の柱
    const gx = e.center.x + Math.sin(e.gate) * (e.radius + 0.9)
    const gz = e.center.z + Math.cos(e.gate) * (e.radius + 0.9)
    props.add(new THREE.CylinderGeometry(0.07, 0.07, 1.6, 6), '#8b5e3c', m4(gx, 0.8, gz), 0.1)
  }
  map.outerTrees.forEach(t => addTree(props, t, canopies, seed++))
  // 広場のベンチと花壇
  for (let i = 0; i < 3; i++) {
    const a = i * (Math.PI * 2 / 3) + Math.PI / 3
    const x = map.plaza.x + Math.sin(a) * (map.plaza.r - 0.6)
    const z = map.plaza.z + Math.cos(a) * (map.plaza.r - 0.6)
    props.add(new THREE.BoxGeometry(1.4, 0.1, 0.45), '#c98b54', m4(x, 0.45, z, 1, 1, 1, a + Math.PI / 2), 0.1)
    for (const s of [-0.55, 0.55]) {
      props.add(new THREE.BoxGeometry(0.1, 0.45, 0.4), '#8b5e3c',
        m4(x + Math.cos(a) * s, 0.22, z - Math.sin(a) * s, 1, 1, 1, a + Math.PI / 2), 0.1)
    }
  }
  props.add(new THREE.CylinderGeometry(1.1, 1.2, 0.35, 10), '#c7a77c', m4(map.plaza.x, 0.17, map.plaza.z), 0.1)
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2
    props.add(new THREE.IcosahedronGeometry(0.2, 0), ['#ff7aa2', '#ffd04f', '#ffffff', '#ff9d5c'][i % 4],
      m4(map.plaza.x + Math.sin(a) * 0.7, 0.45, map.plaza.z + Math.cos(a) * 0.7), 0.1)
  }
  props.add(new THREE.IcosahedronGeometry(0.45, 1), '#5aae4a', m4(map.plaza.x, 0.6, map.plaza.z, 1, 0.8, 1), 0.2)

  const propMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92 })
  const propsMesh = props.build(propMaterial)
  if (propsMesh) {
    propsMesh.castShadow = true
    propsMesh.receiveShadow = true
    propsMesh.name = 'zoo-props'
    group.add(propsMesh)
    disposables.push(propsMesh.geometry, propMaterial)
  }

  // 池: 水面と、ゆっくり広がる波紋
  const waterMaterial = new THREE.MeshStandardMaterial({ color: '#69c3ea', roughness: 0.15, metalness: 0.05 })
  const rippleMaterial = new THREE.MeshBasicMaterial({ color: '#e9fbff', transparent: true, opacity: 0.5, depthWrite: false })
  const ripples: THREE.Mesh[] = []
  disposables.push(waterMaterial, rippleMaterial)
  for (const e of map.enclosures) {
    if (!e.pond) continue
    const water = new THREE.Mesh(new THREE.CircleGeometry(e.pond.r, 36).rotateX(-Math.PI / 2), waterMaterial)
    water.position.set(e.pond.x, 0.035, e.pond.z)
    water.receiveShadow = true
    water.name = 'zoo-pond'
    group.add(water)
    disposables.push(water.geometry)
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 32).rotateX(-Math.PI / 2), rippleMaterial.clone())
      ring.position.set(e.pond.x + (i - 1) * 0.6, 0.045, e.pond.z + (i % 2 ? 0.5 : -0.4))
      ring.userData.phase = i / 3
      ring.userData.maxScale = e.pond.r * 0.55
      ripples.push(ring)
      group.add(ring)
      disposables.push(ring.geometry, ring.material as THREE.Material)
    }
  }

  // 入口の看板
  for (const e of map.enclosures) {
    const texture = signTexture(e.id as SpeciesId)
    if (!texture) continue
    const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8 })
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.75, 0.08), [
      ...Array(4).fill(new THREE.MeshStandardMaterial({ color: '#a8764a' })), material, material,
    ])
    const gx = e.center.x + Math.sin(e.gate) * (e.radius + 0.9)
    const gz = e.center.z + Math.cos(e.gate) * (e.radius + 0.9)
    board.position.set(gx, 1.75, gz)
    board.rotation.y = e.gate
    board.castShadow = true
    board.name = `zoo-sign-${e.id}`
    group.add(board)
    disposables.push(board.geometry, texture, material, (board.material as THREE.Material[])[0])
  }

  return {
    group,
    canopies,
    update(time: number) {
      for (const ring of ripples) {
        const k = (time * 0.25 + (ring.userData.phase as number)) % 1
        const s = 0.2 + k * (ring.userData.maxScale as number)
        ring.scale.set(s, 1, s)
        ;(ring.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - k)
      }
    },
    dispose() {
      for (const d of disposables) d.dispose()
    },
  }
}
