import { getSharedAudioContext, isSoundEnabled, playTone } from '../../audio/sound'
import type { Material } from './levels'

// 音声ファイルを ふやさず、Web Audio で その場で つくる みじかい こうかおん。

// ノイズは 1びょうぶんを 1回だけ つくり、ばしょを ずらして つかいまわす。
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
  gain.gain.linearRampToValueAtTime(volume, start + .015)
  gain.gain.exponentialRampToValueAtTime(.001, start + duration)
  osc.connect(gain).connect(ctx.destination)
  osc.start(start)
  osc.stop(start + duration)
}

function context() {
  if (!isSoundEnabled()) return undefined
  return getSharedAudioContext()
}

/** ゴムを ひっぱる「ギュッ」。ひっぱる ほど 高く なる。 */
export function playStretchSound(amount: number) {
  const ctx = context()
  if (!ctx) return
  slide(ctx, 180 + amount * 160, 220 + amount * 200, ctx.currentTime, .08, .04, 'triangle')
}

/** はなした ときの「ビュン」。 */
export function playLaunchSound() {
  const ctx = context()
  if (!ctx) return
  const now = ctx.currentTime
  slide(ctx, 260, 820, now, .22, .09, 'sine')
  noise(ctx, now, .18, .08, 2400, 'bandpass')
}

/** ものに ぶつかった 音。ざいりょうで ちがう 音に する。 */
export function playHitSound(material: Material | 'robot' | 'ground' | 'ball', strength: number) {
  const ctx = context()
  if (!ctx) return
  const now = ctx.currentTime
  const v = .04 + strength * .1
  if (material === 'ice') { playTone(ctx, 1760, now, .08, v * .6, 'triangle'); playTone(ctx, 2349, now + .03, .1, v * .4, 'sine') }
  else if (material === 'stone') { noise(ctx, now, .16, v * 1.4, 500); playTone(ctx, 110, now, .12, v, 'sine') }
  else if (material === 'robot') slide(ctx, 520, 380, now, .12, v, 'square')
  else if (material === 'wood') { noise(ctx, now, .09, v, 1400); playTone(ctx, 240, now, .08, v * .8, 'triangle') }
  else noise(ctx, now, .12, v * .8, 700)
}

/** こわれた 音。 */
export function playBreakSound(material: Material | 'box') {
  const ctx = context()
  if (!ctx) return
  const now = ctx.currentTime
  if (material === 'ice') { for (let i = 0; i < 4; i++) playTone(ctx, 1900 + i * 420, now + i * .035, .12, .05, 'triangle'); noise(ctx, now, .2, .08, 5000, 'highpass') }
  else if (material === 'stone') { noise(ctx, now, .35, .16, 380); playTone(ctx, 82, now, .25, .1, 'sine') }
  else if (material === 'wood') { noise(ctx, now, .22, .12, 1100); playTone(ctx, 180, now, .12, .07, 'square') }
  else playBlastSound()
}

/** びっくりばこの「ボワーン」。 */
export function playBlastSound() {
  const ctx = context()
  if (!ctx) return
  const now = ctx.currentTime
  noise(ctx, now, .6, .25, 600)
  slide(ctx, 160, 40, now, .5, .16, 'sine')
  slide(ctx, 300, 900, now + .05, .3, .06, 'triangle')
}

/** ロボットが ポンと きえる 音。 */
export function playRobotSound() {
  const ctx = context()
  if (!ctx) return
  const now = ctx.currentTime
  slide(ctx, 400, 1400, now, .16, .1, 'square')
  playTone(ctx, 1568, now + .12, .12, .06, 'triangle')
  playTone(ctx, 2093, now + .2, .16, .05, 'sine')
}

export function playSplitSound() {
  const ctx = context()
  if (!ctx) return
  const now = ctx.currentTime
  for (let i = 0; i < 3; i++) playTone(ctx, 880 + i * 330, now + i * .04, .09, .06, 'triangle')
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

export function playStarSound(index: number) {
  const ctx = context()
  if (!ctx) return
  const now = ctx.currentTime
  playTone(ctx, 1047 * Math.pow(1.26, index), now, .18, .08, 'triangle')
}

export function playFailSound() {
  const ctx = context()
  if (!ctx) return
  const now = ctx.currentTime
  slide(ctx, 440, 330, now, .25, .07, 'triangle')
  slide(ctx, 330, 247, now + .25, .35, .07, 'triangle')
}
