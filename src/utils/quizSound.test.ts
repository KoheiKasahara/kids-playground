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
})
