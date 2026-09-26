import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  HAPTICS_ENABLED_STORAGE_KEY,
  HAPTIC_PATTERNS,
  isHapticsEnabled,
  resetHapticsForTest,
  setHapticsEnabled,
  vibrate,
} from './haptics'

describe('haptics（Issue #784 A7）', () => {
  const vibrateMock = vi.fn(() => true)

  beforeEach(() => {
    localStorage.clear()
    resetHapticsForTest()
    vibrateMock.mockClear()
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: vibrateMock })
  })

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'vibrate')
    vi.useRealTimers()
  })

  test('既定は ON で、種類に応じたパターンで振動する', () => {
    expect(isHapticsEnabled()).toBe(true)
    vibrate('success')
    expect(vibrateMock).toHaveBeenCalledWith(HAPTIC_PATTERNS.success)
  })

  test('OFF にすると振動せず、設定は保存される', () => {
    setHapticsEnabled(false)
    expect(localStorage.getItem(HAPTICS_ENABLED_STORAGE_KEY)).toBe('off')
    vibrateMock.mockClear()
    vibrate('tap')
    expect(vibrateMock).not.toHaveBeenCalled()

    resetHapticsForTest()
    expect(isHapticsEnabled()).toBe(false)
  })

  test('連続した呼び出しは間引かれる', () => {
    vi.useFakeTimers()
    vibrate('impact')
    vibrate('impact')
    expect(vibrateMock).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(200)
    vibrate('impact')
    expect(vibrateMock).toHaveBeenCalledTimes(2)
  })

  test('navigator.vibrate が無い・例外を投げる環境でも落ちない', () => {
    Reflect.deleteProperty(navigator, 'vibrate')
    expect(() => vibrate('tap')).not.toThrow()
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: () => {
        throw new Error('blocked')
      },
    })
    resetHapticsForTest()
    expect(() => vibrate('tap')).not.toThrow()
  })
})
