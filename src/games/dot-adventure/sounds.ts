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
/** 25% の パルス波（ファミコン・SFC らしい 音色）。 */
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

function tone(ctx: AudioContext, dest: AudioNode, f: number, start: number, dur: number, vol: number, voice: Voice, release = .06) {
  if (!f) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  if (voice === 'pulse') osc.setPeriodicWave(pulseWave(ctx))
  else osc.type = voice
  osc.frequency.setValueAtTime(f, start)
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(vol, start + .008)
  gain.gain.setValueAtTime(vol * .8, start + Math.max(.01, dur - release))
  gain.gain.linearRampToValueAtTime(0, start + dur)
  osc.connect(gain).connect(dest)
  osc.start(start)
  osc.stop(start + dur + .02)
}

function sfx() {
  if (!isSoundEnabled()) return undefined
  return getSharedAudioContext()
}

/** ほしの かけらを ひろった「ピロリン♪」。のこりが すくないほど 高く。 */
export function playShardSound(left: number) {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  const lift = Math.pow(2, (4 - Math.min(4, left)) / 12 * 2)
  ;['C6', 'E6', 'G6', 'C7'].forEach((n, i) => tone(ctx, ctx.destination, freq(n) * lift, t + i * .055, .12, .07, 'pulse'))
  tone(ctx, ctx.destination, freq('G7') * lift, t + .24, .25, .03, 'sine')
}

/** なかまに なった「ぴょこ♪」。 */
export function playJoinSound() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(300, t)
  osc.frequency.exponentialRampToValueAtTime(900, t + .12)
  gain.gain.setValueAtTime(.12, t)
  gain.gain.exponentialRampToValueAtTime(.001, t + .16)
  osc.connect(gain).connect(ctx.destination)
  osc.start(t)
  osc.stop(t + .18)
  ;['E5', 'A5', 'C#6'].forEach((n, i) => tone(ctx, ctx.destination, freq(n), t + .14 + i * .09, .14, .06, 'pulse'))
}

/** たからばこが あらわれた「シャラララン」。 */
export function playChestAppearSound() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  ;['C7', 'G6', 'E6', 'C6', 'G5', 'E5', 'C5'].forEach((n, i) => tone(ctx, ctx.destination, freq(n), t + i * .04, .1, .035, 'triangle'))
  ;['C5', 'E5', 'G5', 'C6'].forEach(n => tone(ctx, ctx.destination, freq(n), t + .32, .6, .03, 'pulse', .3))
}

/** たからばこを あけた ファンファーレ。 */
export function playFanfare() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  const s = .1
  const melody: [string, number, number][] = [['G5', 0, 1], ['G5', 1, 1], ['G5', 2, 1], ['C6', 3, 3], ['A5', 6, 1], ['B5', 7, 1], ['C6', 8, 1], ['D6', 9, 1], ['E6', 10, 6]]
  for (const [n, at, len] of melody) {
    tone(ctx, ctx.destination, freq(n), t + at * s, len * s, .075, 'pulse')
    tone(ctx, ctx.destination, freq(n) / 2, t + at * s, len * s, .03, 'pulse')
  }
  for (const [n, at, len] of [['C4', 3, 3], ['F3', 6, 2], ['G3', 8, 2], ['C4', 10, 6]] as [string, number, number][]) tone(ctx, ctx.destination, freq(n), t + at * s, len * s, .1, 'triangle')
  ;['E6', 'G6', 'C7'].forEach((n, i) => tone(ctx, ctx.destination, freq(n), t + 10 * s + i * .03, .6, .025, 'sine', .4))
}

/** ぶつかった「コツン」。 */
export function playBumpSound() {
  const ctx = sfx()
  if (!ctx) return
  tone(ctx, ctx.destination, 130, ctx.currentTime, .06, .06, 'square')
}

/** タップの「ピッ」。 */
export function playTapSound() {
  const ctx = sfx()
  if (!ctx) return
  tone(ctx, ctx.destination, freq('A6'), ctx.currentTime, .03, .025, 'pulse')
}

/** メッセージの もじおくり「ポポポ」。 */
export function playTextBlip() {
  const ctx = sfx()
  if (!ctx) return
  tone(ctx, ctx.destination, freq('E6'), ctx.currentTime, .025, .018, 'pulse')
}

// ---------------- BGM ----------------

type Song = { bpm: number; melody: string; bass: readonly string[]; arp?: boolean }

// メロディは 8分音符ずつ。'-' は のばす、'.' は やすみ。
export const SONGS: Record<string, Song> = {
  forest: {
    bpm: 104,
    melody: 'E5 - G5 - C6 - B5 A5 | G5 - - - E5 - D5 - | C5 - D5 E5 F5 - E5 D5 | E5 - - - - - . . | A5 - G5 - F5 - E5 - | D5 - E5 F5 G5 - - - | A5 G5 F5 E5 D5 - G5 - | C5 - - - - - . .',
    bass: ['C3', 'E3', 'F3', 'C3', 'F3', 'D3', 'G3', 'C3'],
  },
  beach: {
    bpm: 84,
    melody: 'A4 - C5 - F5 - - - | E5 - D5 - C5 - - - | Bb4 - D5 - G5 - F5 E5 | F5 - - - - - . . | A5 - G5 F5 E5 - D5 - | C5 - D5 - E5 - C5 - | D5 - Bb4 - G4 - C5 - | F4 - - - - - . .',
    bass: ['F2', 'C3', 'Bb2', 'F2', 'F2', 'C3', 'G2', 'C3'],
  },
  ruins: {
    bpm: 76,
    melody: 'A4 - - - C5 - B4 - | E4 - - - - - . . | F4 - - - A4 - G4 - | E4 - - - - - . . | A4 - B4 - C5 - D5 - | E5 - - - D5 - C5 - | B4 - G4 - E4 - F4 - | E4 - - - - - . .',
    bass: ['A2', 'E2', 'F2', 'E2', 'A2', 'C3', 'G2', 'E2'],
    arp: true,
  },
}

/** ステージの BGM を ながす。とめる 関数を かえす。 */
export function startBgm(id: string): () => void {
  const song = SONGS[id]
  const ctx = isSoundEnabled() ? getSharedAudioContext() : undefined
  if (!song || !ctx) return () => {}
  const master = ctx.createGain()
  master.gain.value = .55
  master.connect(ctx.destination)
  // すこし ひびきを つける（SFC の エコー）。
  const delay = ctx.createDelay(1)
  delay.delayTime.value = 60 / song.bpm * .75
  const feedback = ctx.createGain()
  feedback.gain.value = .28
  const wet = ctx.createGain()
  wet.gain.value = .35
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
        tone(ctx, master, freq(s), next, len * step * .92, .045, 'pulse')
        tone(ctx, delay, freq(s), next, len * step * .92, .03, 'pulse')
      }
      const bar = Math.floor((index % steps.length) / 8)
      const root = freq(song.bass[bar % song.bass.length])
      const beat = index % 8
      if (song.arp) {
        const arp = [1, 1.5, 2, 1.5][beat % 4]
        tone(ctx, master, root * arp, next, step * .9, .07, 'triangle')
      } else if (beat % 2 === 0) {
        const mul = [1, 1.5, 2, 1.5][beat / 2]
        tone(ctx, master, root * mul, next, step * 1.8, .08, 'triangle')
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
