import { sizeOf } from '../parts'
import { buildingCells, carriesRoad, colOf, COLS, neighborIndex, rowOf, ROWS, type Dir, type Town } from '../town'

// 3D の まちの ならべかた。three.js を つかわない じゅんすいな かんすう だけを おく。
// 1マスを 1 とし、ちずの まんなかが 0、きた（ちずの うえ）が -z、ひがし（みぎ）が +x。

export type Point = { readonly x: number; readonly z: number }

export function tileCenter(index: number): Point {
  return { x: colOf(index) + 0.5 - COLS / 2, z: rowOf(index) + 0.5 - ROWS / 2 }
}

/** 3D の いちに ある マス。ちずの そとなら null。 */
export function tileAt(x: number, z: number): number | null {
  const col = Math.floor(x + COLS / 2)
  const row = Math.floor(z + ROWS / 2)
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null
  return row * COLS + col
}

/** みなみ（はじめの カメラの がわ）→ ひがし → にし → きた の じゅんに みちを さがす。 */
const FACING_ORDER: readonly Dir[] = [2, 1, 3, 0]

/** たてものの まんなか。おおきな たてものは のって いる マス ぜんぶの まんなか。 */
export function buildingCenter(town: Town, index: number): Point {
  const cells = buildingCells(town, index)
  const points = cells.map(tileCenter)
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    z: points.reduce((sum, point) => sum + point.z, 0) / points.length,
  }
}

/**
 * たてものの しょうめんを むける ほう。となりの みちに むけ、なければ みなみ。
 * よこながの おおきな たてものは まわすと マスから はみでるので、みなみか きたに だけ むける。
 */
export function facingOf(town: Town, index: number): Dir {
  const cells = buildingCells(town, index)
  const part = town[index]?.part ?? null
  const [cols, rows] = part ? sizeOf(part) : [1, 1]
  const order = cols === rows ? FACING_ORDER : FACING_ORDER.filter((dir) => dir === 0 || dir === 2)
  for (const dir of order) {
    const facesRoad = cells.some((cell) => {
      const next = neighborIndex(cell, dir)
      return next !== null && !cells.includes(next) && carriesRoad(town[next].part)
    })
    if (facesRoad) return dir
  }
  return 2
}

/** しょうめん（ローカルの +z）を dir に むける ための y じくの かいてん。 */
export function facingAngle(dir: Dir): number {
  return [Math.PI, Math.PI / 2, 0, -Math.PI / 2][dir]
}

/** マスごとに きまった 0〜1 の かず。きの おおきさや むきの ばらつきに つかう（まいかい おなじ まちに なる）。 */
export function tileNoise(index: number, salt = 0): number {
  let h = Math.imul(index + 1, 374761393) ^ Math.imul(salt + 1, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/** ちず ぜんたいの はんぶんの はば（すこし よゆうを もたせる）。 */
const MAP_HALF_SPAN = Math.max(COLS, ROWS) / 2 + 0.6
/** はじめに みえる まちの はんぶんの はば。ひろい ちずの うち、みて いた あたりを ながめる。 */
const VIEW_HALF_SPAN = Math.min(MAP_HALF_SPAN, 7.6)

function distanceFor(halfSpan: number, aspect: number, fovDegrees: number): number {
  const vertical = (fovDegrees * Math.PI) / 180
  const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * Math.max(0.2, aspect))
  return halfSpan / Math.tan(Math.min(vertical, horizontal) / 2)
}

/** はじめの カメラの きょり。たて・よこ どちらの がめんでも、みて いた あたりの まちが おさまる。 */
export function fitDistance(aspect: number, fovDegrees: number): number {
  return Math.min(46, Math.max(14, distanceFor(VIEW_HALF_SPAN, aspect, fovDegrees)))
}

/** いちばん はなれた ときの カメラの きょり。ちず ぜんたいが だいたい おさまる。 */
export function farDistance(aspect: number, fovDegrees: number): number {
  return Math.min(150, Math.max(fitDistance(aspect, fovDegrees) * 1.4, distanceFor(MAP_HALF_SPAN, aspect, fovDegrees)))
}
