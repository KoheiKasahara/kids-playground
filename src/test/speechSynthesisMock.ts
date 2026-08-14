import { vi } from 'vitest'

/**
 * jsdom には Web Speech API (SpeechSynthesis) が実装されていないため、
 * speechEngine / useQuestionSpeech / SpeechToggle のテストで共通して使う最小限のモックを
 * ここにまとめる。window と globalThis の両方に生やすのは、
 * 実装側が `window.SpeechSynthesisUtterance` と裸の `SpeechSynthesisUtterance` の
 * どちらを参照しても解決できるようにするため。
 */

export class FakeUtterance {
  text: string
  lang = ''
  voice: SpeechSynthesisVoice | null = null
  rate = 1
  pitch = 1

  constructor(text?: string) {
    this.text = text ?? ''
  }
}

export type SpeechSynthesisMock = {
  /** 発話されたテキストの履歴 */
  spoken: string[]
  cancelCount: number
  utterances: FakeUtterance[]
  voices: SpeechSynthesisVoice[]
  setVoices(voices: Partial<SpeechSynthesisVoice>[]): void
  reset(): void
  /** 次の speak() 呼び出し1回だけ、speechSynthesis.speak() 自体が例外を投げるようにする（防御コードの検証用）。 */
  throwOnNextSpeak(): void
}

let originalSpeechSynthesis: unknown
let originalSpeechSynthesisUtterance: unknown
let hadSpeechSynthesisProperty = false
let hadUtteranceProperty = false

export function installSpeechSynthesisMock(): SpeechSynthesisMock {
  let shouldThrowOnNextSpeak = false

  const state: SpeechSynthesisMock = {
    spoken: [],
    cancelCount: 0,
    utterances: [],
    voices: [],
    setVoices(voices: Partial<SpeechSynthesisVoice>[]) {
      state.voices = voices as SpeechSynthesisVoice[]
    },
    reset() {
      state.spoken = []
      state.cancelCount = 0
      state.utterances = []
      state.voices = []
      shouldThrowOnNextSpeak = false
    },
    throwOnNextSpeak() {
      shouldThrowOnNextSpeak = true
    },
  }

  const fakeSpeechSynthesis = {
    getVoices: () => state.voices,
    speak: vi.fn((utterance: FakeUtterance) => {
      if (shouldThrowOnNextSpeak) {
        shouldThrowOnNextSpeak = false
        throw new Error('mock speak() failure')
      }
      state.spoken.push(utterance.text)
      state.utterances.push(utterance)
    }),
    cancel: vi.fn(() => {
      state.cancelCount += 1
    }),
  }

  hadSpeechSynthesisProperty = Object.prototype.hasOwnProperty.call(window, 'speechSynthesis')
  hadUtteranceProperty = Object.prototype.hasOwnProperty.call(window, 'SpeechSynthesisUtterance')
  originalSpeechSynthesis = hadSpeechSynthesisProperty
    ? (window as unknown as { speechSynthesis?: unknown }).speechSynthesis
    : undefined
  originalSpeechSynthesisUtterance = hadUtteranceProperty
    ? (window as unknown as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance
    : undefined

  Object.defineProperty(window, 'speechSynthesis', {
    value: fakeSpeechSynthesis,
    configurable: true,
    writable: true,
  })
  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    value: FakeUtterance,
    configurable: true,
    writable: true,
  })
  // 裸の `SpeechSynthesisUtterance` / `speechSynthesis` 参照も解決できるよう globalThis にも生やす。
  Object.defineProperty(globalThis, 'speechSynthesis', {
    value: fakeSpeechSynthesis,
    configurable: true,
    writable: true,
  })
  Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', {
    value: FakeUtterance,
    configurable: true,
    writable: true,
  })

  return state
}

export function uninstallSpeechSynthesisMock(): void {
  if (hadSpeechSynthesisProperty) {
    Object.defineProperty(window, 'speechSynthesis', {
      value: originalSpeechSynthesis,
      configurable: true,
      writable: true,
    })
    Object.defineProperty(globalThis, 'speechSynthesis', {
      value: originalSpeechSynthesis,
      configurable: true,
      writable: true,
    })
  } else {
    delete (window as unknown as { speechSynthesis?: unknown }).speechSynthesis
    delete (globalThis as unknown as { speechSynthesis?: unknown }).speechSynthesis
  }

  if (hadUtteranceProperty) {
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      value: originalSpeechSynthesisUtterance,
      configurable: true,
      writable: true,
    })
    Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', {
      value: originalSpeechSynthesisUtterance,
      configurable: true,
      writable: true,
    })
  } else {
    delete (window as unknown as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance
    delete (globalThis as unknown as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance
  }

  hadSpeechSynthesisProperty = false
  hadUtteranceProperty = false
  originalSpeechSynthesis = undefined
  originalSpeechSynthesisUtterance = undefined
}
