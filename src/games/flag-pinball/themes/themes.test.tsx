import { render } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import carStyles from './carTheme.module.css'
import { carBoard } from '../boardConfigs/carBoard'
import { carTheme } from './carTheme'
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
  test('7テーマが指定順で揃い、id・emoji・labelJaが重複しない', () => {
    expect(PINBALL_THEMES.map((theme) => theme.id)).toEqual(['normal', 'space', 'ocean', 'candy', 'sky', 'car', 'forest'])
    expect(new Set(PINBALL_THEMES.map((theme) => theme.id)).size).toBe(7)
    expect(new Set(PINBALL_THEMES.map((theme) => theme.emoji)).size).toBe(7)
    expect(new Set(PINBALL_THEMES.map((theme) => theme.labelJa)).size).toBe(7)
  })

  test('盤面とおもちゃのクラス名は空でなく、テーマ間で重複しない', () => {
    expect(PINBALL_THEMES.every((theme) => theme.boardClassName !== '')).toBe(true)
    expect(PINBALL_THEMES.every((theme) => theme.toyClassName !== '')).toBe(true)
    expect(new Set(PINBALL_THEMES.map((theme) => theme.boardClassName)).size).toBe(7)
    expect(new Set(PINBALL_THEMES.map((theme) => theme.toyClassName)).size).toBe(7)
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


test('くるまtoyは車種ごとに描き分けたSVGの車を描く（前後のタイヤ付き）', () => {
  const base = carBoard.toys.filter((toy) => toy.kind === 'car')
  for (const toy of base) {
    const { container, unmount } = render(<>{carTheme.renderToy('car', toy)}</>)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg!.getAttribute('data-car-variant')).toBe(toy.car!.variant)
    expect(container.querySelectorAll(`.${carStyles.carWheelSpin}`)).toHaveLength(2)
    unmount()
  }
})

test('くるまtoyは配置データがなくても既定の車を描く', () => {
  const { container } = render(<>{carTheme.renderToy('car')}</>)
  expect(container.querySelector('svg')?.getAttribute('data-car-variant')).toBe('sedan')
})

test('同じ盤面に並んだ複数の車でも、SVGのグラデーションidが重複しない', () => {
  const { container } = render(
    <>
      {carBoard.toys.map((toy) => (
        <span key={toy.id}>{carTheme.renderToy(toy.kind, toy)}</span>
      ))}
    </>,
  )
  const ids = Array.from(container.querySelectorAll('[id]')).map((el) => el.id)
  expect(ids.length).toBeGreaterThan(0)
  expect(new Set(ids).size).toBe(ids.length)
})
