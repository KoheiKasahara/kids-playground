import { describe, expect, test } from 'vitest'
import { DEFAULT_PINBALL_THEME_ID, PINBALL_THEMES, resolvePinballTheme } from './index'
import type { PinballThemeId } from './types'

const toyKinds = ['spinner', 'launcher', 'jumppad', 'seesaw', 'hammer', 'wind', 'car'] as const
const expectedDefinitionKeys = [
  'boardClassName',
  'emoji',
  'id',
  'labelJa',
  'renderBackdrop',
  'renderToy',
  'toyClassName',
].sort()

describe('flag-pinball themes', () => {
  test('6テーマが指定順で揃い、id・emoji・labelJaが重複しない', () => {
    expect(PINBALL_THEMES.map((theme) => theme.id)).toEqual(['normal', 'space', 'ocean', 'candy', 'sky', 'car'])
    expect(new Set(PINBALL_THEMES.map((theme) => theme.id)).size).toBe(6)
    expect(new Set(PINBALL_THEMES.map((theme) => theme.emoji)).size).toBe(6)
    expect(new Set(PINBALL_THEMES.map((theme) => theme.labelJa)).size).toBe(6)
  })

  test('盤面とおもちゃのクラス名は空でなく、テーマ間で重複しない', () => {
    expect(PINBALL_THEMES.every((theme) => theme.boardClassName !== '')).toBe(true)
    expect(PINBALL_THEMES.every((theme) => theme.toyClassName !== '')).toBe(true)
    expect(new Set(PINBALL_THEMES.map((theme) => theme.boardClassName)).size).toBe(6)
    expect(new Set(PINBALL_THEMES.map((theme) => theme.toyClassName)).size).toBe(6)
  })

  test('renderToy は全種類で絵を返す', () => {
    for (const theme of PINBALL_THEMES) {
      for (const kind of toyKinds) {
        expect(theme.renderToy(kind)).not.toBeNull()
        expect(theme.renderToy(kind)).not.toBeUndefined()
      }
    }
  })

  test('未知id・null・undefinedは既定テーマへフォールバックする', () => {
    expect(resolvePinballTheme('not-found').id).toBe(DEFAULT_PINBALL_THEME_ID)
    expect(resolvePinballTheme(null).id).toBe(DEFAULT_PINBALL_THEME_ID)
    expect(resolvePinballTheme(undefined).id).toBe(DEFAULT_PINBALL_THEME_ID)
  })

  test('テーマ定義には盤面座標・得点・物理のプロパティを持たない', () => {
    for (const theme of PINBALL_THEMES) {
      expect(Object.keys(theme).sort()).toEqual(expectedDefinitionKeys)
      expect(theme.id satisfies PinballThemeId).toBe(theme.id)
    }
  })
})
