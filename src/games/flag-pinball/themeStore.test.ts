import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  PINBALL_THEME_STORAGE_KEY,
  getPinballThemeId,
  resetPinballThemeCache,
  setPinballThemeId,
  subscribePinballThemeId,
} from './themeStore'

describe('themeStore', () => {
  beforeEach(() => {
    localStorage.clear()
    resetPinballThemeCache()
  })

  test('既定値は normal', () => {
    expect(getPinballThemeId()).toBe('normal')
  })

  test('localStorage に保存したテーマを読み出せる', () => {
    localStorage.setItem(PINBALL_THEME_STORAGE_KEY, 'ocean')
    resetPinballThemeCache()

    expect(getPinballThemeId()).toBe('ocean')
  })

  test('setPinballThemeId で保存され、購読者へ通知される', () => {
    const listener = vi.fn()
    const unsubscribe = subscribePinballThemeId(listener)

    setPinballThemeId('space')

    expect(localStorage.getItem(PINBALL_THEME_STORAGE_KEY)).toBe('space')
    expect(getPinballThemeId()).toBe('space')
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
  })

  test('同じテーマを再設定しても購読者へ通知しない', () => {
    const listener = vi.fn()
    const unsubscribe = subscribePinballThemeId(listener)

    setPinballThemeId('normal')
    expect(listener).not.toHaveBeenCalled()

    setPinballThemeId('candy')
    setPinballThemeId('candy')
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
  })

  test('未知のidは normal へフォールバックする', () => {
    localStorage.setItem(PINBALL_THEME_STORAGE_KEY, 'unknown')
    resetPinballThemeCache()

    expect(getPinballThemeId()).toBe('normal')
  })

  test('壊れた値（空文字）は normal へフォールバックする', () => {
    localStorage.setItem(PINBALL_THEME_STORAGE_KEY, '')
    resetPinballThemeCache()

    expect(getPinballThemeId()).toBe('normal')
  })

  test('localStorage.getItem が例外を投げても落ちず normal になる', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('boom')
    })

    expect(() => getPinballThemeId()).not.toThrow()
    expect(getPinballThemeId()).toBe('normal')

    spy.mockRestore()
  })

  test('localStorage.setItem が例外を投げてもキャッシュは更新される', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('boom')
    })

    expect(() => setPinballThemeId('candy')).not.toThrow()
    expect(getPinballThemeId()).toBe('candy')

    spy.mockRestore()
  })
})
