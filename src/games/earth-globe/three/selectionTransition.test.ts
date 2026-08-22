import { describe, expect, it } from 'vitest'
import {
  BASE_SELECTED_BORDER_SCALE,
  POLYGONS_TRANSITION_DURATION_MS,
  sampleBorderScaleAnimation,
  type BorderScaleAnimation,
} from './selectionTransition'

function risingAnimation(): BorderScaleAnimation {
  return {
    fromScale: BASE_SELECTED_BORDER_SCALE,
    toScale: 1,
    startedAt: 1_000,
    durationMs: POLYGONS_TRANSITION_DURATION_MS,
  }
}

describe('globe selection transition', () => {
  it('starts the selected outline at the normal border radius', () => {
    expect(sampleBorderScaleAnimation(risingAnimation(), 1_000)).toEqual({
      scale: BASE_SELECTED_BORDER_SCALE,
      complete: false,
    })
  })

  it('matches three-globe quadratic in-out easing while rising', () => {
    const animation = risingAnimation()
    const quarter = sampleBorderScaleAnimation(
      animation,
      animation.startedAt + POLYGONS_TRANSITION_DURATION_MS * 0.25,
    )
    const expectedQuarterScale = BASE_SELECTED_BORDER_SCALE
      + (1 - BASE_SELECTED_BORDER_SCALE) * 0.125

    expect(quarter.scale).toBeCloseTo(expectedQuarterScale)
    expect(quarter.complete).toBe(false)
  })

  it('finishes exactly at the selected radius', () => {
    const animation = risingAnimation()

    expect(sampleBorderScaleAnimation(
      animation,
      animation.startedAt + POLYGONS_TRANSITION_DURATION_MS,
    )).toEqual({ scale: 1, complete: true })
  })

  it('uses the same interpolation in reverse when changing countries', () => {
    const animation: BorderScaleAnimation = {
      fromScale: 1,
      toScale: BASE_SELECTED_BORDER_SCALE,
      startedAt: 2_000,
      durationMs: POLYGONS_TRANSITION_DURATION_MS,
    }

    expect(sampleBorderScaleAnimation(
      animation,
      animation.startedAt + POLYGONS_TRANSITION_DURATION_MS,
    )).toEqual({ scale: BASE_SELECTED_BORDER_SCALE, complete: true })
  })
})
