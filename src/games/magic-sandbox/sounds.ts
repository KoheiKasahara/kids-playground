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
