import { describe, expect, it } from 'vitest'
import { computeTrend, coveragePercent } from './historyTrend.mjs'

describe('computeTrend', () => {
  it('higherIsBetterで増加したらimproved', () => {
    expect(computeTrend(94, 90, 'higherIsBetter')).toEqual({ delta: 4, trend: 'up', judgement: 'improved' })
  })

  it('higherIsBetterで減少したらworsened', () => {
    expect(computeTrend(88, 94, 'higherIsBetter')).toEqual({ delta: -6, trend: 'down', judgement: 'worsened' })
  })

  it('lowerIsBetterで増加したらworsened（Bundle sizeの増加等）', () => {
    expect(computeTrend(1875, 1843, 'lowerIsBetter')).toEqual({ delta: 32, trend: 'up', judgement: 'worsened' })
  })

  it('lowerIsBetterで減少したらimproved（vulnerabilitiesの減少等）', () => {
    expect(computeTrend(0, 2, 'lowerIsBetter')).toEqual({ delta: -2, trend: 'down', judgement: 'improved' })
  })

  it('neutralは増減してもimproved/worsenedにしない（Unit testsの増減等）', () => {
    expect(computeTrend(650, 638, 'neutral')).toEqual({ delta: 12, trend: 'up', judgement: 'neutral' })
    expect(computeTrend(600, 638, 'neutral')).toEqual({ delta: -38, trend: 'down', judgement: 'neutral' })
  })

  it('変化なしはflat/neutral', () => {
    expect(computeTrend(96, 96, 'higherIsBetter')).toEqual({ delta: 0, trend: 'flat', judgement: 'neutral' })
  })

  it('現在値/前回値のどちらかが無い場合はnull（欠損値への耐性）', () => {
    expect(computeTrend(null, 90, 'higherIsBetter')).toBeNull()
    expect(computeTrend(90, null, 'higherIsBetter')).toBeNull()
    expect(computeTrend(undefined, undefined, 'higherIsBetter')).toBeNull()
  })
})

describe('coveragePercent', () => {
  it('passed/totalから百分率を計算する', () => {
    expect(coveragePercent(21, 42)).toBe(50)
    expect(coveragePercent(42, 42)).toBe(100)
  })

  it('小数第1位まで丸める', () => {
    expect(coveragePercent(1, 3)).toBe(33.3)
  })

  it('total が 0 以下や値が無い場合はnull', () => {
    expect(coveragePercent(0, 0)).toBeNull()
    expect(coveragePercent(null, 42)).toBeNull()
    expect(coveragePercent(1, null)).toBeNull()
  })
})
