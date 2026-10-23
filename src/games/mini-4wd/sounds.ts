import { getSharedAudioContext, getSoundOutput, isSoundEnabled } from '../../audio/sound'

export type MiniSound = 'select' | 'assemble' | 'start' | 'countdown' | 'go' | 'lap' | 'bump' | 'cheer' | 'finish'
type Theme = 'park' | 'forest' | 'coast' | 'night'
type Voice = 'pulse' | 'triangle' | 'sine'

const frequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12)
const pulseWaves = new WeakMap<AudioContext, PeriodicWave>()
const noiseBuffers = new WeakMap<AudioContext, AudioBuffer>()
const soundEffects = new Set<ReturnType<typeof createVoices>>()

function pulseWave(ctx: AudioContext): PeriodicWave {
  let wave = pulseWaves.get(ctx)
  if (!wave) {
    const real = new Float32Array(32)
    const imag = new Float32Array(32)
    for (let harmonic = 1; harmonic < 32; harmonic++) {
      imag[harmonic] = 2 * Math.sin(harmonic * Math.PI * .25) / (harmonic * Math.PI)
    }
    wave = ctx.createPeriodicWave(real, imag)
    pulseWaves.set(ctx, wave)
  }
  return wave
}

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  let buffer = noiseBuffers.get(ctx)
  if (!buffer) {
    buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .25), ctx.sampleRate)
    const data = buffer.getChannelData(0)
    // A deterministic shift register gives the percussion a small game-console texture.
    let register = 0x6a41
    for (let i = 0; i < data.length; i++) {
      register = (register >> 1) | (((register ^ (register >> 1)) & 1) << 14)
      data[i] = (register & 1) * 2 - 1
    }
    noiseBuffers.set(ctx, buffer)
  }
  return buffer
}

/** Each phrase owns its voices; ending or stopping a voice disconnects its entire chain. */
function createVoices(ctx: AudioContext, persistent: boolean, onEmpty?: () => void) {
  const output = ctx.createGain()
  output.connect(getSoundOutput(ctx))
  const active = new Set<() => void>()
  let stopped = false

  function start(source: AudioScheduledSourceNode, nodes: AudioNode[], at: number, duration: number) {
    const release = () => {
      source.onended = null
      for (const node of [source, ...nodes]) node.disconnect()
      active.delete(stop)
      if (!persistent && active.size === 0) {
        output.disconnect()
        onEmpty?.()
      }
    }
    const stop = () => {
      try { source.stop() } catch { /* It may already have ended. */ }
      release()
    }
    active.add(stop)
    source.onended = release
    source.start(at)
    source.stop(at + duration)
  }

  function tone(midi: number, at: number, duration: number, volume: number, voice: Voice = 'pulse', endMidi = midi) {
    if (stopped) return
    const oscillator = ctx.createOscillator()
    const envelope = ctx.createGain()
    if (voice === 'pulse') oscillator.setPeriodicWave(pulseWave(ctx))
    else oscillator.type = voice
    oscillator.frequency.setValueAtTime(frequency(midi), at)
    if (endMidi !== midi) oscillator.frequency.exponentialRampToValueAtTime(frequency(endMidi), at + duration)
    envelope.gain.setValueAtTime(0, at)
    envelope.gain.linearRampToValueAtTime(volume, at + .004)
    envelope.gain.linearRampToValueAtTime(volume * .65, at + duration * .6)
    envelope.gain.linearRampToValueAtTime(0, at + duration)
    oscillator.connect(envelope).connect(output)
    start(oscillator, [envelope], at, duration + .005)
  }

  function percussion(at: number, duration: number, volume: number, high = false) {
    if (stopped) return
    const source = ctx.createBufferSource()
    source.buffer = noiseBuffer(ctx)
    const filter = ctx.createBiquadFilter()
    filter.type = high ? 'highpass' : 'bandpass'
    filter.frequency.value = high ? 6500 : 1800
    const envelope = ctx.createGain()
    envelope.gain.setValueAtTime(volume, at)
    envelope.gain.exponentialRampToValueAtTime(.0001, at + duration)
    source.connect(filter).connect(envelope).connect(output)
    start(source, [filter, envelope], at, duration + .005)
  }

  return {
    tone,
    percussion,
    stop() {
      if (stopped) return
      stopped = true
      for (const stop of [...active]) stop()
      output.disconnect()
    },
  }
}

/** Call from a gesture or a race that the player has already started. */
export function playMiniSound(kind: MiniSound): void {
  if (!isSoundEnabled()) return
  const ctx = getSharedAudioContext()
  if (!ctx) return
  const voices = createVoices(ctx, false, () => soundEffects.delete(voices))
  soundEffects.add(voices)
  const at = ctx.currentTime
  const notes = (melody: number[], step: number, volume = .065) => {
    melody.forEach((note, i) => voices.tone(note, at + i * step, step * 1.25, volume))
  }
  switch (kind) {
    case 'select':
      notes([79, 84], .045, .055)
      break
    case 'assemble':
      voices.percussion(at, .06, .12)
      notes([72, 79, 88], .055)
      voices.tone(48, at, .12, .11, 'triangle')
      break
    case 'start':
      voices.tone(43, at, .34, .11, 'triangle', 67)
      notes([72, 76, 79, 84], .075)
      break
    case 'countdown':
      voices.tone(79, at, .13, .075)
      break
    case 'go':
      voices.tone(84, at, .32, .075)
      voices.tone(79, at, .32, .045)
      voices.tone(48, at, .2, .12, 'triangle', 60)
      break
    case 'lap':
      notes([84, 88, 91], .065)
      break
    case 'bump':
      voices.percussion(at, .1, .13)
      voices.tone(55, at, .13, .13, 'triangle', 38)
      break
    case 'cheer':
      notes([76, 81, 88], .055)
      voices.tone(57, at, .15, .08, 'triangle')
      break
    case 'finish':
      notes([72, 76, 79, 84, 83, 84, 88], .095, .075)
      voices.tone(60, at, .28, .11, 'triangle')
      voices.tone(55, at + .28, .28, .1, 'triangle')
      voices.tone(60, at + .56, .5, .1, 'triangle')
      voices.tone(84, at + .665, .4, .045)
      voices.tone(91, at + .665, .4, .035)
      break
  }
}

/** Silence pending effects on mute, pause, hidden tabs, or leaving the game. */
export function stopMiniSounds(): void {
  for (const voices of [...soundEffects]) voices.stop()
  soundEffects.clear()
}

// Original eight-bar melodies. Each cell is an eighth-note; -1 sustains, 0 rests.
const GARAGE = [
  72, -1, 76, 79, 76, -1, 74, 72,
  74, -1, 77, 81, 79, -1, 76, -1,
  72, -1, 76, 79, 84, -1, 83, 81,
  79, -1, -1, 0, 76, 74, 72, -1,
  77, -1, 81, 84, 81, -1, 79, 77,
  76, -1, 79, 84, 79, -1, 76, 72,
  74, 77, 79, -1, 83, 81, 79, 77,
  76, -1, 74, -1, 72, -1, -1, 0,
] as const
const RACE = [
  72, 76, 79, -1, 81, 79, 76, 74,
  72, 76, 79, 84, 83, -1, 79, -1,
  81, 79, 76, -1, 72, 76, 79, 81,
  83, -1, 86, 84, 83, 81, 79, -1,
  81, 84, 89, -1, 88, 84, 81, 79,
  79, 84, 88, 86, 84, -1, 79, 76,
  77, 81, 84, 83, 81, 79, 77, 74,
  76, 79, 84, -1, 83, 79, 74, 71,
] as const
const BASS = [48, 43, 45, 43, 41, 48, 43, 48] as const
const THEMES: Record<Theme, { shift: number; bpm: number; lead: Voice }> = {
  park: { shift: 0, bpm: 156, lead: 'pulse' },
  forest: { shift: 2, bpm: 148, lead: 'triangle' },
  coast: { shift: 5, bpm: 162, lead: 'pulse' },
  night: { shift: -3, bpm: 168, lead: 'pulse' },
}

/** Start only after the first interaction. Cleanup stops even the already scheduled notes. */
export function startMiniBgm(mode: 'garage' | 'race', theme: Theme = 'park'): () => void {
  if (!isSoundEnabled()) return () => {}
  const ctx = getSharedAudioContext()
  if (!ctx) return () => {}
  const voices = createVoices(ctx, true)
  const race = mode === 'race'
  const profile = THEMES[theme]
  const melody = race ? RACE : GARAGE
  const step = 30 / (race ? profile.bpm : 112)
  const shift = race ? profile.shift : 0
  let next = ctx.currentTime + .025
  let index = 0
  let stopped = false

  const stop = () => {
    if (stopped) return
    stopped = true
    clearInterval(timer)
    voices.stop()
  }

  const schedule = () => {
    if (stopped) return
    if (!isSoundEnabled() || ctx.state === 'closed') {
      stop()
      return
    }
    // Background tabs may throttle timers. Resume the current phrase without a burst of missed notes.
    if (next < ctx.currentTime - step) next = ctx.currentTime + .025
    while (next < ctx.currentTime + .12) {
      const position = index % melody.length
      const beat = position % 8
      const note = melody[position]
      if (note > 0) {
        let length = 1
        while (length < 8 && melody[(position + length) % melody.length] === -1) length++
        voices.tone(note + shift, next, step * length * .86, race ? .023 : .036, race ? profile.lead : 'triangle')
        if (race && beat % 2 === 0) voices.tone(note + shift - 12, next + step * .5, step * .35, .008)
      }
      const bass = BASS[Math.floor(position / 8)] + shift
      if (race || beat % 2 === 0) voices.tone(bass + (beat % 4 === 2 ? 7 : beat % 4 === 3 ? 12 : 0), next, step * .72, .045, 'triangle')
      if (beat % 4 === 0) voices.tone(43, next, .095, .075, 'sine', 26)
      if (race && beat % 4 === 2) voices.percussion(next, .065, .028)
      if (race || beat % 2 === 1) voices.percussion(next, .025, race ? .012 : .008, true)
      index++
      next += step
    }
  }

  const timer = setInterval(schedule, 25)
  schedule()
  return stop
}
