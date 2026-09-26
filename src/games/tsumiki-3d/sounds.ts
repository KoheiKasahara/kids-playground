import { getSharedAudioContext, isSoundEnabled, playTone } from '../../audio/sound'

/**
 * 3Dつみきの こうかおん。木と 木が ぶつかる「コトッ」を、みじかい サインはと
 * ノイズの カチッ で つくる。おとの ファイルは つかわない。
 */

const noiseBuffers = new WeakMap<AudioContext, AudioBuffer>()

function context() {
  if (!isSoundEnabled()) return undefined
  return getSharedAudioContext()
}

function noise(ctx: AudioContext) {
  let buffer = noiseBuffers.get(ctx)
  if (!buffer) {
    buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.4), ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    noiseBuffers.set(ctx, buffer)
  }
  return buffer
}

function ping(ctx: AudioContext, frequency: number, start: number, decay: number, volume: number, type: OscillatorType = 'sine') {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, start)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.004)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + decay)
  oscillator.connect(gain).connect(ctx.destination)
  oscillator.start(start)
  oscillator.stop(start + decay + 0.02)
}

function click(ctx: AudioContext, start: number, frequency: number, duration: number, volume: number) {
  const source = ctx.createBufferSource()
  source.buffer = noise(ctx)
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = frequency
  filter.Q.value = 1.4
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(volume, start)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  source.connect(filter).connect(gain).connect(ctx.destination)
  source.start(start, Math.random() * 0.2)
  source.stop(start + duration + 0.02)
}

/** つみきが ぶつかった「コトッ」。strength は 0〜1。 */
export function playKnockSound(pitch: number, strength: number) {
  const ctx = context()
  if (!ctx) return
  const now = ctx.currentTime
  const level = 0.04 + Math.min(1, strength) * 0.16
  const base = (420 + Math.random() * 60) * pitch
  ping(ctx, base, now, 0.16, level)
  ping(ctx, base * 2.76, now, 0.06, level * 0.45)
  click(ctx, now, 1800 * pitch, 0.035, level * 0.9)
}

/** つみきを だした ときの「ぽんっ」。 */
export function playPlaceSound(pitch: number) {
  const ctx = context()
  if (!ctx) return
  const now = ctx.currentTime
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(380 * pitch, now)
  oscillator.frequency.exponentialRampToValueAtTime(760 * pitch, now + 0.08)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.09, now + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14)
  oscillator.connect(gain).connect(ctx.destination)
  oscillator.start(now)
  oscillator.stop(now + 0.16)
}

/** かたち・いろを えらんだ ときの かるい おと。 */
export function playSelectSound(step = 0) {
  const ctx = context()
  if (!ctx) return
  playTone(ctx, 660 * 2 ** (step / 12), ctx.currentTime, 0.07, 0.05, 'triangle')
}

/** くるっと まわした おと。 */
export function playRotateSound() {
  const ctx = context()
  if (!ctx) return
  const now = ctx.currentTime
  ;[587, 740, 880].forEach((note, index) => playTone(ctx, note, now + index * 0.045, 0.06, 0.04, 'triangle'))
}

/** もどす・かたづける ときの「しゅっ」。 */
export function playPoofSound() {
  const ctx = context()
  if (!ctx) return
  const now = ctx.currentTime
  click(ctx, now, 900, 0.18, 0.12)
  ping(ctx, 520, now, 0.12, 0.04, 'triangle')
}

/** ぜんぶ かたづけ。ちいさく「ぽぽぽぽ」。 */
export function playClearSound(count: number) {
  const ctx = context()
  if (!ctx) return
  const now = ctx.currentTime
  const steps = Math.min(8, Math.max(3, count))
  for (let i = 0; i < steps; i++) ping(ctx, 900 - i * 60, now + i * 0.05, 0.08, 0.05, 'triangle')
}

/** ゆらゆら の「ゴゴゴ」。 */
export function playShakeSound() {
  const ctx = context()
  if (!ctx) return
  const now = ctx.currentTime
  const source = ctx.createBufferSource()
  source.buffer = noise(ctx)
  source.loop = true
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 180
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.35, now + 0.08)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9)
  source.connect(filter).connect(gain).connect(ctx.destination)
  source.start(now)
  source.stop(now + 0.95)
}

/** たかさの めあてに とどいた ファンファーレ。 */
export function playGoalSound(level: number) {
  const ctx = context()
  if (!ctx) return
  const now = ctx.currentTime
  const lift = 2 ** (Math.min(level, 5) / 12)
  const notes = [523, 659, 784, 1047, 784, 1047]
  notes.forEach((note, index) => {
    const start = now + index * 0.09 + (index > 3 ? 0.08 : 0)
    playTone(ctx, note * lift, start, index === notes.length - 1 ? 0.45 : 0.12, 0.07, 'triangle')
    playTone(ctx, note * lift * 2, start, 0.08, 0.018, 'sine')
  })
}

/** もう おけない（つみきが いっぱい）ときの やさしい おと。 */
export function playFullSound() {
  const ctx = context()
  if (!ctx) return
  const now = ctx.currentTime
  playTone(ctx, 440, now, 0.12, 0.05, 'triangle')
  playTone(ctx, 349, now + 0.12, 0.18, 0.05, 'triangle')
}
