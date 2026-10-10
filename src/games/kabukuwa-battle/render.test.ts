import { describe, expect, test } from 'vitest'
import { viewSize } from './render'
import { STAGES } from './stages'

describe('ドットの キャンバスの 大きさ', () => {
  test.each(STAGES.map(stage => [stage.id, stage] as const))('%s: どんな 画面でも ばしょ ぜんたいが はいる', (_id, stage) => {
    for (const [w, h, dpr] of [[390, 600, 3], [390, 600, 2], [390, 600, 1], [844, 260, 3], [1280, 640, 1], [320, 420, 2]]) {
      const view = viewSize(w, h, dpr, stage.minW, stage.minH)
      expect(view.w, `${w}x${h}@${dpr}`).toBeGreaterThanOrEqual(stage.minW - 1)
      expect(view.h, `${w}x${h}@${dpr}`).toBeGreaterThanOrEqual(stage.minH - 1)
      // キャンバスを はみださずに うめる。
      expect(view.w * view.scale).toBeGreaterThanOrEqual(view.dw - view.scale)
    }
  })

  test('こまかい 画面では せいすうばいで くっきり かく', () => {
    const view = viewSize(390, 600, 3, 210, 170)
    expect(Number.isInteger(view.scale)).toBe(true)
    expect(view.scale).toBe(5)
  })
})
