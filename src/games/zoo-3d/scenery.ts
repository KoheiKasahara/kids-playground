// エリアの地面・柵・獣舎・木・岩・池・看板・出入口の門を、手続き的なローポリ形状で作る。
// iPhone の負荷を抑えるため、描画呼び出しを少なくする:
// - 動かない物は頂点カラーで色付けして1つのメッシュへまとめる（ガラスだけは透明な別メッシュ）。
// - 池と堀の水面は1つのメッシュ、波紋は1つの InstancedMesh、看板は1枚のテクスチャ（アトラス）にまとめる。

import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { SPECIES } from './species'
import { GATE_HALF } from './walk'
import {
  areaById, barrierInset, onPath, roamRadius, signPosition,
  type Area, type Enclosure, type House, type Rock, type Tree,
} from './zooMap'

export type Scenery = {
  group: THREE.Group
  /** カメラがめり込まないように避ける、木の葉・看板の球。 */
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

  get size(): number {
    return this.parts.length
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

/** 展示場の円周上の点。 */
function rim(e: Enclosure, angle: number, dist = e.radius): [number, number] {
  return [e.center.x + Math.sin(angle) * dist, e.center.z + Math.cos(angle) * dist]
}

function angleGap(a: number, b: number): number {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))
}

// ---------------------------------------------------------------------------
// 地面

function groundGeometry(area: Area): THREE.BufferGeometry {
  const size = area.radius * 2 + 28
  const seg = Math.round(size / 0.85)
  const g = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2).toNonIndexed()
  const pos = g.attributes.position as THREE.BufferAttribute
  const colors = new Float32Array(pos.count * 3)
  const grass = new THREE.Color(area.grass)
  const grassDark = grass.clone().multiplyScalar(0.86)
  const sand = new THREE.Color('#efdcab')
  const ditch = new THREE.Color('#8d7a5c')
  const edge = new THREE.Color(area.grass).multiplyScalar(0.78)
  const tmp = new THREE.Color()
  for (let tri = 0; tri < pos.count / 3; tri++) {
    let cx = 0
    let cz = 0
    for (let v = 0; v < 3; v++) {
      cx += pos.getX(tri * 3 + v) / 3
      cz += pos.getZ(tri * 3 + v) / 3
    }
    const r = Math.hypot(cx, cz)
    tmp.copy(grass).lerp(grassDark, hash(tri * 7.13) * 0.7)
    const p = { x: cx, z: cz }
    const enc = area.enclosures.find(e => Math.hypot(cx - e.center.x, cz - e.center.z) < e.radius)
    if (enc) {
      const d = Math.hypot(cx - enc.center.x, cz - enc.center.z)
      if (d > roamRadius(enc)) tmp.copy(ditch).multiplyScalar(0.94 + hash(tri) * 0.1)
      else tmp.lerp(new THREE.Color(enc.ground), 0.78).multiplyScalar(0.96 + hash(tri) * 0.08)
    } else if (onPath(area, p)) {
      tmp.copy(sand).multiplyScalar(0.96 + hash(tri * 3.1) * 0.07)
    }
    if (r > area.radius) tmp.lerp(edge, Math.min(1, (r - area.radius) / 8))
    for (let v = 0; v < 3; v++) colors.set([tmp.r, tmp.g, tmp.b], (tri * 3 + v) * 3)
  }
  // エリアの外だけ丘のように持ち上げる（歩ける所と動物の足元は平らのまま）
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const r = Math.hypot(x, z)
    if (r > area.radius + 1.5) {
      const k = r - area.radius - 1.5
      pos.setY(i, k * 0.35 + (hash(Math.round(x * 2) * 977 + Math.round(z * 2)) - 0.5) * 0.3)
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  g.deleteAttribute('uv')
  g.computeVertexNormals()
  return g
}

// ---------------------------------------------------------------------------
// 柵（動物に合わせて種類を変える）

/** 柵を立てない角度（獣舎・ふれあい広場の入口・おりの のぞき窓）。 */
function skipAngles(e: Enclosure): { angle: number; half: number }[] {
  const list: { angle: number; half: number }[] = []
  if (e.house) list.push({ angle: e.house.angle, half: (e.house.width * 0.5) / e.radius })
  if (e.walkIn) list.push({ angle: e.front, half: GATE_HALF / e.radius })
  return list
}

function ringSegments(e: Enclosure, spacing: number, skip = skipAngles(e)): [number, number][] {
  const n = Math.max(8, Math.round((Math.PI * 2 * e.radius) / spacing))
  const out: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2
    const a1 = ((i + 1) / n) * Math.PI * 2
    if (skip.some(s => angleGap(a0, s.angle) < s.half || angleGap(a1, s.angle) < s.half)) continue
    out.push([a0, a1])
  }
  return out
}

function rail(batch: Batch, e: Enclosure, a0: number, a1: number, y: number, w: number, h: number, hex: string, dist = e.radius) {
  const [x0, z0] = rim(e, a0, dist)
  const [x1, z1] = rim(e, a1, dist)
  const len = Math.hypot(x1 - x0, z1 - z0)
  const yaw = Math.atan2(x1 - x0, z1 - z0)
  batch.add(new THREE.BoxGeometry(w, h, len + 0.02), hex, m4((x0 + x1) / 2, y, (z0 + z1) / 2, 1, 1, 1, yaw), 0.1)
}

function post(batch: Batch, x: number, z: number, h: number, w: number, hex: string, cap = true) {
  batch.add(new THREE.CylinderGeometry(w, w * 1.1, h, 6), hex, m4(x, h / 2, z), 0.12, Math.round(x * 37 + z * 11))
  if (cap) batch.add(new THREE.ConeGeometry(w * 1.25, w * 1.6, 6), hex, m4(x, h + w * 0.8, z), 0.12)
}

function addWoodFence(batch: Batch, e: Enclosure, low: boolean): void {
  const h = low ? 0.62 : 0.95
  for (const [a0, a1] of ringSegments(e, low ? 1.0 : 1.15)) {
    const [x, z] = rim(e, a0)
    post(batch, x, z, h, low ? 0.07 : 0.09, e.fence)
    for (const y of low ? [0.42] : [0.42, 0.78]) rail(batch, e, a0, a1, y, 0.07, 0.09, e.fence)
  }
  // 入口・獣舎の両側の柱
  for (const s of skipAngles(e)) {
    for (const side of [-1, 1]) {
      const [x, z] = rim(e, s.angle + side * s.half)
      post(batch, x, z, e.walkIn && s.angle === e.front ? 1.4 : h, 0.12, e.fence)
    }
  }
}

function addMoat(batch: Batch, e: Enclosure): void {
  // 見る側の低い石のかべ（堀は地面の色と水面で表す）
  const stone = '#c7bba6'
  for (const [a0, a1] of ringSegments(e, 1.1)) {
    rail(batch, e, a0, a1, 0.3, 0.34, 0.6, stone, e.radius - 0.05)
    rail(batch, e, a0, a1, 0.63, 0.42, 0.08, '#d8cdb9', e.radius - 0.05)
  }
  // 堀の内側のふち石
  const inner = roamRadius(e)
  const n = Math.round(inner * 5)
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    if (skipAngles(e).some(s => angleGap(a, s.angle) < s.half)) continue
    const [x, z] = rim(e, a, inner)
    batch.add(new THREE.DodecahedronGeometry(0.26 + hash(i * 3.7) * 0.1, 0), i % 2 ? '#b8a98f' : '#a9997e', m4(x, 0.08, z, 1, 0.5, 1, a), 0.15, i)
  }
}

function addGlass(batch: Batch, glass: Batch, e: Enclosure): void {
  const frame = '#5d6b78'
  const h = 1.35
  for (const [a0, a1] of ringSegments(e, 1.6)) {
    const [x, z] = rim(e, a0)
    post(batch, x, z, h + 0.05, 0.05, frame, false)
    rail(batch, e, a0, a1, h, 0.08, 0.06, frame)
    rail(batch, e, a0, a1, 0.08, 0.1, 0.16, frame)
    const [x0, z0] = rim(e, a0)
    const [x1, z1] = rim(e, a1)
    const len = Math.hypot(x1 - x0, z1 - z0)
    glass.add(new THREE.BoxGeometry(0.03, h - 0.12, len), '#d6f1ff', m4((x0 + x1) / 2, h / 2 + 0.04, (z0 + z1) / 2, 1, 1, 1, Math.atan2(x1 - x0, z1 - z0)))
  }
}

function addBars(batch: Batch, glass: Batch, e: Enclosure): void {
  const h = 2.5
  // 見る側には、もうじゅうを近くで見られる ガラスの のぞき窓を作る
  const view = { angle: e.front, half: 1.3 / e.radius }
  const skip = [...skipAngles(e), view]
  for (const [a0, a1] of ringSegments(e, 1.4, skip)) {
    const [x, z] = rim(e, a0)
    post(batch, x, z, h + 0.1, 0.06, e.fence, false)
    rail(batch, e, a0, a1, h, 0.06, 0.06, e.fence)
    rail(batch, e, a0, a1, 0.12, 0.06, 0.08, e.fence)
    // 上の返し（内側へ傾ける）
    rail(batch, e, a0, a1, h + 0.25, 0.05, 0.05, e.fence, e.radius - 0.35)
    const bars = 6
    for (let i = 1; i < bars; i++) {
      const [bx, bz] = rim(e, a0 + ((a1 - a0) * i) / bars)
      batch.add(new THREE.CylinderGeometry(0.018, 0.018, h, 4, 1, true), e.fence, m4(bx, h / 2, bz), 0.06)
    }
  }
  for (const side of [-1, 1]) {
    const [x, z] = rim(e, view.angle + side * view.half)
    post(batch, x, z, h + 0.1, 0.09, '#3f463c', false)
  }
  const [x0, z0] = rim(e, view.angle - view.half)
  const [x1, z1] = rim(e, view.angle + view.half)
  const len = Math.hypot(x1 - x0, z1 - z0)
  const yaw = Math.atan2(x1 - x0, z1 - z0)
  glass.add(new THREE.BoxGeometry(0.04, 2.0, len), '#d6f1ff', m4((x0 + x1) / 2, 1.05, (z0 + z1) / 2, 1, 1, 1, yaw))
  batch.add(new THREE.BoxGeometry(0.12, 0.12, len), '#3f463c', m4((x0 + x1) / 2, 2.1, (z0 + z1) / 2, 1, 1, 1, yaw), 0.05)
  batch.add(new THREE.BoxGeometry(0.14, 0.12, len), '#3f463c', m4((x0 + x1) / 2, 0.06, (z0 + z1) / 2, 1, 1, 1, yaw), 0.05)
}

function addRockWall(batch: Batch, e: Enclosure): void {
  const n = Math.round((Math.PI * 2 * e.radius) / 0.75)
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    if (skipAngles(e).some(s => angleGap(a, s.angle) < s.half)) continue
    const [x, z] = rim(e, a, e.radius - 0.15)
    const r = 0.42 + hash(i * 1.9) * 0.18
    batch.add(new THREE.DodecahedronGeometry(r, 0), i % 3 ? '#a89c8a' : '#9a8e7c', m4(x, 0.35 + hash(i) * 0.15, z, 1, 1.15, 1, a * 3), 0.2, i)
  }
}

function addBarrier(batch: Batch, glass: Batch, e: Enclosure): void {
  switch (e.barrier) {
    case 'wood':
      addWoodFence(batch, e, false)
      return
    case 'low':
      addWoodFence(batch, e, true)
      return
    case 'moat':
      addMoat(batch, e)
      return
    case 'glass':
      addGlass(batch, glass, e)
      return
    case 'bars':
      addBars(batch, glass, e)
      return
    case 'rock':
      addRockWall(batch, e)
  }
}

// ---------------------------------------------------------------------------
// 獣舎・木・岩・池のふち・広場

function addHouse(batch: Batch, e: Enclosure, h: House): void {
  const [x, z] = rim(e, h.angle, e.radius - 0.2)
  const yaw = h.angle
  const local = (dx: number, dz: number): [number, number] => [x + Math.sin(yaw) * dz + Math.cos(yaw) * dx, z + Math.cos(yaw) * dz - Math.sin(yaw) * dx]
  batch.add(new THREE.BoxGeometry(h.width, h.height, h.depth), h.wall, m4(x, h.height / 2, z, 1, 1, 1, yaw), 0.06, 7)
  // 切妻屋根: 三角柱を横にねかせる
  const roofH = Math.min(1.4, h.width * 0.32)
  const roof = new THREE.CylinderGeometry(1, 1, h.depth + 0.4, 3).rotateX(-Math.PI / 2).scale(h.width * 0.62, roofH * 0.9, 1)
  batch.add(roof, h.roof, m4(x, h.height + roofH * 0.42, z, 1, 1, 1, yaw), 0.08, 9)
  // 動物の出入り口（展示場の内側の面）
  const [dx, dz] = local(0, -h.depth / 2 - 0.01)
  const doorH = Math.min(h.height - 0.3, 2.4)
  batch.add(new THREE.BoxGeometry(Math.min(1.6, h.width * 0.45), doorH, 0.06), '#4a3426', m4(dx, doorH / 2, dz, 1, 1, 1, yaw), 0.05)
  // 窓（外側の面）
  for (const s of [-1, 1]) {
    const [wx, wz] = local(s * h.width * 0.25, h.depth / 2 + 0.01)
    batch.add(new THREE.BoxGeometry(0.6, 0.5, 0.05), '#8fc6e8', m4(wx, h.height * 0.62, wz, 1, 1, 1, yaw), 0.05)
  }
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
  } else if (t.kind === 'pine') {
    // 針葉樹: 円すいを3段重ねる
    batch.add(new THREE.CylinderGeometry(0.12 * s, 0.18 * s, 1.2 * s, 6), trunk, m4(t.x, 0.6 * s, t.z), 0.15, seed)
    for (let i = 0; i < 3; i++) {
      batch.add(new THREE.ConeGeometry((1.0 - i * 0.25) * s, 1.3 * s, 7), ['#3f8a4a', '#4a9a52', '#55a85a'][i],
        m4(t.x, (1.4 + i * 0.75) * s, t.z, 1, 1, 1, seed + i), 0.15, seed + i)
    }
    canopies.push(new THREE.Sphere(new THREE.Vector3(t.x, 2.1 * s, t.z), 1.1 * s))
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
  } else if (t.kind === 'bamboo') {
    // 竹やぶ: 節のある細い茎を何本も立て、先に葉を付ける
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4 + seed
      const r = (0.15 + 0.12 * (i % 3)) * s
      const h = (2.4 + 0.5 * ((i * 7) % 3)) * s
      const x = t.x + Math.sin(a) * r
      const z = t.z + Math.cos(a) * r
      batch.add(new THREE.CylinderGeometry(0.045 * s, 0.055 * s, h, 5), i % 2 ? '#7cc35a' : '#68b04a', m4(x, h / 2, z), 0.08, i)
      for (let j = 1; j < 4; j++) {
        batch.add(new THREE.CylinderGeometry(0.06 * s, 0.06 * s, 0.04 * s, 5), '#4e9a3c', m4(x, (h * j) / 4, z), 0.05)
      }
      batch.add(new THREE.IcosahedronGeometry(0.32 * s, 0), '#5cb84d', m4(x, h, z, 1.3, 0.45, 1.3, a), 0.2, i)
    }
    // 茎の林は上から下まで視界をさえぎるので、高さごとに球を置いてカメラの回り込みで避ける
    for (const y of [0.7, 1.5, 2.4]) canopies.push(new THREE.Sphere(new THREE.Vector3(t.x, y * s, t.z), 0.75 * s))
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
  const base = new THREE.Color(r.color ?? '#b7aa98')
  batch.add(new THREE.DodecahedronGeometry(r.r, 0), base, m4(r.x, r.h * 0.4, r.z, 1, r.h / r.r, 0.9, seed), 0.22, seed)
  batch.add(new THREE.DodecahedronGeometry(r.r * 0.5, 0), r.color ? base.clone().multiplyScalar(1.04) : '#c8bca9',
    m4(r.x + r.r * 0.7, r.h * 0.2, r.z + r.r * 0.3, 1, 0.8, 1, seed * 2), 0.22, seed + 1)
}

function addPondRim(batch: Batch, e: Enclosure): void {
  const pond = e.pond
  if (!pond) return
  const stones = Math.round(pond.r * 6)
  const ice = e.ground === '#e4eef0' || e.ground === '#e6eef0'
  for (let i = 0; i < stones; i++) {
    const a = (i / stones) * Math.PI * 2
    batch.add(new THREE.DodecahedronGeometry(0.22 + hash(i) * 0.1, 0), ice ? (i % 2 ? '#f3f8fb' : '#e3eef4') : (i % 2 ? '#d9cfbf' : '#c9bda8'),
      m4(pond.x + Math.sin(a) * (pond.r + 0.05), 0.06, pond.z + Math.cos(a) * (pond.r + 0.05), 1, 0.45, 1, a), 0.15, i)
  }
}

function addPlaza(batch: Batch, area: Area): void {
  const { plaza } = area
  for (let i = 0; i < 3; i++) {
    const a = i * (Math.PI * 2 / 3) + Math.PI / 3
    const x = plaza.x + Math.sin(a) * (plaza.r - 0.5)
    const z = plaza.z + Math.cos(a) * (plaza.r - 0.5)
    batch.add(new THREE.BoxGeometry(1.4, 0.1, 0.45), '#c98b54', m4(x, 0.45, z, 1, 1, 1, a + Math.PI / 2), 0.1)
    for (const s of [-0.55, 0.55]) {
      batch.add(new THREE.BoxGeometry(0.1, 0.45, 0.4), '#8b5e3c', m4(x + Math.cos(a) * s, 0.22, z - Math.sin(a) * s, 1, 1, 1, a + Math.PI / 2), 0.1)
    }
  }
  batch.add(new THREE.CylinderGeometry(1.1, 1.2, 0.35, 10), '#c7a77c', m4(plaza.x, 0.17, plaza.z), 0.1)
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2
    batch.add(new THREE.IcosahedronGeometry(0.2, 0), ['#ff7aa2', '#ffd04f', '#ffffff', '#ff9d5c'][i % 4],
      m4(plaza.x + Math.sin(a) * 0.7, 0.45, plaza.z + Math.cos(a) * 0.7), 0.1)
  }
  batch.add(new THREE.IcosahedronGeometry(0.45, 1), '#5aae4a', m4(plaza.x, 0.6, plaza.z, 1, 0.8, 1), 0.2)
}

/** エリアの出入口の門（柱と横木。看板はアトラスで貼る）。 */
function addGate(batch: Batch, x: number, z: number, yaw: number): void {
  for (const s of [-1, 1]) {
    const px = x + Math.cos(yaw) * s * 1.75
    const pz = z - Math.sin(yaw) * s * 1.75
    post(batch, px, pz, 3.1, 0.16, '#a8764a', false)
    batch.add(new THREE.ConeGeometry(0.26, 0.4, 6), '#c8553d', m4(px, 3.3, pz), 0.1)
  }
  batch.add(new THREE.BoxGeometry(4.0, 0.22, 0.24), '#8b5e3c', m4(x, 3.0, z, 1, 1, 1, yaw), 0.08)
}

// ---------------------------------------------------------------------------
// 看板（1枚のテクスチャにまとめて、1回で描く）

type SignSpec = { x: number; y: number; z: number; yaw: number; w: number; h: number; draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void }

const CELL_W = 256
const CELL_H = 128

function drawEnclosureSign(e: Enclosure) {
  return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const list = e.species.map(id => SPECIES[id])
    ctx.fillStyle = '#fff8e6'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#a8764a'
    ctx.lineWidth = 10
    ctx.strokeRect(5, 5, w - 10, h - 10)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    if (list.length === 1) {
      ctx.font = '64px sans-serif'
      ctx.fillText(list[0].emoji, 64, 68)
      ctx.fillStyle = '#5a3d22'
      const name = list[0].name
      ctx.font = `bold ${name.length > 5 ? 30 : 44}px sans-serif`
      ctx.fillText(name, 168, 68)
    } else {
      ctx.font = '44px sans-serif'
      list.forEach((s, i) => ctx.fillText(s.emoji, w / 2 + (i - (list.length - 1) / 2) * 58, 46))
      ctx.fillStyle = '#5a3d22'
      ctx.font = 'bold 22px sans-serif'
      ctx.fillText(list.map(s => s.name).join('・'), w / 2, 96, w - 24)
    }
  }
}

function drawGateSign(to: Area, back: boolean) {
  return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.fillStyle = back ? '#e8f4ff' : '#fff3d6'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#8b5e3c'
    ctx.lineWidth = 8
    ctx.strokeRect(4, 4, w - 8, h - 8)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = '48px sans-serif'
    ctx.fillText(to.emoji, 44, h / 2)
    ctx.fillStyle = '#4a3426'
    ctx.font = 'bold 20px sans-serif'
    ctx.fillText(back ? 'もどる' : 'つぎは', 150, 34)
    ctx.font = `bold ${to.name.length > 6 ? 24 : 30}px sans-serif`
    ctx.fillText(to.name, 150, 80, 180)
  }
}

function buildSigns(specs: SignSpec[], batch: Batch): { mesh?: THREE.Mesh; texture?: THREE.Texture } {
  // 看板の板（木の枠と柱）は、まとめた形に入れる
  for (const s of specs) {
    batch.add(new THREE.BoxGeometry(s.w + 0.1, s.h + 0.1, 0.06), '#a8764a', m4(s.x, s.y, s.z, 1, 1, 1, s.yaw), 0.05)
  }
  if (typeof document === 'undefined' || specs.length === 0) return {}
  const cols = 4
  const rows = Math.ceil(specs.length / cols)
  const canvas = document.createElement('canvas')
  canvas.width = CELL_W * cols
  canvas.height = CELL_H * Math.max(1, 2 ** Math.ceil(Math.log2(rows)))
  const ctx = canvas.getContext('2d')
  if (!ctx) return {}
  const parts: THREE.BufferGeometry[] = []
  specs.forEach((s, i) => {
    const cx = (i % cols) * CELL_W
    const cy = Math.floor(i / cols) * CELL_H
    ctx.save()
    ctx.translate(cx, cy)
    s.draw(ctx, CELL_W, CELL_H)
    ctx.restore()
    const u0 = cx / canvas.width
    const u1 = (cx + CELL_W) / canvas.width
    const v1 = 1 - cy / canvas.height
    const v0 = 1 - (cy + CELL_H) / canvas.height
    // 表と裏の両面に貼る（裏から見ても文字が反転しない）
    for (const flip of [0, Math.PI]) {
      const g = new THREE.PlaneGeometry(s.w, s.h)
      const uv = g.attributes.uv as THREE.BufferAttribute
      for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) ? u1 : u0, uv.getY(k) ? v1 : v0)
      g.applyMatrix4(m4(0, 0, 0.032, 1, 1, 1, 0))
      g.applyMatrix4(m4(s.x, s.y, s.z, 1, 1, 1, s.yaw + flip))
      parts.push(g)
    }
  })
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  const merged = mergeGeometries(parts, false)
  for (const p of parts) p.dispose()
  const mesh = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8 }))
  mesh.name = 'zoo-signs'
  return { mesh, texture }
}

// ---------------------------------------------------------------------------

export function createScenery(area: Area): Scenery {
  const group = new THREE.Group()
  group.name = `zoo-scenery-${area.id}`
  const disposables: { dispose: () => void }[] = []
  const canopies: THREE.Sphere[] = []

  const groundMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 })
  const ground = new THREE.Mesh(groundGeometry(area), groundMaterial)
  ground.receiveShadow = true
  ground.name = 'zoo-ground'
  group.add(ground)
  disposables.push(ground.geometry, groundMaterial)

  const props = new Batch()
  const glass = new Batch()
  const signs: SignSpec[] = []
  let seed = 1
  for (const e of area.enclosures) {
    addBarrier(props, glass, e)
    if (e.house) addHouse(props, e, e.house)
    e.trees.forEach(t => addTree(props, t, canopies, seed++))
    e.rocks.forEach(r => addRock(props, r, seed++))
    addPondRim(props, e)
    const sign = signPosition(e)
    props.add(new THREE.CylinderGeometry(0.07, 0.07, 1.6, 6), '#8b5e3c', m4(sign.x, 0.8, sign.z), 0.1)
    signs.push({ x: sign.x, y: 1.75, z: sign.z, yaw: sign.angle, w: 1.5, h: 0.75, draw: drawEnclosureSign(e) })
    // 看板が追いかけるカメラと動物のあいだに入らないよう、よける球として登録する
    canopies.push(new THREE.Sphere(new THREE.Vector3(sign.x, 1.6, sign.z), 0.95))
  }
  area.trees.forEach(t => addTree(props, t, canopies, seed++))
  addPlaza(props, area)
  for (const exit of area.exits) {
    const yaw = exit.heading
    addGate(props, exit.at.x, exit.at.z, yaw)
    // 門の看板は内側（エリアの中）を向ける
    signs.push({ x: exit.at.x, y: 2.45, z: exit.at.z, yaw: yaw + Math.PI, w: 2.4, h: 1.0, draw: drawGateSign(areaById(exit.to), exit.heading === 0) })
  }
  const signMesh = buildSigns(signs, props)
  if (signMesh.mesh) {
    signMesh.mesh.castShadow = true
    group.add(signMesh.mesh)
    disposables.push(signMesh.mesh.geometry, signMesh.mesh.material as THREE.Material, signMesh.texture!)
  }

  const propMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92 })
  const propsMesh = props.build(propMaterial)
  if (propsMesh) {
    propsMesh.castShadow = true
    propsMesh.receiveShadow = true
    propsMesh.name = 'zoo-props'
    group.add(propsMesh)
    disposables.push(propsMesh.geometry, propMaterial)
  }
  // ガラス（透明）は別のメッシュにして、ほかの物のあとに描く
  const glassMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true, transparent: true, opacity: 0.24, roughness: 0.05, metalness: 0.1, depthWrite: false,
  })
  const glassMesh = glass.build(glassMaterial)
  if (glassMesh) {
    glassMesh.name = 'zoo-glass'
    glassMesh.renderOrder = 3
    group.add(glassMesh)
    disposables.push(glassMesh.geometry, glassMaterial)
  }

  // 池と堀の水面（1つのメッシュ）と、ゆっくり広がる波紋（1つの InstancedMesh）
  const waterParts: THREE.BufferGeometry[] = []
  const ripples: { x: number; z: number; max: number; phase: number }[] = []
  for (const e of area.enclosures) {
    if (e.pond) {
      waterParts.push(new THREE.CircleGeometry(e.pond.r, 36).rotateX(-Math.PI / 2).translate(e.pond.x, 0.035, e.pond.z))
      for (let i = 0; i < 2; i++) {
        ripples.push({ x: e.pond.x + (i - 0.5) * 0.7, z: e.pond.z + (i ? 0.4 : -0.3), max: e.pond.r * 0.55, phase: i / 2 + hash(seed++) * 0.2 })
      }
    }
    if (e.barrier === 'moat') {
      const inner = roamRadius(e) + 0.2
      waterParts.push(new THREE.RingGeometry(inner, e.radius - barrierInset(e.barrier) * 0.15, 64).rotateX(-Math.PI / 2).translate(e.center.x, 0.02, e.center.z))
    }
  }
  const waterMaterial = new THREE.MeshStandardMaterial({ color: '#69c3ea', roughness: 0.15, metalness: 0.05 })
  disposables.push(waterMaterial)
  if (waterParts.length) {
    for (const g of waterParts) g.deleteAttribute('uv')
    const water = new THREE.Mesh(mergeGeometries(waterParts, false), waterMaterial)
    for (const p of waterParts) p.dispose()
    water.receiveShadow = true
    water.name = 'zoo-water'
    group.add(water)
    disposables.push(water.geometry)
  }
  const rippleMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff' })
  const rippleGeometry = new THREE.RingGeometry(0.9, 1, 28).rotateX(-Math.PI / 2)
  const rippleMesh = new THREE.InstancedMesh(rippleGeometry, rippleMaterial, Math.max(1, ripples.length))
  rippleMesh.count = ripples.length
  rippleMesh.name = 'zoo-ripples'
  rippleMesh.frustumCulled = false
  group.add(rippleMesh)
  disposables.push(rippleGeometry, rippleMaterial, rippleMesh)
  const water = new THREE.Color('#69c3ea')
  const white = new THREE.Color('#e9fbff')
  const matrix = new THREE.Matrix4()
  const tint = new THREE.Color()

  return {
    group,
    canopies,
    update(time: number) {
      ripples.forEach((r, i) => {
        const k = (time * 0.25 + r.phase) % 1
        const s = 0.2 + k * r.max
        matrix.makeScale(s, 1, s).setPosition(r.x, 0.045, r.z)
        rippleMesh.setMatrixAt(i, matrix)
        // 透明度のかわりに、水の色へ近づけて消す（1回の描画で済む）
        rippleMesh.setColorAt(i, tint.copy(white).lerp(water, k))
      })
      rippleMesh.instanceMatrix.needsUpdate = true
      if (rippleMesh.instanceColor) rippleMesh.instanceColor.needsUpdate = true
    },
    dispose() {
      for (const d of disposables) d.dispose()
    },
  }
}
