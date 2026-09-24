import { getSharedAudioContext, isSoundEnabled, playTone } from '../../audio/sound'
import type { TargetKind } from './levels'

// 音声ファイルを ふやさず、Web Audio で その場で つくる みじかい こうかおん。

let noiseCache: { ctx: AudioContext; buffer: AudioBuffer } | undefined
function noiseBuffer(ctx: AudioContext) {
  if (noiseCache?.ctx !== ctx) {
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    noiseCache = { ctx, buffer }
  }
  return noiseCache.buffer
}

function noise(ctx: AudioContext, start: number, duration: number, volume: number, filter: number, type: BiquadFilterType = 'lowpass') {
  const source = ctx.createBufferSource()
  source.buffer = noiseBuffer(ctx)
  const biquad = ctx.createBiquadFilter()
  biquad.type = type
  biquad.frequency.value = filter
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(volume, start)
  gain.gain.exponentialRampToValueAtTime(.001, start + duration)
  source.connect(biquad).connect(gain).connect(ctx.destination)
  source.start(start, Math.random() * (1 - duration))
  source.stop(start + duration)
}

function slide(ctx: AudioContext, from: number, to: number, start: number, duration: number, volume: number, type: OscillatorType) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(from, start)
  osc.frequency.exponentialRampToValueAtTime(to, start + duration)
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(volume, start + .012)
  gain.gain.exponentialRampToValueAtTime(.001, start + duration)
  osc.connect(gain).connect(ctx.destination)
  osc.start(start)
  osc.stop(start + duration)
}

function context() {
  if (!isSoundEnabled()) return undefined
  return getSharedAudioContext()
}

/** たいほうの「ポン！」。 */
export function playShootSound() {
  const ctx = context()
  if (!ctx) return
  const now = ctx.currentTime
  slide(ctx, 180, 60, now, .18, .16, 'sine')
  noise(ctx, now, .12, .12, 900)
  slide(ctx, 500, 900, now + .02, .12, .04, 'triangle')
}

/** まとが われる「パリーン」。れんぞくで あてるほど 高く なる。 */
export function playHitSound(kind: TargetKind, broken: boolean, combo: number) {
  const ctx = context()
  if (!ctx) return
  const now = ctx.currentTime
  if (!broken) {
    // かたい まとに ヒビが はいる「カキン」。
    playTone(ctx, 1320, now, .12, .07, 'square')
    playTone(ctx, 1980, now + .02, .16, .04, 'triangle')
    noise(ctx, now, .08, .06, 4000, 'highpass')
    return
  }
  const lift = Math.pow(1.122, Math.min(combo, 6) - 1)
  noise(ctx, now, .2, .1, 3000, 'highpass')
  if (kind === 'gold') {
    ;[1568, 2093, 2637, 3136].forEach((f, i) => playTone(ctx, f, now + i * .06, .22, .06, 'triangle'))
    return
  }
  playTone(ctx, 784 * lift, now, .14, .08, 'triangle')
  playTone(ctx, 1175 * lift, now + .07, .2, .07, 'triangle')
  if (kind === 'hard') slide(ctx, 300, 90, now, .25, .08, 'square')
}

/** かべに あたって とまる「コツン」。 */
export function playBlockSound() {
  const ctx = context()
  if (!ctx) return
  const now = ctx.currentTime
  noise(ctx, now, .1, .1, 700)
  playTone(ctx, 160, now, .09, .08, 'triangle')
}

/** はねかえる かべの「ぼよん」。 */
export function playBounceSound() {
  const ctx = context()
  if (!ctx) return
  const now = ctx.currentTime
  slide(ctx, 220, 520, now, .16, .1, 'sine')
  slide(ctx, 520, 300, now + .1, .14, .06, 'sine')
}

/** はずれて とおくへ いった「ひゅ〜」。 */
export function playMissSound() {
  const ctx = context()
  if (!ctx) return
  slide(ctx, 700, 350, ctx.currentTime, .22, .03, 'sine')
}

/** クリアの ファンファーレ。 */
export function playClearSound() {
  const ctx = context()
  if (!ctx) return
  const now = ctx.currentTime
  const notes = [523, 659, 784, 1047, 784, 1047]
  const times = [0, .12, .24, .36, .52, .62]
  notes.forEach((n, i) => { playTone(ctx, n, now + times[i], .2, .08, 'triangle'); playTone(ctx, n / 2, now + times[i], .2, .04, 'sine') })
}

export function playFailSound() {
  const ctx = context()
  if (!ctx) return
  const now = ctx.currentTime
  slide(ctx, 440, 330, now, .25, .07, 'triangle')
  slide(ctx, 330, 247, now + .25, .35, .07, 'triangle')
}
