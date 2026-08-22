import { BASE_BORDER_RADIUS, SELECTED_BORDER_RADIUS } from './globeLayers'

/** three-globe のポリゴン高度アニメーションと同じ時間にそろえる。 */
export const POLYGONS_TRANSITION_DURATION_MS = 260
/** タップ時に選択国を一段高く押し上げる時間。 */
export const SELECTION_POP_RISE_DURATION_MS = 110
/** 押し上げ後、既存の選択高度へ自然に落ち着かせる時間。 */
export const SELECTION_POP_SETTLE_DURATION_MS = 150

/** 選択時半径で作った線を、通常の国境線と同じ半径へ重ねるためのscale。 */
export const BASE_SELECTED_BORDER_SCALE = BASE_BORDER_RADIUS / SELECTED_BORDER_RADIUS

export type BorderScaleAnimation = {
  readonly fromScale: number
  readonly toScale: number
  readonly startedAt: number
  readonly durationMs: number
}

type BorderScaleSample = {
  readonly scale: number
  readonly complete: boolean
}

/** @tweenjs/tween.js の Easing.Quadratic.InOut と同じ補間。 */
function easeQuadraticInOut(progress: number): number {
  return progress < 0.5
    ? 2 * progress * progress
    : 1 - ((-2 * progress + 2) ** 2) / 2
}

export function sampleBorderScaleAnimation(
  animation: BorderScaleAnimation,
  now: number,
): BorderScaleSample {
  const progress = Math.min(
    1,
    Math.max(0, (now - animation.startedAt) / animation.durationMs),
  )
  const easedProgress = easeQuadraticInOut(progress)

  return {
    scale: animation.fromScale
      + (animation.toScale - animation.fromScale) * easedProgress,
    complete: progress >= 1,
  }
}
