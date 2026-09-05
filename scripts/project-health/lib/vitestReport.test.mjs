import { describe, expect, it } from 'vitest'
import { parseVitestSummary } from './vitestReport.mjs'

describe('parseVitestSummary', () => {
  it('vitest の JSON reporter 出力から件数を取り出す', () => {
    expect(parseVitestSummary({ numTotalTests: 10, numPassedTests: 9 })).toEqual({ total: 10, passed: 9 })
  })

  it('テストが増えると値が追従する', () => {
    const before = parseVitestSummary({ numTotalTests: 10, numPassedTests: 10 })
    const after = parseVitestSummary({ numTotalTests: 11, numPassedTests: 11 })
    expect(after.total).toBe(before.total + 1)
  })

  it('別フィールド名（numTotalTestResults等）でも読み取れる', () => {
    expect(parseVitestSummary({ numTotalTestResults: 5, numPassedTestResults: 4 })).toEqual({
      total: 5,
      passed: 4,
    })
  })

  it('レポートが無い/壊れている場合は null を返す', () => {
    expect(parseVitestSummary(null)).toEqual({ total: null, passed: null })
    expect(parseVitestSummary({})).toEqual({ total: null, passed: null })
  })
})
