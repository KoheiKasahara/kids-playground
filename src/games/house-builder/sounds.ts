import { getSharedAudioContext, getSoundOutput, isSoundEnabled } from '../../audio/sound'
import type { RoomTypeId } from './data'

// おうちづくりの こうかおん と BGM。音声ファイルは つかわず、Web Audio で その場で つくる。
// BGM の メロディは このゲームの ための オリジナル（オルゴールふうの のんびりした きょく）。

const NOTE: Record<string, number> = { C: -9, 'C#': -8, D: -7, 'D#': -6, Eb: -6, E: -5, F: -4, 'F#': -3, G: -2, 'G#': -1, Ab: -1, A: 0, 'A#': 1, Bb: 1, B: 2 }

/** 'C5' → 周波数（よめない ときは 0）。 */
export function freq(name: string): number {
  const m = /^([A-G](?:#|b)?)(\d)$/.exec(name)
  if (!m) return 0
  return 440 * Math.pow(2, (NOTE[m[1]] + (Number(m[2]) - 4) * 12) / 12)
}

function tone(ctx: AudioContext, dest: AudioNode, f: number, start: number, dur: number, vol: number, type: OscillatorType, attack = .006) {
  if (!f) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(f, start)
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(vol, start + attack)
  gain.gain.exponentialRampToValueAtTime(.0005, start + dur)
  osc.connect(gain).connect(dest)
  osc.start(start)
  osc.stop(start + dur + .02)
}

/** たかさが すーっと かわる おと。 */
function slide(ctx: AudioContext, dest: AudioNode, from: number, to: number, start: number, dur: number, vol: number, type: OscillatorType) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(from, start)
  osc.frequency.exponentialRampToValueAtTime(to, start + dur)
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(vol, start + .008)
  gain.gain.exponentialRampToValueAtTime(.0005, start + dur)
  osc.connect(gain).connect(dest)
  osc.start(start)
  osc.stop(start + dur + .02)
}

const noiseCache = new WeakMap<AudioContext, AudioBuffer>()
/** ざらざらした おと。from → to へ フィルタを うごかせる。 */
function noise(ctx: AudioContext, dest: AudioNode, start: number, dur: number, vol: number, filter: BiquadFilterType, from: number, to = from) {
  let buffer = noiseCache.get(ctx)
  if (!buffer) {
    buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 1.2), ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    noiseCache.set(ctx, buffer)
  }
  const src = ctx.createBufferSource()
  src.buffer = buffer
  const f = ctx.createBiquadFilter()
  f.type = filter
  f.frequency.setValueAtTime(from, start)
  if (to !== from) f.frequency.exponentialRampToValueAtTime(to, start + dur)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(vol, start + Math.min(.02, dur / 4))
  gain.gain.exponentialRampToValueAtTime(.0005, start + dur)
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

/** オルゴールの ような「ちりん」。 */
function bell(ctx: AudioContext, out: AudioNode, note: string, at: number, dur: number, vol: number) {
  tone(ctx, out, freq(note), at, dur, vol, 'sine')
  tone(ctx, out, freq(note) * 2, at, dur * .5, vol * .25, 'sine')
}

export type HouseSound =
  | 'tap' | 'place' | 'blocked' | 'remove' | 'turn' | 'floor' | 'paint' | 'complete'
  | 'splash' | 'flush' | 'sizzle' | 'water' | 'bell' | 'bark' | 'horn' | 'sleep' | 'music' | 'toy' | 'koto' | 'step' | 'eat'

/** なかを みる ときに へやを タップすると なる おと。 */
export const ROOM_VOICE: Readonly<Record<RoomTypeId, HouseSound>> = {
  living: 'music', dining: 'eat', kitchen: 'sizzle', bath: 'splash', toilet: 'flush', washroom: 'water',
  bedroom: 'sleep', kids: 'toy', washitsu: 'koto', entrance: 'bell', stairs: 'step', hall: 'step',
}

export function playHouseSound(kind: HouseSound): void {
  const ctx = sfx()
  if (!ctx) return
  const out = getSoundOutput(ctx)
  const t = ctx.currentTime
  switch (kind) {
    case 'tap':
      tone(ctx, out, freq('A5'), t, .09, .16, 'triangle')
      tone(ctx, out, freq('E6'), t + .05, .12, .12, 'triangle')
      break
    case 'place':
      noise(ctx, out, t, .06, .12, 'bandpass', 1400)
      tone(ctx, out, freq('C6'), t + .01, .16, .2, 'triangle')
      tone(ctx, out, freq('G6'), t + .08, .3, .16, 'triangle')
      tone(ctx, out, freq('C5'), t + .01, .2, .12, 'sine')
      break
    case 'blocked':
      tone(ctx, out, freq('E4'), t, .12, .18, 'triangle')
      tone(ctx, out, freq('C4'), t + .13, .2, .18, 'triangle')
      break
    case 'remove':
      slide(ctx, out, 1100, 260, t, .22, .14, 'sine')
      noise(ctx, out, t, .18, .06, 'highpass', 2500, 800)
      break
    case 'turn':
      slide(ctx, out, 520, 1200, t, .14, .13, 'triangle')
      tone(ctx, out, freq('A6'), t + .12, .12, .08, 'sine')
      break
    case 'floor':
      ;['C5', 'E5', 'G5'].forEach((n, i) => tone(ctx, out, freq(n), t + i * .07, .14, .16, 'triangle'))
      break
    case 'paint':
      ;['E6', 'G6', 'C7'].forEach((n, i) => bell(ctx, out, n, t + i * .05, .3, .12))
      break
    case 'complete': {
      const s = .12
      const melody: [string, number, number][] = [['C5', 0, 1], ['E5', 1, 1], ['G5', 2, 1], ['C6', 3, 2], ['G5', 5, 1], ['C6', 6, 1], ['E6', 7, 1], ['G6', 8, 5]]
      for (const [n, at, len] of melody) {
        tone(ctx, out, freq(n), t + at * s, len * s + .12, .18, 'triangle')
        tone(ctx, out, freq(n), t + at * s, len * s + .08, .03, 'square')
      }
      for (const [n, at, len] of [['C3', 0, 3], ['F3', 3, 2], ['G3', 5, 3], ['C3', 8, 5]] as [string, number, number][]) {
        tone(ctx, out, freq(n), t + at * s, len * s + .1, .2, 'triangle')
      }
      ;['C7', 'E7', 'G7'].forEach((n, i) => bell(ctx, out, n, t + 8 * s + i * .06, .8, .06))
      break
    }
    case 'splash':
      slide(ctx, out, 1600, 500, t, .12, .16, 'sine')
      noise(ctx, out, t + .03, .3, .1, 'bandpass', 900, 2400)
      slide(ctx, out, 700, 1400, t + .16, .1, .1, 'sine')
      break
    case 'flush':
      noise(ctx, out, t, 1.1, .16, 'lowpass', 2600, 300)
      slide(ctx, out, 500, 180, t + .2, .8, .05, 'sine')
      break
    case 'sizzle':
      noise(ctx, out, t, .7, .1, 'highpass', 4200, 3000)
      tone(ctx, out, freq('E5'), t, .12, .08, 'triangle')
      break
    case 'water':
      noise(ctx, out, t, .6, .12, 'bandpass', 1600, 1200)
      tone(ctx, out, freq('B5'), t + .45, .15, .08, 'sine')
      break
    case 'bell':
      bell(ctx, out, 'E6', t, .7, .22)
      bell(ctx, out, 'C6', t + .38, 1.1, .22)
      break
    case 'bark':
      for (const at of [0, .2]) {
        slide(ctx, out, 620, 300, t + at, .13, .14, 'sawtooth')
        noise(ctx, out, t + at, .08, .06, 'bandpass', 1200)
      }
      break
    case 'horn':
      tone(ctx, out, 392, t, .12, .1, 'square')
      tone(ctx, out, 494, t, .12, .07, 'square')
      tone(ctx, out, 392, t + .18, .4, .1, 'square')
      tone(ctx, out, 494, t + .18, .4, .07, 'square')
      break
    case 'sleep':
      ;['G5', 'E5', 'C5'].forEach((n, i) => bell(ctx, out, n, t + i * .28, .6, .14))
      break
    case 'music':
      ;['C6', 'E6', 'G6', 'E6', 'C7'].forEach((n, i) => bell(ctx, out, n, t + i * .1, .45, .13))
      break
    case 'toy':
      ;['C6', 'D6', 'E6', 'G6', 'A6'].forEach((n, i) => tone(ctx, out, freq(n), t + i * .06, .2, .14, 'triangle', .002))
      break
    case 'koto':
      ;['D5', 'G5', 'A5', 'D6'].forEach((n, i) => {
        tone(ctx, out, freq(n), t + i * .13, .5, .16, 'triangle', .002)
        tone(ctx, out, freq(n) * 2, t + i * .13, .2, .04, 'sine', .002)
      })
      break
    case 'step':
      ;[180, 210, 240].forEach((f, i) => {
        slide(ctx, out, f * 1.6, f, t + i * .14, .1, .22, 'sine')
        noise(ctx, out, t + i * .14, .04, .05, 'lowpass', 900)
      })
      break
    case 'eat':
      bell(ctx, out, 'G5', t, .3, .15)
      bell(ctx, out, 'C6', t + .15, .5, .15)
      break
  }
}

// ---------------- BGM ----------------

const BPM = 112
/** 8ぶおんぷ ずつ。'-' は のばす、'.' は やすみ。1しょうせつ 8こ。 */
const MELODY = [
  'F5 - A5 - C6 - A5 -', 'Bb5 - A5 G5 F5 - - -', 'G5 - Bb5 - D6 - C6 Bb5', 'G5 - - - E5 - C5 -',
  'F5 - A5 - C6 - F6 -', 'E6 - D6 C6 D6 - Bb5 -', 'A5 - G5 - F5 - E5 G5', 'F5 - - - . . . .',
  'D6 - C6 - A5 - C6 -', 'Bb5 - A5 - G5 - - -', 'C6 - Bb5 - A5 - F5 -', 'A5 - G5 - - - C5 -',
  'F5 G5 A5 Bb5 C6 - A5 -', 'D6 - C6 - Bb5 - G5 -', 'A5 - C6 - G5 - E5 -', 'F5 - - - . . . .',
].join(' ').split(/\s+/)

const F = ['F', 'A', 'C'], Bb = ['Bb', 'D', 'F'], Gm = ['G', 'Bb', 'D'], C = ['C', 'E', 'G'], Dm = ['D', 'F', 'A']
/** しょうせつ ごとの わおん。 */
const CHORDS: readonly (readonly string[])[] = [F, Bb, Gm, C, F, C, C, F, Dm, Gm, F, C, F, Bb, C, F]

export const BGM_BARS = CHORDS.length

/** メロディ（8ぶおんぷの ならび）。テスト用。 */
export function bgmMelody(): readonly string[] {
  return MELODY
}

/** のんびりした BGM を ながす。とめる 関数を かえす。 */
export function startBgm(): () => void {
  const ctx = isSoundEnabled() ? getSharedAudioContext() : undefined
  if (!ctx) return () => {}
  const master = ctx.createGain()
  master.gain.value = 1
  master.connect(getSoundOutput(ctx))

  const sixteenth = 60 / BPM / 4
  let index = 0
  let next = ctx.currentTime + .1
  const schedule = () => {
    while (next < ctx.currentTime + .4) {
      const s16 = index % 16
      const bar = Math.floor(index / 16) % BGM_BARS
      const chord = CHORDS[bar]

      // メロディ（オルゴール）。
      if (s16 % 2 === 0) {
        const at = bar * 8 + s16 / 2
        const note = MELODY[at]
        if (note !== '-' && note !== '.') {
          let len = 1
          while (MELODY[(at + len) % MELODY.length] === '-' && len < 8) len++
          const dur = len * sixteenth * 2 + .25
          tone(ctx, master, freq(note), next, dur, .055, 'triangle')
          tone(ctx, master, freq(note) * 2, next, dur * .4, .014, 'sine')
        }
        // わおんの アルペジオ。
        const arp = [0, 1, 2, 1][(s16 / 2) % 4]
        tone(ctx, master, freq(`${chord[arp]}4`), next, sixteenth * 3, .018, 'sine')
      }
      // ベースは 1はくめ と 3はくめ。
      if (s16 === 0) tone(ctx, master, freq(`${chord[0]}2`) * 2, next, sixteenth * 7, .07, 'triangle')
      if (s16 === 8) tone(ctx, master, freq(`${chord[2]}2`) * 2, next, sixteenth * 7, .055, 'triangle')
      // かるい リズム（ぽこ・しゃか）。
      if (s16 === 0 || s16 === 8) slide(ctx, master, 140, 55, next, .12, .07, 'sine')
      if (s16 % 4 === 2) noise(ctx, master, next, .05, .012, 'highpass', 6500)

      index++
      next += sixteenth
    }
  }
  schedule()
  const timer = setInterval(schedule, 60)
  return () => {
    clearInterval(timer)
    const t = ctx.currentTime
    master.gain.cancelScheduledValues(t)
    master.gain.setValueAtTime(master.gain.value, t)
    master.gain.linearRampToValueAtTime(0, t + .3)
    setTimeout(() => {
      try {
        master.disconnect()
      } catch {
        // もう きれている。
      }
    }, 450)
  }
}
