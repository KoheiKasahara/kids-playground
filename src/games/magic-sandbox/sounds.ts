import { getSharedAudioContext, isSoundEnabled, playNoiseBurst, playTone } from '../../audio/sound'
import { Cell, type Material } from './sandboxSimulation'

/**
 * まほうのすなばの効果音（Issue #784 A8）。なぞっているあいだ、そざいに合った短い音を
 * 間引きながら鳴らす。すな＝さらさら、みず＝ちゃぷ、いし＝ことっ、たね＝ぽっ、けす＝しゅっ。
 */
export function playMaterialSound(material: Material): void {
  if (!isSoundEnabled()) return
  const ctx = getSharedAudioContext()
  if (!ctx) return
  const now = ctx.currentTime
  switch (material) {
    case Cell.Sand:
      playNoiseBurst(ctx, now, 0.14, 0.05, 'bandpass', 2400 + Math.random() * 1200)
      break
    case Cell.Water:
      playTone(ctx, 520 + Math.random() * 260, now, 0.09, 0.05, 'sine')
      playTone(ctx, 780 + Math.random() * 260, now + 0.05, 0.07, 0.03, 'sine')
      break
    case Cell.Stone:
      playTone(ctx, 150 + Math.random() * 40, now, 0.08, 0.08, 'triangle')
      playNoiseBurst(ctx, now, 0.05, 0.03, 'lowpass', 900)
      break
    case Cell.Seed:
    case Cell.TulipSeed:
      playTone(ctx, 880 + Math.random() * 200, now, 0.07, 0.05, 'sine')
      break
    default:
      playNoiseBurst(ctx, now, 0.12, 0.04, 'highpass', 3000)
  }
}

/** おはなが さいたときの「ポロロン♪」。 */
export function playBloomSound(): void {
  if (!isSoundEnabled()) return
  const ctx = getSharedAudioContext()
  if (!ctx) return
  const now = ctx.currentTime
  ;[659, 784, 988, 1319].forEach((frequency, i) => playTone(ctx, frequency, now + i * 0.09, 0.3, 0.06, 'triangle'))
}

/** 「ゆらす」の「ゴゴゴ」。 */
export function playShakeSound(): void {
  if (!isSoundEnabled()) return
  const ctx = getSharedAudioContext()
  if (!ctx) return
  const now = ctx.currentTime
  playNoiseBurst(ctx, now, 0.45, 0.08, 'lowpass', 320)
  playTone(ctx, 70, now, 0.4, 0.06, 'sawtooth')
}

function withAudio(play: (ctx: AudioContext, now: number) => void): void {
  if (!isSoundEnabled()) return
  const ctx = getSharedAudioContext()
  if (!ctx) return
  play(ctx, ctx.currentTime)
}

/** そざいを えらんだときの「ぽこっ」。 */
export function playSelectSound(): void {
  withAudio((ctx, now) => {
    playTone(ctx, 660, now, 0.06, 0.05, 'sine')
    playTone(ctx, 990, now + 0.04, 0.06, 0.04, 'sine')
  })
}

/** いきものを ふやしたときの音。カニ＝ちょこちょこ、カメ＝のっそり、ちょうちょ＝ひらひら。 */
export function playCreatureSound(kind: 'crab' | 'turtle' | 'butterfly'): void {
  withAudio((ctx, now) => {
    if (kind === 'crab') {
      ;[0, 0.07, 0.14].forEach(t => playNoiseBurst(ctx, now + t, 0.035, 0.05, 'bandpass', 2000))
      playTone(ctx, 700, now + 0.2, 0.08, 0.05, 'square')
    } else if (kind === 'turtle') {
      playTone(ctx, 220, now, 0.18, 0.07, 'triangle')
      playTone(ctx, 330, now + 0.16, 0.22, 0.06, 'triangle')
    } else {
      ;[1175, 1568, 1319, 1760].forEach((frequency, i) => playTone(ctx, frequency, now + i * 0.06, 0.12, 0.04, 'sine'))
    }
  })
}

/** ひる／よるを きりかえたときの音。よるは さがる、ひるは あがる。 */
export function playDayNightSound(night: boolean): void {
  withAudio((ctx, now) => {
    const notes = night ? [784, 659, 523] : [523, 659, 784]
    notes.forEach((frequency, i) => playTone(ctx, frequency, now + i * 0.1, 0.22, 0.05, night ? 'sine' : 'triangle'))
  })
}

/** とめる／うごかすの「ぴっ」。 */
export function playPauseSound(paused: boolean): void {
  withAudio((ctx, now) => playTone(ctx, paused ? 440 : 660, now, 0.1, 0.05, 'square'))
}

/** ぜんぶけすの「しゅわわ〜」。 */
export function playClearSound(): void {
  withAudio((ctx, now) => {
    playNoiseBurst(ctx, now, 0.5, 0.06, 'highpass', 1800)
    ;[1047, 784, 523].forEach((frequency, i) => playTone(ctx, frequency, now + 0.1 + i * 0.08, 0.15, 0.04, 'sine'))
  })
}
