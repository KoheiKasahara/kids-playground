import { getSharedAudioContext, isSoundEnabled } from '../../audio/sound'

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

function noise(ctx: AudioContext, start: number, dur: number, vol: number, cutoff: number, type: BiquadFilterType = 'lowpass') {
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur))
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
  const src = ctx.createBufferSource()
  src.buffer = buf
  const filter = ctx.createBiquadFilter()
  filter.type = type
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

/** みずの おと「ぽちゃん」。 */
function plop(ctx: AudioContext, t: number, f = 520, vol = .1) {
  tone(ctx, ctx.destination, f, t, .12, vol, 'sine', .06, 2.4)
  noise(ctx, t, .08, .04, 1800)
}

/** いれた「ぽちゃん♪」。 */
export function playPlaceSound() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  plop(ctx, t)
  ;['E6', 'B6'].forEach((n, i) => tone(ctx, ctx.destination, freq(n), t + .08 + i * .06, .1, .04, 'pulse'))
}

/** かたづけた「すぽっ」。 */
export function playRemoveSound() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  tone(ctx, ctx.destination, 900, t, .16, .07, 'sine', .05, .35)
  noise(ctx, t, .14, .06, 2600)
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

/** えさを いれた「ぽとぽと」。 */
export function playDropSound() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  for (let i = 0; i < 3; i++) plop(ctx, t + i * .07, 700 + i * 140, .05)
}

/** ぱくっ。 */
export function playMunchSound() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  tone(ctx, ctx.destination, 320, t, .06, .08, 'square', .02, .5)
  noise(ctx, t, .05, .05, 1200)
}

/** おなか いっぱい「ピロリン♪」。 */
export function playHappySound() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  ;['C6', 'E6', 'G6', 'C7'].forEach((n, i) => tone(ctx, ctx.destination, freq(n), t + i * .06, .12, .045, 'pulse'))
}

/** ガラスを ふく「きゅっ」。 */
export function playWipeSound() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  tone(ctx, ctx.destination, 1400, t, .08, .03, 'triangle', .03, 1.6)
  noise(ctx, t, .06, .035, 5000, 'highpass')
}

/** ピカピカ「キラリン」。 */
export function playCleanSound() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  ;['E6', 'G#6', 'B6', 'E7'].forEach((n, i) => tone(ctx, ctx.destination, freq(n), t + i * .04, .1, .04, 'triangle'))
  noise(ctx, t, .12, .04, 6000)
}

/** ガラスを コンコン。 */
export function playKnockSound() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  for (let i = 0; i < 2; i++) {
    tone(ctx, ctx.destination, 1900, t + i * .12, .05, .06, 'sine', .03, .8)
    tone(ctx, ctx.destination, 620, t + i * .12, .06, .05, 'triangle', .03, .9)
  }
}

/** ぷくーっ。 */
export function playPuffSound() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  tone(ctx, ctx.destination, 180, t, .35, .09, 'triangle', .08, 3.2)
  tone(ctx, ctx.destination, 360, t + .02, .3, .03, 'pulse', .08, 3)
}

/** しんじゅ「キラリーン」。 */
export function playPearlSound() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  ;['G5', 'C6', 'E6', 'G6', 'C7', 'E7'].forEach((n, i) => tone(ctx, ctx.destination, freq(n), t + i * .055, .22, .045, i % 2 ? 'triangle' : 'pulse', .12))
}

/** たからばこ・ぶくぶく「ごぽぽ」。 */
export function playBubbleSound() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  for (let i = 0; i < 4; i++) tone(ctx, ctx.destination, 300 + Math.random() * 400, t + i * .07, .07, .04, 'sine', .03, 1.8)
}

/** シャコガイが ぱかっ。 */
export function playClamSound() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  tone(ctx, ctx.destination, 260, t, .18, .05, 'triangle', .06, 1.6)
  tone(ctx, ctx.destination, freq('E6'), t + .15, .2, .03, 'sine', .1)
}

/** あさ・よるの おしらせ。 */
export function playTimeSound(night: boolean) {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  const notes = night ? ['G5', 'E5', 'C5', 'G4'] : ['C5', 'E5', 'G5', 'C6']
  notes.forEach((n, i) => tone(ctx, ctx.destination, freq(n), t + i * .14, .3, .045, night ? 'triangle' : 'pulse', .2))
}

// ---------------- BGM ----------------

type Song = { bpm: number; melody: string; chords: readonly (readonly string[])[]; voice: Voice; vol: number }

// メロディは 8分音符ずつ。'-' は のばす、'.' は やすみ。和音は 1小節ずつ（アルペジオで ながす）。
export const SONGS: Record<'day' | 'night', Song> = {
  day: {
    bpm: 92,
    voice: 'triangle',
    vol: .05,
    melody: 'E5 - - G5 A5 - G5 E5 | D5 - - - . . C5 D5 | E5 - - G5 C6 - B5 A5 | G5 - - - . . . . | A5 - - G5 E5 - D5 C5 | D5 - - E5 G5 - - - | E5 - D5 C5 A4 - C5 D5 | C5 - - - . . . .',
    chords: [['C4', 'E4', 'G4', 'B4'], ['A3', 'C4', 'E4', 'G4'], ['F3', 'A3', 'C4', 'E4'], ['G3', 'B3', 'D4', 'F4'], ['F3', 'A3', 'C4', 'E4'], ['E3', 'G3', 'B3', 'D4'], ['D3', 'F3', 'A3', 'C4'], ['G3', 'C4', 'E4', 'G4']],
  },
  night: {
    bpm: 64,
    voice: 'sine',
    vol: .06,
    melody: 'A5 - - - E5 - - - | F5 - E5 - C5 - - - | D5 - - - E5 - C5 - | B4 - - - - - . . | A5 - - - G5 - - - | F5 - E5 - D5 - - - | C5 - B4 - A4 - - - | A4 - - - - - . .',
    chords: [['A3', 'C4', 'E4', 'A4'], ['F3', 'A3', 'C4', 'F4'], ['D3', 'F3', 'A3', 'D4'], ['E3', 'G#3', 'B3', 'E4'], ['A3', 'C4', 'E4', 'A4'], ['D3', 'F3', 'A3', 'D4'], ['F3', 'A3', 'C4', 'E4'], ['E3', 'A3', 'C4', 'E4']],
  },
}

/** BGM を ながす。とめる 関数を かえす。 */
export function startBgm(id: 'day' | 'night'): () => void {
  const song = SONGS[id]
  const ctx = isSoundEnabled() ? getSharedAudioContext() : undefined
  if (!song || !ctx) return () => {}
  const master = ctx.createGain()
  master.gain.setValueAtTime(0, ctx.currentTime)
  master.gain.linearRampToValueAtTime(.5, ctx.currentTime + 1.2)
  master.connect(ctx.destination)
  // みずの なかの ような ひびき（ディレイ＋こもり）。
  const delay = ctx.createDelay(1)
  delay.delayTime.value = 60 / song.bpm * .75
  const feedback = ctx.createGain()
  feedback.gain.value = .38
  const damp = ctx.createBiquadFilter()
  damp.type = 'lowpass'
  damp.frequency.value = 1800
  const wet = ctx.createGain()
  wet.gain.value = .45
  delay.connect(damp).connect(feedback).connect(delay)
  damp.connect(wet).connect(master)
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
        tone(ctx, master, freq(s), next, len * step * .92, song.vol, song.voice, .15)
        tone(ctx, delay, freq(s), next, len * step * .92, song.vol * .8, song.voice, .15)
      }
      const bar = Math.floor((index % steps.length) / 8)
      const chord = song.chords[bar % song.chords.length]
      const beat = index % 8
      // きらきらした アルペジオ。
      const n = chord[[0, 1, 2, 3, 2, 1, 2, 3][beat]]
      tone(ctx, master, freq(n) * 2, next, step * 1.6, .022, 'pulse', .1)
      if (beat === 0 || beat === 4) tone(ctx, master, freq(chord[0]) / 2, next, step * 3.6, .06, 'triangle', .2)
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
    setTimeout(() => { try { master.disconnect(); delay.disconnect(); feedback.disconnect(); damp.disconnect() } catch { /* もう きれている */ } }, 500)
  }
}
