import { describe, expect, it } from 'vitest'
import {
  createSettleState,
  isCalm,
  SETTLE_ANGULAR_SPEED,
  SETTLE_LINEAR_SPEED,
  SETTLE_MAX_THROW_MS,
  SETTLE_MIN_THROW_MS,
  SETTLE_STABLE_MS,
  updateSettleState,
  type MotionSample,
} from './bowlingSettle'

const CALM: MotionSample = { linearSpeed: 0.01, angularSpeed: 0.02 }
const MOVING: MotionSample = { linearSpeed: 8, angularSpeed: 20 }

function run(state: ReturnType<typeof createSettleState>, samples: MotionSample[], ms: number) {
  const step = 10
  for (let elapsed = 0; elapsed < ms; elapsed += step) {
    if (updateSettleState(state, samples, step)) return true
  }
  return false
}

describe('静止の判定', () => {
  it('しきい値以下なら静止とみなす', () => {
    expect(isCalm([CALM, CALM])).toBe(true)
    expect(isCalm([{ linearSpeed: SETTLE_LINEAR_SPEED, angularSpeed: SETTLE_ANGULAR_SPEED }])).toBe(true)
  })

  it('1つでも動いていれば静止ではない', () => {
    expect(isCalm([CALM, MOVING])).toBe(false)
  })

  it('NaNは静止とみなさない（暴走を静止と誤判定しない）', () => {
    expect(isCalm([{ linearSpeed: Number.NaN, angularSpeed: 0 }])).toBe(false)
  })
})

describe('1投の終わり', () => {
  it('発射直後に全部が止まって見えても、最低待機時間より前には終わらない', () => {
    const state = createSettleState()
    expect(run(state, [CALM], SETTLE_MIN_THROW_MS - 50)).toBe(false)
    expect(state.settled).toBe(false)
  })

  it('落ち着いた状態が続いたら終わる', () => {
    const state = createSettleState()
    expect(run(state, [CALM], SETTLE_MIN_THROW_MS + SETTLE_STABLE_MS + 100)).toBe(true)
    expect(state.reason).toBe('stable')
  })

  it('動き続けている間は終わらない', () => {
    const state = createSettleState()
    expect(run(state, [MOVING], SETTLE_MAX_THROW_MS - 100)).toBe(false)
  })

  it('落ち着きかけて再び動いたら、静止時間は数え直す', () => {
    const state = createSettleState()
    // 最低待機時間の手前までは、静かでもまだ終わらない。
    run(state, [CALM], SETTLE_MIN_THROW_MS - 100)
    expect(state.settled).toBe(false)
    expect(state.stableMs).toBeGreaterThan(0)
    run(state, [MOVING], 50)
    expect(state.stableMs).toBe(0)
    expect(state.settled).toBe(false)
  })

  it('いつまでも転がり続けても最大待機時間で打ち切る', () => {
    const state = createSettleState()
    expect(run(state, [MOVING], SETTLE_MAX_THROW_MS + 100)).toBe(true)
    expect(state.reason).toBe('timeout')
  })

  it('いちど終わったら、その後に動かしても終わったまま', () => {
    const state = createSettleState()
    run(state, [CALM], SETTLE_MIN_THROW_MS + SETTLE_STABLE_MS + 100)
    const elapsedAtSettle = state.elapsedMs
    expect(updateSettleState(state, [MOVING], 100)).toBe(true)
    expect(state.elapsedMs).toBe(elapsedAtSettle)
  })
})
