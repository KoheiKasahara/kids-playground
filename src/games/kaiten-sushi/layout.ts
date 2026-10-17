// おみせの ばめんの ならび（ドット の ざひょう）と、かいてんレーンの みち。
// レーンは よこながの トラック がた。てまえを ひだり→みぎ、おくを みぎ→ひだりへ ながれる。

export const SCENE_W = 256
export const SCENE_H = 264

/** レーンの まんなかの せん。cxL/cxR は カーブの ちゅうしん、r は はんけい、half は はばの はんぶん。 */
export const LANE = { cxL: 66, cxR: 190, cy: 150, r: 48, half: 10 } as const

const STRAIGHT = LANE.cxR - LANE.cxL
const ARC = Math.PI * LANE.r
export const LANE_LENGTH = STRAIGHT * 2 + ARC * 2

/** おきゃくさんの せき（よこの いち）。 */
export const SEATS = [26, 77, 128, 179, 230] as const
/** おきゃくさんの えの したはし。 */
export const CUSTOMER_BOTTOM = 84
/** おくの カウンター。 */
export const FAR_COUNTER = { top: 74, front: 86, bottom: 90 } as const
/** てまえの カウンター（edge から したは てまえの ふち）。 */
export const NEAR_COUNTER_TOP = 210
export const NEAR_COUNTER_EDGE = 252
/** とっきゅうレーン（しんかんせん）の レールの たかさ。 */
export const TRAIN_RAIL_Y = 89
/** しんかんせんの ながさ と、おさらを のせる ところ（ひだりはしから）。 */
export const TRAIN_W = 54
export const TRAIN_H = 16
export const TRAIN_DISH_X = 17
/** しんかんせんに のせた おさらの まんなかの たかさ。 */
export const TRAIN_DISH_Y = TRAIN_RAIL_Y - 12
/** ねこの たいしょうの あしもと。 */
export const CHEF_POS = { x: 128, y: 172 } as const

const mod = (v: number, m: number) => ((v % m) + m) % m

export type LanePoint = { x: number; y: number; far: boolean }

/** レーンの うえの きょり s の ばしょ。 */
export function lanePoint(s: number): LanePoint {
  const { cxL, cxR, cy, r } = LANE
  s = mod(s, LANE_LENGTH)
  if (s < STRAIGHT) return { x: cxL + s, y: cy + r, far: false }
  s -= STRAIGHT
  if (s < ARC) {
    const t = Math.PI / 2 - s / r
    return { x: cxR + r * Math.cos(t), y: cy + r * Math.sin(t), far: t < 0 }
  }
  s -= ARC
  if (s < STRAIGHT) return { x: cxR - s, y: cy - r, far: true }
  s -= STRAIGHT
  const t = -Math.PI / 2 - s / r
  return { x: cxL + r * Math.cos(t), y: cy + r * Math.sin(t), far: Math.sin(t) < 0 }
}

/**
 * ピクセルが レーンの どこに あたるか。s は ながれる むきの きょり、w は まんなかからの よこずれ
 * （そとがわが プラス）。カーブの なかと そとを わける ために つかう。
 */
export function laneCoord(x: number, y: number): { s: number; w: number } {
  const { cxL, cxR, cy, r } = LANE
  if (x >= cxL && x <= cxR) {
    if (y > cy) return { s: x - cxL, w: y - (cy + r) }
    return { s: STRAIGHT + ARC + (cxR - x), w: (cy - r) - y }
  }
  if (x > cxR) {
    const d = Math.hypot(x - cxR, y - cy)
    const t = Math.atan2(y - cy, x - cxR)
    return { s: STRAIGHT + (Math.PI / 2 - t) * r, w: d - r }
  }
  const d = Math.hypot(x - cxL, y - cy)
  let t = Math.atan2(y - cy, x - cxL)
  if (t > -Math.PI / 2) t -= Math.PI * 2
  return { s: STRAIGHT * 2 + ARC + (-Math.PI / 2 - t) * r, w: d - r }
}

/** たいしょうの まえ（てまえの まっすぐの ところ）＝ あたらしい おすしを おく ところ。 */
export const DROP_S = CHEF_POS.x - LANE.cxL

/** s の ちがいを -L/2〜L/2 で（レーンは わに なっている）。 */
export function laneDelta(a: number, b: number): number {
  const d = mod(a - b, LANE_LENGTH)
  return d > LANE_LENGTH / 2 ? d - LANE_LENGTH : d
}

export { mod }
