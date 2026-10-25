import { getSharedAudioContext, getSoundOutput, isSoundEnabled } from '../../audio/sound'

// こっきコロコロパズルの こうかおん と BGM。音声ファイルは つかわず、Web Audio で その場で つくる。
// BGM の メロディは このゲームの ための オリジナル（ころころ はずむ マリンバふうの きょく）。

const NOTE: Record<string, number> = { C: -9, 'C#': -8, D: -7, 'D#': -6, Eb: -6, E: -5, F: -4, 'F#': -3, G: -2, 'G#': -1, Ab: -1, A: 0, 'A#': 1, Bb: 1, B: 2 }

/** 'C5' → 周波数（よめない ときは 0）。 */
export function freq(name: string): number {
  const m = /^([A-G](?:#|b)?)(\d)$/.exec(name)
  if (!m) return 0
  return 440 * Math.pow(2, (NOTE[m[1]] + (Number(m[2]) - 4) * 12) / 12)
}

function tone(ctx: AudioContext, dest: AudioNode, f: number, start: number, dur: number, vol: number, type: OscillatorType, attack = .005) {
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
  gain.gain.linearRampToValueAtTime(vol, start + .006)
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

/** ちいさな 木琴の「ぽこ」。 */
function marimba(ctx: AudioContext, out: AudioNode, note: string, at: number, dur: number, vol: number) {
  tone(ctx, out, freq(note), at, dur, vol, 'sine', .002)
  tone(ctx, out, freq(note) * 4, at, dur * .18, vol * .22, 'sine', .001)
}

export type PuzzleSound =
  // そうさ
  | 'pick' | 'place' | 'rotate' | 'remove' | 'blocked' | 'clearAll' | 'flag' | 'drop' | 'return'
  // けっか
  | 'stopped' | 'goalOne' | 'clear'
  // ころがっている あいだの パーツ
  | 'wood' | 'bumper' | 'jump' | 'cannonLoad' | 'cannonFire' | 'spinner' | 'conveyor' | 'seesaw' | 'fan' | 'bubble' | 'warp'

/**
 * 同じ おとが つづけて なりすぎない ための まびき（ms）。
 * ころがる あいだの おとは 連続で とどくので、うるさく ならない ように 少し あける。
 */
const MIN_INTERVAL_MS: Partial<Record<PuzzleSound, number>> = {
  wood: 70,
  bumper: 60,
  jump: 120,
  spinner: 110,
  conveyor: 160,
  seesaw: 180,
  fan: 380,
  bubble: 200,
  warp: 200,
}

const lastPlayedAt = new Map<PuzzleSound, number>()

function throttled(kind: PuzzleSound, now: number): boolean {
  const interval = MIN_INTERVAL_MS[kind]
  if (!interval) return false
  const last = lastPlayedAt.get(kind)
  if (last !== undefined && now - last < interval) return true
  lastPlayedAt.set(kind, now)
  return false
}

export function playPuzzleSound(kind: PuzzleSound): void {
  const ctx = sfx()
  if (!ctx) return
  if (throttled(kind, performance.now())) return
  const t = ctx.currentTime
  const out = getSoundOutput(ctx)
  switch (kind) {
    case 'pick':
      tone(ctx, out, freq('E6'), t, .08, .14, 'triangle')
      tone(ctx, out, freq('B6'), t + .04, .1, .1, 'triangle')
      break
    case 'place':
      noise(ctx, out, t, .05, .1, 'bandpass', 1800)
      marimba(ctx, out, 'G5', t, .18, .24)
      marimba(ctx, out, 'D6', t + .06, .22, .2)
      break
    case 'rotate':
      slide(ctx, out, 480, 1100, t, .14, .13, 'triangle')
      tone(ctx, out, freq('A6'), t + .12, .1, .08, 'sine')
      break
    case 'remove':
      slide(ctx, out, 1000, 240, t, .22, .14, 'sine')
      noise(ctx, out, t, .16, .05, 'highpass', 2600, 900)
      break
    case 'blocked':
      tone(ctx, out, freq('E4'), t, .12, .18, 'triangle')
      tone(ctx, out, freq('C4'), t + .13, .2, .18, 'triangle')
      break
    case 'clearAll':
      noise(ctx, out, t, .45, .1, 'bandpass', 3200, 500)
      slide(ctx, out, 1200, 200, t, .4, .12, 'triangle')
      break
    case 'flag':
      ;['C6', 'E6', 'G6'].forEach((n, i) => marimba(ctx, out, n, t + i * .06, .25, .16))
      break
    case 'drop':
      // 「ひゅーん」と おちて「ころん」。
      slide(ctx, out, 1400, 500, t, .3, .12, 'sine')
      marimba(ctx, out, 'C5', t + .28, .2, .2)
      marimba(ctx, out, 'G5', t + .36, .24, .16)
      break
    case 'return':
      slide(ctx, out, 400, 1300, t, .22, .11, 'triangle')
      marimba(ctx, out, 'C6', t + .2, .18, .14)
      break
    case 'stopped':
      ;['G5', 'E5', 'C5'].forEach((n, i) => tone(ctx, out, freq(n), t + i * .14, .22, .14, 'triangle'))
      break
    case 'goalOne':
      marimba(ctx, out, 'E6', t, .3, .22)
      marimba(ctx, out, 'A6', t + .1, .4, .2)
      break
    case 'clear': {
      const s = .11
      const melody: [string, number, number][] = [['G5', 0, 1], ['C6', 1, 1], ['E6', 2, 1], ['G6', 3, 2], ['E6', 5, 1], ['G6', 6, 1], ['C7', 7, 5]]
      for (const [n, at, len] of melody) {
        tone(ctx, out, freq(n), t + at * s, len * s + .12, .18, 'triangle')
        tone(ctx, out, freq(n), t + at * s, len * s + .08, .03, 'square')
      }
      for (const [n, at, len] of [['C3', 0, 3], ['F3', 3, 2], ['G3', 5, 2], ['C3', 7, 5]] as [string, number, number][]) {
        tone(ctx, out, freq(n), t + at * s, len * s + .1, .2, 'triangle')
      }
      ;['C7', 'E7', 'G7'].forEach((n, i) => tone(ctx, out, freq(n), t + 7 * s + i * .06, .7, .05, 'sine'))
      break
    }
    case 'wood':
      // いたに あたる「こつん」。たくさん なるので ちいさめ。
      noise(ctx, out, t, .03, .05, 'bandpass', 2400)
      tone(ctx, out, 700 + Math.random() * 160, t, .07, .07, 'sine', .001)
      break
    case 'bumper':
      // 「ぼよん」。
      slide(ctx, out, 260, 720, t, .12, .17, 'square')
      slide(ctx, out, 720, 420, t + .1, .14, .1, 'triangle')
      break
    case 'jump':
      // 「びよよーん」と とびあがる。
      slide(ctx, out, 220, 1500, t, .32, .15, 'triangle')
      slide(ctx, out, 330, 2000, t + .02, .26, .04, 'square')
      noise(ctx, out, t, .08, .06, 'lowpass', 900)
      break
    case 'cannonLoad':
      // 「ガチャ」と たまを こめる。
      noise(ctx, out, t, .05, .12, 'bandpass', 1300)
      tone(ctx, out, 180, t, .1, .16, 'square', .001)
      noise(ctx, out, t + .1, .04, .1, 'bandpass', 2400)
      break
    case 'cannonFire':
      // 「ドーン！」。ひくい ずしん と はれつ。
      slide(ctx, out, 150, 40, t, .45, .4, 'sine')
      noise(ctx, out, t, .45, .3, 'lowpass', 2200, 180)
      noise(ctx, out, t, .08, .14, 'highpass', 3000)
      break
    case 'spinner':
      // 「くるっ」。
      slide(ctx, out, 900, 1500, t, .08, .1, 'triangle')
      slide(ctx, out, 1500, 900, t + .07, .08, .08, 'triangle')
      break
    case 'conveyor':
      // ベルトの「カタカタ」。
      for (const at of [0, .06, .12]) noise(ctx, out, t + at, .03, .06, 'bandpass', 1600)
      break
    case 'seesaw':
      // 「ギッ ギィ」。
      slide(ctx, out, 300, 220, t, .1, .08, 'sawtooth')
      slide(ctx, out, 260, 330, t + .12, .12, .06, 'sawtooth')
      break
    case 'fan':
      // 「ひゅうっ」と かぜ。
      noise(ctx, out, t, .35, .1, 'bandpass', 700, 2200)
      break
    case 'bubble':
      // 「ぷくぷく」。
      ;[0, .07, .14].forEach((at, i) => slide(ctx, out, 500 + i * 200, 1100 + i * 260, t + at, .07, .11, 'sine'))
      break
    case 'warp':
      // 「ひゅいーん」と ワープ。
      slide(ctx, out, 300, 2400, t, .22, .1, 'sine')
      slide(ctx, out, 2400, 600, t + .2, .18, .08, 'triangle')
      tone(ctx, out, freq('E7'), t + .18, .2, .05, 'sine')
      break
  }
}

// ---------------- BGM ----------------

const BPM = 126
/** 8ぶおんぷ ずつ。'-' は のばす、'.' は やすみ。1しょうせつ 8こ。 */
const MELODY = [
  'C5 E5 G5 - E5 - C5 .', 'D5 F5 A5 - G5 - . .', 'E5 G5 C6 - B5 A5 G5 -', 'A5 - G5 F5 E5 - . .',
  'C5 E5 G5 - E5 - C5 .', 'D5 F5 A5 - C6 - B5 .', 'C6 - G5 - A5 B5 C6 -', 'G5 - - - . . . .',
  'E5 - F5 - G5 - E5 -', 'F5 - E5 - D5 - . .', 'E5 G5 A5 - G5 - E5 -', 'D5 - - - . . G4 .',
  'C5 E5 G5 C6 B5 - G5 -', 'A5 - F5 - D5 E5 F5 -', 'E5 - D5 - G5 - B4 -', 'C5 - - - . . . .',
].join(' ').split(/\s+/)

const C = ['C', 'E', 'G'], Dm = ['D', 'F', 'A'], F = ['F', 'A', 'C'], G = ['G', 'B', 'D'], Am = ['A', 'C', 'E']
/** しょうせつ ごとの わおん。 */
const CHORDS: readonly (readonly string[])[] = [C, Dm, C, F, C, Dm, F, G, C, Dm, Am, G, C, F, G, C]

export const BGM_BARS = CHORDS.length

/** メロディ（8ぶおんぷの ならび）。テスト用。 */
export function bgmMelody(): readonly string[] {
  return MELODY
}

/** ころころ はずむ BGM を ながす。とめる 関数を かえす。 */
export function startBgm(): () => void {
  const ctx = isSoundEnabled() ? getSharedAudioContext() : undefined
  if (!ctx) return () => {}
  const master = ctx.createGain()
  master.gain.value = .5
  master.connect(getSoundOutput(ctx))

  const sixteenth = 60 / BPM / 4
  let index = 0
  let next = ctx.currentTime + .1
  const schedule = () => {
    while (next < ctx.currentTime + .4) {
      const s16 = index % 16
      const bar = Math.floor(index / 16) % BGM_BARS
      const chord = CHORDS[bar]

      // メロディ（マリンバ）。
      if (s16 % 2 === 0) {
        const at = bar * 8 + s16 / 2
        const note = MELODY[at]
        if (note !== '-' && note !== '.') {
          let len = 1
          while (MELODY[(at + len) % MELODY.length] === '-' && len < 8) len++
          const dur = Math.min(len * sixteenth * 2 + .12, .7)
          tone(ctx, master, freq(note), next, dur, .06, 'sine', .002)
          tone(ctx, master, freq(note) * 4, next, .05, .012, 'sine', .001)
        }
      }
      // うらはくの わおん（ぽろん）。
      if (s16 === 4 || s16 === 12) {
        for (const n of chord) tone(ctx, master, freq(`${n}4`), next, sixteenth * 3, .014, 'triangle')
      }
      // ベースは 1はくめ と 3はくめ。
      if (s16 === 0) tone(ctx, master, freq(`${chord[0]}2`) * 2, next, sixteenth * 5, .07, 'triangle')
      if (s16 === 8) tone(ctx, master, freq(`${chord[2]}2`) * 2, next, sixteenth * 5, .055, 'triangle')
      // かるい リズム（ぽこ・ちっ）。
      if (s16 === 0 || s16 === 8) slide(ctx, master, 160, 60, next, .1, .06, 'sine')
      if (s16 % 4 === 2) noise(ctx, master, next, .04, .012, 'highpass', 7000)

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
