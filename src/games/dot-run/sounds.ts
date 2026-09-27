import { getSharedAudioContext, isSoundEnabled } from '../../audio/sound'
import type { StageId } from './stages'

// 音声ファイルを つかわず、Web Audio で むかしの ゲーム機 ふうの こうかおん と BGM を その場で つくる。
// メロディは このゲームの ための オリジナル。

const NOTE: Record<string, number> = { C: -9, 'C#': -8, D: -7, 'D#': -6, Eb: -6, E: -5, F: -4, 'F#': -3, G: -2, 'G#': -1, Ab: -1, A: 0, 'A#': 1, Bb: 1, B: 2 }

/** 'C5' → 周波数。 */
export function freq(name: string) {
  const m = /^([A-G](?:#|b)?)(\d)$/.exec(name)
  if (!m) return 0
  return 440 * Math.pow(2, (NOTE[m[1]] + (Number(m[2]) - 4) * 12) / 12)
}

const pulseCache = new WeakMap<AudioContext, PeriodicWave>()
/** 25% の パルス波。 */
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

type Voice = 'pulse' | 'triangle' | 'sine' | 'square'

function tone(ctx: AudioContext, dest: AudioNode, f: number, start: number, dur: number, vol: number, voice: Voice, release = .05) {
  if (!f) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  if (voice === 'pulse') osc.setPeriodicWave(pulseWave(ctx))
  else osc.type = voice
  osc.frequency.setValueAtTime(f, start)
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(vol, start + .006)
  gain.gain.setValueAtTime(vol * .8, start + Math.max(.01, dur - release))
  gain.gain.linearRampToValueAtTime(0, start + dur)
  osc.connect(gain).connect(dest)
  osc.start(start)
  osc.stop(start + dur + .02)
}

/** 音の 高さが すーっと かわる 音（ジャンプ など）。 */
function slide(ctx: AudioContext, dest: AudioNode, from: number, to: number, start: number, dur: number, vol: number, voice: Voice) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  if (voice === 'pulse') osc.setPeriodicWave(pulseWave(ctx))
  else osc.type = voice
  osc.frequency.setValueAtTime(from, start)
  osc.frequency.exponentialRampToValueAtTime(to, start + dur)
  gain.gain.setValueAtTime(vol, start)
  gain.gain.exponentialRampToValueAtTime(.001, start + dur)
  osc.connect(gain).connect(dest)
  osc.start(start)
  osc.stop(start + dur + .02)
}

const noiseCache = new WeakMap<AudioContext, AudioBuffer>()
function noise(ctx: AudioContext, dest: AudioNode, start: number, dur: number, vol: number, filter: BiquadFilterType, hz: number) {
  let buffer = noiseCache.get(ctx)
  if (!buffer) {
    buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * .5), ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    noiseCache.set(ctx, buffer)
  }
  const src = ctx.createBufferSource()
  src.buffer = buffer
  const f = ctx.createBiquadFilter()
  f.type = filter
  f.frequency.value = hz
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(vol, start)
  gain.gain.exponentialRampToValueAtTime(.001, start + dur)
  src.connect(f).connect(gain).connect(dest)
  src.start(start)
  src.stop(start + dur + .02)
}

function sfx() {
  if (!isSoundEnabled()) return undefined
  return getSharedAudioContext()
}

/** ジャンプの「ぴょん」。 */
export function playJump() {
  const ctx = sfx()
  if (!ctx) return
  slide(ctx, ctx.destination, 280, 760, ctx.currentTime, .13, .07, 'pulse')
}

/** くうちゅうで もう1かい「ぴょーん」。 */
export function playDoubleJump() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  slide(ctx, ctx.destination, 480, 1200, t, .14, .06, 'pulse')
  tone(ctx, ctx.destination, freq('E7'), t + .08, .06, .02, 'sine')
}

/** にんじんを とった「ピコッ」。つづけて とると すこしずつ 高く なる。 */
export function playCarrot(combo: number) {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  const lift = Math.pow(2, (combo % 8) / 24)
  tone(ctx, ctx.destination, freq('B5') * lift, t, .05, .05, 'pulse')
  tone(ctx, ctx.destination, freq('E6') * lift, t + .05, .12, .05, 'pulse')
}

/** ほしメダル「キラリラーン」。 */
export function playMedal() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  ;['C6', 'E6', 'G6', 'C7', 'E7', 'G7'].forEach((n, i) => tone(ctx, ctx.destination, freq(n), t + i * .055, .16, .05, 'pulse'))
  ;['G6', 'C7', 'E7'].forEach((n, i) => tone(ctx, ctx.destination, freq(n), t + .36 + i * .04, .5, .025, 'sine', .35))
}

/** はてなブロックを たたいた「コン」。 */
export function playBlock() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  tone(ctx, ctx.destination, 190, t, .05, .09, 'square')
  tone(ctx, ctx.destination, 380, t + .01, .04, .03, 'square')
}

/** ふんだ「ぽよん」。 */
export function playStomp() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  slide(ctx, ctx.destination, 700, 220, t, .09, .12, 'sine')
  slide(ctx, ctx.destination, 300, 900, t + .08, .12, .07, 'triangle')
}

/** ぶつかった「ぷぇ〜」。 */
export function playHurt() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  slide(ctx, ctx.destination, 620, 160, t, .32, .07, 'square')
  noise(ctx, ctx.destination, t, .12, .08, 'lowpass', 1800)
}

/** ばね「びよよーん」。 */
export function playSpring() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  const osc = ctx.createOscillator()
  const lfo = ctx.createOscillator()
  const lfoGain = ctx.createGain()
  const gain = ctx.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(220, t)
  osc.frequency.exponentialRampToValueAtTime(880, t + .45)
  lfo.frequency.value = 22
  lfoGain.gain.value = 40
  lfo.connect(lfoGain).connect(osc.frequency)
  gain.gain.setValueAtTime(.12, t)
  gain.gain.exponentialRampToValueAtTime(.001, t + .5)
  osc.connect(gain).connect(ctx.destination)
  osc.start(t)
  lfo.start(t)
  osc.stop(t + .52)
  lfo.stop(t + .52)
}

/** あなに おちた「ひゅ〜」。 */
export function playFall() {
  const ctx = sfx()
  if (!ctx) return
  slide(ctx, ctx.destination, 1000, 200, ctx.currentTime, .45, .05, 'sine')
}

/** あわで たすけて もらった「ぽわん」。 */
export function playRescue() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  slide(ctx, ctx.destination, 300, 700, t, .18, .08, 'sine')
  ;['C6', 'G6'].forEach((n, i) => tone(ctx, ctx.destination, freq(n), t + .16 + i * .07, .1, .035, 'pulse'))
}

/** よーい の「ピッ」と どん！ の「ピーッ」。 */
export function playReady(go: boolean) {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  if (go) {
    tone(ctx, ctx.destination, freq('C6'), t, .32, .06, 'pulse')
    tone(ctx, ctx.destination, freq('C5'), t, .32, .04, 'pulse')
  } else tone(ctx, ctx.destination, freq('C5'), t, .12, .05, 'pulse')
}

/** ゴールの ファンファーレ。 */
export function playGoal() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  const s = .09
  const melody: [string, number, number][] = [['C5', 0, 1], ['E5', 1, 1], ['G5', 2, 1], ['C6', 3, 2], ['G5', 5, 1], ['C6', 6, 4], ['D6', 11, 1], ['E6', 12, 8]]
  for (const [n, at, len] of melody) {
    tone(ctx, ctx.destination, freq(n), t + at * s, len * s, .07, 'pulse')
    tone(ctx, ctx.destination, freq(n) / 2, t + at * s, len * s, .025, 'pulse')
  }
  for (const [n, at, len] of [['C3', 0, 3], ['G3', 3, 3], ['C3', 6, 5], ['G3', 11, 1], ['C3', 12, 8]] as [string, number, number][]) {
    tone(ctx, ctx.destination, freq(n), t + at * s, len * s, .1, 'triangle')
  }
  ;['G6', 'C7', 'E7'].forEach((n, i) => tone(ctx, ctx.destination, freq(n), t + 12 * s + i * .04, .7, .02, 'sine', .5))
}

// ---------------- BGM ----------------

type Song = { bpm: number; melody: string; bass: readonly string[]; lead: Voice; drums: 'pop' | 'soft' | 'bell' }

// メロディは 8分音符ずつ。'-' は のばす、'.' は やすみ。
const SONGS: Record<StageId, Song> = {
  meadow: {
    bpm: 150,
    melody: 'G4 C5 E5 G5 - E5 C5 E5 | F5 - E5 D5 - C5 D5 - | E5 - C5 - G4 - C5 - | D5 - - - . . G4 . | G4 C5 E5 G5 - A5 G5 E5 | F5 - A5 - G5 - E5 - | D5 E5 F5 D5 G5 - B4 - | C5 - - - . . . .',
    bass: ['C3', 'F3', 'C3', 'G2', 'C3', 'F3', 'G2', 'C3'],
    lead: 'pulse',
    drums: 'pop',
  },
  beach: {
    bpm: 118,
    melody: 'E5 - D5 - C5 - A4 - | G4 - A4 C5 - - . . | E5 - G5 - A5 - G5 E5 | D5 - - - . . . . | C5 - D5 - E5 - G5 - | A5 - G5 - E5 - D5 - | C5 - A4 - G4 - A4 C5 | C5 - - - . . . .',
    bass: ['C3', 'A2', 'F2', 'G2', 'C3', 'F2', 'G2', 'C3'],
    lead: 'pulse',
    drums: 'soft',
  },
  snow: {
    bpm: 136,
    melody: 'A5 - E5 - C5 - E5 - | B4 - E5 - G5 - - - | A5 - G5 - F5 - E5 - | D5 - E5 - C5 - - - | F5 - A5 - C6 - B5 A5 | G5 - E5 - C5 - D5 E5 | F5 - E5 - D5 - B4 - | C5 - - - . . . .',
    bass: ['A2', 'E2', 'F2', 'C3', 'F2', 'C3', 'G2', 'C3'],
    lead: 'triangle',
    drums: 'bell',
  },
}

/** ステージの BGM を ながす。とめる 関数を かえす。 */
export function startBgm(id: StageId): () => void {
  const song = SONGS[id]
  const ctx = isSoundEnabled() ? getSharedAudioContext() : undefined
  if (!song || !ctx) return () => {}
  const master = ctx.createGain()
  master.gain.value = .5
  master.connect(ctx.destination)
  const delay = ctx.createDelay(1)
  delay.delayTime.value = 60 / song.bpm * .75
  const feedback = ctx.createGain()
  feedback.gain.value = .22
  const wet = ctx.createGain()
  wet.gain.value = .3
  delay.connect(feedback).connect(delay)
  delay.connect(wet).connect(master)
  const steps = song.melody.split(/\s+/).filter(s => s && s !== '|')
  const step = 60 / song.bpm / 2
  let index = 0
  let next = ctx.currentTime + .15
  const schedule = () => {
    while (next < ctx.currentTime + .25) {
      const s = steps[index % steps.length]
      if (s !== '-' && s !== '.') {
        let len = 1
        while (steps[(index + len) % steps.length] === '-' && len < 8) len++
        const vol = song.lead === 'triangle' ? .1 : .042
        tone(ctx, master, freq(s), next, len * step * .9, vol, song.lead)
        tone(ctx, delay, freq(s), next, len * step * .9, vol * .6, song.lead)
        if (song.drums === 'bell') tone(ctx, master, freq(s) * 2, next, .08, .012, 'sine')
      }
      const beat = index % 8
      const bar = Math.floor((index % steps.length) / 8)
      const root = freq(song.bass[bar % song.bass.length])
      // ベースは ぽん・ぽん と はずむ。
      const bassStep = song.drums === 'soft' ? [1, 0, 0, 1.5, 0, 0, 2, 0][beat] : [1, 0, 2, 0, 1.5, 0, 2, 1.5][beat]
      if (bassStep) tone(ctx, master, root * bassStep, next, step * (song.drums === 'soft' ? 2.4 : .85), .09, 'triangle')
      if (song.drums === 'pop') {
        if (beat % 4 === 0) slide(ctx, master, 150, 50, next, .12, .16, 'sine')
        if (beat % 4 === 2) noise(ctx, master, next, .08, .05, 'bandpass', 2400)
        noise(ctx, master, next, .025, .018, 'highpass', 7000)
      } else if (song.drums === 'soft') {
        if (beat === 0) slide(ctx, master, 120, 50, next, .14, .12, 'sine')
        if (beat % 2 === 1) noise(ctx, master, next, .05, .02, 'highpass', 6000)
      } else {
        if (beat % 4 === 0) slide(ctx, master, 130, 50, next, .12, .1, 'sine')
        if (beat % 2 === 1) noise(ctx, master, next, .03, .014, 'highpass', 9000)
      }
      index++
      next += step
    }
  }
  schedule()
  const timer = setInterval(schedule, 60)
  return () => {
    clearInterval(timer)
    const t = ctx.currentTime
    master.gain.setValueAtTime(master.gain.value, t)
    master.gain.linearRampToValueAtTime(0, t + .3)
    setTimeout(() => { try { master.disconnect(); delay.disconnect(); feedback.disconnect() } catch { /* もう きれている */ } }, 400)
  }
}
