import type { PianoNote, PianoNoteId } from './notes'
import { findPianoSample, PIANO_SAMPLE_DEFINITIONS } from './pianoSamples'

type AudioContextConstructor = new () => AudioContext

type SampleVoice = {
  id: number
  kind: 'sample'
  gain: GainNode
  source: AudioBufferSourceNode
  stopped: boolean
}

type FallbackVoice = {
  id: number
  kind: 'fallback'
  gain: GainNode
  oscillators: OscillatorNode[]
  stopped: boolean
}

type PianoVoice = SampleVoice | FallbackVoice
type SampleLoadState = 'idle' | 'loading' | 'ready' | 'failed'

export type PianoVoiceHandle = { readonly id: number }

function getAudioContextConstructor(): AudioContextConstructor | undefined {
  if (typeof window === 'undefined') return undefined
  const audioWindow = window as typeof window & { webkitAudioContext?: AudioContextConstructor }
  return audioWindow.AudioContext ?? audioWindow.webkitAudioContext
}

function stopNode(node: AudioScheduledSourceNode, when: number): void {
  try {
    node.stop(when)
  } catch {
    // すでに停止済みでも、離鍵や画面離脱を失敗させない。
  }
}

/**
 * 自由演奏と将来の自動演奏が共有する、ゲーム単位の発音エンジン。
 * AudioBufferSourceNodeは発音ごとに新規作成し、同音連打・和音・手動と自動の同時発音を独立させる。
 */
export class PianoAudioEngine {
  private context?: AudioContext
  private output?: GainNode
  private readonly sampleBuffers = new Map<PianoNoteId, AudioBuffer>()
  private sampleLoadState: SampleLoadState = 'idle'
  private sampleLoadPromise?: Promise<void>
  private sampleAbortController?: AbortController
  private nextVoiceId = 1
  private readonly voices = new Map<number, PianoVoice>()
  private readonly durationTimers = new Set<ReturnType<typeof setTimeout>>()
  private disposed = false

  /**
   * 画面表示時に13音を先読みする。AudioContextはここではresumeせず、iOSのユーザー操作制約を守る。
   * ロード前の最初の押下は、無反応にしないため既存の軽量な合成音で一度だけ発音する。
   */
  prepare(): Promise<void> {
    if (this.disposed) return Promise.resolve()
    const context = this.getOrCreateContext()
    if (!context || this.sampleLoadState === 'ready' || this.sampleLoadState === 'failed') {
      return this.sampleLoadPromise ?? Promise.resolve()
    }
    if (this.sampleLoadPromise) return this.sampleLoadPromise

    this.sampleLoadState = 'loading'
    const abortController = new AbortController()
    this.sampleAbortController = abortController
    this.sampleLoadPromise = this.loadSamples(context, abortController)
    return this.sampleLoadPromise
  }

  private getOrCreateContext(): AudioContext | undefined {
    if (this.disposed) return undefined
    const Context = getAudioContextConstructor()
    if (!Context) return undefined

    if (!this.context) {
      try {
        this.context = new Context()
        this.output = this.context.createGain()
        // 4鍵程度の和音でも過大になりにくいよう、masterを抑えて各voiceの自然な音量を残す。
        this.output.gain.value = 0.5
        this.output.connect(this.context.destination)
      } catch {
        this.context = undefined
        this.output = undefined
        return undefined
      }
    }
    return this.context
  }

  private ensureContextForPlayback(): AudioContext | undefined {
    const context = this.getOrCreateContext()
    if (!context) return undefined

    if (context.state === 'suspended') {
      // startNoteはpointerdown/clickの同期処理から呼ばれるため、iOS Safariの解除条件を満たす。
      void context.resume().catch(() => {})
    }
    return context
  }

  /**
   * 再生ボタンの同期したユーザー操作中に呼び、後続の曲タイマーからのplayNoteでも
   * iOS Safari / PWA のAudioContext制約に引っかかりにくくする。
   */
  activate(): void {
    this.ensureContextForPlayback()
  }

  private async loadSamples(context: AudioContext, abortController: AbortController): Promise<void> {
    try {
      const decodedSamples = await Promise.all(PIANO_SAMPLE_DEFINITIONS.map(async (sample) => {
        const response = await fetch(sample.url, { signal: abortController.signal })
        if (!response.ok) throw new Error(`piano sample fetch failed: ${sample.noteId}`)
        const data = await response.arrayBuffer()
        const buffer = await context.decodeAudioData(data)
        return [sample.noteId, buffer] as const
      }))

      if (this.disposed) return
      this.sampleBuffers.clear()
      for (const [noteId, buffer] of decodedSamples) this.sampleBuffers.set(noteId, buffer)
      this.sampleLoadState = 'ready'
    } catch {
      if (this.disposed) return
      this.sampleBuffers.clear()
      this.sampleLoadState = 'failed'
    } finally {
      if (this.sampleAbortController === abortController) this.sampleAbortController = undefined
    }
  }

  private createVoiceGain(context: AudioContext, targetGain: number): GainNode {
    const gain = context.createGain()
    const now = context.currentTime
    gain.connect(this.output!)
    gain.gain.setValueAtTime(0.0001, now)
    // 録音のアタックを保ちつつ開始時のクリックを防ぐ短いフェード。
    gain.gain.exponentialRampToValueAtTime(targetGain, now + 0.006)
    return gain
  }

  private startSampleVoice(context: AudioContext, note: PianoNote, buffer: AudioBuffer): PianoVoiceHandle {
    const id = this.nextVoiceId++
    // 個別補正後、4鍵程度の和音でもクリップしにくい共通voice gainを掛ける。
    const gain = this.createVoiceGain(context, (findPianoSample(note.id)?.gain ?? 1) * 0.75)
    const source = context.createBufferSource()
    source.buffer = buffer
    source.connect(gain)

    const voice: SampleVoice = { id, kind: 'sample', gain, source, stopped: false }
    this.voices.set(id, voice)
    source.onended = () => {
      if (this.voices.get(id) === voice) this.voices.delete(id)
      try {
        source.disconnect()
        gain.disconnect()
      } catch {
        // 接続解除に失敗しても次の発音を妨げない。
      }
    }
    source.start(context.currentTime)
    return { id }
  }

  private startFallbackVoice(context: AudioContext, note: PianoNote): PianoVoiceHandle {
    const id = this.nextVoiceId++
    const gain = this.createVoiceGain(context, 0.32)
    const fundamental = context.createOscillator()
    const harmonic = context.createOscillator()
    const harmonicGain = context.createGain()

    fundamental.type = 'triangle'
    fundamental.frequency.value = note.frequency
    harmonic.type = 'sine'
    harmonic.frequency.value = note.frequency * 2
    harmonicGain.gain.value = 0.16
    fundamental.connect(gain)
    harmonic.connect(harmonicGain)
    harmonicGain.connect(gain)

    const voice: FallbackVoice = { id, kind: 'fallback', gain, oscillators: [fundamental, harmonic], stopped: false }
    this.voices.set(id, voice)
    for (const oscillator of voice.oscillators) oscillator.start(context.currentTime)
    // 読込中だけの代替音も、長押し時に鳴り続けすぎないよう従来どおり短く減衰させる。
    gain.gain.exponentialRampToValueAtTime(0.1, context.currentTime + 0.34)
    return { id }
  }

  startNote(note: PianoNote): PianoVoiceHandle | null {
    const context = this.ensureContextForPlayback()
    if (!context || !this.output) return null

    // prepare()との競合を1本化し、まだdecode中でも入力を無反応にしない。
    void this.prepare()
    const sample = this.sampleLoadState === 'ready' ? this.sampleBuffers.get(note.id) : undefined
    return sample ? this.startSampleVoice(context, note, sample) : this.startFallbackVoice(context, note)
  }

  stopNote(handle: PianoVoiceHandle, releaseSeconds = 0.2): void {
    const voice = this.voices.get(handle.id)
    const context = this.context
    if (!voice || !context || voice.stopped) return
    voice.stopped = true
    this.voices.delete(handle.id)

    const now = context.currentTime
    const release = Math.max(0.04, releaseSeconds)
    const gainParam = voice.gain.gain as AudioParam & {
      cancelAndHoldAtTime?: (cancelTime: number) => AudioParam
    }
    if (typeof gainParam.cancelAndHoldAtTime === 'function') {
      gainParam.cancelAndHoldAtTime(now)
    } else {
      gainParam.cancelScheduledValues(now)
      gainParam.setValueAtTime(Math.max(gainParam.value, 0.0001), now)
    }
    gainParam.exponentialRampToValueAtTime(0.0001, now + release)

    if (voice.kind === 'sample') stopNode(voice.source, now + release + 0.025)
    else for (const oscillator of voice.oscillators) stopNode(oscillator, now + release + 0.025)
  }

  /** Phase 2の曲再生からも利用できる、長さ指定付きの発音口。 */
  playNote(note: PianoNote, durationMs = 500): PianoVoiceHandle | null {
    const handle = this.startNote(note)
    if (!handle) return null
    const timer = setTimeout(() => {
      this.durationTimers.delete(timer)
      this.stopNote(handle)
    }, Math.max(40, durationMs))
    this.durationTimers.add(timer)
    return handle
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.sampleAbortController?.abort()
    this.sampleAbortController = undefined
    for (const timer of this.durationTimers) clearTimeout(timer)
    this.durationTimers.clear()

    const now = this.context?.currentTime ?? 0
    for (const voice of this.voices.values()) {
      if (voice.kind === 'sample') stopNode(voice.source, now)
      else for (const oscillator of voice.oscillators) stopNode(oscillator, now)
    }
    this.voices.clear()
    this.sampleBuffers.clear()
    if (this.context) void this.context.close().catch(() => {})
    this.context = undefined
    this.output = undefined
  }
}
