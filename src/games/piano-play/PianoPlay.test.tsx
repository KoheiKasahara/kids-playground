import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import PianoPlay from './PianoPlay'
import { PIANO_SONGS } from './pianoSongs'

class MockAudioParam {
  value = 0
  setValueAtTime = vi.fn()
  exponentialRampToValueAtTime = vi.fn()
  cancelScheduledValues = vi.fn()
}

class MockNode {
  connect = vi.fn()
}

class MockGain extends MockNode {
  gain = new MockAudioParam()
}

class MockOscillator extends MockNode {
  type: OscillatorType = 'sine'
  frequency = { value: 0 }
  start = vi.fn()
  stop = vi.fn()
}

const contexts: MockAudioContext[] = []
class MockAudioContext {
  currentTime = 1
  state: AudioContextState = 'suspended'
  destination = new MockNode()
  resume = vi.fn(() => {
    this.state = 'running'
    return Promise.resolve()
  })
  close = vi.fn().mockResolvedValue(undefined)
  createGain = vi.fn(() => new MockGain())
  createOscillator = vi.fn(() => new MockOscillator())
  constructor() {
    contexts.push(this)
  }
}

describe('PianoPlay', () => {
  const originalAudioContext = window.AudioContext
  const originalMatchMedia = window.matchMedia
  let portraitMobile = false
  let dispatchMediaChange: (() => void) | undefined

  beforeEach(() => {
    contexts.length = 0
    portraitMobile = false
    dispatchMediaChange = undefined
    ;(window as unknown as { AudioContext: typeof MockAudioContext }).AudioContext = MockAudioContext
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({
        get matches() {
          return portraitMobile
        },
        addEventListener: vi.fn((event: string, listener: EventListener) => {
          if (event === 'change') dispatchMediaChange = () => listener(new Event('change'))
        }),
        removeEventListener: vi.fn(),
      })),
    })
  })

  afterEach(() => {
    window.AudioContext = originalAudioContext
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: originalMatchMedia })
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const renderPiano = () => render(<MemoryRouter><PianoPlay /></MemoryRouter>)

  test('白鍵8本と黒鍵5本を表示する', () => {
    renderPiano()
    expect(screen.getAllByRole('button').filter((button) => button.hasAttribute('data-note'))).toHaveLength(13)
    expect(screen.getByRole('button', { name: 'ド C4' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ド C5' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'C シャープ4' })).toBeInTheDocument()
  })

  test('曲選択にはPhase 3の全10曲を表示する', () => {
    renderPiano()

    expect(within(screen.getByLabelText('きょくを えらぶ')).getAllByRole('option')).toHaveLength(PIANO_SONGS.length)
    expect(screen.getByRole('option', { name: 'ハッピーバースデー' })).toBeInTheDocument()
  })

  test('5種類の楽器を選べる', () => {
    renderPiano()

    const instrumentGroup = screen.getByRole('group', { name: 'おとを えらぶ' })
    expect(within(instrumentGroup).getAllByRole('button')).toHaveLength(5)
    expect(screen.getByRole('button', { name: 'バイオリン' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '木琴' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ピアノ' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('C5も既存の鍵盤と同じ経路で発音・ハイライトできる', () => {
    renderPiano()
    const c5 = screen.getByRole('button', { name: 'ド C5' })
    fireEvent.pointerDown(c5, { pointerId: 6 })

    expect(contexts[0].createOscillator).toHaveBeenCalledTimes(2)
    expect(c5).toHaveAttribute('aria-pressed', 'true')

    fireEvent.pointerUp(c5, { pointerId: 6 })
    expect(c5).toHaveAttribute('aria-pressed', 'false')
  })

  test('スマホ縦では横向き案内だけを表示する', () => {
    portraitMobile = true
    renderPiano()

    expect(screen.getByRole('heading', { name: /よこにして/ })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'ピアノのけんばん' })).not.toBeInTheDocument()
  })

  test('向きの切替時に発音とハイライトを解除して通常鍵盤へ戻る', () => {
    renderPiano()
    const c4 = screen.getByRole('button', { name: 'ド C4' })
    fireEvent.pointerDown(c4, { pointerId: 7 })

    portraitMobile = true
    act(() => dispatchMediaChange?.())
    expect(screen.getByRole('heading', { name: /よこにして/ })).toBeInTheDocument()
    const oscillators = contexts[0].createOscillator.mock.results.map((result) => result.value)
    expect(oscillators.every((oscillator) => oscillator.stop.mock.calls.length === 1)).toBe(true)

    portraitMobile = false
    act(() => dispatchMediaChange?.())
    expect(screen.getByRole('button', { name: 'ド C4' })).toHaveAttribute('aria-pressed', 'false')
  })

  test('最初のpointerdownでAudioContextを開始し、pointerupで離鍵する', () => {
    renderPiano()
    const key = screen.getByRole('button', { name: 'ド C4' })
    fireEvent.pointerDown(key, { pointerId: 1 })

    expect(contexts).toHaveLength(1)
    expect(contexts[0].resume).toHaveBeenCalledTimes(1)
    expect(contexts[0].createOscillator).toHaveBeenCalledTimes(2)
    expect(key).toHaveAttribute('aria-pressed', 'true')

    fireEvent.pointerUp(key, { pointerId: 1 })
    expect(key).toHaveAttribute('aria-pressed', 'false')
    const oscillators = contexts[0].createOscillator.mock.results.map((result) => result.value)
    expect(oscillators.every((oscillator) => oscillator.stop.mock.calls.length === 1)).toBe(true)
  })

  test('同一鍵盤の連打と複数pointerを独立voiceで鳴らす', () => {
    renderPiano()
    const c = screen.getByRole('button', { name: 'ド C4' })
    const black = screen.getByRole('button', { name: 'C シャープ4' })

    fireEvent.pointerDown(c, { pointerId: 1 })
    fireEvent.pointerUp(c, { pointerId: 1 })
    fireEvent.pointerDown(c, { pointerId: 2 })
    fireEvent.pointerDown(black, { pointerId: 3 })

    expect(contexts[0].createOscillator).toHaveBeenCalledTimes(6)
    expect(c).toHaveAttribute('aria-pressed', 'true')
    expect(black).toHaveAttribute('aria-pressed', 'true')
  })

  test('キーボード由来のclickでも発音し、通常pointer clickは二重発音しない', () => {
    renderPiano()
    const key = screen.getByRole('button', { name: 'レ D4' })
    fireEvent.click(key, { detail: 0 })
    expect(contexts[0].createOscillator).toHaveBeenCalledTimes(2)

    fireEvent.pointerDown(key, { pointerId: 4 })
    fireEvent.click(key, { detail: 1 })
    expect(contexts[0].createOscillator).toHaveBeenCalledTimes(4)
  })

  test('自動演奏中も手動演奏を重ねられ、停止しても手動ハイライトを消さない', () => {
    vi.useFakeTimers()
    renderPiano()
    const c4 = screen.getByRole('button', { name: 'ド C4' })

    fireEvent.click(screen.getByRole('button', { name: /さいせい/ }))
    act(() => vi.advanceTimersByTime(0))
    expect(c4).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('えんそうちゅう')

    fireEvent.pointerDown(c4, { pointerId: 21 })
    fireEvent.click(screen.getByRole('button', { name: /とめる/ }))
    expect(c4).toHaveAttribute('aria-pressed', 'true')

    fireEvent.pointerUp(c4, { pointerId: 21 })
    expect(c4).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('status')).toHaveTextContent('じゅんびOK')
  })

  test('自動演奏中の楽器切替で演奏を停止せず、次の音符へ適用する', () => {
    vi.useFakeTimers()
    renderPiano()

    fireEvent.click(screen.getByRole('button', { name: /さいせい/ }))
    act(() => vi.advanceTimersByTime(0))
    fireEvent.click(screen.getByRole('button', { name: 'ラッパ' }))

    expect(screen.getByRole('status')).toHaveTextContent('えんそうちゅう')
    expect(screen.getByRole('button', { name: 'ラッパ' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('曲切り替えで旧曲の予約とハイライトを確実に取り消す', () => {
    vi.useFakeTimers()
    renderPiano()
    const c4 = screen.getByRole('button', { name: 'ド C4' })

    fireEvent.click(screen.getByRole('button', { name: /さいせい/ }))
    act(() => vi.advanceTimersByTime(0))
    expect(c4).toHaveAttribute('aria-pressed', 'true')
    const oscillatorCallsBeforeChange = contexts[0].createOscillator.mock.calls.length

    fireEvent.change(screen.getByLabelText('きょくを えらぶ'), { target: { value: 'mary-had-a-little-lamb' } })
    expect(c4).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('いまのきょく：メリーさんのひつじ')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(60_000))
    expect(contexts[0].createOscillator).toHaveBeenCalledTimes(oscillatorCallsBeforeChange)
  })

  test('自然終了後に再生中表示を残さず、再生ボタンで最初から再開できる', () => {
    vi.useFakeTimers()
    renderPiano()
    const play = screen.getByRole('button', { name: /さいせい/ })

    fireEvent.click(play)
    act(() => vi.advanceTimersByTime(PIANO_SONGS[0].totalDurationMs + 2))
    expect(screen.getByRole('status')).toHaveTextContent('おわり')
    expect(screen.getByRole('button', { name: /とめる/ })).toBeDisabled()

    fireEvent.click(play)
    act(() => vi.advanceTimersByTime(0))
    expect(screen.getByRole('status')).toHaveTextContent('えんそうちゅう')
  })

  test('自動演奏中に縦画面へ切り替えると停止し、横へ戻っても旧曲を再開しない', () => {
    vi.useFakeTimers()
    renderPiano()

    fireEvent.click(screen.getByRole('button', { name: /さいせい/ }))
    act(() => vi.advanceTimersByTime(0))
    const oscillatorCallsBeforeOrientationChange = contexts[0].createOscillator.mock.calls.length
    portraitMobile = true
    act(() => dispatchMediaChange?.())
    expect(screen.getByRole('heading', { name: /よこにして/ })).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(60_000))
    expect(contexts[0].createOscillator).toHaveBeenCalledTimes(oscillatorCallsBeforeOrientationChange)
    portraitMobile = false
    act(() => dispatchMediaChange?.())
    expect(screen.getByRole('button', { name: 'ド C4' })).toHaveAttribute('aria-pressed', 'false')
  })

  test('画面離脱で発音中voiceを止めAudioContextを閉じる', () => {
    const { unmount } = renderPiano()
    fireEvent.pointerDown(screen.getByRole('button', { name: 'ミ E4' }), { pointerId: 5 })
    unmount()

    expect(contexts[0].close).toHaveBeenCalledTimes(1)
    const oscillators = contexts[0].createOscillator.mock.results.map((result) => result.value)
    expect(oscillators.every((oscillator) => oscillator.stop.mock.calls.length === 1)).toBe(true)
  })
})
