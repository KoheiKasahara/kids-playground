import { getSharedAudioContext, getSoundOutput, isSoundEnabled } from '../../audio/sound'
import type { DrillId } from './farm'
import type { FxKind } from './monsters'

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

function notes(ctx: AudioContext, list: readonly (readonly [string, number, number])[], step: number, vol: number, voice: Voice = 'pulse') {
  const t = ctx.currentTime
  for (const [n, at, len] of list) tone(ctx, getSoundOutput(ctx), freq(n), t + at * step, len * step, vol, voice)
}

/** ボタンの「ピッ」。 */
export function playSelect() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  tone(ctx, getSoundOutput(ctx), freq('A5'), t, .05, .05, 'pulse')
  tone(ctx, getSoundOutput(ctx), freq('E6'), t + .05, .07, .05, 'pulse')
}

/** モンスターの なきごえ。しゅるいごとに たかさが ちがう。 */
export function playCry(voice: number, happy = true) {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  const out = getSoundOutput(ctx)
  const osc = ctx.createOscillator()
  const lfo = ctx.createOscillator()
  const depth = ctx.createGain()
  const gain = ctx.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(voice * (happy ? .9 : 1.1), t)
  osc.frequency.linearRampToValueAtTime(voice * (happy ? 1.35 : .8), t + .12)
  osc.frequency.linearRampToValueAtTime(voice * (happy ? 1.1 : .7), t + .3)
  lfo.frequency.value = 18
  depth.gain.value = voice * .04
  lfo.connect(depth).connect(osc.frequency)
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(.16, t + .02)
  gain.gain.exponentialRampToValueAtTime(.001, t + .34)
  osc.connect(gain).connect(out)
  osc.start(t)
  lfo.start(t)
  osc.stop(t + .36)
  lfo.stop(t + .36)
}

/** おうえんの「ぴこっ」。つづけて おすと だんだん たかく なる。 */
export function playCheer(count: number) {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  const lift = Math.pow(2, Math.min(12, count) / 12)
  tone(ctx, getSoundOutput(ctx), freq('C6') * lift, t, .05, .07, 'pulse')
  tone(ctx, getSoundOutput(ctx), freq('G6') * lift, t + .05, .07, .06, 'pulse')
}

/** とっくんの おと（いわを たたく・はしる・みず など）。 */
export function playTrainBeat(drill: DrillId) {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  const out = getSoundOutput(ctx)
  switch (drill) {
    case 'rock':
      slide(ctx, out, 180, 50, t, .14, .2, 'sine')
      noise(ctx, out, t, .1, .1, 'lowpass', 1400)
      break
    case 'study':
      noise(ctx, out, t, .05, .05, 'bandpass', 3800)
      noise(ctx, out, t + .07, .04, .04, 'bandpass', 4400)
      break
    case 'run':
      noise(ctx, out, t, .04, .08, 'lowpass', 900)
      noise(ctx, out, t + .12, .04, .06, 'lowpass', 1100)
      break
    case 'fall':
      noise(ctx, out, t, .3, .06, 'highpass', 2200)
      break
    case 'pull':
      slide(ctx, out, 120, 90, t, .2, .14, 'triangle')
      break
  }
}

/** だいせいこう！ */
export function playGreat() {
  const ctx = sfx()
  if (!ctx) return
  notes(ctx, [['C5', 0, 1], ['E5', 1, 1], ['G5', 2, 1], ['C6', 3, 2], ['E6', 5, 1], ['G6', 6, 4]], .075, .07)
  notes(ctx, [['C3', 0, 3], ['G3', 3, 3], ['C4', 6, 4]], .075, .1, 'triangle')
}

/** せいこう。 */
export function playGood() {
  const ctx = sfx()
  if (!ctx) return
  notes(ctx, [['E5', 0, 1], ['G5', 1, 1], ['C6', 2, 3]], .08, .06)
  notes(ctx, [['C4', 0, 2], ['G3', 2, 3]], .08, .08, 'triangle')
}

/** しっぱい「ぷぇ〜」。 */
export function playFail() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  slide(ctx, getSoundOutput(ctx), 520, 180, t, .45, .08, 'square')
  tone(ctx, getSoundOutput(ctx), freq('C3'), t + .1, .3, .08, 'triangle')
}

/** なでた「ぽわん」。 */
export function playPet() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  slide(ctx, getSoundOutput(ctx), 420, 840, t, .16, .1, 'sine')
  tone(ctx, getSoundOutput(ctx), freq('E6'), t + .14, .12, .04, 'pulse')
}

/** おやつを たべる「もぐもぐ」。すきな ものだと さいごに「キラッ」。 */
export function playSnack(liked: boolean) {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  const out = getSoundOutput(ctx)
  for (let i = 0; i < 3; i++) {
    noise(ctx, out, t + i * .16, .06, .1, 'lowpass', 1100)
    tone(ctx, out, 160 + i * 20, t + i * .16, .06, .1, 'triangle')
  }
  if (liked) ['C6', 'E6', 'G6', 'C7'].forEach((n, i) => tone(ctx, out, freq(n), t + .52 + i * .06, .12, .045, 'pulse'))
}

/** やすみの こもりうた。 */
export function playRest() {
  const ctx = sfx()
  if (!ctx) return
  notes(ctx, [['G5', 0, 2], ['E5', 2, 2], ['C5', 4, 2], ['D5', 6, 2], ['E5', 8, 2], ['C5', 10, 4]], .13, .06, 'triangle')
}

/** あさの「ピロリロ〜」。 */
export function playMorning() {
  const ctx = sfx()
  if (!ctx) return
  notes(ctx, [['C6', 0, 1], ['E6', 1, 1], ['G6', 2, 1], ['C7', 3, 3]], .06, .045)
}

/** つぎの しゅう。 */
export function playWeek() {
  const ctx = sfx()
  if (!ctx) return
  notes(ctx, [['G5', 0, 1], ['C6', 1, 2]], .09, .05)
}

/** いしに ちからが あつまる。 */
export function playSummon() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  const out = getSoundOutput(ctx)
  slide(ctx, out, 180, 1400, t, 2, .06, 'triangle')
  for (let i = 0; i < 14; i++) tone(ctx, out, freq(['C5', 'E5', 'G5', 'B5'][i % 4]) * (1 + i / 14), t + i * .14, .08, .03, 'pulse')
}

/** うまれた！ */
export function playBorn() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  noise(ctx, getSoundOutput(ctx), t, .3, .12, 'highpass', 1500)
  notes(ctx, [['G5', 1, 1], ['C6', 2, 1], ['E6', 3, 1], ['G6', 4, 2], ['E6', 6, 1], ['G6', 7, 5]], .08, .065)
  notes(ctx, [['C4', 1, 3], ['G3', 4, 3], ['C4', 7, 5]], .08, .1, 'triangle')
}

/** よーい・ファイト！ */
export function playGo(go: boolean) {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  if (go) {
    tone(ctx, getSoundOutput(ctx), freq('C6'), t, .32, .06, 'pulse')
    tone(ctx, getSoundOutput(ctx), freq('G5'), t, .32, .05, 'pulse')
  } else tone(ctx, getSoundOutput(ctx), freq('G5'), t, .12, .05, 'pulse')
}

/** わざの ためる おと。 */
export function playWindup(big: boolean) {
  const ctx = sfx()
  if (!ctx) return
  slide(ctx, getSoundOutput(ctx), big ? 200 : 400, big ? 900 : 700, ctx.currentTime, big ? .3 : .12, .05, 'pulse')
}

/** とおい わざを うつ「ピュン」。 */
export function playShot(kind: FxKind) {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  const out = getSoundOutput(ctx)
  if (kind === 'beam') {
    slide(ctx, out, 1200, 300, t, .5, .07, 'square')
    noise(ctx, out, t, .5, .06, 'bandpass', 1800)
  } else if (kind === 'fire') noise(ctx, out, t, .2, .1, 'bandpass', 1200)
  else if (kind === 'bubble') slide(ctx, out, 300, 900, t, .12, .08, 'sine')
  else slide(ctx, out, 900, 1500, t, .1, .05, 'pulse')
}

/** あたった「バシッ」。 */
export function playHit(big: boolean, crit: boolean) {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  const out = getSoundOutput(ctx)
  noise(ctx, out, t, big ? .25 : .12, big ? .22 : .16, 'lowpass', big ? 2400 : 3200)
  slide(ctx, out, big ? 220 : 320, 60, t, big ? .28 : .14, big ? .24 : .18, 'sine')
  if (crit) ['E6', 'B6'].forEach((n, i) => tone(ctx, out, freq(n), t + .05 + i * .05, .08, .04, 'pulse'))
}

/** よけた「ヒュッ」。 */
export function playMiss() {
  const ctx = sfx()
  if (!ctx) return
  noise(ctx, getSoundOutput(ctx), ctx.currentTime, .16, .07, 'highpass', 3200)
}

/** たおれた。 */
export function playKo() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  slide(ctx, getSoundOutput(ctx), 800, 90, t, .7, .08, 'square')
  noise(ctx, getSoundOutput(ctx), t + .5, .3, .12, 'lowpass', 600)
}

/** かった！ */
export function playWin() {
  const ctx = sfx()
  if (!ctx) return
  notes(ctx, [['C5', 0, 1], ['C5', 1, 1], ['C5', 2, 1], ['C5', 3, 3], ['Ab4', 6, 3], ['Bb4', 9, 3], ['C5', 12, 2], ['Bb4', 14, 1], ['C5', 15, 6]], .075, .07)
  notes(ctx, [['C3', 0, 6], ['Ab2', 6, 3], ['Bb2', 9, 3], ['C3', 12, 9]], .075, .1, 'triangle')
}

/** まけた。 */
export function playLose() {
  const ctx = sfx()
  if (!ctx) return
  notes(ctx, [['G4', 0, 2], ['F4', 2, 2], ['E4', 4, 2], ['D4', 6, 2], ['C4', 8, 5]], .11, .055, 'triangle')
}

/** ランクアップ・チャンピオン。 */
export function playRankUp() {
  const ctx = sfx()
  if (!ctx) return
  notes(ctx, [['G5', 0, 1], ['G5', 1, 1], ['G5', 2, 1], ['C6', 3, 4], ['B5', 7, 1], ['C6', 8, 1], ['D6', 9, 1], ['E6', 10, 6]], .08, .07)
  notes(ctx, [['C3', 0, 3], ['C4', 3, 4], ['G3', 7, 3], ['C4', 10, 6]], .08, .1, 'triangle')
  ;['G6', 'C7', 'E7'].forEach((n, i) => tone(ctx, getSoundOutput(ctx), freq(n), ctx.currentTime + .8 + i * .05, .6, .02, 'sine', .4))
}

// ---------------- BGM ----------------

export type SongId = 'ranch' | 'battle' | 'shrine'
type Song = { bpm: number; melody: string; bass: readonly string[]; lead: Voice; drums: 'pop' | 'soft' | 'bell' | 'march' }

// メロディは 8分音符ずつ。'-' は のばす、'.' は やすみ。
const SONGS: Record<SongId, Song> = {
  ranch: {
    bpm: 126,
    melody: 'C5 - E5 G5 - E5 D5 C5 | D5 - - E5 F5 - E5 D5 | E5 - G5 C6 - B5 A5 G5 | A5 - - - G5 - . . | F5 - A5 C6 - A5 G5 F5 | E5 - G5 - C5 - E5 - | D5 - F5 E5 - D5 B4 D5 | C5 - - - . . . .',
    bass: ['C3', 'G2', 'C3', 'F2', 'F2', 'C3', 'G2', 'C3'],
    lead: 'pulse',
    drums: 'soft',
  },
  battle: {
    bpm: 164,
    melody: 'E5 - E5 G5 - E5 D5 E5 | A5 - G5 E5 - D5 C5 D5 | E5 - E5 G5 - A5 B5 C6 | B5 - A5 - G5 - E5 - | F5 - F5 A5 - F5 E5 F5 | G5 - E5 C5 - E5 G5 A5 | B5 - A5 - G5 - F5 D5 | E5 - - - B4 - D5 -',
    bass: ['A2', 'A2', 'C3', 'E2', 'D3', 'C3', 'G2', 'E2'],
    lead: 'square',
    drums: 'march',
  },
  shrine: {
    bpm: 92,
    melody: 'A4 - C5 - E5 - D5 - | C5 - - - B4 - - - | A4 - C5 - F5 - E5 - | E5 - - - . . . . | F5 - E5 - D5 - C5 - | B4 - C5 - D5 - - - | C5 - B4 - A4 - G#4 - | A4 - - - . . . .',
    bass: ['A2', 'E2', 'F2', 'C3', 'D3', 'G2', 'E2', 'A2'],
    lead: 'triangle',
    drums: 'bell',
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
  feedback.gain.value = .2
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
        const vol = song.lead === 'triangle' ? .1 : song.lead === 'square' ? .028 : .042
        tone(ctx, master, freq(s), next, len * step * .9, vol, song.lead)
        tone(ctx, delay, freq(s), next, len * step * .9, vol * .6, song.lead)
        if (song.drums === 'bell') tone(ctx, master, freq(s) * 2, next, .08, .012, 'sine')
      }
      const beat = index % 8
      const bar = Math.floor((index % steps.length) / 8)
      const root = freq(song.bass[bar % song.bass.length])
      const pattern = song.drums === 'march' ? [1, 2, 1, 2, 1, 2, 1, 2] : song.drums === 'soft' ? [1, 0, 1.5, 0, 2, 0, 1.5, 0] : [1, 0, 0, 0, 1.5, 0, 0, 0]
      const bassStep = pattern[beat]
      if (bassStep) tone(ctx, master, root * bassStep, next, step * (song.drums === 'bell' ? 3 : .85), .09, 'triangle')
      if (song.drums === 'march') {
        if (beat % 2 === 0) slide(ctx, master, 150, 50, next, .1, .15, 'sine')
        if (beat % 4 === 2) noise(ctx, master, next, .08, .05, 'bandpass', 2400)
        noise(ctx, master, next, .02, .015, 'highpass', 7000)
      } else if (song.drums === 'soft') {
        if (beat % 4 === 0) slide(ctx, master, 130, 50, next, .12, .12, 'sine')
        if (beat % 2 === 1) noise(ctx, master, next, .04, .016, 'highpass', 6500)
      } else if (beat % 4 === 0) noise(ctx, master, next, .05, .012, 'highpass', 8000)
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
