import { describe, expect, it } from 'vitest'
import { parseNpmAudit } from './npmAudit.mjs'

describe('parseNpmAudit', () => {
  it('脆弱性0件も実データとして返す', () => {
    expect(
      parseNpmAudit({
        metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 } },
      }),
    ).toEqual({ total: 0, info: 0, low: 0, moderate: 0, high: 0, critical: 0 })
  })

  it('重大度ごとの件数を集計する', () => {
    expect(parseNpmAudit({ metadata: { vulnerabilities: { high: 1, critical: 1, total: 2 } } })).toEqual({
      total: 2,
      info: 0,
      low: 0,
      moderate: 0,
      high: 1,
      critical: 1,
    })
  })

  it('audit結果が無い/壊れている場合はnullを返す', () => {
    expect(parseNpmAudit(null)).toBeNull()
    expect(parseNpmAudit({})).toBeNull()
    expect(parseNpmAudit({ metadata: {} })).toBeNull()
  })
})
