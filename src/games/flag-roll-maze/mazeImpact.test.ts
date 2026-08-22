import { describe, expect, it } from 'vitest'
import {
  createImpactTracker,
  updateImpactTracker,
  WALL_HIT_COOLDOWN_MS,
  WALL_HIT_MAX_SPEED_DROP,
  WALL_HIT_MIN_SPEED_BEFORE,
  WALL_HIT_MIN_SPEED_DROP,
} from './mazeImpact'

const hitInput = {
  speedBefore: 4,
  speedAfter: 1,
  nowMs: 1000,
}

describe('mazeImpact', () => {
  it('ぶつかる前の速さが小さいと鳴らさない', () => {
    const result = updateImpactTracker(createImpactTracker(), {
      speedBefore: WALL_HIT_MIN_SPEED_BEFORE - 0.01,
      speedAfter: 0,
      nowMs: 1000,
    })

    expect(result.intensity).toBeNull()
  })

  it('速度の落差が小さいと鳴らさない', () => {
    const result = updateImpactTracker(createImpactTracker(), {
      speedBefore: 2,
      speedAfter: 2 - WALL_HIT_MIN_SPEED_DROP + 0.01,
      nowMs: 1000,
    })

    expect(result.intensity).toBeNull()
  })

  it('前回発火からクールダウン中は鳴らさない', () => {
    const first = updateImpactTracker(createImpactTracker(), hitInput)
    const second = updateImpactTracker(first.tracker, {
      ...hitInput,
      nowMs: hitInput.nowMs + WALL_HIT_COOLDOWN_MS - 1,
    })

    expect(first.intensity).not.toBeNull()
    expect(second.intensity).toBeNull()
    expect(second.tracker).toBe(first.tracker)
  })

  it('落差を0〜1のintensityへ変換する', () => {
    const atMinimum = updateImpactTracker(createImpactTracker(), {
      speedBefore: 3,
      speedAfter: 3 - WALL_HIT_MIN_SPEED_DROP,
      nowMs: 1000,
    })
    const atMaximum = updateImpactTracker(createImpactTracker(), {
      speedBefore: 4,
      speedAfter: 4 - WALL_HIT_MAX_SPEED_DROP,
      nowMs: 1000,
    })

    expect(atMinimum.intensity).toBeCloseTo(0)
    expect(atMaximum.intensity).toBeCloseTo(1)
  })

  it('NaNやInfinityが来ても鳴らさない', () => {
    for (const input of [
      { speedBefore: Number.NaN, speedAfter: 0, nowMs: 1000 },
      { speedBefore: 2, speedAfter: Number.POSITIVE_INFINITY, nowMs: 1000 },
      { speedBefore: 2, speedAfter: 0, nowMs: Number.NaN },
    ]) {
      const result = updateImpactTracker(createImpactTracker(), input)
      expect(result.intensity).toBeNull()
    }
  })

  it('クールダウンが明けると再び鳴らし、時刻を更新する', () => {
    const first = updateImpactTracker(createImpactTracker(), hitInput)
    const second = updateImpactTracker(first.tracker, {
      ...hitInput,
      nowMs: hitInput.nowMs + WALL_HIT_COOLDOWN_MS,
    })

    expect(second.intensity).not.toBeNull()
    expect(second.tracker).not.toBe(first.tracker)
    expect(second.tracker.lastHitAtMs).toBe(hitInput.nowMs + WALL_HIT_COOLDOWN_MS)
  })
})
