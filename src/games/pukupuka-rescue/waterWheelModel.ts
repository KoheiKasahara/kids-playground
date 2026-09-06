import type { WaterWheelDefinition } from './types'

// 水車（#520）の回転状態だけを持つモジュール。羽根の向き（角度）を積分するだけにし、
// 歯車のかみ合いや水流トルクの計算は行わない（Issue #520の非目標）。
//
// 「水にどれだけ浸かっているか」を回転の速さに変換する考え方は floatModel.ts の
// 浮遊物と同じにして、水車専用の判定を増やさないようにしている。ただし浮遊物のような
// 段階的な追従はさせず、しきい値を境に「まわる/とまる」をはっきり切り替える。
// これは「回転開始/停止が分かりやすい」という完了条件を、複雑な物理を足さずに満たすため。

export type WaterWheelState = {
  /** 現在の回転角(度)。0〜360で正規化する。表示側はそのまま rotate() に渡せる。 */
  readonly angleDeg: number
}

/** 回っているときの回転の速さ（度/秒）。 */
export const WATER_WHEEL_SPIN_SPEED_DEG = 260
/** 「水にはっきり浸かっている」とみなす沈み込み割合のしきい値。回転・連動アクション共通で使う。 */
export const WATER_WHEEL_SPIN_THRESHOLD = 0.15

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

export function createWaterWheelState(): WaterWheelState {
  return { angleDeg: 0 }
}

/** 水車がどれだけ沈んでいるか(0〜1)。floatModel.tsの浮遊物と同じ考え方を流用する。 */
export function waterWheelSubmergedRatio(
  definition: WaterWheelDefinition,
  surfaceY: number | undefined,
): number {
  if (surfaceY === undefined) return 0
  return clamp((definition.cy + definition.radius - surfaceY) / (definition.radius * 2), 0, 1)
}

/** はっきり回っている（＝連動アクションが働く）かどうか。 */
export function isWaterWheelSpinningAt(submergedRatio: number): boolean {
  return submergedRatio > WATER_WHEEL_SPIN_THRESHOLD
}

/**
 * 沈み込み具合と流れの向きから、いまの回転の速さ（度/秒、符号が向き）を返す。
 * しきい値未満なら0にすることで「浸かった瞬間に一定の速さで回りだす/離れた瞬間に止まる」
 * というはっきりした切り替えになる。
 */
export function waterWheelSpinSpeedDeg(submergedRatio: number, driftDirection: number): number {
  return isWaterWheelSpinningAt(submergedRatio) ? WATER_WHEEL_SPIN_SPEED_DEG * driftDirection : 0
}

/** 水車を1ステップ進める。回っていない（spinSpeedDeg === 0）なら同じ状態を返す。 */
export function stepWaterWheel(
  state: WaterWheelState,
  spinSpeedDeg: number,
  deltaSeconds: number,
): WaterWheelState {
  if (spinSpeedDeg === 0) return state
  const angleDeg = (state.angleDeg + spinSpeedDeg * deltaSeconds) % 360
  return { angleDeg: angleDeg < 0 ? angleDeg + 360 : angleDeg }
}
