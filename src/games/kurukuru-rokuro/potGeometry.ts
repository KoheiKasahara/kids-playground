import * as THREE from 'three'
import { RING_COUNT, WALL, radiusAt, ringY, wallMetrics, type Profile } from './pottery'

/**
 * かたち（Profile）から、なかが くぼんだ うつわの 3Dメッシュを つくる。
 * ゆびで おしている あいだは まいフレーム かたちが かわるので、頂点の 数を かえずに
 * position だけ かきかえられるよう、自前で LatheGeometry と おなじ ならびを つくる。
 *
 * たての ならび（row）:
 *   そとがわ（そこ→ふち）… グループ0（もようの テクスチャを はる。v は かべに そった ながさの わりあい）
 *   ふちの まるみ → うちがわ（ふち→うちの そこ）
 *   うちの そこ（ふち→まんなか）
 *   おもての そこ（まんなか→ふち。下むき）
 * 2つめ以降は グループ1（うわぐすりの いろ だけ）。
 */
export const SEGMENTS = 72
const RIM_POINTS = 6
const INNER_POINTS = 26
const MAIN_ROWS = RING_COUNT + RIM_POINTS + INNER_POINTS - 1
const FLOOR_START = MAIN_ROWS
const BOTTOM_START = MAIN_ROWS + 2
const ROWS = MAIN_ROWS + 4
const COLUMNS = SEGMENTS + 1
export const POT_VERTEX_COUNT = ROWS * COLUMNS

const SIN = Array.from({ length: COLUMNS }, (_, column) => Math.sin((column / SEGMENTS) * Math.PI * 2))
const COS = Array.from({ length: COLUMNS }, (_, column) => Math.cos((column / SEGMENTS) * Math.PI * 2))

/** うちがわの そこの たかさ。ひくい おさらでも そこが ぬけないように。 */
export function floorHeight(height: number): number {
  return Math.min(0.16, height * 0.3)
}

/** うちがわの かべの はんけい。 */
export function innerRadiusAt(profile: Profile, y: number): number {
  return Math.max(0.05, radiusAt(profile, y) - WALL)
}

/** だんめんの 点の ならび [はんけい, たかさ]。 */
export function potRows(profile: Profile): [number, number][] {
  const rows: [number, number][] = []
  const height = profile.height
  for (let index = 0; index < RING_COUNT; index++) rows.push([profile.radii[index]!, ringY(height, index)])
  const top = profile.radii[RING_COUNT - 1]!
  const rimRadius = Math.min(WALL / 2, Math.max(0.02, (top - 0.05) / 2))
  const rimCenter = top - rimRadius
  for (let k = 1; k <= RIM_POINTS; k++) {
    const angle = (Math.PI * k) / RIM_POINTS
    rows.push([rimCenter + rimRadius * Math.cos(angle), height + rimRadius * Math.sin(angle)])
  }
  const innerTop = rows[rows.length - 1]![0]
  const floor = floorHeight(height)
  for (let m = 1; m < INNER_POINTS; m++) {
    const y = height - ((height - floor) * m) / (INNER_POINTS - 1)
    rows.push([Math.min(innerTop, innerRadiusAt(profile, y)), y])
  }
  const floorEdge = rows[rows.length - 1]![0]
  rows.push([floorEdge, floor], [0, floor])
  rows.push([0, 0], [profile.radii[0]!, 0])
  return rows
}

function quads(index: number[], fromRow: number, toRow: number) {
  for (let row = fromRow; row < toRow; row++) {
    for (let column = 0; column < SEGMENTS; column++) {
      const a = row * COLUMNS + column
      const b = a + 1
      const d = a + COLUMNS
      const c = d + 1
      // LatheGeometry と おなじ まわり方（そとむきが おもて）。
      index.push(a, b, d, c, d, b)
    }
  }
}

export function createPotGeometry(profile: Profile): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  const uv = new Float32Array(POT_VERTEX_COUNT * 2)
  for (let row = 0; row < ROWS; row++) {
    for (let column = 0; column < COLUMNS; column++) {
      const offset = (row * COLUMNS + column) * 2
      uv[offset] = column / SEGMENTS
      uv[offset + 1] = 0
    }
  }
  const index: number[] = []
  quads(index, 0, RING_COUNT - 1)
  const outerCount = index.length
  quads(index, RING_COUNT - 1, MAIN_ROWS - 1)
  quads(index, FLOOR_START, FLOOR_START + 1)
  quads(index, BOTTOM_START, BOTTOM_START + 1)
  geometry.setIndex(index)
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(POT_VERTEX_COUNT * 3), 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(POT_VERTEX_COUNT * 3), 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  geometry.addGroup(0, outerCount, 0)
  geometry.addGroup(outerCount, index.length - outerCount, 1)
  updatePotGeometry(geometry, profile)
  return geometry
}

export function updatePotGeometry(geometry: THREE.BufferGeometry, profile: Profile): void {
  const position = geometry.getAttribute('position') as THREE.BufferAttribute
  const array = position.array as Float32Array
  const rows = potRows(profile)
  for (let row = 0; row < ROWS; row++) {
    const [radius, y] = rows[row]!
    for (let column = 0; column < COLUMNS; column++) {
      const offset = (row * COLUMNS + column) * 3
      array[offset] = radius * SIN[column]!
      array[offset + 1] = y
      array[offset + 2] = radius * COS[column]!
    }
  }
  position.needsUpdate = true
  // そとがわの もようは かべに そった ながさで はる。
  const uv = geometry.getAttribute('uv') as THREE.BufferAttribute
  const { fractions } = wallMetrics(profile)
  for (let row = 0; row < RING_COUNT; row++) {
    for (let column = 0; column < COLUMNS; column++) uv.setY(row * COLUMNS + column, fractions[row]!)
  }
  uv.needsUpdate = true
  geometry.computeVertexNormals()
  const normal = geometry.getAttribute('normal') as THREE.BufferAttribute
  const normals = normal.array as Float32Array
  // つなぎめ（さいしょと さいごの 列）は おなじ ばしょなので 向きを そろえる。
  for (let row = 0; row < ROWS; row++) {
    const first = row * COLUMNS * 3
    const last = (row * COLUMNS + SEGMENTS) * 3
    const n = new THREE.Vector3(normals[first]! + normals[last]!, normals[first + 1]! + normals[last + 1]!, normals[first + 2]! + normals[last + 2]!).normalize()
    normals.set([n.x, n.y, n.z], first)
    normals.set([n.x, n.y, n.z], last)
  }
  // そこは たいらなので まっすぐ うえ／した。
  for (let row = FLOOR_START; row < ROWS; row++) {
    const up = row < BOTTOM_START ? 1 : -1
    for (let column = 0; column < COLUMNS; column++) normals.set([0, up, 0], (row * COLUMNS + column) * 3)
  }
  normal.needsUpdate = true
  geometry.computeBoundingSphere()
  geometry.computeBoundingBox()
}
