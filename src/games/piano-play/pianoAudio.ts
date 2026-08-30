import type { PianoNote } from './notes'

type AudioContextConstructor = new () => AudioContext

type PianoVoice = {
  id: number
  gain: GainNode
  oscillators: OscillatorNode[]
  stopped: boolean
}

export type PianoVoiceHandle = { readonly id: number }

function getAudioContextConstructor(): AudioContextConstructor | undefined {
  if (typeof window === 'undefined') return undefined
  const audioWindow = window as typeof window & { webkitAudioContext?: AudioContextConstructor }
  return audioWindow.AudioContext ?? audioWindow.webkitAudioContext
}

/**
 * 自由演奏と将来の自動演奏が共有する、ゲーム単位の発音エンジン。
 * 1回の発音ごとに独立したvoiceを作るため、同音連打や和音でも先の音を打ち切らない。
 */
export class PianoAudioEngine {
  private context?: AudioContext
  private output?: GainNode
  private nextVoiceId = 1
  private readonly voices = new Map<number, PianoVoice>()
  private readonly durationTimers = new Set<ReturnType<typeof setTimeout>>()
  private disposed = false

  private ensureContext(): AudioContext | undefined {
    if (this.disposed) return undefined
    const Context = getAudioContextConstructor()
    if (!Context) return undefined

    if (!this.context) {
      try {
        this.context = new Context()
        this.output = this.context.createGain()
        this.output.gain.value = 0.72
        this.output.connect(this.context.destination)
      } catch {
        this.context = undefined
        this.output = undefined
        return undefined
      }
    }

    if (this.context.state === 'suspended') {
      // startNoteはpointerdown/clickの同期処理から呼ばれるため、iOS Safariの解除条件を満たす。
      void this.context.resume().catch(() => {})
    }
    return this.context
  }

  startNote(note: PianoNote): PianoVoiceHandle | null {
    const context = this.ensureContext()
    if (!context || !this.output) return null

    const now = context.currentTime
    const gain = context.createGain()
    const fundamental = context.createOscillator()
    const harmonic = context.createOscillator()
    const id = this.nextVoiceId++

    // 三角波の基音へ小さな倍音を重ね、短い減衰を付けて単純なビープ音を避ける。
    fundamental.type = 'triangle'
    fundamental.frequency.value = note.frequency
    harmonic.type = 'sine'
    harmonic.frequency.value = note.frequency * 2

    const harmonicGain = context.createGain()
    harmonicGain.gain.value = 0.16
    harmonic.connect(harmonicGain)
    harmonicGain.connect(gain)
    fundamental.connect(gain)
    gain.connect(this.output)

    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.24, now + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.075, now + 0.34)

    const voice: PianoVoice = { id, gain, oscillators: [fundamental, harmonic], stopped: false }
    this.voices.set(id, voice)
    for (const oscillator of voice.oscillators) {
      oscillator.start(now)
    }

    // どちらか一方のendedだけでvoiceを消すと、もう一方の後片付け前に参照が消えるため、
    // 2つとも停止予約したstopVoice側でMapから除く。
    return { id }
  }

  stopNote(handle: PianoVoiceHandle, releaseSeconds = 0.2): void {
    const voice = this.voices.get(handle.id)
    const context = this.context
    if (!voice || !context || voice.stopped) return
    voice.stopped = true

    const now = context.currentTime
    const release = Math.max(0.04, releaseSeconds)
    if (typeof voice.gain.gain.cancelAndHoldAtTime === 'function') {
      voice.gain.gain.cancelAndHoldAtTime(now)
    } else {
      voice.gain.gain.cancelScheduledValues(now)
      voice.gain.gain.setValueAtTime(0.075, now)
    }
    voice.gain.gain.exponentialRampToValueAtTime(0.0001, now + release)
    for (const oscillator of voice.oscillators) {
      oscillator.stop(now + release + 0.02)
    }
    this.voices.delete(handle.id)
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
    for (const timer of this.durationTimers) clearTimeout(timer)
    this.durationTimers.clear()

    const now = this.context?.currentTime ?? 0
    for (const voice of this.voices.values()) {
      for (const oscillator of voice.oscillators) {
        try {
          oscillator.stop(now)
        } catch {
          // すでに停止済みでも画面離脱を失敗させない。
        }
      }
    }
    this.voices.clear()
    if (this.context) void this.context.close().catch(() => {})
    this.context = undefined
    this.output = undefined
  }
}
