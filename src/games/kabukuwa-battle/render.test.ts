import { describe, expect, test } from 'vitest'
import { stageDots, viewSize, ZOOM } from './render'
import { STAGES } from './stages'

describe('ドットの キャンバスの 大きさ', () => {
  test.each(STAGES.map(stage => [stage.id, stage] as const))('%s: どんな 画面でも カメラの まどが ぜんぶ はいる', (_id, stage) => {
    const dots = stageDots(stage)
    expect(dots.w).toBe(Math.round(stage.viewW * ZOOM))
    for (const [w, h, dpr] of [[844, 390, 3], [852, 393, 2], [640, 360, 1], [1280, 720, 1], [390, 844, 3], [1024, 768, 2]]) {
      const view = viewSize(w, h, dpr, dots.w, dots.h)
      expect(view.w, `${w}x${h}@${dpr}`).toBeGreaterThanOrEqual(dots.w - 1)
      expect(view.h, `${w}x${h}@${dpr}`).toBeGreaterThanOrEqual(dots.h - 1)
      // キャンバスを はみださずに うめる。
      expect(view.w * view.scale).toBeGreaterThanOrEqual(view.dw - view.scale)
    }
  })

  test('こまかい 画面では せいすうばいで くっきり、よこむきの スマホでは むしが 大きく みえる', () => {
    const dots = stageDots(STAGES[0])
    const view = viewSize(844, 390, 3, dots.w, dots.h)
    expect(Number.isInteger(view.scale)).toBe(true)
    // 1ドットが CSS で 2px いじょうに なる（むしの 絵が 大きい）。
    expect(view.scale / 3).toBeGreaterThanOrEqual(2)
  })
})
