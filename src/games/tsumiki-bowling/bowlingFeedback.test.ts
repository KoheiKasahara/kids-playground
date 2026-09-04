import { describe, expect, it } from 'vitest'
import {
  BIG_COLLAPSE_COUNT,
  BIG_COLLAPSE_WINDOW_MS,
  BOUNCE_MIN_INTERVAL_MS,
  IMPACT_MIN_INTERVAL_MS,
  IMPACT_SPEED_DROP,
  IMPACT_STRONG_DROP,
  createFeedbackState,
  noteToppled,
  resetFeedbackState,
  takeBigCollapse,
  updateBallFeedback,
  type FeedbackVec3,
} from './bowlingFeedback'

const ZERO: FeedbackVec3 = { x: 0, y: 0, z: 0 }

function motion(speed: number, velocityY = 0): { position: FeedbackVec3; velocity: FeedbackVec3; speed: number } {
  return { position: ZERO, velocity: { x: 0, y: velocityY, z: 0 }, speed }
}

describe('updateBallFeedback: impact', () => {
  it('速度差がIMPACT_SPEED_DROP未満なら何も起きない', () => {
    const state = createFeedbackState()
    updateBallFeedback(state, motion(20), 16)
    const events = updateBallFeedback(state, motion(20 - IMPACT_SPEED_DROP + 0.1), 16)
    expect(events).toHaveLength(0)
  })

  it('速度差がIMPACT_SPEED_DROP以上でimpactが出る', () => {
    const state = createFeedbackState()
    updateBallFeedback(state, motion(20), 16)
    const events = updateBallFeedback(state, motion(20 - IMPACT_SPEED_DROP), 16)
    expect(events).toEqual([{ kind: 'impact', strength: 0, position: ZERO }])
  })

  it('strengthはIMPACT_SPEED_DROP〜IMPACT_STRONG_DROPの範囲で0〜1へ正規化される', () => {
    const state = createFeedbackState()
    updateBallFeedback(state, motion(30), 16)
    const events = updateBallFeedback(state, motion(30 - IMPACT_STRONG_DROP), 16)
    expect(events[0]).toMatchObject({ kind: 'impact', strength: 1 })
  })

  it('strengthは1を超えない（IMPACT_STRONG_DROPよりさらに落ちても頭打ち）', () => {
    const state = createFeedbackState()
    updateBallFeedback(state, motion(40), 16)
    const events = updateBallFeedback(state, motion(0), 16)
    expect(events[0]).toMatchObject({ kind: 'impact', strength: 1 })
  })

  it('IMPACT_MIN_INTERVAL_MS未満の間隔では連続してimpactを出さない', () => {
    const state = createFeedbackState()
    updateBallFeedback(state, motion(30), 16)
    const first = updateBallFeedback(state, motion(30 - IMPACT_SPEED_DROP), 16)
    expect(first).toHaveLength(1)
    // 直後にもう一度大きく減速しても、最小間隔未満なら出さない。
    const second = updateBallFeedback(state, motion(0), IMPACT_MIN_INTERVAL_MS - 1)
    expect(second.filter((e) => e.kind === 'impact')).toHaveLength(0)
  })

  it('IMPACT_MIN_INTERVAL_MS以上経てば再びimpactを出す', () => {
    const state = createFeedbackState()
    updateBallFeedback(state, motion(30), 16)
    updateBallFeedback(state, motion(30 - IMPACT_SPEED_DROP), 16)
    updateBallFeedback(state, motion(30 - IMPACT_SPEED_DROP), IMPACT_MIN_INTERVAL_MS)
    const events = updateBallFeedback(state, motion(0), 16)
    expect(events.filter((e) => e.kind === 'impact')).toHaveLength(1)
  })
})

describe('updateBallFeedback: bounce', () => {
  it('下向き→上向きの反転でbounceが出て、indexが1から始まる', () => {
    const state = createFeedbackState()
    updateBallFeedback(state, motion(10, -4), 16)
    const events = updateBallFeedback(state, motion(10, 2), 16)
    expect(events).toEqual([{ kind: 'bounce', index: 1, strength: expect.any(Number), position: ZERO }])
  })

  it('下向きの速さがBOUNCE_MIN_DOWN_SPEED未満なら反転してもbounceを出さない', () => {
    const state = createFeedbackState()
    updateBallFeedback(state, motion(10, -1), 16)
    const events = updateBallFeedback(state, motion(10, 2), 16)
    expect(events.filter((e) => e.kind === 'bounce')).toHaveLength(0)
  })

  it('上向きの速さがBOUNCE_MIN_UP_SPEED未満ならbounceを出さない', () => {
    const state = createFeedbackState()
    updateBallFeedback(state, motion(10, -4), 16)
    const events = updateBallFeedback(state, motion(10, 0.5), 16)
    expect(events.filter((e) => e.kind === 'bounce')).toHaveLength(0)
  })

  it('連続バウンドでindexが増えていく', () => {
    const state = createFeedbackState()
    updateBallFeedback(state, motion(10, -4), 16)
    const first = updateBallFeedback(state, motion(10, 3), 16)
    expect(first[0]).toMatchObject({ index: 1 })
    updateBallFeedback(state, motion(10, -4), BOUNCE_MIN_INTERVAL_MS)
    const second = updateBallFeedback(state, motion(10, 3), 16)
    expect(second[0]).toMatchObject({ index: 2 })
  })

  it('BOUNCE_MIN_INTERVAL_MS未満の間隔では連続してbounceを出さない', () => {
    const state = createFeedbackState()
    updateBallFeedback(state, motion(10, -4), 16)
    updateBallFeedback(state, motion(10, 3), 16)
    updateBallFeedback(state, motion(10, -4), 16)
    const events = updateBallFeedback(state, motion(10, 3), 16)
    expect(events.filter((e) => e.kind === 'bounce')).toHaveLength(0)
  })

  it('初回フレーム（前の速度が無い）ではbounceを出さない', () => {
    const state = createFeedbackState()
    const events = updateBallFeedback(state, motion(10, 5), 16)
    expect(events.filter((e) => e.kind === 'bounce')).toHaveLength(0)
  })

  it('strengthは0〜1に収まる', () => {
    const state = createFeedbackState()
    updateBallFeedback(state, motion(10, -20), 16)
    const events = updateBallFeedback(state, motion(10, 100), 16)
    const bounce = events.find((e) => e.kind === 'bounce')
    expect(bounce?.strength).toBeLessThanOrEqual(1)
    expect(bounce?.strength).toBeGreaterThan(0)
  })
})

describe('resetFeedbackState', () => {
  it('投球ごとに呼ぶと、バウンド回数とクールダウンが引き継がれない', () => {
    const state = createFeedbackState()
    updateBallFeedback(state, motion(10, -4), 16)
    updateBallFeedback(state, motion(10, 3), 16)
    expect(state.bounceCount).toBe(1)

    resetFeedbackState(state)
    expect(state.bounceCount).toBe(0)

    // リセット直後は「前フレームが無い」扱いなので、いきなり反転してもbounceは出ない。
    const events = updateBallFeedback(state, motion(10, 3), 16)
    expect(events.filter((e) => e.kind === 'bounce')).toHaveLength(0)
  })

  it('大崩壊の窓もリセットされる', () => {
    const state = createFeedbackState()
    noteToppled(state, 3, 100)
    expect(state.collapseCountInWindow).toBe(3)
    resetFeedbackState(state)
    expect(state.collapseCountInWindow).toBe(0)
    expect(state.collapseWindowMs).toBe(0)
  })
})

describe('noteToppled / takeBigCollapse', () => {
  it(`${BIG_COLLAPSE_COUNT}個未満ならtakeBigCollapseは0を返す`, () => {
    const state = createFeedbackState()
    noteToppled(state, BIG_COLLAPSE_COUNT - 1, 100)
    expect(takeBigCollapse(state)).toBe(0)
  })

  it(`窓の中で${BIG_COLLAPSE_COUNT}個以上倒れたら大崩壊としてその数を返し、窓をリセットする`, () => {
    const state = createFeedbackState()
    noteToppled(state, 2, 100)
    noteToppled(state, 3, 100)
    expect(takeBigCollapse(state)).toBe(5)
    expect(state.collapseCountInWindow).toBe(0)
    // リセット後にもう一度呼んでも0（同じ崩壊を二重に数えない）。
    expect(takeBigCollapse(state)).toBe(0)
  })

  it('窓の時間が過ぎたあとの新しい倒壊は、古い分を引き継がず数え直す', () => {
    const state = createFeedbackState()
    noteToppled(state, 3, BIG_COLLAPSE_WINDOW_MS + 1)
    // 窓は時間切れだが、まだtakeBigCollapseされていない古い3個が残っている状態で
    // 新しい倒壊が来ると、古い分は捨てて新しい分だけの窓になる。
    noteToppled(state, 1, 10)
    expect(state.collapseCountInWindow).toBe(1)
    expect(takeBigCollapse(state)).toBe(0)
  })

  it('deltaが0のフレームでも、窓が開いていれば経過時間だけ進む', () => {
    const state = createFeedbackState()
    noteToppled(state, 1, 100)
    noteToppled(state, 0, 50)
    expect(state.collapseWindowMs).toBe(150)
    expect(state.collapseCountInWindow).toBe(1)
  })

  it('倒壊が一度も無ければ、時間が進んでも窓は開かない', () => {
    const state = createFeedbackState()
    noteToppled(state, 0, 1000)
    expect(state.collapseWindowMs).toBe(0)
    expect(state.collapseCountInWindow).toBe(0)
  })
})
