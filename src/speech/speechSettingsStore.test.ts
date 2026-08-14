import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  SPEECH_ENABLED_STORAGE_KEY,
  isSpeechEnabled,
  resetSpeechEnabledCache,
  setSpeechEnabled,
  subscribeSpeechEnabled,
} from './speechSettingsStore'

describe('speechSettingsStore', () => {
  beforeEach(() => {
    localStorage.clear()
    resetSpeechEnabledCache()
  })

  test('初期値は OFF（localStorage が空）', () => {
    expect(isSpeechEnabled()).toBe(false)
  })

  test('localStorage に "on" があれば復元される', () => {
    localStorage.setItem(SPEECH_ENABLED_STORAGE_KEY, 'on')
    resetSpeechEnabledCache()

    expect(isSpeechEnabled()).toBe(true)
  })

  test('未知の値は OFF にフォールバックする', () => {
    localStorage.setItem(SPEECH_ENABLED_STORAGE_KEY, 'yes-please')
    resetSpeechEnabledCache()

    expect(isSpeechEnabled()).toBe(false)
  })

  test('壊れた値（空文字）も OFF にフォールバックする', () => {
    localStorage.setItem(SPEECH_ENABLED_STORAGE_KEY, '')
    resetSpeechEnabledCache()

    expect(isSpeechEnabled()).toBe(false)
  })

  test('setSpeechEnabled(true) で localStorage に保存される', () => {
    setSpeechEnabled(true)

    expect(localStorage.getItem(SPEECH_ENABLED_STORAGE_KEY)).toBe('on')
    expect(isSpeechEnabled()).toBe(true)
  })

  test('setSpeechEnabled(false) で localStorage に "off" が保存される', () => {
    setSpeechEnabled(true)
    setSpeechEnabled(false)

    expect(localStorage.getItem(SPEECH_ENABLED_STORAGE_KEY)).toBe('off')
    expect(isSpeechEnabled()).toBe(false)
  })

  test('購読者は値が変化したときにだけ通知される', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeSpeechEnabled(listener)

    setSpeechEnabled(true)
    expect(listener).toHaveBeenCalledTimes(1)

    // 同じ値を再設定しても変化していないので通知されない
    setSpeechEnabled(true)
    expect(listener).toHaveBeenCalledTimes(1)

    setSpeechEnabled(false)
    expect(listener).toHaveBeenCalledTimes(2)

    unsubscribe()
  })

  test('unsubscribe 後は通知されない', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeSpeechEnabled(listener)

    unsubscribe()
    setSpeechEnabled(true)

    expect(listener).not.toHaveBeenCalled()
  })

  test('localStorage.getItem が例外を投げても落ちず OFF になる', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('boom')
    })

    expect(() => isSpeechEnabled()).not.toThrow()
    expect(isSpeechEnabled()).toBe(false)

    spy.mockRestore()
  })

  test('localStorage.setItem が例外を投げても落ちない（メモリ上のキャッシュは更新される）', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('boom')
    })

    expect(() => setSpeechEnabled(true)).not.toThrow()
    expect(isSpeechEnabled()).toBe(true)

    spy.mockRestore()
  })
})
