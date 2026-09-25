import { getSharedAudioContext, isSoundEnabled } from '../../audio/sound'
import type { SpeciesId } from './data'

// 音声ファイルを つかわず、Web Audio で SFC ふうの こうかおん と BGM を その場で つくる。
// メロディは このゲームの ための オリジナル。

const NOTE: Record<string, number> = { C: -9, 'C#': -8, D: -7, 'D#': -6, Eb: -6, E: -5, F: -4, 'F#': -3, G: -2, 'G#': -1, Ab: -1, A: 0, 'A#': 1, Bb: 1, B: 2 }

/** 'C5' → 周波数。 */
export function freq(name: string) {
  const m = /^([A-G](?:#|b)?)(\d)$/.exec(name)
  if (!m) return 0
  return 440 * Math.pow(2, (NOTE[m[1]] + (Number(m[2]) - 4) * 12) / 12)
}

const pulseCache = new WeakMap<AudioContext, PeriodicWave>()
function pulseWave(ctx: AudioContext) {
  let wave = pulseCache.get(ctx)
  if (!wave) {
    const n = 32
    const real = new Float32Array(n), imag = new Float32Array(n)
    for (let k = 1; k < n; k++) imag[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * .25)
    wave = ctx.createPeriodicWave(real, imag)
    pulseCache.set(ctx, wave)
  }
  return wave
}

type Voice = 'pulse' | 'triangle' | 'sine' | 'square' | 'sawtooth'

function tone(ctx: AudioContext, dest: AudioNode, f: number, start: number, dur: number, vol: number, voice: Voice, release = .06, bend = 1) {
  if (!f) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  if (voice === 'pulse') osc.setPeriodicWave(pulseWave(ctx))
  else osc.type = voice
  osc.frequency.setValueAtTime(f, start)
  if (bend !== 1) osc.frequency.exponentialRampToValueAtTime(f * bend, start + dur)
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(vol, start + .008)
  gain.gain.setValueAtTime(vol * .8, start + Math.max(.01, dur - release))
  gain.gain.linearRampToValueAtTime(0, start + dur)
  osc.connect(gain).connect(dest)
  osc.start(start)
  osc.stop(start + dur + .02)
}

function noise(ctx: AudioContext, start: number, dur: number, vol: number, cutoff: number) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur))
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
  const src = ctx.createBufferSource()
  src.buffer = buf
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = cutoff
  const gain = ctx.createGain()
  gain.gain.value = vol
  src.connect(filter).connect(gain).connect(ctx.destination)
  src.start(start)
}

function sfx() {
  if (!isSoundEnabled()) return undefined
  return getSharedAudioContext()
}

/** おいた「ポン♪」。 */
export function playPlaceSound() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  tone(ctx, ctx.destination, 380, t, .1, .1, 'sine', .05, 2.2)
  ;['G5', 'C6'].forEach((n, i) => tone(ctx, ctx.destination, freq(n), t + .06 + i * .06, .1, .05, 'pulse'))
}

/** かたづけた「シュッ」。 */
export function playRemoveSound() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  noise(ctx, t, .18, .12, 2400)
  tone(ctx, ctx.destination, 700, t, .14, .05, 'triangle', .05, .4)
}

/** だめ「ブブッ」。 */
export function playNoSound() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  tone(ctx, ctx.destination, 150, t, .08, .06, 'square')
  tone(ctx, ctx.destination, 150, t + .11, .1, .06, 'square')
}

/** タップ「ピッ」。 */
export function playTapSound() {
  const ctx = sfx()
  if (!ctx) return
  tone(ctx, ctx.destination, freq('A6'), ctx.currentTime, .03, .025, 'pulse')
}

/** えさを なげた「ヒュー ポト」。 */
export function playDropSound() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  tone(ctx, ctx.destination, 1200, t, .22, .04, 'sine', .05, .35)
  tone(ctx, ctx.destination, 180, t + .22, .06, .09, 'triangle')
}

/** もぐもぐ。 */
export function playMunchSound() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  for (let i = 0; i < 4; i++) noise(ctx, t + i * .16, .06, .09, 900)
}

/** たべおわって うれしい「ピロリン♪」。 */
export function playHappySound() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  ;['C6', 'E6', 'G6', 'C7'].forEach((n, i) => tone(ctx, ctx.destination, freq(n), t + i * .06, .12, .05, 'pulse'))
}

/** うんち「ぷっ」。 */
export function playPoopSound() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  tone(ctx, ctx.destination, 110, t, .18, .08, 'sawtooth', .05, .7)
}

/** そうじ「キラリン」。 */
export function playCleanSound() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  ;['E6', 'G#6', 'B6', 'E7'].forEach((n, i) => tone(ctx, ctx.destination, freq(n), t + i * .04, .1, .04, 'triangle'))
  noise(ctx, t, .12, .04, 6000)
}

/** まわす「シュルン」。 */
export function playSpinSound() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  tone(ctx, ctx.destination, 300, t, .25, .05, 'triangle', .08, 3)
}

/** あさ・よるの おしらせ。 */
export function playTimeSound(night: boolean) {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  const notes = night ? ['G5', 'E5', 'C5', 'G4'] : ['C5', 'E5', 'G5', 'C6']
  notes.forEach((n, i) => tone(ctx, ctx.destination, freq(n), t + i * .14, .3, .045, night ? 'triangle' : 'pulse', .2))
}

/** どうぶつの なきごえ（それっぽい 合成音）。 */
export function playCry(id: SpeciesId) {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  const d = ctx.destination
  switch (id) {
    case 'lion':
    case 'tiger':
      noise(ctx, t, .5, .16, 500)
      tone(ctx, d, id === 'lion' ? 110 : 130, t, .5, .08, 'sawtooth', .2, .6)
      break
    case 'elephant':
      tone(ctx, d, 520, t, .5, .06, 'sawtooth', .15, 1.5)
      tone(ctx, d, 780, t + .05, .45, .03, 'square', .15, 1.4)
      break
    case 'giraffe':
      tone(ctx, d, 220, t, .25, .05, 'triangle', .1, 1.2)
      break
    case 'zebra':
      for (let i = 0; i < 4; i++) tone(ctx, d, 700 - i * 80, t + i * .08, .07, .05, 'square', .02, 1.3)
      break
    case 'hippo':
      tone(ctx, d, 90, t, .45, .1, 'sawtooth', .2, .8)
      break
    case 'panda':
      tone(ctx, d, 330, t, .15, .05, 'triangle', .05, 1.3)
      tone(ctx, d, 290, t + .17, .15, .05, 'triangle', .05, 1.2)
      break
    case 'monkey':
      for (let i = 0; i < 3; i++) tone(ctx, d, 900 + i * 120, t + i * .09, .07, .05, 'square', .02, 1.4)
      break
    case 'rabbit':
      tone(ctx, d, 1400, t, .06, .03, 'sine', .02, 1.3)
      break
    case 'penguin':
      tone(ctx, d, 440, t, .12, .05, 'sawtooth', .04, 1.4)
      tone(ctx, d, 480, t + .14, .16, .05, 'sawtooth', .04, .8)
      break
  }
}

// ---------------- BGM ----------------

type Song = { bpm: number; melody: string; bass: readonly string[]; voice: Voice; vol: number }

// メロディは 8分音符ずつ。'-' は のばす、'.' は やすみ。
export const SONGS: Record<'day' | 'night', Song> = {
  day: {
    bpm: 112,
    voice: 'pulse',
    vol: .04,
    melody: 'C5 - E5 G5 A5 - G5 - | E5 - C5 - D5 - . . | F5 - A5 - G5 - E5 - | D5 - - - . . G4 - | C5 - E5 G5 C6 - B5 A5 | G5 - E5 - F5 - D5 - | E5 - D5 - C5 - D5 - | C5 - - - . . . .',
    bass: ['C3', 'A2', 'F2', 'G2', 'C3', 'E3', 'F2', 'C3'],
  },
  night: {
    bpm: 72,
    voice: 'triangle',
    vol: .06,
    melody: 'E5 - - - G5 - - - | A5 - G5 - E5 - - - | D5 - - - E5 - C5 - | A4 - - - - - . . | C5 - - - D5 - - - | E5 - G5 - E5 - - - | D5 - C5 - A4 - - - | C5 - - - - - . .',
    bass: ['A2', 'F2', 'G2', 'A2', 'F2', 'C3', 'G2', 'C3'],
  },
}

/** BGM を ながす。とめる 関数を かえす。 */
export function startBgm(id: 'day' | 'night'): () => void {
  const song = SONGS[id]
  const ctx = isSoundEnabled() ? getSharedAudioContext() : undefined
  if (!song || !ctx) return () => {}
  const master = ctx.createGain()
  master.gain.setValueAtTime(0, ctx.currentTime)
  master.gain.linearRampToValueAtTime(.5, ctx.currentTime + 1)
  master.connect(ctx.destination)
  const delay = ctx.createDelay(1)
  delay.delayTime.value = 60 / song.bpm * .75
  const feedback = ctx.createGain()
  feedback.gain.value = .3
  const wet = ctx.createGain()
  wet.gain.value = .35
  delay.connect(feedback).connect(delay)
  delay.connect(wet).connect(master)
  const steps = song.melody.split(/\s+/).filter(s => s && s !== '|')
  const step = 60 / song.bpm / 2
  let index = 0
  let next = ctx.currentTime + .2
  const schedule = () => {
    while (next < ctx.currentTime + .25) {
      const s = steps[index % steps.length]
      if (s !== '-' && s !== '.') {
        let len = 1
        while (steps[(index + len) % steps.length] === '-' && len < 8) len++
        tone(ctx, master, freq(s), next, len * step * .92, song.vol, song.voice)
        tone(ctx, delay, freq(s), next, len * step * .92, song.vol * .7, song.voice)
      }
      const bar = Math.floor((index % steps.length) / 8)
      const root = freq(song.bass[bar % song.bass.length])
      const beat = index % 8
      if (beat % 2 === 0) tone(ctx, master, root * [1, 1.5, 2, 1.5][beat / 2], next, step * 1.8, .07, 'triangle')
      index++
      next += step
    }
  }
  schedule()
  const timer = setInterval(schedule, 60)
  return () => {
    clearInterval(timer)
    const t = ctx.currentTime
    master.gain.cancelScheduledValues(t)
    master.gain.setValueAtTime(master.gain.value, t)
    master.gain.linearRampToValueAtTime(0, t + .4)
    setTimeout(() => { try { master.disconnect(); delay.disconnect(); feedback.disconnect() } catch { /* もう きれている */ } }, 500)
  }
}
