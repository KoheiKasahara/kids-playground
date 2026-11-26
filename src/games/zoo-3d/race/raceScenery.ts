// どうぶつレース場の景色（受付・コース・観客席・表彰台）を、手続き的なローポリ形状で作る。
// 動物園の景色（scenery.ts）と同じく、動かない物は頂点カラーで色付けして1つのメッシュへまとめ、描画呼び出しを少なくする。
// - コースの地面は中心線にそって帯（リボン）を張り、地面の種類（つち・しばふ・こおり・どろんこ…）で色を変える。
// - プールは地面より少し上に水面を張る。泳ぐ動物は地面の下へ沈め、地面に隠れた部分が水の中に見える。

import * as THREE from 'three'
import { addRock, addTree, Batch, hash, m4 } from '../scenery'
import { SPECIES, type SpeciesId } from '../species'
import type { Tree, TreeKind } from '../zooMap'
import { pointAt, type CoursePath } from './course'
import { LANE_COLORS, RACES, terrainAt, type RaceDef, type Terrain } from './races'
import { coursePath } from './raceSim'

/** 水面の高さ。 */
export const WATER_LEVEL = 0.07
/** ハードル・丸太を とびこえる高さ（m）。 */
export function hopHeight(race: RaceDef): number {
  return race.course.jumpKind === 'log' ? 0.8 : 0.72
}

/** レーン（0 が左はし）の、中心線から左へのずれ（m）。 */
export function laneOffset(race: RaceDef, lane: number): number {
  return ((race.runners.length - 1) / 2 - lane) * race.course.laneWidth
}

/** コースの はばの半分（m）。 */
export function trackHalfWidth(race: RaceDef): number {
  return (race.runners.length * race.course.laneWidth) / 2 + 0.5
}

/** 出走する動物の大きさの最大（表彰台・アーチの大きさに使う）。 */
function biggest(ids: readonly SpeciesId[]) {
  const b = ids.map(id => SPECIES[id].manifest.bounds)
  return { width: Math.max(...b.map(x => x.width)), length: Math.max(...b.map(x => x.length)), height: Math.max(...b.map(x => x.height)) }
}

// ---------------------------------------------------------------------------
// 文字の看板

function textCanvas(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.Texture | undefined {
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : undefined
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) return undefined
  canvas.width = w
  canvas.height = h
  draw(ctx)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** 横長の看板の絵。checker なら左右に ゴールの白黒もようを入れる。 */
function bannerTexture(text: string, bg: string, fg: string, checker = false): THREE.Texture | undefined {
  return textCanvas(512, 128, ctx => {
    ctx.fillStyle = bg
    roundRect(ctx, 4, 4, 504, 120, 22)
    ctx.fill()
    if (checker) {
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          ctx.fillStyle = (i + j) % 2 ? '#222' : '#fff'
          ctx.fillRect(18 + i * 18, 28 + j * 18, 18, 18)
          ctx.fillRect(422 + i * 18, 28 + j * 18, 18, 18)
        }
      }
    }
    ctx.lineWidth = 8
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'
    roundRect(ctx, 10, 10, 492, 108, 18)
    ctx.stroke()
    ctx.fillStyle = fg
    ctx.font = `bold ${text.length > 7 ? 54 : 70}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 256, 68, checker ? 300 : 470)
  })
}

type Disposable = { dispose: () => void }

/** 両面から読める看板（表と裏に1枚ずつ）。 */
function signBoard(texture: THREE.Texture | undefined, w: number, h: number, disposables: Disposable[]): THREE.Group {
  const group = new THREE.Group()
  if (!texture) return group
  // 角の透明な所を黒くしない
  const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, transparent: true, alphaTest: 0.05 })
  const geometry = new THREE.PlaneGeometry(w, h)
  const front = new THREE.Mesh(geometry, material)
  const back = new THREE.Mesh(geometry, material)
  front.position.z = 0.03
  back.position.z = -0.03
  back.rotation.y = Math.PI
  group.add(front, back)
  disposables.push(material, geometry, texture)
  return group
}

// ---------------------------------------------------------------------------
// 帯（リボン）

const tmpColor = new THREE.Color()

/** 中心線にそった帯。color は区間ごとの色（s はその区間のまんなか）。 */
function ribbon(path: CoursePath, s0: number, s1: number, left: number, right: number, y: number,
  color: (s: number, k: number) => string | THREE.Color, step = 0.5): THREE.BufferGeometry {
  // 左（正）が先になるように そろえる（面が上を向く）
  if (left < right) [left, right] = [right, left]
  const rows = Math.max(1, Math.ceil((s1 - s0) / step))
  const pos = new Float32Array(rows * 18)
  const col = new Float32Array(rows * 18)
  let prevL = pointAt(path, s0, left)
  let prevR = pointAt(path, s0, right)
  for (let k = 0; k < rows; k++) {
    const s = s0 + ((k + 1) / rows) * (s1 - s0)
    const L = pointAt(path, s, left)
    const R = pointAt(path, s, right)
    const quad = [prevL, prevR, L, prevR, R, L]
    const c = color(s0 + ((k + 0.5) / rows) * (s1 - s0), k)
    tmpColor.set(c)
    quad.forEach((p, v) => {
      pos.set([p.x, y, p.z], (k * 6 + v) * 3)
      col.set([tmpColor.r, tmpColor.g, tmpColor.b], (k * 6 + v) * 3)
    })
    prevL = L
    prevR = R
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.computeVertexNormals()
  return g
}

function shade(hex: string, k: number): THREE.Color {
  return new THREE.Color(hex).multiplyScalar(k)
}

const TERRAIN_COLOR: Record<Terrain, string> = {
  dirt: '#c58d57',
  turf: '#5fae4e',
  trail: '#a9824f',
  bush: '#7f8a48',
  ice: '#dcf1fa',
  water: '#4fb8e8',
  mud: '#6b4a2c',
  grass: '#86c45a',
}

/** 地面の色（少しずつ明るさを変えて、のっぺりさせない。しばふ・はらっぱは刈ったもよう）。 */
function trackColor(terrain: Terrain, s: number, k: number): THREE.Color {
  const base = TERRAIN_COLOR[terrain]
  if (terrain === 'turf' || terrain === 'grass') return shade(base, Math.floor(s / 4) % 2 ? 1.08 : 0.96)
  if (terrain === 'mud') return shade(base, 0.85 + 0.3 * hash(k * 3.1))
  return shade(base, 0.94 + 0.12 * hash(k * 1.7 + s))
}

// ---------------------------------------------------------------------------
// 観客（どうぶつの おきゃくさん）

type Crowd = { meshes: THREE.InstancedMesh[]; update: (time: number, level: number) => void }

function createCrowd(seats: { x: number; y: number; z: number; yaw: number }[], disposables: Disposable[]): Crowd {
  const shirts = ['#ff6b6b', '#4dabf7', '#ffd43b', '#69db7c', '#da77f2', '#ffa94d', '#f783ac', '#ffffff']
  const furs = ['#a0703f', '#f2e6d0', '#8c8c8c', '#e8913a', '#3d3d3d', '#d9b38c']
  const bodyGeo = new THREE.CylinderGeometry(0.2, 0.26, 0.62, 7)
  const headGeo = new THREE.IcosahedronGeometry(0.22, 1)
  const earGeo = new THREE.IcosahedronGeometry(0.08, 0)
  const material = new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true })
  const n = Math.max(1, seats.length)
  const body = new THREE.InstancedMesh(bodyGeo, material, n)
  const head = new THREE.InstancedMesh(headGeo, material, n)
  const ears = new THREE.InstancedMesh(earGeo, material, n * 2)
  body.count = head.count = seats.length
  ears.count = seats.length * 2
  seats.forEach((_, i) => {
    body.setColorAt(i, new THREE.Color(shirts[i % shirts.length]))
    const fur = new THREE.Color(furs[Math.floor(hash(i * 5.3) * furs.length)])
    head.setColorAt(i, fur)
    ears.setColorAt(i * 2, fur)
    ears.setColorAt(i * 2 + 1, fur)
  })
  for (const m of [body, head, ears]) {
    m.frustumCulled = false
    m.castShadow = true
  }
  disposables.push(bodyGeo, headGeo, earGeo, material, body, head, ears)
  const mat = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)
  const p = new THREE.Vector3()
  const one = new THREE.Vector3(1, 1, 1)
  const side = new THREE.Vector3()
  function update(time: number, level: number) {
    seats.forEach((seat, i) => {
      // 走っているあいだは ゆらゆら、ゴールの ときは ぴょんぴょん はねる
      const phase = hash(i * 9.1) * Math.PI * 2
      const jump = level * Math.abs(Math.sin(time * (6 + (i % 3)) + phase)) * 0.22
      const sway = Math.sin(time * 1.6 + phase) * 0.04
      q.setFromAxisAngle(up, seat.yaw + sway)
      p.set(seat.x, seat.y + 0.31 + jump, seat.z)
      body.setMatrixAt(i, mat.compose(p, q, one))
      p.y += 0.5
      head.setMatrixAt(i, mat.compose(p, q, one))
      side.set(Math.cos(seat.yaw) * 0.15, 0.17, -Math.sin(seat.yaw) * 0.15)
      ears.setMatrixAt(i * 2, mat.compose(p.clone().add(side), q, one))
      side.x *= -1
      side.z *= -1
      ears.setMatrixAt(i * 2 + 1, mat.compose(p.clone().add(side), q, one))
    })
    body.instanceMatrix.needsUpdate = true
    head.instanceMatrix.needsUpdate = true
    ears.instanceMatrix.needsUpdate = true
  }
  update(0, 0)
  return { meshes: [body, head, ears], update }
}

// ---------------------------------------------------------------------------
// こまごまとした小物

function addArch(batch: Batch, path: CoursePath, s: number, half: number, height: number, colors: [string, string]) {
  const c = pointAt(path, s)
  for (const side of [-1, 1]) {
    const p = pointAt(path, s, side * (half + 0.8))
    batch.add(new THREE.CylinderGeometry(0.22, 0.26, height, 10), colors[0], m4(p.x, height / 2, p.z), 0.05)
    batch.add(new THREE.IcosahedronGeometry(0.4, 1), colors[1], m4(p.x, height + 0.25, p.z), 0.05)
  }
  batch.add(new THREE.BoxGeometry(2 * (half + 0.8), 0.32, 0.32), colors[0], m4(c.x, height - 0.1, c.z, 1, 1, 1, c.heading), 0.05)
}

function addFlag(batch: Batch, x: number, z: number, h: number, color: string, seed: number) {
  batch.add(new THREE.CylinderGeometry(0.035, 0.035, h, 5), '#eeeeee', m4(x, h / 2, z), 0)
  batch.add(new THREE.BoxGeometry(0.5, 0.32, 0.02), color, m4(x + 0.25, h - 0.2, z, 1, 1, 1, seed), 0.05)
}

function addHay(batch: Batch, x: number, z: number, yaw: number, seed: number) {
  // ほしくさの ロール（ころんと寝かせた円柱）
  batch.add(new THREE.CylinderGeometry(0.55, 0.55, 0.9, 12), '#e2c06a', m4(x, 0.55, z, 1, 1, 1, yaw, 0, Math.PI / 2), 0.12, seed)
  batch.add(new THREE.CylinderGeometry(0.4, 0.4, 0.92, 10), '#c9a24e', m4(x, 0.55, z, 1, 1, 1, yaw, 0, Math.PI / 2), 0.08, seed + 1)
}

function addMushroom(batch: Batch, x: number, z: number, s: number, seed: number) {
  batch.add(new THREE.CylinderGeometry(0.06 * s, 0.08 * s, 0.25 * s, 6), '#f6efe0', m4(x, 0.12 * s, z), 0.05)
  batch.add(new THREE.SphereGeometry(0.2 * s, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), seed % 2 ? '#e8503a' : '#f0a23a', m4(x, 0.24 * s, z), 0.08)
}

function addSnowMound(batch: Batch, x: number, z: number, s: number, seed: number) {
  batch.add(new THREE.IcosahedronGeometry(0.8 * s, 1), '#f7fbfd', m4(x, 0.15 * s, z, 1.3, 0.45, 1, seed), 0.06, seed)
}

function addSnowyPine(batch: Batch, x: number, z: number, s: number, seed: number) {
  batch.add(new THREE.CylinderGeometry(0.12 * s, 0.18 * s, 1.1 * s, 6), '#8a5f3c', m4(x, 0.55 * s, z), 0.1, seed)
  for (let i = 0; i < 3; i++) {
    const y = (1.3 + i * 0.72) * s
    batch.add(new THREE.ConeGeometry((1.0 - i * 0.25) * s, 1.2 * s, 7), ['#3d7f52', '#468a5a', '#509663'][i], m4(x, y, z, 1, 1, 1, seed + i), 0.12, seed + i)
    batch.add(new THREE.ConeGeometry((0.8 - i * 0.22) * s, 0.45 * s, 7), '#f4f9fb', m4(x, y + 0.42 * s, z, 1, 1, 1, seed + i), 0.04)
  }
}

function addTermiteMound(batch: Batch, x: number, z: number, s: number, seed: number) {
  batch.add(new THREE.ConeGeometry(0.5 * s, 1.5 * s, 7), '#b98a5a', m4(x, 0.75 * s, z, 1, 1, 1, seed), 0.15, seed)
  batch.add(new THREE.ConeGeometry(0.25 * s, 0.9 * s, 6), '#a87a4c', m4(x + 0.35 * s, 0.45 * s, z + 0.1 * s, 1, 1, 1, seed), 0.15)
}

function addBarn(batch: Batch, x: number, z: number, yaw: number) {
  batch.add(new THREE.BoxGeometry(5, 3, 4), '#c8473a', m4(x, 1.5, z, 1, 1, 1, yaw), 0.08)
  batch.add(new THREE.CylinderGeometry(0.01, 3.2, 1.8, 4, 1), '#6d4b3a', m4(x, 3.9, z, 1.1, 1, 0.9, yaw + Math.PI / 4), 0.05)
  batch.add(new THREE.BoxGeometry(1.6, 2, 0.1), '#f4ead8', m4(x + Math.sin(yaw) * 2.02, 1, z + Math.cos(yaw) * 2.02, 1, 1, 1, yaw), 0.02)
}

// ---------------------------------------------------------------------------
// コース

export type Podium = {
  /** 1着・2着・3着の立つ所と、ほかの動物の立つ所。 */
  spots: THREE.Vector3[]
  /** 表彰台が向いている向き（動物もこちらを向く）。 */
  facing: number
  camera: { pos: THREE.Vector3; look: THREE.Vector3 }
}

export type RaceScenery = {
  group: THREE.Group
  podium: Podium
  /** 観客の もりあがり（0〜1）を変えながら、毎フレーム呼ぶ。 */
  update: (time: number, excitement: number) => void
  dispose: () => void
}

/** 中心線までの距離と、どちら側か（左が正）。 */
function nearest(path: CoursePath, s0: number, s1: number, x: number, z: number): { d: number; side: number; s: number } {
  let best = { d: Infinity, side: 1, s: 0 }
  for (let s = s0; s <= s1; s += 1) {
    const p = pointAt(path, s)
    const d = Math.hypot(x - p.x, z - p.z)
    if (d < best.d) {
      // 進む向きの左を正
      const lx = Math.cos(p.heading)
      const lz = -Math.sin(p.heading)
      best = { d, side: Math.sign((x - p.x) * lx + (z - p.z) * lz) || 1, s }
    }
  }
  return best
}

export function createRaceScenery(race: RaceDef): RaceScenery {
  const course = race.course
  const theme = course.theme
  const path = coursePath(course)
  const half = trackHalfWidth(race)
  const big = biggest(race.runners)
  const group = new THREE.Group()
  group.name = `race-scenery-${race.id}`
  const disposables: Disposable[] = []
  const props = new Batch()
  const canopies: THREE.Sphere[] = []
  let seed = 1

  const s0 = course.closed ? 0 : -14
  const s1 = course.closed ? path.length : path.length + 4

  // 地面（コースのまわり）
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (let s = s0; s <= s1; s += 2) {
    const p = pointAt(path, s)
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minZ = Math.min(minZ, p.z)
    maxZ = Math.max(maxZ, p.z)
  }
  const margin = 70
  const gw = maxX - minX + margin * 2
  const gd = maxZ - minZ + margin * 2
  const groundGeo = new THREE.PlaneGeometry(gw, gd, 40, 40).rotateX(-Math.PI / 2).translate((minX + maxX) / 2, 0, (minZ + maxZ) / 2).toNonIndexed()
  {
    const n = groundGeo.attributes.position.count
    const colors = new Float32Array(n * 3)
    for (let tri = 0; tri < n / 3; tri++) {
      tmpColor.set(theme.ground).multiplyScalar(0.94 + 0.1 * hash(tri * 0.37))
      for (let v = 0; v < 3; v++) colors.set([tmpColor.r, tmpColor.g, tmpColor.b], (tri * 3 + v) * 3)
    }
    groundGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    groundGeo.deleteAttribute('uv')
    groundGeo.computeVertexNormals()
  }
  const groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 })
  const ground = new THREE.Mesh(groundGeo, groundMat)
  ground.receiveShadow = true
  ground.name = 'race-ground'
  group.add(ground)
  disposables.push(groundGeo, groundMat)

  // コースの地面（プールの区間は水面にする）
  const trackParts: THREE.BufferGeometry[] = []
  const waterParts: THREE.BufferGeometry[] = []
  const cuts = [s0, ...course.zones.flatMap(z => [z.from, z.to]), s1].sort((a, b) => a - b)
  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i]
    const b = cuts[i + 1]
    if (b - a < 0.01) continue
    const terrain = terrainAt(course, (a + b) / 2)
    if (terrain === 'water') {
      waterParts.push(ribbon(path, a, b, half + 0.2, -(half + 0.2), WATER_LEVEL, () => '#ffffff', 1))
      // プールのふち（白いタイル）
      for (const side of [-1, 1]) {
        trackParts.push(ribbon(path, a, b, side * (half + 0.2), side * (half + 0.75), 0.12, (_, k) => (k % 2 ? '#f2fbff' : '#d5eef8'), 1))
      }
      for (const end of [a, b]) {
        trackParts.push(ribbon(path, end - 0.3, end + 0.3, half + 0.75, -(half + 0.75), 0.11, () => '#e8f6fb', 0.6))
      }
    } else {
      trackParts.push(ribbon(path, a, b, half, -half, 0.02, (s, k) => trackColor(terrain, s, k)))
    }
  }
  // レーンの線・スタートの線・ゴールの白黒
  if (theme.lanes) {
    for (let lane = 0; lane <= race.runners.length; lane++) {
      const off = half - 0.5 - lane * course.laneWidth
      trackParts.push(ribbon(path, s0, s1, off + 0.05, off - 0.05, 0.03, () => '#f6f6f0', 1))
    }
  }
  if (!course.closed) trackParts.push(ribbon(path, -0.15, 0.15, half, -half, 0.035, () => '#ffffff', 0.3))
  {
    const cols = Math.ceil((half * 2) / 0.5)
    for (let row = 0; row < 2; row++) {
      for (let c = 0; c < cols; c++) {
        const left = half - c * 0.5
        trackParts.push(ribbon(path, course.distance - 0.5 + row * 0.5, course.distance + row * 0.5, left, left - 0.5, 0.04,
          () => ((row + c) % 2 ? '#222222' : '#ffffff'), 0.5))
      }
    }
  }
  // どろんこの でこぼこ
  for (const z of course.zones) {
    if (z.terrain !== 'mud') continue
    for (let s = z.from + 0.6; s < z.to - 0.4; s += 0.9) {
      for (let i = 0; i < 3; i++) {
        const off = (hash(s * 3.7 + i) - 0.5) * half * 1.8
        const p = pointAt(path, s, off)
        props.add(new THREE.IcosahedronGeometry(0.18 + hash(s + i) * 0.2, 0), shade('#5d3e24', 0.95 + hash(i + s) * 0.2),
          m4(p.x, 0.02, p.z, 1.5, 0.14, 1.1, hash(s * i)), 0.08, seed++)
      }
    }
  }
  const trackGeo = mergeAll(trackParts)
  const trackMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })
  const track = new THREE.Mesh(trackGeo, trackMat)
  track.receiveShadow = true
  track.name = 'race-track'
  group.add(track)
  disposables.push(trackGeo, trackMat)
  if (waterParts.length) {
    const waterGeo = mergeAll(waterParts)
    const waterMat = new THREE.MeshStandardMaterial({ color: '#4cb6e6', roughness: 0.12, metalness: 0.05, transparent: true, opacity: 0.84, depthWrite: false })
    const water = new THREE.Mesh(waterGeo, waterMat)
    water.renderOrder = 3
    water.name = 'race-water'
    group.add(water)
    disposables.push(waterGeo, waterMat)
  }

  // さく
  const fenceColor = theme.fence === 'white' ? '#f7f7f2' : theme.fence === 'rope' ? '#9b7048' : '#a8784c'
  for (const side of [-1, 1]) {
    const off = side * (half + 0.35)
    let prev = pointAt(path, s0, off)
    for (let s = s0 + 2.4; s <= s1; s += 2.4) {
      const p = pointAt(path, s, off)
      if (theme.fence === 'snow') {
        props.add(new THREE.IcosahedronGeometry(0.55, 1), shade('#f5fafc', 0.97 + hash(s) * 0.05), m4(p.x, 0.12, p.z, 1.2, 0.55, 1.6, p.heading), 0.05, seed++)
      } else {
        const h = theme.fence === 'rope' ? 0.7 : 1.05
        props.add(new THREE.BoxGeometry(0.12, h, 0.12), fenceColor, m4(p.x, h / 2, p.z, 1, 1, 1, p.heading), 0.08)
        const len = Math.hypot(p.x - prev.x, p.z - prev.z)
        const yaw = Math.atan2(p.x - prev.x, p.z - prev.z)
        const mx = (p.x + prev.x) / 2
        const mz = (p.z + prev.z) / 2
        const rails = theme.fence === 'rope' ? [0.55] : [0.5, 0.92]
        for (const y of rails) {
          const thick = theme.fence === 'rope' ? 0.04 : 0.08
          props.add(new THREE.BoxGeometry(thick, thick, len), theme.fence === 'rope' ? '#d9c08a' : fenceColor, m4(mx, y, mz, 1, 1, 1, yaw), 0.04)
        }
      }
      prev = p
    }
  }

  // ハードル・丸太
  for (const j of course.jumps) {
    const p = pointAt(path, j)
    if (course.jumpKind === 'log') {
      props.add(new THREE.CylinderGeometry(0.26, 0.3, half * 2, 10), '#8a5a35', m4(p.x, 0.27, p.z, 1, 1, 1, p.heading, 0, Math.PI / 2), 0.12, seed++)
      for (const side of [-1, 1]) {
        const e = pointAt(path, j, side * half)
        props.add(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 10), '#d9b27c', m4(e.x, 0.27, e.z, 1, 1, 1, p.heading, 0, Math.PI / 2), 0.05)
      }
    } else {
      for (let lane = 0; lane < race.runners.length; lane++) {
        const q = pointAt(path, j, laneOffset(race, lane))
        props.add(new THREE.BoxGeometry(course.laneWidth * 0.78, 0.42, 0.5), '#e5c56c', m4(q.x, 0.21, q.z, 1, 1, 1, p.heading), 0.18, seed++)
        props.add(new THREE.BoxGeometry(course.laneWidth * 0.8, 0.05, 0.52), '#b5603c', m4(q.x, 0.3, q.z, 1, 1, 1, p.heading), 0.05)
      }
    }
  }

  // やぶ（コースの はしに しげみ）
  for (const z of course.zones) {
    if (z.terrain !== 'bush') continue
    for (let s = z.from; s < z.to; s += 1.3) {
      for (const side of [-1, 1]) {
        const p = pointAt(path, s, side * (half - 0.2 - hash(s * 2.3 + side) * 0.5))
        addTree(props, { x: p.x, z: p.z, kind: 'bush', size: 0.75 + hash(s + side) * 0.35 }, canopies, seed++)
      }
    }
  }

  // スタートとゴールのアーチ
  const archHeight = Math.max(4.4, big.height * 1.35 + 0.6)
  const finish = pointAt(path, course.distance)
  addArch(props, path, course.distance, half, archHeight, ['#e8463c', '#ffd23f'])
  const finishSign = signBoard(bannerTexture('ゴール', '#e8463c', '#ffffff', true), Math.min(6, half * 1.3), 1.3, disposables)
  finishSign.position.set(finish.x, archHeight - 0.95, finish.z)
  finishSign.rotation.y = finish.heading + Math.PI
  group.add(finishSign)
  if (!course.closed) {
    const start = pointAt(path, 0)
    addArch(props, path, 0, half, archHeight, ['#2f9e55', '#ffffff'])
    const startSign = signBoard(bannerTexture('スタート', '#2f9e55', '#ffffff'), Math.min(6, half * 1.3), 1.3, disposables)
    startSign.position.set(start.x, archHeight - 0.95, start.z)
    startSign.rotation.y = start.heading
    group.add(startSign)
  }

  // ゴールの横の 観客席（右がわ）
  const seats: { x: number; y: number; z: number; yaw: number }[] = []
  const standFrom = course.distance - 12
  const standTo = course.distance + 1
  for (let row = 0; row < 3; row++) {
    const off = -(half + 2.4 + row * 1.15)
    const h = 0.45 + row * 0.5
    for (let s = standFrom; s < standTo; s += 1.0) {
      const p = pointAt(path, s, off)
      props.add(new THREE.BoxGeometry(1.2, h, 1.05), row % 2 ? '#d8d2c4' : '#c9c2b2', m4(p.x, h / 2, p.z, 1, 1, 1, p.heading), 0.04)
      if (hash(s * 3.3 + row) < 0.8) seats.push({ x: p.x, y: h, z: p.z, yaw: p.heading + Math.PI / 2 })
    }
  }
  // 屋根の柱と旗
  for (const s of [standFrom, (standFrom + standTo) / 2, standTo]) {
    const p = pointAt(path, s, -(half + 6))
    addFlag(props, p.x, p.z, 4.2, LANE_COLORS[Math.floor(hash(s) * LANE_COLORS.length)], seed++)
  }
  const crowd = createCrowd(seats, disposables)
  crowd.meshes.forEach(m => group.add(m))

  // 表彰台（ゴールの先、観客席の向かい）
  const blockW = Math.max(1.7, big.width + 0.9)
  const blockD = Math.max(1.7, big.length + 0.5)
  const podiumS = course.distance + (course.closed ? 10 : 8)
  const pc = pointAt(path, podiumS, half + 3.2 + blockD / 2)
  // 表彰台はコースのほう（右）を向く
  const facing = pc.heading - Math.PI / 2
  const fx = Math.sin(facing)
  const fz = Math.cos(facing)
  // 表彰台の横（コースの進む向き）
  const px = Math.sin(pc.heading)
  const pz = Math.cos(pc.heading)
  const heights = [0.95, 0.65, 0.42]
  const slots = [0, -1, 1]
  const spots: THREE.Vector3[] = []
  const podiumColors = ['#f2c230', '#c9d1d9', '#d99055']
  slots.forEach((slot, place) => {
    const x = pc.x + px * slot * blockW
    const z = pc.z + pz * slot * blockW
    props.add(new THREE.BoxGeometry(blockW, heights[place], blockD), '#fbf7ee', m4(x, heights[place] / 2, z, 1, 1, 1, facing), 0.03)
    props.add(new THREE.BoxGeometry(blockW + 0.04, 0.08, blockD + 0.04), podiumColors[place], m4(x, heights[place], z, 1, 1, 1, facing), 0.03)
    spots.push(new THREE.Vector3(x, heights[place] + 0.04, z))
    const label = signBoard(textCanvas(128, 128, ctx => {
      ctx.fillStyle = podiumColors[place]
      ctx.beginPath()
      ctx.arc(64, 64, 58, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 84px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(place + 1), 64, 70)
    }), 0.5, 0.5, disposables)
    label.position.set(x + fx * (blockD / 2 + 0.01), heights[place] * 0.5, z + fz * (blockD / 2 + 0.01))
    label.rotation.y = facing
    group.add(label)
  })
  // 4着より うしろは、表彰台の よこに ならぶ
  for (let i = 3; i < race.runners.length; i++) {
    const slot = (i % 2 ? -1 : 1) * (2 + Math.floor((i - 3) / 2)) * blockW
    spots.push(new THREE.Vector3(pc.x + px * slot + fx * 0.6, 0, pc.z + pz * slot + fz * 0.6))
  }
  const camDist = 6.5 + big.height * 1.6 + blockW
  const podium: Podium = {
    spots,
    facing,
    camera: {
      pos: new THREE.Vector3(pc.x + fx * camDist, 2.2 + big.height * 0.9, pc.z + fz * camDist),
      look: new THREE.Vector3(pc.x, 1.1 + big.height * 0.55, pc.z),
    },
  }

  // まわりの景色: 木・岩・ほしくさ・きのこ・雪・アリづか・なや
  const kinds: TreeKind[] = theme.trees
  const avoid = [
    { x: pc.x, z: pc.z, r: blockW * 3 + 2 },
    ...[standFrom, standTo].map(s => ({ ...pointAt(path, s, -(half + 4)), r: 7 })),
  ]
  const cx = (minX + maxX) / 2
  const cz = (minZ + maxZ) / 2
  for (let gx = minX - 30; gx <= maxX + 30; gx += 4.2) {
    for (let gz = minZ - 30; gz <= maxZ + 30; gz += 4.2) {
      const jx = gx + (hash(gx * 1.3 + gz * 7.1) - 0.5) * 3
      const jz = gz + (hash(gx * 5.7 - gz * 2.9) - 0.5) * 3
      const near = nearest(path, s0, s1, jx, jz)
      // カメラは右がわから写すので、右がわは はなして植える
      const minD = half + (near.side < 0 ? 10 : 3.5)
      if (near.d < minD || near.d > half + 30) continue
      if (avoid.some(a => Math.hypot(jx - a.x, jz - a.z) < a.r)) continue
      const r = hash(jx * 3.1 + jz * 1.7)
      const density = 0.45 * (1 - (near.d - minD) / 34)
      if (r > density + 0.12) continue
      const size = 0.85 + hash(jx + jz) * 0.45
      if (theme.snow) addSnowyPine(props, jx, jz, size, seed++)
      else addTree(props, { x: jx, z: jz, kind: kinds[Math.floor(hash(jx * 0.7 + jz) * kinds.length)], size } as Tree, canopies, seed++)
    }
  }
  // コースの すぐそばの 小物
  for (let s = s0 + 3; s < s1 - 3; s += 5.5) {
    for (const side of [-1, 1]) {
      if (side < 0 && s > standFrom - 3 && s < standTo + 3) continue
      const r = hash(s * 2.1 + side)
      const p = pointAt(path, s, side * (half + 1.6 + r * 1.5))
      if (avoid.some(a => Math.hypot(p.x - a.x, p.z - a.z) < a.r)) continue
      if (race.id === 'forest' && r < 0.6) addMushroom(props, p.x, p.z, 0.9 + r, seed++)
      else if (theme.snow && r < 0.5) addSnowMound(props, p.x, p.z, 0.8 + r, seed++)
      else if (theme.hay && r < 0.25) addHay(props, p.x + side * 1.5, p.z, p.heading, seed++)
      else if (race.id === 'savanna' && r < 0.2) addTermiteMound(props, p.x + side * 2, p.z, 0.9 + r, seed++)
      else if (theme.rock && r < 0.35) addRock(props, { x: p.x + side * 1.2, z: p.z, r: 0.35 + r * 0.5, h: 0.3 + r * 0.4, color: theme.rock }, seed++)
      else if (!theme.snow && r > 0.82) {
        // 花
        for (let i = 0; i < 3; i++) {
          props.add(new THREE.IcosahedronGeometry(0.1, 0), ['#ff8fb1', '#ffd66b', '#ffffff', '#b197fc'][(i + seed) % 4],
            m4(p.x + i * 0.25, 0.12, p.z + (i % 2) * 0.2), 0.05)
        }
      }
    }
  }
  if (theme.hay) addBarn(props, cx + (maxX - minX) / 2 + 22, cz - 6, -Math.PI / 2)
  // 遠くの おか（地平線を やわらかくする）
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2
    const r = Math.max(gw, gd) * 0.42
    props.add(new THREE.IcosahedronGeometry(10 + hash(i) * 8, 1), shade(theme.snow ? '#e9f3f7' : theme.ground, 0.82 + hash(i * 3) * 0.1),
      m4(cx + Math.sin(a) * r, -2, cz + Math.cos(a) * r, 1.6, 0.45, 1, a), 0.08, i)
  }

  const propMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92 })
  const propsMesh = props.build(propMat)
  if (propsMesh) {
    propsMesh.castShadow = true
    propsMesh.receiveShadow = true
    propsMesh.name = 'race-props'
    group.add(propsMesh)
    disposables.push(propsMesh.geometry)
  }
  disposables.push(propMat)

  return {
    group,
    podium,
    update(time, excitement) {
      crowd.update(time, excitement)
    },
    dispose() {
      for (const d of disposables) d.dispose()
    },
  }
}

function mergeAll(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let count = 0
  for (const p of parts) count += p.attributes.position.count
  const pos = new Float32Array(count * 3)
  const col = new Float32Array(count * 3)
  const nor = new Float32Array(count * 3)
  let o = 0
  for (const p of parts) {
    pos.set(p.attributes.position.array as Float32Array, o * 3)
    col.set(p.attributes.color.array as Float32Array, o * 3)
    nor.set(p.attributes.normal.array as Float32Array, o * 3)
    o += p.attributes.position.count
    p.dispose()
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  return g
}

// ---------------------------------------------------------------------------
// 受付

export type ReceptionScenery = {
  group: THREE.Group
  /** 受付の係（サル）が立つ所と向き。 */
  clerk: { x: number; y: number; z: number; heading: number }
  update: (time: number) => void
  dispose: () => void
}

export function createReceptionScenery(): ReceptionScenery {
  const group = new THREE.Group()
  group.name = 'race-reception'
  const disposables: Disposable[] = []
  const props = new Batch()
  const canopies: THREE.Sphere[] = []
  let seed = 1

  const groundGeo = new THREE.CircleGeometry(70, 40).rotateX(-Math.PI / 2).toNonIndexed()
  {
    const n = groundGeo.attributes.position.count
    const colors = new Float32Array(n * 3)
    for (let tri = 0; tri < n / 3; tri++) {
      tmpColor.set('#9fd36a').multiplyScalar(0.95 + 0.08 * hash(tri))
      for (let v = 0; v < 3; v++) colors.set([tmpColor.r, tmpColor.g, tmpColor.b], (tri * 3 + v) * 3)
    }
    groundGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    groundGeo.deleteAttribute('uv')
  }
  const groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 })
  const ground = new THREE.Mesh(groundGeo, groundMat)
  ground.receiveShadow = true
  group.add(ground)
  disposables.push(groundGeo, groundMat)

  // 入口の石の道
  for (let i = 0; i < 18; i++) {
    const z = 9 - i * 1.15
    for (let j = -1; j <= 1; j++) {
      props.add(new THREE.CylinderGeometry(0.5, 0.52, 0.06, 7), shade('#e4dccb', 0.95 + hash(i * 3 + j) * 0.08),
        m4(j * 1.1 + 4.2 + (i % 2) * 0.3, 0.03, z, 1, 1, 1, hash(i + j)), 0.05)
    }
  }
  // 受付の小屋（しましまの ひさし）
  props.add(new THREE.BoxGeometry(3.6, 2.6, 2.4), '#fff4dc', m4(0, 1.3, -0.7), 0.04)
  props.add(new THREE.BoxGeometry(2.6, 1.0, 0.05), '#5a4b3c', m4(0, 1.6, 0.52), 0.02)
  props.add(new THREE.BoxGeometry(3.9, 1.0, 0.7), '#e8463c', m4(0, 0.5, 0.72), 0.05)
  props.add(new THREE.BoxGeometry(4.0, 0.08, 0.8), '#fff8ec', m4(0, 1.02, 0.74), 0.02)
  for (let i = 0; i < 7; i++) {
    props.add(new THREE.BoxGeometry(0.6, 0.06, 1.2), i % 2 ? '#ffffff' : '#ff6b5b', m4(-1.8 + i * 0.6, 2.75, 0.85, 1, 1, 1, 0, 0.4), 0.02)
  }
  props.add(new THREE.BoxGeometry(3.8, 0.25, 2.6), '#c9473c', m4(0, 2.72, -0.7), 0.04)
  props.add(new THREE.BoxGeometry(0.1, 0.9, 0.1), '#8b5e3c', m4(-0.9, 3.25, -0.4), 0.05)
  props.add(new THREE.BoxGeometry(0.1, 0.9, 0.1), '#8b5e3c', m4(0.9, 3.25, -0.4), 0.05)
  const sign = signBoard(bannerTexture('うけつけ', '#ffd23f', '#7a4a1c'), 2.6, 0.65, disposables)
  sign.position.set(0, 3.55, -0.35)
  group.add(sign)

  // おおきな門「どうぶつ レースじょう」
  addArch(props, STRAIGHT, 0, 4.2, 5.4, ['#2f78d6', '#ffd23f'])
  const gate = signBoard(bannerTexture('どうぶつ レースじょう', '#2f78d6', '#ffffff', true), 7.5, 1.6, disposables)
  gate.position.set(4.6, 4.5, -6)
  group.add(gate)
  // 門の むこうの 観客席と旗
  for (let row = 0; row < 3; row++) {
    props.add(new THREE.BoxGeometry(22, 0.8 + row * 0.8, 1.6), row % 2 ? '#d8d2c4' : '#c9c2b2', m4(4, 0.4 + row * 0.4, -16 - row * 1.6), 0.04)
  }
  for (let i = 0; i < 7; i++) addFlag(props, -6 + i * 3.4, -19.5, 5, LANE_COLORS[i % LANE_COLORS.length], seed++)
  // 旗のかざり（小屋から門へ）
  for (let i = 0; i <= 12; i++) {
    const k = i / 12
    const x = 1.9 + k * 2.7
    const y = 2.95 - Math.sin(Math.PI * k) * 0.5 + k * 1.5
    const z = 0.6 - k * 7.6
    props.add(new THREE.ConeGeometry(0.16, 0.34, 3), LANE_COLORS[i % LANE_COLORS.length], m4(x, y - 0.2, z, 1, 1, 0.3, Math.PI / 2, Math.PI), 0.02)
  }
  // ポスター（6つの レース）
  props.add(new THREE.BoxGeometry(2.4, 1.7, 0.12), '#8b5e3c', m4(-3.6, 1.6, 0.0, 1, 1, 1, 0.35), 0.04)
  props.add(new THREE.BoxGeometry(0.12, 1.0, 0.12), '#8b5e3c', m4(-4.4, 0.5, -0.3, 1, 1, 1, 0.35), 0.04)
  props.add(new THREE.BoxGeometry(0.12, 1.0, 0.12), '#8b5e3c', m4(-2.8, 0.5, 0.3, 1, 1, 1, 0.35), 0.04)
  const poster = signBoard(textCanvas(384, 256, ctx => {
    ctx.fillStyle = '#fffaf0'
    ctx.fillRect(0, 0, 384, 256)
    RACES.forEach((r, i) => {
      const x = 14 + (i % 3) * 122
      const y = 14 + Math.floor(i / 3) * 120
      ctx.fillStyle = r.color
      roundRect(ctx, x, y, 112, 108, 14)
      ctx.fill()
      ctx.font = '64px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(r.emoji, x + 56, y + 58)
    })
  }), 2.2, 1.5, disposables)
  poster.position.set(-3.6 + Math.sin(0.35) * 0.07, 1.6, Math.cos(0.35) * 0.07)
  poster.rotation.y = 0.35
  group.add(poster)
  // 植木と木
  for (const [x, z] of [[-2.3, 1.4], [2.3, 1.4]]) {
    props.add(new THREE.CylinderGeometry(0.32, 0.25, 0.5, 8), '#c8754a', m4(x, 0.25, z), 0.05)
    addTree(props, { x, z, kind: 'bush', size: 0.6 }, canopies, seed++)
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + 0.2
    const r = 13 + hash(i) * 10
    const x = Math.sin(a) * r
    const z = Math.cos(a) * r - 4
    if (z > 4 && Math.abs(x) < 9) continue
    addTree(props, { x, z, kind: (['round', 'pine', 'round', 'bush'] as TreeKind[])[i % 4], size: 0.9 + hash(i * 2) * 0.5 }, canopies, seed++)
  }

  const propMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92 })
  const propsMesh = props.build(propMat)
  if (propsMesh) {
    propsMesh.castShadow = true
    propsMesh.receiveShadow = true
    group.add(propsMesh)
    disposables.push(propsMesh.geometry)
  }
  disposables.push(propMat)

  return {
    group,
    clerk: { x: 0, y: 1.06, z: 0.62, heading: 0 },
    update(time) {
      sign.position.y = 3.55 + Math.sin(time * 2) * 0.03
    },
    dispose() {
      for (const d of disposables) d.dispose()
    },
  }
}

/** 受付の門を置く まっすぐな線（門は x=4.6, z=-7 に横向き）。 */
const STRAIGHT: CoursePath = (() => {
  const xs = new Float64Array([4.6, 4.6])
  const zs = new Float64Array([-6, -8])
  return { xs, zs, ss: new Float64Array([0, 2]), length: 2, closed: false }
})()
