import { describe, expect, test } from 'vitest'
import { createGarden, gardenHint, pickedCount, PLOT_COUNT, tendPlot } from './garden'

describe('おはなばたけの進行', () => {
  test('どの順で育てても6本を1回ずつ花束にでき、元の状態は変えない', () => {
    const initial = createGarden()
    let garden = initial
    expect(gardenHint(garden)).toContain('たねまき')
    for (const index of [5, 1, 3, 0, 4, 2]) garden = tendPlot(garden, index)
    expect(gardenHint(garden)).toContain('おみず')
    for (let n = 0; n < 2; n++) for (let i = 0; i < PLOT_COUNT; i++) garden = tendPlot(garden, i)
    expect(pickedCount(garden)).toBe(0)
    expect(gardenHint(garden)).toContain('さいた')
    for (let i = 0; i < PLOT_COUNT; i++) {
      garden = tendPlot(garden, i)
      expect(pickedCount(garden)).toBe(i + 1)
      expect(tendPlot(garden, i)).toBe(garden)
    }
    expect(initial.plots.every((stage) => stage === 'soil')).toBe(true)
    expect(createGarden(1)).toEqual({ round: 1, plots: initial.plots })
  })

  test('範囲外や不正な花壇は進行しない', () => {
    const garden = createGarden()
    for (const index of [-1, PLOT_COUNT, NaN, Infinity, 0.5]) expect(tendPlot(garden, index)).toBe(garden)
  })
})
