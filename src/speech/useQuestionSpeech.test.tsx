import { act, render, renderHook } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { installSpeechSynthesisMock, uninstallSpeechSynthesisMock } from '../test/speechSynthesisMock'
import type { SpeechSynthesisMock } from '../test/speechSynthesisMock'
import { resetSpeechEnabledCache, setSpeechEnabled } from './speechSettingsStore'
import { useQuestionSpeech } from './useQuestionSpeech'

describe('useQuestionSpeech', () => {
  let mock: SpeechSynthesisMock

  beforeEach(() => {
    localStorage.clear()
    resetSpeechEnabledCache()
    mock = installSpeechSynthesisMock()
  })

  afterEach(() => {
    uninstallSpeechSynthesisMock()
  })

  test('OFF のときは読み上げない', () => {
    renderHook(() => useQuestionSpeech('もんだいです', 'q1'))

    expect(mock.spoken).toEqual([])
  })

  test('ON のときに questionKey が変わると読み上げる', () => {
    setSpeechEnabled(true)
    const { rerender } = renderHook(({ text, key }) => useQuestionSpeech(text, key), {
      initialProps: { text: 'もんだい1', key: 'q1' },
    })

    expect(mock.spoken).toEqual(['もんだい1'])

    rerender({ text: 'もんだい2', key: 'q2' })

    expect(mock.spoken).toEqual(['もんだい1', 'もんだい2'])
  })

  test('OFF → ON に切り替えると、現在の問題文をその場で読み上げる', () => {
    renderHook(() => useQuestionSpeech('いまのもんだい', 'q1'))

    expect(mock.spoken).toEqual([])

    act(() => {
      setSpeechEnabled(true)
    })

    expect(mock.spoken).toEqual(['いまのもんだい'])
  })

  test('ON → OFF で stopSpeaking()（cancel）が呼ばれる', () => {
    setSpeechEnabled(true)
    renderHook(() => useQuestionSpeech('もんだい', 'q1'))
    mock.reset()

    act(() => {
      setSpeechEnabled(false)
    })

    expect(mock.cancelCount).toBe(1)
    expect(mock.spoken).toEqual([])
  })

  test('問題切り替え時、前の読み上げが停止されてから次が読まれる', () => {
    setSpeechEnabled(true)
    const { rerender } = renderHook(({ text, key }) => useQuestionSpeech(text, key), {
      initialProps: { text: 'もんだい1', key: 'q1' },
    })
    mock.reset()

    rerender({ text: 'もんだい2', key: 'q2' })

    expect(mock.cancelCount).toBeGreaterThanOrEqual(1)
    expect(mock.spoken).toEqual(['もんだい2'])
  })

  test('アンマウントで停止する', () => {
    setSpeechEnabled(true)
    const { unmount } = renderHook(() => useQuestionSpeech('もんだい', 'q1'))
    mock.reset()

    unmount()

    expect(mock.cancelCount).toBe(1)
  })

  test('同じ questionKey のまま無関係な state だけ変えて再レンダーしても、読み上げ回数が増えない', () => {
    setSpeechEnabled(true)

    function Harness() {
      const [count, setCount] = useState(0)
      useQuestionSpeech('もんだい', 'q1')
      return (
        <button type="button" onClick={() => setCount((c) => c + 1)}>
          {count}
        </button>
      )
    }

    const { getByRole } = render(<Harness />)
    expect(mock.spoken).toEqual(['もんだい'])

    act(() => {
      getByRole('button').click()
    })
    act(() => {
      getByRole('button').click()
    })

    expect(mock.spoken).toEqual(['もんだい'])
  })

  test('text が null でも落ちず、読み上げない', () => {
    setSpeechEnabled(true)
    expect(() => renderHook(() => useQuestionSpeech(null, 'q1'))).not.toThrow()

    expect(mock.spoken).toEqual([])
  })

  test('text が空文字でも落ちず、読み上げない', () => {
    setSpeechEnabled(true)
    expect(() => renderHook(() => useQuestionSpeech('', 'q1'))).not.toThrow()

    expect(mock.spoken).toEqual([])
  })

  test('Web Speech 非対応環境でも例外にならない', () => {
    uninstallSpeechSynthesisMock()
    setSpeechEnabled(true)

    expect(() => renderHook(() => useQuestionSpeech('もんだい', 'q1'))).not.toThrow()
  })
})
