import type { RailVec3 } from './railModel'

/**
 * 踏切（crossing）の遮断機の動きを決める、描画に依存しない純粋関数。
 *
 * 遮断機の開き具合は 0（あいている）〜1（さがりきった）の値で持つ。
 * 電車の車両中心が踏切の中心から一定距離に入ったら下げ、全車両が
 * 離れたら上げる。距離は「最高速の電車が着く少し前に下がりきる」程度。
 */

/** 車両中心がこの水平距離より近いと遮断機を下げる。 */
export const RAIL_CROSSING_CLOSE_DISTANCE = 7
/**
 * 高さがこれ以上ちがう車両は無視する。踏切の真上を通る橋の電車で
 * 地上の遮断機が下りないようにする。
 */
export const RAIL_CROSSING_MAX_HEIGHT_DIFFERENCE = 1
/** 1秒あたりに進む開き具合。約0.7秒で上げ下げしきる。 */
export const RAIL_CROSSING_GATE_SPEED = 1.4
/** 警報灯が左右交互に点滅する周期（秒）。 */
export const RAIL_CROSSING_BLINK_PERIOD = 0.84

export function isRailCrossingApproached(
  crossingCenter: RailVec3,
  carPositions: readonly RailVec3[],
  closeDistance = RAIL_CROSSING_CLOSE_DISTANCE,
): boolean {
  return carPositions.some((car) => (
    Math.abs(car.y - crossingCenter.y) < RAIL_CROSSING_MAX_HEIGHT_DIFFERENCE
    && Math.hypot(car.x - crossingCenter.x, car.z - crossingCenter.z) < closeDistance
  ))
}

/** 遮断機の開き具合を目標へ一定速度で近づける。reducedMotionでは即座に切り替える。 */
export function stepRailCrossingGate(
  current: number,
  shouldClose: boolean,
  delta: number,
  reducedMotion = false,
): number {
  const target = shouldClose ? 1 : 0
  if (reducedMotion) return target
  const step = Math.max(0, delta) * RAIL_CROSSING_GATE_SPEED
  if (current < target) return Math.min(target, current + step)
  return Math.max(target, current - step)
}

/** 警報灯のどちら側が点いているか（0 か 1）。 */
export function railCrossingLitLamp(elapsed: number): 0 | 1 {
  const phase = ((elapsed % RAIL_CROSSING_BLINK_PERIOD) + RAIL_CROSSING_BLINK_PERIOD) % RAIL_CROSSING_BLINK_PERIOD
  return phase < RAIL_CROSSING_BLINK_PERIOD / 2 ? 0 : 1
}
