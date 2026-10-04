import { getSharedAudioContext, getSoundOutput, isSoundEnabled } from '../../audio/sound'
import type { WorldId } from './stages'

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

type Voice = 'pulse' | 'triangle' | 'sine' | 'square' | 'sawtooth'

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

/** 音の 高さが すーっと かわる 音。 */
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
function noiseBuffer(ctx: AudioContext) {
  let buffer = noiseCache.get(ctx)
  if (!buffer) {
    buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 1), ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    noiseCache.set(ctx, buffer)
  }
  return buffer
}

function noise(ctx: AudioContext, dest: AudioNode, start: number, dur: number, vol: number, filter: BiquadFilterType, hz: number, toHz?: number) {
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer(ctx)
  const f = ctx.createBiquadFilter()
  f.type = filter
  f.frequency.setValueAtTime(hz, start)
  if (toHz) f.frequency.exponentialRampToValueAtTime(toHz, start + dur)
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

/** ボンを おいた「ポン」。 */
export function playPlace() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime, out = getSoundOutput(ctx)
  slide(ctx, out, 330, 140, t, .1, .2, 'sine')
  tone(ctx, out, 900, t, .02, .04, 'square')
}

/** ドッカーン！（いくつも いっしょに ばくはつすると 大きく なる）。 */
export function playBoom(count = 1, power = 2) {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime, out = getSoundOutput(ctx)
  const big = Math.min(1.6, 1 + (count - 1) * .18 + power * .03)
  const dur = .55 * big
  noise(ctx, out, t, dur, .2 * Math.min(1.25, big), 'lowpass', 2600, 160)
  noise(ctx, out, t, .09, .14, 'highpass', 3000)
  slide(ctx, out, 120, 32, t + .005, dur * .9, .2 * Math.min(1.2, big), 'sine')
  slide(ctx, out, 220, 60, t + .015, .18, .06, 'square')
  noise(ctx, out, t + .12, .25, .05, 'bandpass', 900)
}

/** ブロックが くずれる「ガラガラ」。 */
export function playBreak() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime, out = getSoundOutput(ctx)
  for (let i = 0; i < 4; i++) noise(ctx, out, t + .05 + i * .045, .06, .07, 'bandpass', 700 + i * 260)
}

/** アイテムが でてきた「キラン」。 */
export function playReveal(gold = false) {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime, out = getSoundOutput(ctx)
  const notes = gold ? ['C6', 'E6', 'G6', 'C7', 'E7', 'G7'] : ['E6', 'B6']
  notes.forEach((n, i) => tone(ctx, out, freq(n), t + i * .05, .14, .05, 'pulse'))
  if (gold) ['C7', 'E7', 'G7'].forEach((n, i) => tone(ctx, out, freq(n), t + .32 + i * .04, .6, .03, 'sine', .4))
}

/** アイテムを とった「ピロリロ」。 */
export function playItem(kind: string) {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime, out = getSoundOutput(ctx)
  const melody = kind === 'heart' ? ['C5', 'E5', 'G5', 'C6', 'E6']
    : kind === 'star' ? ['G5', 'C6', 'E6', 'G6', 'C7', 'E7']
      : kind === 'fire' ? ['C5', 'G5', 'C6', 'G6']
        : kind === 'speed' ? ['E5', 'A5', 'E6', 'A6']
          : ['C5', 'E5', 'G5', 'C6']
  melody.forEach((n, i) => tone(ctx, out, freq(n), t + i * .055, .1, .075, 'pulse'))
  tone(ctx, out, freq(melody[melody.length - 1]) * 2, t + melody.length * .055, .3, .03, 'sine', .25)
}

/** たまごが われて ピョンタが うまれる。 */
export function playHatch() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime, out = getSoundOutput(ctx)
  for (let i = 0; i < 3; i++) noise(ctx, out, t + i * .09, .04, .12, 'highpass', 2500)
  ;['G5', 'C6', 'E6', 'G6'].forEach((n, i) => tone(ctx, out, freq(n), t + .3 + i * .06, .14, .07, 'pulse'))
}

/** ピョンタに のった「ピョーン♪」。 */
export function playRide() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime, out = getSoundOutput(ctx)
  slide(ctx, out, 300, 1100, t, .16, .12, 'pulse')
  ;['E6', 'G6', 'C7'].forEach((n, i) => tone(ctx, out, freq(n), t + .16 + i * .07, .12, .06, 'pulse'))
}

/** ピョンタが にげちゃった。 */
export function playDismount() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime, out = getSoundOutput(ctx)
  slide(ctx, out, 900, 300, t, .25, .12, 'square')
  slide(ctx, out, 600, 200, t + .2, .3, .08, 'square')
}

export function playSkill(skill: 'dash' | 'kick' | 'jump' | 'line') {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime, out = getSoundOutput(ctx)
  switch (skill) {
    case 'dash':
      noise(ctx, out, t, .35, .16, 'bandpass', 600, 3000)
      slide(ctx, out, 200, 700, t, .25, .1, 'pulse')
      break
    case 'kick':
      slide(ctx, out, 400, 120, t, .08, .22, 'square')
      noise(ctx, out, t, .05, .12, 'lowpass', 1500)
      break
    case 'jump':
      slide(ctx, out, 250, 900, t, .22, .12, 'triangle')
      slide(ctx, out, 260, 920, t + .02, .2, .06, 'pulse')
      break
    case 'line':
      for (let i = 0; i < 4; i++) slide(ctx, out, 330, 150, t + i * .05, .08, .14, 'sine')
      break
  }
}

/** すたっと おりた。 */
export function playLand() {
  const ctx = sfx()
  if (!ctx) return
  slide(ctx, getSoundOutput(ctx), 180, 60, ctx.currentTime, .1, .2, 'sine')
}

/** ゴツン。 */
export function playBump() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime, out = getSoundOutput(ctx)
  tone(ctx, out, 140, t, .06, .14, 'square')
  noise(ctx, out, t, .05, .08, 'lowpass', 900)
}

/** てきを たおした「ポムッ☆」。 */
export function playEnemyDown() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime, out = getSoundOutput(ctx)
  slide(ctx, out, 900, 200, t, .14, .16, 'square')
  ;['C6', 'G6', 'C7'].forEach((n, i) => tone(ctx, out, freq(n), t + .1 + i * .05, .1, .05, 'pulse'))
}

/** かたい てきに あたった「カキン」。 */
export function playClink() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime, out = getSoundOutput(ctx)
  tone(ctx, out, 1800, t, .12, .06, 'square')
  tone(ctx, out, 2400, t + .02, .2, .04, 'sine')
}

/** いたい！ */
export function playHurt() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime, out = getSoundOutput(ctx)
  slide(ctx, out, 700, 150, t, .35, .14, 'square')
  noise(ctx, out, t, .14, .12, 'lowpass', 1800)
}

/** ハートが ふえた。 */
export function playHeal() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime, out = getSoundOutput(ctx)
  ;['C6', 'E6', 'G6'].forEach((n, i) => tone(ctx, out, freq(n), t + .1 + i * .06, .2, .04, 'sine', .15))
}

/** とびらが ひらいた「シャラララーン」。 */
export function playDoorOpen() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime, out = getSoundOutput(ctx)
  ;['C5', 'E5', 'G5', 'C6', 'E6', 'G6', 'C7'].forEach((n, i) => tone(ctx, out, freq(n), t + i * .07, .3, .06, 'triangle', .2))
  ;['G6', 'C7', 'E7'].forEach((n, i) => tone(ctx, out, freq(n), t + .5 + i * .05, .8, .025, 'sine', .6))
}

/** ワープ「ひゅるるん」。 */
export function playWarp() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime, out = getSoundOutput(ctx)
  const osc = ctx.createOscillator(), lfo = ctx.createOscillator(), lfoGain = ctx.createGain(), gain = ctx.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(300, t)
  osc.frequency.exponentialRampToValueAtTime(1400, t + .4)
  lfo.frequency.value = 18
  lfoGain.gain.value = 80
  lfo.connect(lfoGain).connect(osc.frequency)
  gain.gain.setValueAtTime(.12, t)
  gain.gain.exponentialRampToValueAtTime(.001, t + .45)
  osc.connect(gain).connect(out)
  osc.start(t); lfo.start(t); osc.stop(t + .47); lfo.stop(t + .47)
}

/** ひの あなが ゴゴゴ… */
export function playRumble() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime, out = getSoundOutput(ctx)
  noise(ctx, out, t, .9, .08, 'lowpass', 220)
  slide(ctx, out, 70, 50, t, .9, .06, 'sawtooth')
}

/** ボスに あたった「ガツーン」。 */
export function playBossHit() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime, out = getSoundOutput(ctx)
  tone(ctx, out, 160, t, .25, .16, 'square')
  tone(ctx, out, 1300, t, .3, .05, 'square')
  noise(ctx, out, t, .25, .16, 'bandpass', 1400, 400)
  slide(ctx, out, 500, 120, t + .05, .3, .1, 'sawtooth')
}

export function playBossAct(act: string) {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime, out = getSoundOutput(ctx)
  switch (act) {
    case 'roar': {
      const osc = ctx.createOscillator(), lfo = ctx.createOscillator(), lfoGain = ctx.createGain(), gain = ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(160, t)
      osc.frequency.linearRampToValueAtTime(90, t + .7)
      lfo.frequency.value = 26
      lfoGain.gain.value = 30
      lfo.connect(lfoGain).connect(osc.frequency)
      const f = ctx.createBiquadFilter()
      f.type = 'lowpass'
      f.frequency.value = 900
      gain.gain.setValueAtTime(.0001, t)
      gain.gain.linearRampToValueAtTime(.16, t + .08)
      gain.gain.exponentialRampToValueAtTime(.001, t + .75)
      osc.connect(f).connect(gain).connect(out)
      osc.start(t); lfo.start(t); osc.stop(t + .8); lfo.stop(t + .8)
      break
    }
    case 'land':
      slide(ctx, out, 110, 30, t, .45, .4, 'sine')
      noise(ctx, out, t, .35, .2, 'lowpass', 600)
      break
    case 'charge':
      slide(ctx, out, 200, 600, t, .3, .1, 'pulse')
      break
    case 'shoot':
      slide(ctx, out, 900, 260, t, .18, .1, 'square')
      break
    case 'dive':
    case 'emerge':
      noise(ctx, out, t, .5, .18, 'lowpass', 900, 200)
      slide(ctx, out, 90, 45, t, .5, .2, 'sine')
      break
    case 'bonk':
      tone(ctx, out, 110, t, .2, .2, 'square')
      noise(ctx, out, t, .2, .16, 'lowpass', 1200)
      ;['E6', 'C6', 'E6', 'C6'].forEach((n, i) => tone(ctx, out, freq(n), t + .2 + i * .08, .07, .04, 'pulse'))
      break
    case 'breath':
      noise(ctx, out, t, .7, .22, 'bandpass', 500, 2400)
      slide(ctx, out, 140, 70, t, .6, .12, 'sawtooth')
      break
    case 'spawn':
      slide(ctx, out, 200, 800, t, .15, .1, 'triangle')
      break
    case 'break':
      noise(ctx, out, t, .9, .3, 'lowpass', 3000, 120)
      slide(ctx, out, 140, 30, t, .9, .35, 'sine')
      break
    default:
      break
  }
}

/** ボスの からだが ポン ポン と はじける。 */
export function playBossPop() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime, out = getSoundOutput(ctx)
  noise(ctx, out, t, .22, .16, 'lowpass', 1800, 200)
  slide(ctx, out, 160, 50, t, .2, .2, 'sine')
}

/** よーい の「ピッ」と スタート の「ピーッ」。 */
export function playReady(go: boolean) {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime, out = getSoundOutput(ctx)
  if (go) {
    tone(ctx, out, freq('C6'), t, .32, .07, 'pulse')
    tone(ctx, out, freq('G5'), t, .32, .05, 'pulse')
  } else tone(ctx, out, freq('C5'), t, .12, .06, 'pulse')
}

/** クリアの ファンファーレ。 */
export function playClear() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime, out = getSoundOutput(ctx)
  const s = .1
  const melody: [string, number, number][] = [['G5', 0, 1], ['G5', 1, 1], ['G5', 2, 1], ['E5', 3, 1], ['G5', 4, 2], ['C6', 6, 6], ['B5', 13, 1], ['C6', 14, 1], ['D6', 15, 1], ['E6', 16, 8]]
  for (const [n, at, len] of melody) {
    tone(ctx, out, freq(n), t + at * s, len * s, .08, 'pulse')
    tone(ctx, out, freq(n) / 2, t + at * s, len * s, .03, 'pulse')
  }
  for (const [n, at, len] of [['C3', 0, 4], ['G2', 4, 2], ['C3', 6, 6], ['G2', 12, 4], ['C3', 16, 8]] as [string, number, number][]) {
    tone(ctx, out, freq(n), t + at * s, len * s, .12, 'triangle')
  }
  ;['G6', 'C7', 'E7'].forEach((n, i) => tone(ctx, out, freq(n), t + 16 * s + i * .04, .9, .025, 'sine', .6))
}

/** ざんねん… */
export function playMiss() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime, out = getSoundOutput(ctx)
  ;[['E5', 0], ['D#5', .2], ['D5', .4], ['C#5', .6]].forEach(([n, at]) => tone(ctx, out, freq(n as string), t + (at as number), .2, .07, 'pulse'))
  slide(ctx, out, freq('C5'), freq('C4'), t + .8, .6, .07, 'pulse')
}

/** おはなしの もじが でる「ポポポ」。 */
export function playTalk(pitch = 1) {
  const ctx = sfx()
  if (!ctx) return
  tone(ctx, getSoundOutput(ctx), 520 * pitch, ctx.currentTime, .035, .035, 'pulse')
}

/** ボタンを おした「ピッ」。 */
export function playSelect() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime, out = getSoundOutput(ctx)
  tone(ctx, out, freq('E6'), t, .05, .06, 'pulse')
  tone(ctx, out, freq('B6'), t + .05, .08, .05, 'pulse')
}

// ---------------- BGM ----------------

export type SongId = WorldId | 'boss' | 'title' | 'map' | 'ending'

type Drums = 'pop' | 'soft' | 'bell' | 'rock'
type Song = { bpm: number; melody: string; bass: readonly string[]; lead: Voice; drums: Drums }

// メロディは 8分音符ずつ。'-' は のばす、'.' は やすみ。
const SONGS: Record<SongId, Song> = {
  title: {
    bpm: 140,
    melody: 'C5 - E5 G5 - E5 C5 - | D5 - F5 A5 - G5 F5 - | E5 - G5 C6 - B5 A5 G5 | A5 - - - G5 - - - | C5 - E5 G5 - E5 C5 E5 | F5 - A5 C6 - A5 F5 A5 | G5 - F5 E5 - D5 - B4 | C5 - - - . . . .',
    bass: ['C3', 'F3', 'C3', 'G2', 'C3', 'F3', 'G2', 'C3'],
    lead: 'pulse',
    drums: 'pop',
  },
  map: {
    bpm: 104,
    melody: 'E5 - G5 - C6 - - - | B5 - G5 - E5 - - - | F5 - A5 - D6 - - - | C6 - B5 - G5 - - - | E5 - G5 - C6 - E6 - | D6 - C6 - A5 - - - | F5 - E5 - D5 - G5 - | C5 - - - . . . .',
    bass: ['C3', 'E3', 'F3', 'G2', 'C3', 'A2', 'G2', 'C3'],
    lead: 'triangle',
    drums: 'bell',
  },
  forest: {
    bpm: 150,
    melody: 'E5 G5 A5 - G5 E5 D5 - | C5 D5 E5 - G5 - E5 - | D5 E5 F5 - E5 D5 C5 - | D5 - - - . . G4 . | E5 G5 A5 - G5 E5 D5 - | C5 D5 E5 - A5 - G5 - | F5 E5 D5 - E5 D5 B4 - | C5 - - - . . . .',
    bass: ['C3', 'C3', 'F3', 'G2', 'C3', 'A2', 'G2', 'C3'],
    lead: 'pulse',
    drums: 'pop',
  },
  desert: {
    bpm: 128,
    melody: 'E5 F5 G#5 - F5 E5 D5 - | E5 - - - B4 - C5 - | D5 C5 B4 - C5 D5 E5 - | B4 - - - . . . . | E5 F5 G#5 - A5 G#5 F5 - | E5 - D5 - C5 - B4 - | C5 B4 A4 - B4 C5 D5 - | E5 - - - . . . .',
    bass: ['E2', 'E2', 'A2', 'E2', 'E2', 'A2', 'D3', 'E2'],
    lead: 'pulse',
    drums: 'soft',
  },
  ice: {
    bpm: 116,
    melody: 'G5 - E5 - C5 - E5 - | F5 - D5 - B4 - D5 - | E5 - C5 - A4 - C5 - | D5 - - - G4 - - - | G5 - E5 - C6 - B5 - | A5 - F5 - D5 - F5 - | E5 - D5 - C5 - B4 - | C5 - - - . . . .',
    bass: ['C3', 'G2', 'A2', 'G2', 'C3', 'F2', 'G2', 'C3'],
    lead: 'triangle',
    drums: 'bell',
  },
  volcano: {
    bpm: 156,
    melody: 'A4 A4 C5 A4 D5 A4 E5 D5 | C5 - A4 - G4 - A4 - | A4 A4 C5 A4 D5 A4 E5 G5 | E5 - - - D5 - - - | F5 - E5 - D5 - C5 - | D5 - C5 - B4 - G4 - | A4 C5 E5 A5 G5 E5 D5 C5 | A4 - - - . . . .',
    bass: ['A2', 'A2', 'A2', 'E2', 'F2', 'G2', 'A2', 'A2'],
    lead: 'pulse',
    drums: 'rock',
  },
  castle: {
    bpm: 132,
    melody: 'D5 - D5 F5 A5 - F5 - | G5 - F5 E5 D5 - - - | C5 - C5 E5 G5 - E5 - | F5 - E5 D5 C#5 - - - | D5 - F5 - A5 - D6 - | C6 - A5 - F5 - A5 - | G5 F5 E5 D5 C#5 D5 E5 C#5 | D5 - - - . . . .',
    bass: ['D3', 'D3', 'C3', 'A2', 'D3', 'F2', 'A2', 'D3'],
    lead: 'pulse',
    drums: 'rock',
  },
  boss: {
    bpm: 168,
    melody: 'E5 E5 G5 E5 A5 E5 B5 A5 | G5 - E5 - D5 - E5 - | E5 E5 G5 E5 A5 E5 C6 B5 | A5 - - - B5 - - - | C6 B5 A5 G5 A5 G5 E5 D5 | E5 - B4 - E5 - G5 - | F#5 - E5 - D#5 - B4 - | E5 - - - . . . .',
    bass: ['E2', 'E2', 'C3', 'D3', 'A2', 'E2', 'B2', 'E2'],
    lead: 'pulse',
    drums: 'rock',
  },
  ending: {
    bpm: 120,
    melody: 'C5 E5 G5 C6 - B5 A5 G5 | A5 - F5 - C6 - - - | B4 D5 G5 B5 - A5 G5 F5 | G5 - E5 - C6 - - - | A5 - C6 - F6 - E6 - | D6 - C6 - A5 - - - | G5 - C6 - E6 - D6 - | C6 - - - . . . .',
    bass: ['C3', 'F3', 'G2', 'C3', 'F3', 'D3', 'G2', 'C3'],
    lead: 'triangle',
    drums: 'pop',
  },
}

/** BGM を ながす。とめる 関数を かえす。 */
export function startBgm(id: SongId): () => void {
  const song = SONGS[id]
  const ctx = isSoundEnabled() ? getSharedAudioContext() : undefined
  if (!song || !ctx) return () => {}
  const master = ctx.createGain()
  master.gain.value = .5
  master.connect(getSoundOutput(ctx))
  const delay = ctx.createDelay(1)
  delay.delayTime.value = 60 / song.bpm * .75
  const feedback = ctx.createGain()
  feedback.gain.value = .22
  const wet = ctx.createGain()
  wet.gain.value = .28
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
        tone(ctx, delay, freq(s), next, len * step * .9, vol * .55, song.lead)
        if (song.drums === 'bell') tone(ctx, master, freq(s) * 2, next, .08, .012, 'sine')
      }
      const beat = index % 8
      const bar = Math.floor((index % steps.length) / 8)
      const root = freq(song.bass[bar % song.bass.length])
      const bassStep = song.drums === 'soft' ? [1, 0, 0, 1.5, 0, 0, 2, 0][beat]
        : song.drums === 'rock' ? [1, 1, 2, 1, 1, 1, 2, 1.5][beat]
          : [1, 0, 2, 0, 1.5, 0, 2, 1.5][beat]
      if (bassStep) tone(ctx, master, root * bassStep, next, step * (song.drums === 'soft' ? 2.4 : .8), .09, 'triangle')
      switch (song.drums) {
        case 'pop':
          if (beat % 4 === 0) slide(ctx, master, 150, 50, next, .12, .16, 'sine')
          if (beat % 4 === 2) noise(ctx, master, next, .08, .05, 'bandpass', 2400)
          noise(ctx, master, next, .025, .018, 'highpass', 7000)
          break
        case 'rock':
          if (beat % 2 === 0) slide(ctx, master, 160, 45, next, .12, .17, 'sine')
          if (beat % 4 === 2) noise(ctx, master, next, .1, .07, 'bandpass', 1800)
          noise(ctx, master, next, .03, .022, 'highpass', 8000)
          break
        case 'soft':
          if (beat === 0) slide(ctx, master, 120, 50, next, .14, .12, 'sine')
          if (beat % 2 === 1) noise(ctx, master, next, .05, .02, 'highpass', 6000)
          if (beat === 4) noise(ctx, master, next, .06, .03, 'bandpass', 3200)
          break
        default:
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
