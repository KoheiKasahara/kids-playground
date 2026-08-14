import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { installSpeechSynthesisMock, uninstallSpeechSynthesisMock } from '../test/speechSynthesisMock'
import type { SpeechSynthesisMock } from '../test/speechSynthesisMock'
import { isSpeechSupported, speak, stopSpeaking } from './speechEngine'

describe('speechEngine', () => {
  test('jsdom そのままでは isSpeechSupported() は false', () => {
    expect(isSpeechSupported()).toBe(false)
  })

  test('speak() は非対応環境では例外を投げず何もしない', () => {
    expect(() => speak('こんにちは')).not.toThrow()
  })

  test('stopSpeaking() は非対応環境では例外を投げず何もしない', () => {
    expect(() => stopSpeaking()).not.toThrow()
  })

  describe('モックをインストールした状態', () => {
    let mock: SpeechSynthesisMock

    beforeEach(() => {
      mock = installSpeechSynthesisMock()
    })

    afterEach(() => {
      uninstallSpeechSynthesisMock()
    })

    test('モックインストール後は isSpeechSupported() が true になる', () => {
      expect(isSpeechSupported()).toBe(true)
    })

    test('speak() は cancel() してから speak() する', () => {
      speak('こんにちは')

      expect(mock.cancelCount).toBe(1)
      expect(mock.spoken).toEqual(['こんにちは'])
    })

    test('speak("   ") は何もしない', () => {
      speak('   ')

      expect(mock.spoken).toEqual([])
      expect(mock.cancelCount).toBe(0)
    })

    test('speak("") は何もしない', () => {
      speak('')

      expect(mock.spoken).toEqual([])
      expect(mock.cancelCount).toBe(0)
    })

    test('日本語音声があれば選ばれる', () => {
      mock.setVoices([
        { name: 'English', lang: 'en-US', localService: true },
        { name: 'Kyoko', lang: 'ja-JP', localService: false },
      ])

      speak('こんにちは')

      expect(mock.utterances[0].voice?.name).toBe('Kyoko')
    })

    test('localService: true の日本語音声がリモート音声より優先される', () => {
      mock.setVoices([
        { name: 'RemoteJa', lang: 'ja-JP', localService: false },
        { name: 'LocalJa', lang: 'ja_JP', localService: true },
      ])

      speak('こんにちは')

      expect(mock.utterances[0].voice?.name).toBe('LocalJa')
    })

    test('日本語音声がない場合は voice を設定せず lang だけで発話し、例外も投げない', () => {
      mock.setVoices([{ name: 'English', lang: 'en-US', localService: true }])

      expect(() => speak('こんにちは')).not.toThrow()
      expect(mock.utterances[0].voice).toBeNull()
      expect(mock.utterances[0].lang).toBe('ja-JP')
    })

    test('utterance.lang は常に ja-JP', () => {
      speak('こんにちは')

      expect(mock.utterances[0].lang).toBe('ja-JP')
    })

    test('utterance.rate / pitch は子ども向けの値', () => {
      speak('こんにちは')

      expect(mock.utterances[0].rate).toBe(0.95)
      expect(mock.utterances[0].pitch).toBe(1.05)
    })

    test('stopSpeaking() は cancel() を呼ぶ', () => {
      stopSpeaking()

      expect(mock.cancelCount).toBe(1)
    })

    test('speechSynthesis.speak が例外を投げても speak() の外には伝播しない', () => {
      mock.throwOnNextSpeak()

      expect(() => speak('こんにちは')).not.toThrow()
    })
  })
})
