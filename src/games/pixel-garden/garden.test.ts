import { describe, expect, test } from 'vitest'
import { createGarden, gardenHint, pickedCount, PLOT_COUNT, requestedPlot, tendPlot } from './garden'

describe('おはなばたけの進行', () => {
  test('道具で育ててお願いの順に摘む。元の状態は変えない', () => {
    const initial = createGarden()
    let garden = initial
    expect(gardenHint(garden)).toContain('たねまき')
    for (let i = 0; i < PLOT_COUNT; i++) garden = tendPlot(garden, i, 'water')
    expect(gardenHint(garden)).toContain('おみず')
    expect(tendPlot(garden, 0, 'sun')).toBe(garden)
    for (let i = 0; i < PLOT_COUNT; i++) garden = tendPlot(garden, i, 'water')
    expect(gardenHint(garden)).toContain('おひさま')
    expect(tendPlot(garden, 0, 'water')).toBe(garden)
    for (let i = 0; i < PLOT_COUNT; i++) garden = tendPlot(garden, i, 'sun')
    expect(gardenHint(garden)).toContain('おなじ')
    expect(pickedCount(garden)).toBe(0)
    expect(tendPlot(garden, 0, 'water')).toBe(garden)
    for (const [count, index] of [2, 5, 0, 4, 1, 3].entries()) {
      expect(requestedPlot(garden)).toBe(index)
      garden = tendPlot(garden, index, 'water')
      expect(pickedCount(garden)).toBe(count + 1)
      expect(tendPlot(garden, index, 'sun')).toBe(garden)
    }
    expect(requestedPlot(garden)).toBeUndefined()
    expect(initial.plots.every((stage) => stage === 'soil')).toBe(true)
    expect(createGarden(1)).toEqual({ round: 1, plots: initial.plots })
  })

  test('次の花束はお願いが変わり、どの周回も全ての花を摘める', () => {
    for (let round = 0; round < 12; round++) {
      let garden = createGarden(round)
      expect(requestedPlot(garden)).toBe((2 + round) % PLOT_COUNT)
      for (let i = 0; i < PLOT_COUNT; i++) {
        garden = tendPlot(garden, i, 'water')
        garden = tendPlot(garden, i, 'water')
        garden = tendPlot(garden, i, 'sun')
      }
      for (let i = 0; i < PLOT_COUNT; i++) garden = tendPlot(garden, requestedPlot(garden)!, 'sun')
      expect(pickedCount(garden)).toBe(PLOT_COUNT)
      expect(requestedPlot(garden)).toBeUndefined()
    }
  })

  test('範囲外や不正な花壇は進行しない', () => {
    const garden = createGarden()
    for (const index of [-1, PLOT_COUNT, NaN, Infinity, 0.5]) expect(tendPlot(garden, index, 'water')).toBe(garden)
  })
})
