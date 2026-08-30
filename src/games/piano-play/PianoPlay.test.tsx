import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import PianoPlay from './PianoPlay'

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
  resume = vi.fn().mockResolvedValue(undefined)
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

  test('画面離脱で発音中voiceを止めAudioContextを閉じる', () => {
    const { unmount } = renderPiano()
    fireEvent.pointerDown(screen.getByRole('button', { name: 'ミ E4' }), { pointerId: 5 })
    unmount()

    expect(contexts[0].close).toHaveBeenCalledTimes(1)
    const oscillators = contexts[0].createOscillator.mock.results.map((result) => result.value)
    expect(oscillators.every((oscillator) => oscillator.stop.mock.calls.length === 1)).toBe(true)
  })
})
