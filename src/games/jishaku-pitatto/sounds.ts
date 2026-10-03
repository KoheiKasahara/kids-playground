import { getSharedAudioContext, getSoundOutput, isSoundEnabled, playNoiseBurst } from '../../audio/sound'
import type { Material } from './items'
import type { StageId } from './stages'

/**
 * ぴたっと じしゃく の こうかおん と BGM。すべて 共有AudioContext で その場で つくる（音源ファイルなし）。
 */

type Voice = { type: OscillatorType; f: number; f2?: number; dur: number; vol: number; attack?: number; at?: number; dest?: AudioNode }

function ctx(): AudioContext | undefined {
  if (!isSoundEnabled()) return undefined
  return getSharedAudioContext()
}

function voice(c: AudioContext, v: Voice) {
  const t = Math.max(c.currentTime, v.at ?? c.currentTime)
  const o = c.createOscillator()
  const gn = c.createGain()
  o.type = v.type
  o.frequency.setValueAtTime(v.f, t)
  if (v.f2) o.frequency.exponentialRampToValueAtTime(v.f2, t + v.dur)
  const attack = v.attack ?? 0.004
  gn.gain.setValueAtTime(0.0001, t)
  gn.gain.exponentialRampToValueAtTime(v.vol, t + attack)
  gn.gain.exponentialRampToValueAtTime(0.0001, t + v.dur)
  o.connect(gn)
  gn.connect(v.dest ?? getSoundOutput(c))
  o.start(t)
  o.stop(t + v.dur + 0.03)
}

// ペンタトニック（ドレミソラ）で だんだん たかく。
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24]
const hz = (semi: number, base = 1046.5) => base * 2 ** (semi / 12)

let lastStickAt = 0

/** じしゃくに くっついた「カチッ」。つづけて くっつくと おとが たかく なる。 */
export function playStick(combo: number, material: Material, big = false) {
  const c = ctx()
  if (!c) return
  const now = c.currentTime
  if (now - lastStickAt < 0.03) return
  lastStickAt = now
  const note = PENTA[Math.min(combo, PENTA.length - 1)]
  playNoiseBurst(c, now, 0.028, material === 'metal' ? 0.16 : 0.1, 'highpass', 3200)
  voice(c, { type: 'triangle', f: big ? 520 : 780, f2: big ? 260 : 420, dur: 0.06, vol: 0.12 })
  voice(c, { type: 'sine', f: hz(note), dur: 0.22, vol: 0.09, at: now + 0.012 })
  voice(c, { type: 'sine', f: hz(note + 12), dur: 0.12, vol: 0.03, at: now + 0.012 })
}

/** ほしバッジ：きらきら。 */
export function playStar() {
  const c = ctx()
  if (!c) return
  const now = c.currentTime
  ;[0, 4, 7, 12, 16].forEach((s, i) => voice(c, { type: 'sine', f: hz(s, 1318.5), dur: 0.35, vol: 0.07, at: now + i * 0.06 }))
  voice(c, { type: 'triangle', f: hz(24, 1318.5), dur: 0.5, vol: 0.02, at: now + 0.3 })
}

/** とびあがる「ひゅっ」。 */
export function playLift() {
  const c = ctx()
  if (!c) return
  voice(c, { type: 'sine', f: 380, f2: 1150, dur: 0.13, vol: 0.05, attack: 0.02 })
}

let lastClinkAt = 0

/** ものが ぶつかった おと。 */
export function playClink(material: Material, power: number) {
  const c = ctx()
  if (!c) return
  const now = c.currentTime
  if (now - lastClinkAt < 0.05) return
  lastClinkAt = now
  const v = 0.03 + power * 0.08
  if (material === 'metal') {
    voice(c, { type: 'triangle', f: 1900 + Math.random() * 500, dur: 0.12, vol: v * 0.8 })
    voice(c, { type: 'sine', f: 3100 + Math.random() * 400, dur: 0.07, vol: v * 0.4 })
  } else if (material === 'glass') {
    voice(c, { type: 'sine', f: 2600 + Math.random() * 300, dur: 0.18, vol: v * 0.7 })
  } else if (material === 'wood') {
    voice(c, { type: 'sine', f: 520, f2: 260, dur: 0.07, vol: v })
    playNoiseBurst(c, now, 0.03, v * 0.5, 'bandpass', 900)
  } else {
    playNoiseBurst(c, now, 0.05, v * 0.7, 'lowpass', 700)
  }
}

/** くっつかない とき の「しーん」。 */
export function playShiin() {
  const c = ctx()
  if (!c) return
  const now = c.currentTime
  voice(c, { type: 'sine', f: 660, f2: 440, dur: 0.45, vol: 0.05, attack: 0.03 })
  voice(c, { type: 'sine', f: 990, f2: 660, dur: 0.3, vol: 0.02, attack: 0.03, at: now + 0.02 })
}

/** すなから ぽんっ。 */
export function playPop() {
  const c = ctx()
  if (!c) return
  const now = c.currentTime
  playNoiseBurst(c, now, 0.16, 0.12, 'lowpass', 1400)
  voice(c, { type: 'sine', f: 260, f2: 720, dur: 0.14, vol: 0.1 })
}

/** みずの ちゃぽん。 */
export function playSplash(power: number) {
  const c = ctx()
  if (!c) return
  const now = c.currentTime
  playNoiseBurst(c, now, 0.2 + power * 0.2, 0.05 + power * 0.1, 'lowpass', 1600)
  voice(c, { type: 'sine', f: 420, f2: 900, dur: 0.1, vol: 0.05 + power * 0.04, at: now + 0.02 })
  voice(c, { type: 'sine', f: 700, f2: 1300, dur: 0.07, vol: 0.03, at: now + 0.09 })
}

let lastGrainAt = 0

/** さてつが あつまる さらさら。 */
export function playGrains(n: number) {
  const c = ctx()
  if (!c) return
  const now = c.currentTime
  if (now - lastGrainAt < 0.07) return
  lastGrainAt = now
  playNoiseBurst(c, now, 0.07, Math.min(0.06, 0.012 + n * 0.006), 'bandpass', 5200)
}

/** さかなが かかった「ぴちっ」。 */
export function playHooked() {
  const c = ctx()
  if (!c) return
  const now = c.currentTime
  voice(c, { type: 'square', f: 900, f2: 1400, dur: 0.05, vol: 0.03 })
  voice(c, { type: 'square', f: 1100, f2: 1700, dur: 0.05, vol: 0.025, at: now + 0.07 })
}

/** ふうせんが はなれて とんでいく「ぽわん」。 */
export function playBalloon() {
  const c = ctx()
  if (!c) return
  const now = c.currentTime
  voice(c, { type: 'sine', f: 520, f2: 1250, dur: 0.22, vol: 0.07, attack: 0.01 })
  voice(c, { type: 'triangle', f: 1250, f2: 1700, dur: 0.18, vol: 0.025, at: now + 0.12 })
}

/** チャレンジ せいこう「ぱんぱかぱーん」。 */
export function playMedal() {
  const c = ctx()
  if (!c) return
  const now = c.currentTime
  ;[0, 0, 0, 5, 9].forEach((s, i) => voice(c, { type: 'square', f: hz(s, 783.99), dur: i === 4 ? 0.45 : 0.1, vol: 0.035, at: now + [0, 0.1, 0.2, 0.3, 0.45][i] }))
  voice(c, { type: 'sine', f: hz(21, 783.99), dur: 0.6, vol: 0.03, at: now + 0.45 })
}

/** はじめの「ぽろん」。 */
export function playStart() {
  const c = ctx()
  if (!c) return
  const now = c.currentTime
  ;[0, 7, 12].forEach((s, i) => voice(c, { type: 'triangle', f: hz(s, 523.25), dur: 0.4, vol: 0.07, at: now + i * 0.08 }))
}

/** ぜんぶ くっついた！ */
export function playClear() {
  const c = ctx()
  if (!c) return
  const now = c.currentTime
  const melody = [0, 4, 7, 12, 7, 12, 16]
  const times = [0, 0.11, 0.22, 0.33, 0.52, 0.63, 0.78]
  melody.forEach((s, i) => {
    voice(c, { type: 'triangle', f: hz(s, 523.25), dur: i === melody.length - 1 ? 0.9 : 0.2, vol: 0.1, at: now + times[i] })
    voice(c, { type: 'sine', f: hz(s + 12, 523.25), dur: 0.16, vol: 0.03, at: now + times[i] })
  })
  ;[0, 4, 7].forEach((s) => voice(c, { type: 'sine', f: hz(s, 261.63), dur: 1.2, vol: 0.05, attack: 0.05, at: now + 0.78 }))
  ;[24, 28, 31, 36].forEach((s, i) => voice(c, { type: 'sine', f: hz(s, 523.25), dur: 0.3, vol: 0.025, at: now + 1 + i * 0.07 }))
}

// ---------------- BGM（オルゴールふう） ----------------

type Song = { tempo: number; wave: OscillatorType; base: number; melody: (number | null)[]; bass: (number | null)[] }

// 1つの すうじ = 8ぶおんぷ。null は やすみ。
const SONGS: Record<StageId, Song> = {
  desk: {
    tempo: 104, wave: 'triangle', base: 523.25,
    melody: [0, null, 4, 7, 9, 7, 4, null, 2, null, 5, 9, 7, null, null, null, 4, null, 7, 12, 11, 9, 7, null, 5, 4, 2, 4, 0, null, null, null],
    bass: [0, null, null, null, -5, null, null, null, -7, null, null, null, -5, null, null, null, -8, null, null, null, -3, null, null, null, -7, null, -5, null, -12, null, null, null],
  },
  sand: {
    tempo: 112, wave: 'triangle', base: 587.33,
    melody: [0, 2, 4, null, 7, null, 4, 2, 0, null, 2, 4, 2, null, null, null, 7, 9, 7, null, 4, null, 2, 4, 5, 4, 2, null, 0, null, null, null],
    bass: [0, null, 7, null, -5, null, 7, null, -3, null, 4, null, -5, null, 2, null, -7, null, 5, null, 0, null, 4, null, -5, null, 2, null, 0, null, null, null],
  },
  sea: {
    tempo: 88, wave: 'sine', base: 493.88,
    melody: [4, null, 7, null, 11, null, 9, 7, 4, null, null, null, 2, 4, 7, null, 9, null, 7, null, 4, null, 2, null, 0, 2, 4, null, null, null, null, null],
    bass: [0, null, null, null, 7, null, null, null, -3, null, null, null, 4, null, null, null, -7, null, null, null, 0, null, null, null, -5, null, null, null, 0, null, null, null],
  },
  factory: {
    tempo: 120, wave: 'square', base: 440,
    melody: [0, null, 0, 7, null, 7, 5, 4, 2, null, 2, 5, null, 4, 2, null, 0, null, 0, 7, null, 9, 7, 5, 4, null, 2, null, 0, null, null, null],
    bass: [0, null, 0, null, 0, null, 0, null, -5, null, -5, null, -5, null, -5, null, -3, null, -3, null, -7, null, -7, null, -5, null, -5, null, 0, null, null, null],
  },
  park: {
    tempo: 96, wave: 'triangle', base: 523.25,
    melody: [7, null, 4, 5, 7, null, 12, null, 9, null, 7, null, 4, null, null, null, 5, null, 2, 4, 5, null, 9, null, 7, 5, 4, 2, 0, null, null, null],
    bass: [0, null, 4, null, 7, null, 4, null, -3, null, 0, null, 4, null, 0, null, -7, null, -3, null, 0, null, -3, null, -5, null, -1, null, 0, null, null, null],
  },
}

/** BGM を ながす。とめる かんすうを かえす。 */
export function startBgm(stage: StageId): () => void {
  const c = ctx()
  if (!c) return () => {}
  const song = SONGS[stage]
  const out = c.createGain()
  out.gain.value = 0
  out.gain.setTargetAtTime(0.5, c.currentTime, 0.4)
  out.connect(getSoundOutput(c))
  const eighth = 60 / song.tempo / 2
  let step = 0
  let next = c.currentTime + 0.25
  const schedule = () => {
    while (next < c.currentTime + 0.3) {
      const i = step % song.melody.length
      const m = song.melody[i], b = song.bass[i]
      if (m !== null) {
        voice(c, { type: song.wave, f: hz(m, song.base), dur: eighth * 1.8, vol: 0.05, attack: 0.01, at: next, dest: out })
        voice(c, { type: 'sine', f: hz(m + 12, song.base), dur: eighth * 0.9, vol: 0.012, at: next, dest: out })
      }
      if (b !== null) voice(c, { type: 'sine', f: hz(b - 12, song.base), dur: eighth * 3, vol: 0.045, attack: 0.02, at: next, dest: out })
      next += eighth
      step++
    }
  }
  schedule()
  const timer = setInterval(schedule, 90)
  return () => {
    clearInterval(timer)
    try {
      out.gain.setTargetAtTime(0, c.currentTime, 0.08)
      setTimeout(() => out.disconnect(), 400)
    } catch {
      // とめられなくても あそびは つづく。
    }
  }
}
