// クォータービューの ざひょう けいさん。
// ワールド（x, z は マス、y は たかさ）を、かいてん（0〜3 で 90度ずつ）して 画面へ うつす。

import { GRID } from './data'
import { UNIT } from './sprite3d'

/** 地面の 1マスが 画面で よこ 32・たて 16 ドット。 */
export const TW = 16
export const TH = 8
/** たかさ 1 が 画面で なんドットか。 */
export const YPX = UNIT * Math.sqrt(3) / 2
const C = GRID / 2

/** ワールド → かいてん後の ざひょう（ボードの 中心が 0）。 */
export function toView(x: number, z: number, r: number): [number, number] {
  const u = x - C, v = z - C
  switch (r & 3) {
    case 1: return [-v, u]
    case 2: return [-u, -v]
    case 3: return [v, -u]
    default: return [u, v]
  }
}

export function fromView(vx: number, vz: number, r: number): [number, number] {
  let u: number, v: number
  switch (r & 3) {
    case 1: u = vz; v = -vx; break
    case 2: u = -vx; v = -vz; break
    case 3: u = -vz; v = vx; break
    default: u = vx; v = vz
  }
  return [u + C, v + C]
}

/** ワールドの 点 → 画面（ボード中心からの ドット）。 */
export function toScreen(x: number, y: number, z: number, r: number): [number, number] {
  const [vx, vz] = toView(x, z, r)
  return [(vx - vz) * TW, (vx + vz) * TH - y * YPX]
}

/** 画面の 点 → 地面（y=0）の ワールド ざひょう。 */
export function groundAt(sx: number, sy: number, r: number): [number, number] {
  const a = sx / TW, b = sy / TH
  return fromView((a + b) / 2, (b - a) / 2, r)
}

/** おくゆき（大きいほど 手前）。 */
export function depthOf(x: number, z: number, r: number) {
  const [vx, vz] = toView(x, z, r)
  return vx + vz
}

/** ワールドでの むき → 画面での スプライトの むき（8ほうこうの 番号）。 */
export function viewDir(facing: number, r: number) {
  const dx = Math.cos(facing), dz = -Math.sin(facing)
  const [ax, az] = toView(dx + C, dz + C, r)
  const yaw = Math.atan2(-az, ax)
  return ((Math.round(yaw / (Math.PI / 4)) % 8) + 8) % 8
}
