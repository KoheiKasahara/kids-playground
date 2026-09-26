import { getSharedAudioContext, isSoundEnabled } from '../../audio/sound'
import type { CourseId, RaceEvent } from './types'

const MELODIES: Record<CourseId, number[]> = {
  forest: [72, 76, 79, 76, 81, 79, 76, 74, 72, 76, 79, 84, 83, 79, 76, 74],
  coast: [74, 78, 81, 83, 81, 78, 76, 78, 74, 78, 81, 86, 85, 81, 78, 76],
  crystal: [76, 79, 83, 86, 83, 79, 78, 74, 76, 79, 83, 88, 86, 83, 79, 78],
  sky: [72, 79, 83, 86, 84, 83, 79, 76, 77, 81, 84, 88, 86, 83, 79, 74],
}

/** One game-owned bus on the app's shared context; stopping silences scheduled voices too. */
export class KartAudio {
  private bus: GainNode | null = null
  private context: AudioContext | undefined
  private timer: ReturnType<typeof setInterval> | undefined
  private voices = new Set<OscillatorNode>()

  private prepare() {
    if (!isSoundEnabled()) return false
    this.context = getSharedAudioContext()
    if (!this.context) return false
    if (!this.bus) {
      this.bus = this.context.createGain()
      this.bus.gain.value = .65
      this.bus.connect(this.context.destination)
    }
    return true
  }

  private tone(note: number, at: number, length: number, volume: number, wave: OscillatorType = 'triangle') {
    const ctx = this.context
    if (!ctx || !this.bus) return
    const oscillator = ctx.createOscillator(), gain = ctx.createGain()
    oscillator.type = wave
    oscillator.frequency.value = 440 * 2 ** ((note - 69) / 12)
    gain.gain.setValueAtTime(0, at)
    gain.gain.linearRampToValueAtTime(volume, at + .008)
    gain.gain.exponentialRampToValueAtTime(.0001, at + length)
    oscillator.connect(gain).connect(this.bus)
    this.voices.add(oscillator)
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); this.voices.delete(oscillator) }
    oscillator.start(at)
    oscillator.stop(at + length + .02)
  }

  start(course: CourseId) {
    this.stop()
    if (!this.prepare()) return
    let beat = 0, next = this.context!.currentTime + .05
    const melody = MELODIES[course]
    const schedule = () => {
      const ctx = this.context
      if (!ctx) return
      while (next < ctx.currentTime + .18) {
        const note = melody[beat % melody.length]
        this.tone(note, next, .21, .042, 'square')
        if (beat % 2 === 0) this.tone(melody[Math.floor(beat / 8) * 8 % melody.length] - 24, next, .3, .10)
        if (beat % 4 === 3) this.tone(note + 12, next + .1, .12, .027, 'sine')
        next += .215
        beat++
      }
    }
    schedule()
    this.timer = setInterval(schedule, 90)
  }

  effect(kind: RaceEvent['kind'] | 'countdown') {
    if (!this.prepare()) return
    const notes = kind === 'finish' ? [72, 76, 79, 84, 79, 84, 88] :
      kind === 'hit' ? [48, 43] : kind === 'countdown' ? [76] :
        kind === 'jump' ? [60, 72, 84] : kind === 'bomb' ? [55, 62, 67] :
          kind === 'puddle' ? [72, 64, 60] : kind === 'lap' ? [79, 84, 88] : [76, 79, 84]
    notes.forEach((note, i) => this.tone(note, this.context!.currentTime + i * .085, .19, .10))
  }

  stop() {
    clearInterval(this.timer)
    this.timer = undefined
    for (const voice of this.voices) { try { voice.stop() } catch { /* Already ended. */ } }
    this.voices.clear()
    this.bus?.disconnect()
    this.bus = null
  }
}
