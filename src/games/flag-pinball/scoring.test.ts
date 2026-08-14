import { describe, expect, it } from 'vitest'
import {
  createScoreState,
  isAllScored,
  recordBallScore,
  scoredCount,
  toBallResults,
  totalScore,
} from './scoring'

describe('createScoreState', () => {
  it('初期状態は全てnull・合計0・未完了', () => {
    const state = createScoreState(['jp', 'kr', 'cn'])
    expect(state.scores).toEqual([null, null, null])
    expect(totalScore(state)).toBe(0)
    expect(isAllScored(state)).toBe(false)
    expect(scoredCount(state)).toBe(0)
  })
})

describe('recordBallScore', () => {
  it('1球確定すると合計が増える', () => {
    const state = createScoreState(['jp', 'kr', 'cn'])
    const next = recordBallScore(state, 0, 300)
    expect(next.scores).toEqual([300, null, null])
    expect(totalScore(next)).toBe(300)
    expect(scoredCount(next)).toBe(1)
  })

  it('同じballIndexを二度記録しても合計が増えず、同じ参照が返る（二重加算しない）', () => {
    const state = createScoreState(['jp', 'kr', 'cn'])
    const once = recordBallScore(state, 0, 300)
    const twice = recordBallScore(once, 0, 1000)
    expect(twice).toBe(once)
    expect(totalScore(twice)).toBe(300)
  })

  it('範囲外のballIndexは無視し、同じ参照が返る', () => {
    const state = createScoreState(['jp', 'kr', 'cn'])
    expect(recordBallScore(state, -1, 100)).toBe(state)
    expect(recordBallScore(state, 3, 100)).toBe(state)
  })

  it('3球確定するとisAllScoredがtrueになり、合計が正しい', () => {
    let state = createScoreState(['jp', 'kr', 'cn'])
    state = recordBallScore(state, 0, 100)
    state = recordBallScore(state, 1, 1000)
    state = recordBallScore(state, 2, 300)
    expect(isAllScored(state)).toBe(true)
    expect(scoredCount(state)).toBe(3)
    expect(totalScore(state)).toBe(1400)
  })

  it('元のstateを破壊しない', () => {
    const state = createScoreState(['jp', 'kr', 'cn'])
    const before = state.scores
    recordBallScore(state, 0, 300)
    expect(state.scores).toBe(before)
    expect(state.scores).toEqual([null, null, null])
  })
})

describe('toBallResults', () => {
  it('確定済みだけをballIndex昇順で返す', () => {
    let state = createScoreState(['jp', 'kr', 'cn'])
    state = recordBallScore(state, 2, 300)
    state = recordBallScore(state, 0, 1000)
    expect(toBallResults(state)).toEqual([
      { ballIndex: 0, flagId: 'jp', score: 1000 },
      { ballIndex: 2, flagId: 'cn', score: 300 },
    ])
  })

  it('未確定の球を含まない', () => {
    const state = createScoreState(['jp', 'kr', 'cn'])
    expect(toBallResults(state)).toEqual([])
  })
})
