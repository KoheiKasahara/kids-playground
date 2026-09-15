import { createToneNodes, getSharedAudioContext, isSoundEnabled } from '../../audio/sound'

export type GolfSoundKind = 'putt' | 'wall' | 'bumper' | 'rock' | 'windmill' | 'gate' | 'critter' | 'warp' | 'boost' | 'jump' | 'land' | 'sand' | 'ice' | 'splash' | 'cup' | 'cheer' | 'hole-in-one' | 'click'

type Voice = { notes: number[]; type: OscillatorType; gap: number; duration: number; volume: number; glide?: number; noise?: { filter: BiquadFilterType; frequency: number; duration: number; volume: number } }

const VOICES: Record<GolfSoundKind, Voice> = {
  putt: { notes: [980], type: 'triangle', gap: 0, duration: 0.07, volume: 0.05 },
  wall: { notes: [320], type: 'triangle', gap: 0, duration: 0.06, volume: 0.035 },
  bumper: { notes: [520], type: 'sine', gap: 0, duration: 0.2, volume: 0.045, glide: 980 },
  rock: { notes: [210], type: 'triangle', gap: 0, duration: 0.08, volume: 0.035 },
  windmill: { notes: [640, 430], type: 'square', gap: 0.05, duration: 0.06, volume: 0.018 },
  gate: { notes: [240, 180], type: 'square', gap: 0.04, duration: 0.09, volume: 0.03 },
  critter: { notes: [700, 940], type: 'sine', gap: 0.06, duration: 0.1, volume: 0.035 },
  warp: { notes: [300], type: 'sine', gap: 0, duration: 0.34, volume: 0.04, glide: 1500 },
  boost: { notes: [440, 660, 990], type: 'sawtooth', gap: 0.05, duration: 0.1, volume: 0.02 },
  jump: { notes: [392], type: 'sine', gap: 0, duration: 0.28, volume: 0.04, glide: 880 },
  land: { notes: [170], type: 'triangle', gap: 0, duration: 0.09, volume: 0.035 },
  sand: { notes: [], type: 'sine', gap: 0, duration: 0, volume: 0, noise: { filter: 'lowpass', frequency: 1400, duration: 0.22, volume: 0.05 } },
  ice: { notes: [1560, 2090], type: 'sine', gap: 0.05, duration: 0.12, volume: 0.025 },
  splash: { notes: [360], type: 'sine', gap: 0, duration: 0.3, volume: 0.03, glide: 150, noise: { filter: 'bandpass', frequency: 900, duration: 0.45, volume: 0.09 } },
  cup: { notes: [1320, 1760, 1320], type: 'sine', gap: 0.07, duration: 0.18, volume: 0.045 },
  cheer: { notes: [523.25, 659.25, 783.99, 1046.5], type: 'triangle', gap: 0.11, duration: 0.22, volume: 0.04 },
  'hole-in-one': { notes: [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98], type: 'triangle', gap: 0.09, duration: 0.24, volume: 0.045 },
  click: { notes: [720], type: 'sine', gap: 0, duration: 0.05, volume: 0.03 },
}

let noiseBuffer: { context: AudioContext; buffer: AudioBuffer } | null = null

function noise(ctx: AudioContext, voice: NonNullable<Voice['noise']>, start: number, strength: number) {
  if (noiseBuffer?.context !== ctx) {
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    noiseBuffer = { context: ctx, buffer }
  }
  const source = ctx.createBufferSource()
  source.buffer = noiseBuffer.buffer
  const filter = ctx.createBiquadFilter()
  filter.type = voice.filter
  filter.frequency.value = voice.frequency
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(voice.volume * strength, start + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + voice.duration)
  source.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)
  source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect() }
  source.start(start)
  source.stop(start + voice.duration)
}

/** パターゴルフの効果音。音源ファイルを持たず、共有のAudioContextで短い音を合成する。 */
export function golfSound(kind: GolfSoundKind, strength = 1, delay = 0): void {
  if (!isSoundEnabled()) return
  const ctx = getSharedAudioContext()
  if (!ctx) return
  const voice = VOICES[kind]
  const level = Math.min(1, Math.max(0.25, strength))
  const now = ctx.currentTime + Math.max(0, delay)
  voice.notes.forEach((frequency, index) => {
    const start = now + index * voice.gap
    const { oscillator, gain } = createToneNodes(ctx, frequency, start, voice.duration, voice.volume * level, voice.type)
    if (voice.glide) oscillator.frequency.exponentialRampToValueAtTime(voice.glide, start + voice.duration)
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
    oscillator.start(start)
    oscillator.stop(start + voice.duration)
  })
  if (voice.noise) noise(ctx, voice.noise, now, level)
}
