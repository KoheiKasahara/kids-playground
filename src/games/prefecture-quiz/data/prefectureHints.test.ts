import { describe, expect, test } from 'vitest'
import { prefectures } from './prefectures'
import { prefectureHints } from './prefectureHints'

describe('都道府県のヒント', () => {
  test('47都道府県を過不足なくカバーし、県名を答えとして含めない', () => {
    expect(Object.keys(prefectureHints).sort()).toEqual(prefectures.map(({ id }) => id).sort())
    for (const prefecture of prefectures) {
      const hint = prefectureHints[prefecture.id]
      expect(hint.trim().length).toBeGreaterThan(0)
      expect(hint).not.toMatch(/[一-龯ァ-ヶ]/)
      expect(hint).not.toContain(prefecture.nameKanji)
      expect(hint).not.toContain(prefecture.nameHiragana)
    }
    expect(prefectureHints['15']).toBe('おこめが ゆうめいだよ！')
  })
})
