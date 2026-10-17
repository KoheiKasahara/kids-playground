import { getSharedAudioContext, getSoundOutput, isSoundEnabled } from '../../audio/sound'
import type { Hurt } from './race'

// ごちそうレースの こうかおん と BGM。音声ファイルは つかわず、Web Audio で その場で つくる。
// BGM の メロディは このゲームの ための オリジナル。

const NOTE: Record<string, number> = { C: -9, 'C#': -8, D: -7, 'D#': -6, Eb: -6, E: -5, F: -4, 'F#': -3, G: -2, 'G#': -1, Ab: -1, A: 0, 'A#': 1, Bb: 1, B: 2 }

/** 'C5' → 周波数（よめない ときは 0）。 */
export function freq(name: string): number {
  const m = /^([A-G](?:#|b)?)(\d)$/.exec(name)
  if (!m) return 0
  return 440 * Math.pow(2, (NOTE[m[1]] + (Number(m[2]) - 4) * 12) / 12)
}

type Voice = 'pulse' | 'triangle' | 'sine' | 'square' | 'sawtooth'

const pulseCache = new WeakMap<AudioContext, PeriodicWave>()
/** 25% の パルス波（むかしの ゲーム機の ような おと）。 */
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

function oscillator(ctx: AudioContext, voice: Voice) {
  const osc = ctx.createOscillator()
  if (voice === 'pulse') osc.setPeriodicWave(pulseWave(ctx))
  else osc.type = voice
  return osc
}

function tone(ctx: AudioContext, dest: AudioNode, f: number, start: number, dur: number, vol: number, voice: Voice, release = .04) {
  if (!f) return
  const osc = oscillator(ctx, voice)
  const gain = ctx.createGain()
  osc.frequency.setValueAtTime(f, start)
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(vol, start + .005)
  gain.gain.setValueAtTime(vol * .85, start + Math.max(.01, dur - release))
  gain.gain.linearRampToValueAtTime(0, start + dur)
  osc.connect(gain).connect(dest)
  osc.start(start)
  osc.stop(start + dur + .02)
}

/** たかさが すーっと かわる おと。 */
function slide(ctx: AudioContext, dest: AudioNode, from: number, to: number, start: number, dur: number, vol: number, voice: Voice) {
  const osc = oscillator(ctx, voice)
  const gain = ctx.createGain()
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

/** 音を だせる ときだけ AudioContext を かえす。 */
function sfx(): AudioContext | undefined {
  if (!isSoundEnabled()) return undefined
  try {
    return getSharedAudioContext()
  } catch {
    return undefined
  }
}

/** どうぶつ・コースを えらんだ「ポッ」。 */
export function playTap(): void {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  tone(ctx, getSoundOutput(ctx), freq('A5'), t, .05, .06, 'pulse')
  tone(ctx, getSoundOutput(ctx), freq('E6'), t + .05, .08, .05, 'pulse')
}

/** 「よーい」の「ピッ」と「どん！」の「ピーッ」。 */
export function playReady(go: boolean): void {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  const out = getSoundOutput(ctx)
  if (go) {
    tone(ctx, out, freq('C6'), t, .4, .07, 'pulse')
    tone(ctx, out, freq('G5'), t, .4, .05, 'pulse')
    tone(ctx, out, freq('C4'), t, .4, .12, 'triangle')
  } else tone(ctx, out, freq('C5'), t, .14, .07, 'pulse')
}

/** ジャンプの「ぴょん」。くうちゅうの 2だんめは もっと たかく。 */
export function playJump(air = false): void {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  if (air) slide(ctx, getSoundOutput(ctx), 520, 1300, t, .15, .13, 'pulse')
  else slide(ctx, getSoundOutput(ctx), 300, 820, t, .14, .15, 'pulse')
}

/** ごちそうを たべた「ぱくっ」。てんすうが おおきいほど きらきら する。 */
export function playEat(points: number): void {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  const out = getSoundOutput(ctx)
  slide(ctx, out, 420, 260, t, .06, .1, 'square')
  if (points >= 5) {
    ;['C6', 'E6', 'G6', 'C7', 'E7'].forEach((n, i) => tone(ctx, out, freq(n), t + .05 + i * .05, .14, .06, 'pulse'))
    tone(ctx, out, freq('G7'), t + .32, .4, .03, 'sine', .3)
  } else if (points >= 2) {
    tone(ctx, out, freq('A5'), t + .04, .06, .07, 'pulse')
    tone(ctx, out, freq('E6'), t + .1, .12, .07, 'pulse')
  } else {
    tone(ctx, out, freq('E6'), t + .04, .1, .07, 'pulse')
  }
}

/** あいてが たべた「もぐっ」（すこし ちいさく ひくい）。 */
export function playRivalEat(): void {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  slide(ctx, getSoundOutput(ctx), 300, 180, t, .07, .05, 'square')
  tone(ctx, getSoundOutput(ctx), freq('E5'), t + .05, .07, .025, 'pulse')
}

/** ぶつかった。はちは「ぷすっ」、ぺったんは「ぺたん！」。 */
export function playBump(cause: Hurt): void {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  const out = getSoundOutput(ctx)
  if (cause === 'pounder') {
    slide(ctx, out, 180, 50, t, .22, .2, 'sine')
    noise(ctx, out, t, .16, .14, 'lowpass', 900)
    slide(ctx, out, 700, 240, t + .08, .25, .06, 'square')
  } else {
    slide(ctx, out, 900, 300, t, .2, .07, 'square')
    noise(ctx, out, t, .08, .06, 'bandpass', 2500)
  }
}

/** あなに おちた「ひゅ〜」。 */
export function playFall(): void {
  const ctx = sfx()
  if (!ctx) return
  slide(ctx, getSoundOutput(ctx), 1100, 180, ctx.currentTime, .6, .07, 'triangle')
}

/** もどってきた「ぽんっ」。 */
export function playRespawn(): void {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  slide(ctx, getSoundOutput(ctx), 300, 900, t, .12, .08, 'sine')
  tone(ctx, getSoundOutput(ctx), freq('G6'), t + .1, .1, .04, 'pulse')
}

/** ゴールに ついた「パッパラー」。さきに ついたら はでに。 */
export function playGoal(first: boolean): void {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  const out = getSoundOutput(ctx)
  const notes = first ? ['G5', 'C6', 'E6', 'G6'] : ['G5', 'C6', 'E6']
  notes.forEach((n, i) => tone(ctx, out, freq(n), t + i * .08, i === notes.length - 1 ? .4 : .08, .07, 'pulse'))
  tone(ctx, out, freq('C4'), t, .5, .12, 'triangle')
}

/** かった ときの ファンファーレ。 */
export function playWin(): void {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  const out = getSoundOutput(ctx)
  const s = .1
  const melody: [string, number, number][] = [['E5', 0, 1], ['G5', 1, 1], ['C6', 2, 2], ['G5', 4, 1], ['C6', 5, 1], ['E6', 6, 2], ['D6', 8, 1], ['E6', 9, 1], ['G6', 10, 6]]
  for (const [n, at, len] of melody) {
    tone(ctx, out, freq(n), t + at * s, len * s * .95, .07, 'pulse')
    tone(ctx, out, freq(n) / 2, t + at * s, len * s * .95, .03, 'pulse')
  }
  for (const [n, at, len] of [['C3', 0, 4], ['A2', 4, 4], ['G2', 8, 2], ['C3', 10, 6]] as [string, number, number][]) {
    tone(ctx, out, freq(n), t + at * s, len * s, .12, 'triangle')
  }
  ;['G6', 'C7', 'E7'].forEach((n, i) => tone(ctx, out, freq(n), t + 10 * s + i * .05, .7, .025, 'sine', .5))
}

/** まけた ときの「あーあ」。 */
export function playLose(): void {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  const out = getSoundOutput(ctx)
  ;[['E5', 0], ['D5', .18], ['C5', .36], ['G4', .54]].forEach(([n, at], i) => tone(ctx, out, freq(n as string), t + (at as number), i === 3 ? .5 : .16, .07, 'triangle'))
}

// ---------------- BGM ----------------

const BPM = 176
/** 8ぶおんぷ ずつ。'-' は のばす、'.' は やすみ。1しょうせつ 8こ。 */
const MELODY = [
  'C5 E5 G5 C6 - - B5 C6', 'D6 - B5 G5 - - D5 G5', 'A5 C6 E6 - D6 C6 B5 A5', 'C6 - A5 F5 - G5 A5 B5',
  'C6 - G5 E5 - G5 C6 E6', 'D6 - B5 G5 - A5 B5 D6', 'C6 - A5 C6 - F6 E6 D6', 'D6 - - - G5 A5 B5 D6',
  'C6 - A5 - F5 - A5 C6', 'D6 - B5 - G5 - B5 D6', 'E6 - D6 B5 - G5 E5 G5', 'A5 - - - C6 B5 A5 G5',
  'F5 A5 C6 F6 - E6 D6 C6', 'B5 D6 G6 - F6 - D6 B5', 'C6 - G5 - E5 - G5 -', 'C6 . B5 . A5 . G5 .',
].join(' ').split(/\s+/)

/** しょうせつ ごとの わおん（ねいろ と ベース）。 */
const CHORDS: readonly (readonly string[])[] = [
  ['C', 'E', 'G'], ['G', 'B', 'D'], ['A', 'C', 'E'], ['F', 'A', 'C'],
  ['C', 'E', 'G'], ['G', 'B', 'D'], ['F', 'A', 'C'], ['G', 'B', 'D'],
  ['F', 'A', 'C'], ['G', 'B', 'D'], ['E', 'G', 'B'], ['A', 'C', 'E'],
  ['F', 'A', 'C'], ['G', 'B', 'D'], ['C', 'E', 'G'], ['G', 'B', 'D'],
]

export const BGM_BARS = CHORDS.length

/** メロディの ながさ（8ぶおんぷの かず）。テスト用。 */
export function bgmMelody(): readonly string[] {
  return MELODY
}

/** はしる BGM を ながす。とめる 関数を かえす。 */
export function startBgm(): () => void {
  const ctx = isSoundEnabled() ? getSharedAudioContext() : undefined
  if (!ctx) return () => {}
  const master = ctx.createGain()
  master.gain.value = .5
  master.connect(getSoundOutput(ctx))
  const delay = ctx.createDelay(1)
  delay.delayTime.value = (60 / BPM) * .75
  const feedback = ctx.createGain()
  feedback.gain.value = .25
  const wet = ctx.createGain()
  wet.gain.value = .28
  delay.connect(feedback).connect(delay)
  delay.connect(wet).connect(master)

  const sixteenth = 60 / BPM / 4
  let index = 0
  let next = ctx.currentTime + .1
  const schedule = () => {
    while (next < ctx.currentTime + .3) {
      const s16 = index % 16
      const bar = Math.floor(index / 16) % BGM_BARS
      const chord = CHORDS[bar]
      const fill = bar % 8 === 7

      // メロディ。
      if (s16 % 2 === 0) {
        const at = bar * 8 + s16 / 2
        const note = MELODY[at]
        if (note !== '-' && note !== '.') {
          let len = 1
          while (MELODY[(at + len) % MELODY.length] === '-' && len < 8) len++
          const dur = len * sixteenth * 2 * .92
          tone(ctx, master, freq(note), next, dur, .05, 'pulse')
          tone(ctx, delay, freq(note), next, dur, .03, 'pulse')
        }
      }
      // きらきら の わおん（16ぶおんぷの アルペジオ）。
      const arp = [0, 1, 2, 1][s16 % 4]
      const octave = s16 % 8 < 4 ? 5 : 4
      tone(ctx, master, freq(`${chord[arp]}${octave}`), next, sixteenth * .7, .014, 'square')
      // ベースは ドン・ドンと オクターブで はねる。
      if (s16 % 2 === 0) {
        const up = (s16 / 2) % 2 === 1
        tone(ctx, master, freq(`${chord[0]}${up ? 3 : 2}`), next, sixteenth * 1.7, .13, 'triangle')
      }
      // ドラム。
      if (s16 === 0 || s16 === 8 || s16 === 10) slide(ctx, master, 160, 45, next, .13, .2, 'sine')
      if (s16 === 4 || s16 === 12 || (fill && s16 >= 13)) noise(ctx, master, next, .1, fill && s16 > 12 ? .06 : .08, 'bandpass', 1900)
      noise(ctx, master, next, .03, s16 % 2 === 0 ? .022 : .011, 'highpass', 7500)

      index++
      next += sixteenth
    }
  }
  schedule()
  const timer = setInterval(schedule, 50)
  return () => {
    clearInterval(timer)
    const t = ctx.currentTime
    master.gain.cancelScheduledValues(t)
    master.gain.setValueAtTime(master.gain.value, t)
    master.gain.linearRampToValueAtTime(0, t + .25)
    setTimeout(() => {
      try {
        master.disconnect()
        delay.disconnect()
        feedback.disconnect()
      } catch {
        // もう きれている。
      }
    }, 400)
  }
}
