import type { PianoNote, PianoNoteId } from './notes'
import {
  getInstrumentSpec,
  type InstrumentId,
  type ResolvedSample,
  resolveInstrumentSample,
} from './pianoSamples'

type AudioContextConstructor = new () => AudioContext

const ATTACK_START_GAIN = 0.0001
const ATTACK_SECONDS = 0.006
const MANUAL_KEY_RELEASE_SECONDS = 0.035
const AUTOMATIC_NOTE_RELEASE_SECONDS = 0.2
const MINIMUM_RELEASE_SECONDS = 0.02
const SOURCE_STOP_TAIL_SECONDS = 0.015
const FALLBACK_DECAY_END_GAIN = 0.1
const FALLBACK_DECAY_SECONDS = 0.34

type GainEnvelope = {
  startedAt: number
  targetGain: number
}

type SampleVoice = {
  id: number
  kind: 'sample'
  gain: GainNode
  envelope: GainEnvelope
  source: AudioBufferSourceNode
  stopped: boolean
  releasePending: boolean
}

type FallbackVoice = {
  id: number
  kind: 'fallback'
  gain: GainNode
  envelope: GainEnvelope
  oscillators: OscillatorNode[]
  stopped: boolean
  releasePending: boolean
}

type PianoVoice = SampleVoice | FallbackVoice
export type SampleLoadState = 'idle' | 'loading' | 'ready' | 'failed'

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
  private readonly sampleBuffers = new Map<InstrumentId, Map<PianoNoteId, AudioBuffer>>()
  private readonly sampleLoadStates = new Map<InstrumentId, SampleLoadState>()
  private readonly sampleLoadPromises = new Map<InstrumentId, Promise<void>>()
  private readonly sampleAbortControllers = new Map<InstrumentId, AbortController>()
  private selectedInstrument: InstrumentId = 'piano'
  /** iOSの最初のユーザー操作で、resume完了まで短い離鍵を保持するためのPromise。 */
  private resumePromise?: Promise<void>
  private nextVoiceId = 1
  private readonly voices = new Map<number, PianoVoice>()
  private readonly durationTimers = new Set<ReturnType<typeof setTimeout>>()
  private readonly voiceCleanupTimers = new Set<ReturnType<typeof setTimeout>>()
  private disposed = false

  /**
   * 選択中の楽器の音源を先読みする。別の楽器はsetInstrument時に必要なアンカーだけ遅延取得する。
   * AudioContextはここではresumeせず、iOSのユーザー操作制約を守る。
   * ロード前の最初の押下は、無反応にしないため既存の軽量な合成音で一度だけ発音する。
   */
  prepare(instrumentId: InstrumentId = this.selectedInstrument): Promise<void> {
    if (this.disposed) return Promise.resolve()
    const context = this.getOrCreateContext()
    if (!context) return Promise.resolve()
    const state = this.sampleLoadStates.get(instrumentId) ?? 'idle'
    if (state === 'ready' || state === 'failed') return Promise.resolve()
    const existingPromise = this.sampleLoadPromises.get(instrumentId)
    if (existingPromise) return existingPromise

    this.sampleLoadStates.set(instrumentId, 'loading')
    const abortController = new AbortController()
    this.sampleAbortControllers.set(instrumentId, abortController)
    const loadingPromise = this.loadSamples(context, instrumentId, abortController)
    const loadPromise = loadingPromise.finally(() => {
      if (this.sampleLoadPromises.get(instrumentId) === loadPromise) this.sampleLoadPromises.delete(instrumentId)
    })
    this.sampleLoadPromises.set(instrumentId, loadPromise)
    return loadPromise
  }

  getInstrument(): InstrumentId {
    return this.selectedInstrument
  }

  getSampleLoadState(instrumentId: InstrumentId = this.selectedInstrument): SampleLoadState {
    return this.sampleLoadStates.get(instrumentId) ?? 'idle'
  }

  /**
   * 現在鳴っているvoiceは止めず、以後のstartNote/playNoteだけを新しい楽器にする。
   * 返り値はUIが小さなロード表示を解除するためのもので、呼び出し側で待たなくてもよい。
   */
  setInstrument(instrumentId: InstrumentId): Promise<void> {
    if (this.disposed) return Promise.resolve()
    // 失敗後の再試行は明示的な楽器ボタン選択時だけ許可する。鍵盤の連打からは再試行しない。
    if (this.getSampleLoadState(instrumentId) === 'failed') {
      this.sampleLoadStates.set(instrumentId, 'idle')
      this.sampleBuffers.delete(instrumentId)
    }
    this.selectedInstrument = instrumentId
    return this.prepare(instrumentId)
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

    if (context.state !== 'running' && !this.resumePromise) {
      // startNoteはpointerdown/clickの同期処理から呼ばれるため、iOS Safariの解除条件を満たす。
      const resumePromise = context.resume().catch(() => {})
      this.resumePromise = resumePromise
      void resumePromise.finally(() => {
        if (this.resumePromise === resumePromise) this.resumePromise = undefined
      })
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

  private async loadSamples(
    context: AudioContext,
    instrumentId: InstrumentId,
    abortController: AbortController,
  ): Promise<void> {
    const spec = getInstrumentSpec(instrumentId)
    try {
      const decodedSamples = await Promise.all(spec.samples.map(async (sample) => {
        const response = await fetch(sample.url, { signal: abortController.signal })
        if (!response.ok) throw new Error(`${instrumentId} sample fetch failed: ${sample.noteId}`)
        const data = await response.arrayBuffer()
        const buffer = await context.decodeAudioData(data)
        return [sample.noteId, buffer] as const
      }))

      if (this.disposed) return
      this.sampleBuffers.set(instrumentId, new Map(decodedSamples))
      this.sampleLoadStates.set(instrumentId, 'ready')
    } catch {
      if (this.disposed) return
      this.sampleBuffers.delete(instrumentId)
      this.sampleLoadStates.set(instrumentId, 'failed')
    } finally {
      if (this.sampleAbortControllers.get(instrumentId) === abortController) {
        this.sampleAbortControllers.delete(instrumentId)
      }
    }
  }

  private createVoiceGain(context: AudioContext, targetGain: number): { gain: GainNode; envelope: GainEnvelope } {
    const gain = context.createGain()
    const now = context.currentTime
    gain.connect(this.output!)
    gain.gain.setValueAtTime(ATTACK_START_GAIN, now)
    // 録音のアタックを保ちつつ開始時のクリックを防ぐ短いフェード。
    gain.gain.exponentialRampToValueAtTime(targetGain, now + ATTACK_SECONDS)
    return { gain, envelope: { startedAt: now, targetGain } }
  }

  private startSampleVoice(
    context: AudioContext,
    resolvedSample: ResolvedSample,
    buffer: AudioBuffer,
  ): PianoVoiceHandle {
    const id = this.nextVoiceId++
    const spec = getInstrumentSpec(this.selectedInstrument)
    // 楽器補正×録音補正の二層を通し、4鍵程度の和音でもクリップしにくい共通係数を掛ける。
    const voiceGain = this.createVoiceGain(context, spec.gain * resolvedSample.definition.gain * 0.75)
    const source = context.createBufferSource()
    source.buffer = buffer
    // 実ブラウザのAudioBufferSourceNodeには必ずあるが、軽量テストdoubleでは省略されることがある。
    if (source.playbackRate) source.playbackRate.value = resolvedSample.playbackRate
    source.connect(voiceGain.gain)

    const voice: SampleVoice = {
      id,
      kind: 'sample',
      gain: voiceGain.gain,
      envelope: voiceGain.envelope,
      source,
      stopped: false,
      releasePending: false,
    }
    this.voices.set(id, voice)
    source.onended = () => {
      if (this.voices.get(id) === voice) this.voices.delete(id)
      try {
        source.disconnect()
        voiceGain.gain.disconnect()
      } catch {
        // 接続解除に失敗しても次の発音を妨げない。
      }
    }
    source.start(context.currentTime)
    return { id }
  }

  private startFallbackVoice(context: AudioContext, note: PianoNote): PianoVoiceHandle {
    const id = this.nextVoiceId++
    const voiceGain = this.createVoiceGain(context, getInstrumentSpec(this.selectedInstrument).gain * 0.32)
    const fundamental = context.createOscillator()
    const harmonic = context.createOscillator()
    const harmonicGain = context.createGain()

    fundamental.type = 'triangle'
    fundamental.frequency.value = note.frequency
    harmonic.type = 'sine'
    harmonic.frequency.value = note.frequency * 2
    harmonicGain.gain.value = 0.16
    fundamental.connect(voiceGain.gain)
    harmonic.connect(harmonicGain)
    harmonicGain.connect(voiceGain.gain)

    const voice: FallbackVoice = {
      id,
      kind: 'fallback',
      gain: voiceGain.gain,
      envelope: voiceGain.envelope,
      oscillators: [fundamental, harmonic],
      stopped: false,
      releasePending: false,
    }
    this.voices.set(id, voice)
    for (const oscillator of voice.oscillators) oscillator.start(context.currentTime)
    // 読込中だけの代替音も、長押し時に鳴り続けすぎないよう従来どおり短く減衰させる。
    voiceGain.gain.gain.exponentialRampToValueAtTime(FALLBACK_DECAY_END_GAIN, context.currentTime + FALLBACK_DECAY_SECONDS)
    return { id }
  }

  startNote(note: PianoNote): PianoVoiceHandle | null {
    const context = this.ensureContextForPlayback()
    if (!context || !this.output) return null

    // prepare()との競合を1本化し、まだdecode中でも入力を無反応にしない。
    void this.prepare()
    const instrumentId = this.selectedInstrument
    const resolvedSample = resolveInstrumentSample(instrumentId, note.id)
    const sample = resolvedSample && this.getSampleLoadState(instrumentId) === 'ready'
      ? this.sampleBuffers.get(instrumentId)?.get(resolvedSample.definition.noteId)
      : undefined
    return sample && resolvedSample
      ? this.startSampleVoice(context, resolvedSample, sample)
      : this.startFallbackVoice(context, note)
  }

  private gainAtRelease(voice: PianoVoice, time: number): number {
    const { startedAt, targetGain } = voice.envelope
    const attackEnd = startedAt + ATTACK_SECONDS
    if (time <= startedAt) return ATTACK_START_GAIN
    if (time < attackEnd) {
      const progress = (time - startedAt) / ATTACK_SECONDS
      return ATTACK_START_GAIN * (targetGain / ATTACK_START_GAIN) ** progress
    }
    if (voice.kind === 'fallback') {
      const decayEnd = startedAt + FALLBACK_DECAY_SECONDS
      if (time >= decayEnd) return FALLBACK_DECAY_END_GAIN
      const progress = (time - attackEnd) / (decayEnd - attackEnd)
      return targetGain * (FALLBACK_DECAY_END_GAIN / targetGain) ** progress
    }
    return targetGain
  }

  private cleanupVoice(voice: PianoVoice): void {
    if (this.voices.get(voice.id) === voice) this.voices.delete(voice.id)
    try {
      voice.gain.disconnect()
      if (voice.kind === 'sample') voice.source.disconnect()
      else for (const oscillator of voice.oscillators) oscillator.disconnect()
    } catch {
      // 解放済みノードでも、画面離脱や次の発音を妨げない。
    }
  }

  private releaseVoice(voice: PianoVoice, releaseSeconds: number): void {
    const context = this.context
    if (!context || voice.stopped) return
    voice.stopped = true

    const now = context.currentTime
    const release = Math.max(MINIMUM_RELEASE_SECONDS, releaseSeconds)
    const gainParam = voice.gain.gain
    // cancelAndHoldAtTimeの実装差に依存せず、エンジンが予約したenvelopeから
    // 現在値を再計算して保持する。これでattack途中の超短押しでも段差を作らない。
    gainParam.cancelScheduledValues(now)
    gainParam.setValueAtTime(Math.max(this.gainAtRelease(voice, now), ATTACK_START_GAIN), now)
    gainParam.exponentialRampToValueAtTime(ATTACK_START_GAIN, now + release)

    if (voice.kind === 'sample') stopNode(voice.source, now + release + SOURCE_STOP_TAIL_SECONDS)
    else {
      const cleanupTimer = setTimeout(() => {
        this.voiceCleanupTimers.delete(cleanupTimer)
        this.cleanupVoice(voice)
      }, (release + SOURCE_STOP_TAIL_SECONDS) * 1000)
      this.voiceCleanupTimers.add(cleanupTimer)
      for (const oscillator of voice.oscillators) stopNode(oscillator, now + release + SOURCE_STOP_TAIL_SECONDS)
    }
  }

  stopNote(handle: PianoVoiceHandle, releaseSeconds = MANUAL_KEY_RELEASE_SECONDS): void {
    const voice = this.voices.get(handle.id)
    const context = this.context
    if (!voice || !context || voice.stopped || voice.releasePending) return

    // 初回タップではSafariのresumeがpointerupより遅いことがある。この時点で止めると
    // 音が一度も鳴らず「長押しだけ鳴る」状態になるため、resume直後に短い余韻を残す。
    if (context.state !== 'running' && this.resumePromise) {
      voice.releasePending = true
      const minimumTapRelease = Math.max(releaseSeconds, 0.16)
      void this.resumePromise.then(() => {
        if (!this.disposed && this.voices.get(handle.id) === voice) {
          this.releaseVoice(voice, minimumTapRelease)
        }
      })
      return
    }

    this.releaseVoice(voice, releaseSeconds)
  }

  /** Phase 2の曲再生からも利用できる、長さ指定付きの発音口。 */
  playNote(note: PianoNote, durationMs = 500): PianoVoiceHandle | null {
    const handle = this.startNote(note)
    if (!handle) return null
    const timer = setTimeout(() => {
      this.durationTimers.delete(timer)
      // 自動演奏の音価・フレーズ間隔は従来のrelease長を保つ。
      this.stopNote(handle, AUTOMATIC_NOTE_RELEASE_SECONDS)
    }, Math.max(40, durationMs))
    this.durationTimers.add(timer)
    return handle
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const controller of this.sampleAbortControllers.values()) controller.abort()
    this.sampleAbortControllers.clear()
    this.sampleLoadPromises.clear()
    for (const timer of this.durationTimers) clearTimeout(timer)
    this.durationTimers.clear()
    for (const timer of this.voiceCleanupTimers) clearTimeout(timer)
    this.voiceCleanupTimers.clear()

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
