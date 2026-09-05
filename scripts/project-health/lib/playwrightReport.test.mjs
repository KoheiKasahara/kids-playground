import { describe, expect, it } from 'vitest'
import { parsePlaywrightSummary } from './playwrightReport.mjs'

describe('parsePlaywrightSummary', () => {
  it('全件成功した場合の対象数/成功数を返す', () => {
    expect(parsePlaywrightSummary({ stats: { expected: 25, unexpected: 0, skipped: 0, flaky: 0 } })).toEqual({
      total: 25,
      passed: 25,
    })
  })

  it('失敗を含む場合は成功数が対象数を下回る', () => {
    expect(parsePlaywrightSummary({ stats: { expected: 23, unexpected: 2, skipped: 0, flaky: 0 } })).toEqual({
      total: 25,
      passed: 23,
    })
  })

  it('対象ゲームが増えると対象数が追従する', () => {
    const before = parsePlaywrightSummary({ stats: { expected: 25, unexpected: 0, skipped: 0, flaky: 0 } })
    const after = parsePlaywrightSummary({ stats: { expected: 26, unexpected: 0, skipped: 0, flaky: 0 } })
    expect(after.total).toBe(before.total + 1)
  })

  it('レポートが無い/空の場合はnullを返す', () => {
    expect(parsePlaywrightSummary(null)).toBeNull()
    expect(parsePlaywrightSummary({})).toBeNull()
    expect(parsePlaywrightSummary({ stats: { expected: 0, unexpected: 0, skipped: 0, flaky: 0 } })).toBeNull()
  })
})
