import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { PIANO_NOTES } from './notes'
import { PianoAudioEngine } from './pianoAudio'
import { PIANO_SAMPLE_DEFINITIONS } from './pianoSamples'

class MockAudioParam {
  value = 0.42
  setValueAtTime = vi.fn()
  exponentialRampToValueAtTime = vi.fn()
  cancelScheduledValues = vi.fn()
}

class MockNode {
  connect = vi.fn()
  disconnect = vi.fn()
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

class MockBufferSource extends MockNode {
  buffer: AudioBuffer | null = null
  onended: (() => void) | null = null
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
  createBufferSource = vi.fn(() => new MockBufferSource())
  decodeAudioData = vi.fn().mockResolvedValue({} as AudioBuffer)

  constructor() {
    contexts.push(this)
  }
}

describe('PianoAudioEngine', () => {
  const originalAudioContext = window.AudioContext

  beforeEach(() => {
    contexts.length = 0
    ;(window as unknown as { AudioContext: typeof MockAudioContext }).AudioContext = MockAudioContext
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    }))
  })

  afterEach(() => {
    window.AudioContext = originalAudioContext
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  test('13音を一括fetch/decodeし、ユーザー操作までAudioContextをresumeしない', async () => {
    const engine = new PianoAudioEngine()
    await engine.prepare()

    expect(fetch).toHaveBeenCalledTimes(13)
    expect(contexts).toHaveLength(1)
    expect(contexts[0].decodeAudioData).toHaveBeenCalledTimes(13)
    expect(contexts[0].resume).not.toHaveBeenCalled()

    engine.startNote(PIANO_NOTES[0])
    expect(contexts[0].resume).toHaveBeenCalledTimes(1)
    expect(contexts[0].createBufferSource).toHaveBeenCalledTimes(1)
    expect(contexts[0].createOscillator).not.toHaveBeenCalled()
  })

  test('同音連打・和音・手動と自動の各voiceを独立したAudioBufferSourceNodeで鳴らす', async () => {
    vi.useFakeTimers()
    const engine = new PianoAudioEngine()
    await engine.prepare()

    const c4First = engine.startNote(PIANO_NOTES[0])
    const c4Second = engine.startNote(PIANO_NOTES[0])
    const e4Automatic = engine.playNote(PIANO_NOTES[4], 180)
    expect(c4First).not.toBeNull()
    expect(c4Second).not.toBeNull()
    expect(e4Automatic).not.toBeNull()
    expect(contexts[0].createBufferSource).toHaveBeenCalledTimes(3)

    const sources = contexts[0].createBufferSource.mock.results.map((result) => result.value)
    engine.stopNote(c4First!)
    expect(sources[0].stop).toHaveBeenCalledTimes(1)
    expect(sources[1].stop).not.toHaveBeenCalled()
    expect(sources[2].stop).not.toHaveBeenCalled()

    vi.advanceTimersByTime(180)
    expect(sources[2].stop).toHaveBeenCalledTimes(1)
  })

  test('初回resumeより短いタップでも、resume後に短い自然な発音を残す', async () => {
    const engine = new PianoAudioEngine()
    await engine.prepare()
    let finishResume: (() => void) | undefined
    contexts[0].state = 'suspended'
    contexts[0].resume.mockImplementation(() => new Promise<void>((resolve) => {
      finishResume = resolve
    }))

    const handle = engine.startNote(PIANO_NOTES[0])
    const source = contexts[0].createBufferSource.mock.results[0].value
    engine.stopNote(handle!)

    expect(source.stop).not.toHaveBeenCalled()
    finishResume?.()
    await vi.waitFor(() => expect(source.stop).toHaveBeenCalledTimes(1))
    expect(source.stop.mock.calls[0][0]).toBeGreaterThan(contexts[0].currentTime)
  })

  test('自然終了済みのsample voiceは他voiceを止めずに管理から外れる', async () => {
    const engine = new PianoAudioEngine()
    await engine.prepare()
    const first = engine.startNote(PIANO_NOTES[0])
    const second = engine.startNote(PIANO_NOTES[0])
    const sources = contexts[0].createBufferSource.mock.results.map((result) => result.value)

    sources[0].onended?.()
    engine.stopNote(first!)
    expect(sources[0].stop).not.toHaveBeenCalled()
    engine.stopNote(second!)
    expect(sources[1].stop).toHaveBeenCalledTimes(1)
  })

  test('fetchまたはdecode失敗時はクラッシュせず、短い既存合成音へフォールバックする', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const engine = new PianoAudioEngine()
    await engine.prepare()
    const handle = engine.startNote(PIANO_NOTES[0])

    expect(handle).not.toBeNull()
    expect(contexts[0].createBufferSource).not.toHaveBeenCalled()
    expect(contexts[0].createOscillator).toHaveBeenCalledTimes(2)

    engine.stopNote(handle!)
    const oscillators = contexts[0].createOscillator.mock.results.map((result) => result.value)
    expect(oscillators.every((oscillator) => oscillator.stop.mock.calls.length === 1)).toBe(true)
  })

  test('decode失敗時もフォールバックし、disposeはすべてのvoiceとContextをcleanupする', async () => {
    const engine = new PianoAudioEngine()
    void engine.prepare()
    contexts[0].decodeAudioData.mockRejectedValueOnce(new Error('bad audio'))
    await engine.prepare()

    const handle = engine.startNote(PIANO_NOTES[0])
    expect(handle).not.toBeNull()
    expect(contexts[0].createOscillator).toHaveBeenCalledTimes(2)

    engine.dispose()
    const oscillators = contexts[0].createOscillator.mock.results.map((result) => result.value)
    expect(oscillators.every((oscillator) => oscillator.stop.mock.calls.length === 1)).toBe(true)
    expect(contexts[0].close).toHaveBeenCalledTimes(1)
  })

  test('画面離脱時は進行中の音源取得をabortして、decode完了を待たずにcleanupする', () => {
    let signal: AbortSignal | undefined
    vi.stubGlobal('fetch', vi.fn((_url: string, options?: RequestInit) => {
      signal = options?.signal ?? undefined
      return new Promise<Response>(() => {})
    }))
    const engine = new PianoAudioEngine()

    void engine.prepare()
    engine.dispose()

    expect(signal?.aborted).toBe(true)
    expect(contexts[0].close).toHaveBeenCalledTimes(1)
  })

  test('必要音源は13ファイルだけを要求する', async () => {
    const engine = new PianoAudioEngine()
    await engine.prepare()
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls.map(([url]) => url)).toEqual(
      PIANO_SAMPLE_DEFINITIONS.map((sample) => sample.url),
    )
  })
})
