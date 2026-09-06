import { describe, expect, it } from 'vitest'
import { parseLighthouseSummary, roundScore } from './lighthouseReport.mjs'

describe('roundScore', () => {
  it('0〜1のfloatスコアを0〜100の整数へ丸める', () => {
    expect(roundScore(0.94)).toBe(94)
    expect(roundScore(1)).toBe(100)
    expect(roundScore(0)).toBe(0)
  })

  it('数値でない場合はnullを返す', () => {
    expect(roundScore(null)).toBeNull()
    expect(roundScore(undefined)).toBeNull()
    expect(roundScore(Number.NaN)).toBeNull()
  })
})

describe('parseLighthouseSummary', () => {
  it('先頭ターゲットのスコアを返す', () => {
    const result = parseLighthouseSummary({
      targets: [
        { name: 'Top', path: '/', performance: 94, accessibility: 96 },
        { name: 'Game', path: '/games/x', performance: 80, accessibility: 90 },
      ],
    })
    expect(result).toEqual({ name: 'Top', performance: 94, accessibility: 96 })
  })

  it('計測失敗（null）を保持しつつクラッシュしない', () => {
    const result = parseLighthouseSummary({
      targets: [{ name: 'Top', path: '/', performance: null, accessibility: null }],
    })
    expect(result).toEqual({ name: 'Top', performance: null, accessibility: null })
  })

  it('サマリが無い場合は全てnullを返す', () => {
    expect(parseLighthouseSummary(null)).toEqual({ name: null, performance: null, accessibility: null })
    expect(parseLighthouseSummary({})).toEqual({ name: null, performance: null, accessibility: null })
    expect(parseLighthouseSummary({ targets: [] })).toEqual({ name: null, performance: null, accessibility: null })
  })
})
