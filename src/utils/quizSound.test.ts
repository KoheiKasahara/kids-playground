import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

/**
 * jsdom には Web Audio API が実装されていないため、
 * オシレーター/ゲインノードの生成・再生呼び出しだけを最小限に模したモックを window に生やして検証する。
 * quizSound.ts は AudioContext を1つだけ使い回す実装のため、
 * テストごとに vi.resetModules() でモジュール内の状態をリセットしてから読み込み直す。
 */

class MockOscillatorNode {
  type = 'sine'
  frequency = { value: 0 }
  connect = vi.fn()
  start = vi.fn()
  stop = vi.fn()
}

class MockGainNode {
  gain = { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() }
  connect = vi.fn()
}

let instances: MockAudioContext[] = []

class MockAudioContext {
  currentTime = 0
  state: 'running' | 'suspended' = 'running'
  resume = vi.fn().mockResolvedValue(undefined)
  createOscillator = vi.fn(() => new MockOscillatorNode())
  createGain = vi.fn(() => new MockGainNode())
  destination = {}

  constructor() {
    instances.push(this)
  }
}

describe('quizSound', () => {
  const originalAudioContext = (window as unknown as { AudioContext?: unknown }).AudioContext

  beforeEach(() => {
    instances = []
  })

  afterEach(() => {
    ;(window as unknown as { AudioContext?: unknown }).AudioContext = originalAudioContext
    vi.resetModules()
  })

  test('playCorrectSound は「ピンポーン」の2音を鳴らす', async () => {
    ;(window as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext
    vi.resetModules()
    const { playCorrectSound } = await import('./quizSound')

    playCorrectSound()

    expect(instances).toHaveLength(1)
    expect(instances[0].createOscillator).toHaveBeenCalledTimes(2)
  })

  test('playIncorrectSound は「ブブー」の2音を鳴らす', async () => {
    ;(window as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext
    vi.resetModules()
    const { playIncorrectSound } = await import('./quizSound')

    playIncorrectSound()

    expect(instances).toHaveLength(1)
    expect(instances[0].createOscillator).toHaveBeenCalledTimes(2)
  })

  test('AudioContext 非対応環境では例外を投げず何もしない', async () => {
    ;(window as unknown as { AudioContext?: unknown }).AudioContext = undefined
    vi.resetModules()
    const { playCorrectSound, playIncorrectSound } = await import('./quizSound')

    expect(() => playCorrectSound()).not.toThrow()
    expect(() => playIncorrectSound()).not.toThrow()
    expect(instances).toHaveLength(0)
  })

  test('primeAudio は AudioContext を作成する（iOS対策で操作イベント内から先に用意する用）', async () => {
    ;(window as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext
    vi.resetModules()
    const { primeAudio } = await import('./quizSound')

    primeAudio()

    expect(instances).toHaveLength(1)
  })

  test('playPanelOpenSound はオシレーターを1つ生成し、600Hz〜1kHz帯の音を鳴らす', async () => {
    ;(window as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext
    vi.resetModules()
    const { playPanelOpenSound } = await import('./quizSound')

    playPanelOpenSound()

    expect(instances).toHaveLength(1)
    expect(instances[0].createOscillator).toHaveBeenCalledTimes(1)
    const oscillator = instances[0].createOscillator.mock.results[0].value as MockOscillatorNode
    expect(oscillator.frequency.value).toBeGreaterThanOrEqual(600)
    expect(oscillator.frequency.value).toBeLessThanOrEqual(1000)
  })

  test('playPanelRevealSound は step が進むほど周波数が高くなる', async () => {
    ;(window as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext
    vi.resetModules()
    const { playPanelRevealSound } = await import('./quizSound')

    playPanelRevealSound(1, 5)
    playPanelRevealSound(3, 5)

    const first = instances[0].createOscillator.mock.results[0].value as MockOscillatorNode
    const third = instances[0].createOscillator.mock.results[1].value as MockOscillatorNode
    expect(third.frequency.value).toBeGreaterThan(first.frequency.value)
  })

  test('playPanelRevealSound は最後の1枚(step === total)で、その手前より高い音を鳴らす', async () => {
    ;(window as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext
    vi.resetModules()
    const { playPanelRevealSound } = await import('./quizSound')

    playPanelRevealSound(4, 5)
    playPanelRevealSound(5, 5)

    const secondLast = instances[0].createOscillator.mock.results[0].value as MockOscillatorNode
    const last = instances[0].createOscillator.mock.results[1].value as MockOscillatorNode
    expect(last.frequency.value).toBeGreaterThan(secondLast.frequency.value)
  })

  test('setSoundEnabled(false) の間は AudioContext を作らず、どの音も鳴らない', async () => {
    ;(window as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext
    vi.resetModules()
    const { playPanelOpenSound, playPanelRevealSound, playCorrectSound, setSoundEnabled, isSoundEnabled } =
      await import('./quizSound')

    setSoundEnabled(false)
    expect(isSoundEnabled()).toBe(false)

    playPanelOpenSound()
    playPanelRevealSound(1, 3)
    playCorrectSound()

    expect(instances).toHaveLength(0)
  })
})
