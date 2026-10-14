import { MAX_ZOOM_LEVEL, MIN_ZOOM_LEVEL, type ZoomLevel } from './types'

// ピンチ後の小数段階が整数にごく近いとき、その段にいるとみなす許容幅。
const LEVEL_EPSILON = 0.05

/** 次の整数段へ寄る。ピンチ後の 2.4 なら 3 へ進む。 */
export function zoomIn(level: ZoomLevel): ZoomLevel {
  return Math.min(MAX_ZOOM_LEVEL, Math.floor(level + LEVEL_EPSILON) + 1)
}

/** 手前の整数段へ離れる。ピンチ後の 2.4 なら 2 へ戻る。 */
export function zoomOut(level: ZoomLevel): ZoomLevel {
  return Math.max(MIN_ZOOM_LEVEL, Math.ceil(level - LEVEL_EPSILON) - 1)
}
