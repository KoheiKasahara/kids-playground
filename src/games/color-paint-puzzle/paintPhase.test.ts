import { describe, expect, test } from 'vitest'
import { INITIAL_PAINT_PHASE, canPaint, reducePaintPhase } from './paintPhase'

describe('paintPhase', () => {
  test('初期フェーズは coloring', () => {
    expect(INITIAL_PAINT_PHASE).toBe('coloring')
  })

  test('coloringで「できた！」を押すとcelebratingになる', () => {
    expect(reducePaintPhase('coloring', 'finish')).toBe('celebrating')
  })

  test('celebrating中の「できた！」は無視され、同じフェーズのまま（多重起動しない）', () => {
    expect(reducePaintPhase('celebrating', 'finish')).toBe('celebrating')
  })

  test('「できた！」を何回連打してもcelebratingのまま', () => {
    let phase = reducePaintPhase(INITIAL_PAINT_PHASE, 'finish')
    for (let i = 0; i < 10; i += 1) {
      phase = reducePaintPhase(phase, 'finish')
    }
    expect(phase).toBe('celebrating')
  })

  test('「もういちどぬる」でcoloringへ戻る', () => {
    expect(reducePaintPhase('celebrating', 'backToColoring')).toBe('coloring')
  })

  test('coloringで「もういちどぬる」相当が来てもcoloringのまま', () => {
    expect(reducePaintPhase('coloring', 'backToColoring')).toBe('coloring')
  })

  test('完成→もどる→完成 を繰り返しても状態が壊れない', () => {
    let phase = INITIAL_PAINT_PHASE
    for (let i = 0; i < 3; i += 1) {
      phase = reducePaintPhase(phase, 'finish')
      expect(phase).toBe('celebrating')
      phase = reducePaintPhase(phase, 'backToColoring')
      expect(phase).toBe('coloring')
    }
  })

  test('塗れるのは coloring のときだけ', () => {
    expect(canPaint('coloring')).toBe(true)
    expect(canPaint('celebrating')).toBe(false)
  })
})
