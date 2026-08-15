import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test } from 'vitest'
import { PINBALL_THEMES } from './themes'
import {
  getPinballThemeId,
  PINBALL_THEME_STORAGE_KEY,
  resetPinballThemeCache,
} from './themeStore'
import PinballThemePicker from './PinballThemePicker'

describe('PinballThemePicker', () => {
  beforeEach(() => {
    localStorage.clear()
    resetPinballThemeCache()
  })

  test('既定ではノーマルテーマが選ばれている', () => {
    render(<PinballThemePicker />)

    expect(getPinballThemeId()).toBe('normal')
    expect(screen.getByRole('status')).toHaveTextContent('ノーマル')
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
  })

  test('「つぎ」を押すとテーマ名と絵文字が変わる', async () => {
    const user = userEvent.setup()
    render(<PinballThemePicker />)

    await user.click(screen.getByRole('button', { name: 'つぎの もよう' }))

    expect(screen.getByRole('status')).toHaveTextContent('うちゅう')
    expect(screen.getByRole('status')).toHaveTextContent('🚀')
  })

  test('最後のテーマで「つぎ」を押すと最初のテーマへ循環する', async () => {
    localStorage.setItem(PINBALL_THEME_STORAGE_KEY, 'candy')
    resetPinballThemeCache()
    const user = userEvent.setup()
    render(<PinballThemePicker />)

    await user.click(screen.getByRole('button', { name: 'つぎの もよう' }))

    expect(getPinballThemeId()).toBe('normal')
    expect(screen.getByRole('status')).toHaveTextContent('ノーマル')
  })

  test('最初のテーマで「まえ」を押すと最後のテーマへ循環する', async () => {
    const user = userEvent.setup()
    render(<PinballThemePicker />)

    await user.click(screen.getByRole('button', { name: 'まえの もよう' }))

    expect(getPinballThemeId()).toBe('candy')
    expect(screen.getByRole('status')).toHaveTextContent('おかし')
  })

  test('選んだテーマはlocalStorageの値にも反映される', async () => {
    const user = userEvent.setup()
    render(<PinballThemePicker />)

    await user.click(screen.getByRole('button', { name: 'つぎの もよう' }))

    expect(getPinballThemeId()).toBe('space')
    expect(localStorage.getItem(PINBALL_THEME_STORAGE_KEY)).toBe('space')
  })

  test('4テーマを登録順にすべて選べる', async () => {
    const user = userEvent.setup()
    render(<PinballThemePicker />)

    for (let index = 0; index < PINBALL_THEMES.length; index += 1) {
      if (index > 0) {
        await user.click(screen.getByRole('button', { name: 'つぎの もよう' }))
      }

      const theme = PINBALL_THEMES[index]
      expect(theme).toBeDefined()
      expect(screen.getByRole('status')).toHaveTextContent(theme.labelJa)
      expect(screen.getByRole('status')).toHaveTextContent(theme.emoji)
      expect(getPinballThemeId()).toBe(theme.id)
    }
  })

  test('左右ボタンにアクセシブルネームがある', () => {
    render(<PinballThemePicker />)

    expect(screen.getByRole('button', { name: 'まえの もよう' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'つぎの もよう' })).toBeInTheDocument()
  })
})
