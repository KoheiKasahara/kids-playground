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
  playbackRate = new MockAudioParam()
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
    // 自動演奏は従来どおり200msのreleaseを使い、音価やフレーズ間隔を変えない。
    expect(sources[2].stop.mock.calls.at(-1)?.[0]).toBeCloseTo(contexts[0].currentTime + 0.215)
  })

  test('短い離鍵は現在のattack途中Gainから35msでreleaseしてからsourceを止める', async () => {
    const engine = new PianoAudioEngine()
    await engine.prepare()
    const handle = engine.startNote(PIANO_NOTES[0])
    const source = contexts[0].createBufferSource.mock.results[0].value
    const gain = contexts[0].createGain.mock.results[1].value as MockGain

    contexts[0].currentTime = 1.003 // 6msのattack途中
    engine.stopNote(handle!)

    expect(gain.gain.cancelScheduledValues).toHaveBeenCalledWith(1.003)
    const heldGain = gain.gain.setValueAtTime.mock.calls.at(-1)
    expect(heldGain?.[0]).toBeGreaterThan(0.0001)
    expect(heldGain?.[0]).toBeLessThan(0.1)
    expect(heldGain?.[1]).toBe(1.003)
    const releaseRamp = gain.gain.exponentialRampToValueAtTime.mock.calls.at(-1)
    expect(releaseRamp?.[0]).toBe(0.0001)
    expect(releaseRamp?.[1]).toBeCloseTo(1.038)
    expect(source.stop.mock.calls[0][0]).toBeCloseTo(1.053)
  })

  test('同じ鍵の高速連打でも各voiceを一度だけ個別にreleaseする', async () => {
    const engine = new PianoAudioEngine()
    await engine.prepare()
    const first = engine.startNote(PIANO_NOTES[0])
    const second = engine.startNote(PIANO_NOTES[0])
    const sources = contexts[0].createBufferSource.mock.results.map((result) => result.value)

    engine.stopNote(first!)
    engine.stopNote(first!)
    engine.stopNote(second!)

    expect(sources[0].stop).toHaveBeenCalledTimes(1)
    expect(sources[1].stop).toHaveBeenCalledTimes(1)
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

  test('楽器選択は必要なアンカーだけを遅延読込し、次のvoiceから移調して鳴らす', async () => {
    const engine = new PianoAudioEngine()
    await engine.prepare()

    expect((fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(13)
    const switchPromise = engine.setInstrument('violin')
    expect(engine.getInstrument()).toBe('violin')
    expect(engine.getSampleLoadState('violin')).toBe('loading')
    await switchPromise

    expect((fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(18)
    const handle = engine.startNote(PIANO_NOTES[1]) // C#4 は最寄りのC4から半音上げる。
    expect(handle).not.toBeNull()
    const source = contexts[0].createBufferSource.mock.results[0].value
    expect(source.playbackRate.value).toBeCloseTo(2 ** (1 / 12))
  })

  test('楽器切替で既存voiceを止めず、失敗時もフォールバックを発音する', async () => {
    const engine = new PianoAudioEngine()
    await engine.prepare()
    const first = engine.startNote(PIANO_NOTES[0])
    const firstSource = contexts[0].createBufferSource.mock.results[0].value

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    await engine.setInstrument('flute')
    const fallback = engine.startNote(PIANO_NOTES[4])

    expect(first).not.toBeNull()
    expect(fallback).not.toBeNull()
    expect(firstSource.stop).not.toHaveBeenCalled()
    expect(contexts[0].createOscillator).toHaveBeenCalledTimes(2)
  })

  test('失敗後の鍵盤連打では再試行せず、同じ楽器の再選択でだけ再試行する', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'))
    vi.stubGlobal('fetch', fetchMock)
    const engine = new PianoAudioEngine()
    await engine.prepare()
    expect(fetchMock).toHaveBeenCalledTimes(13)

    engine.startNote(PIANO_NOTES[0])
    engine.startNote(PIANO_NOTES[1])
    await Promise.resolve()
    expect(fetchMock).toHaveBeenCalledTimes(13)

    await engine.setInstrument('piano')
    expect(fetchMock).toHaveBeenCalledTimes(26)
  })
})
