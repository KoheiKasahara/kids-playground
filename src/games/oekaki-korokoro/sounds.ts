import { getSharedAudioContext, isSoundEnabled, playNoiseBurst, playTone } from '../../audio/sound'

/**
 * おえかきコロコロの効果音（Issue #784 A8）。ローラーが もようを 1こ おすたびに、
 * もようごとの みじかい音を鳴らす。おんぷの もようだけは ドレミと 音階を のぼっていく。
 */
const SCALE = [523, 587, 659, 698, 784, 880, 988, 1047]
let noteStep = 0

export function playStampSound(patternId: string): void {
  if (!isSoundEnabled()) return
  const ctx = getSharedAudioContext()
  if (!ctx) return
  const now = ctx.currentTime
  switch (patternId) {
    case 'flower':
      playTone(ctx, 1047, now, 0.16, 0.045, 'sine')
      break
    case 'star':
      playTone(ctx, 1319, now, 0.08, 0.04, 'triangle')
      playTone(ctx, 1760, now + 0.05, 0.1, 0.03, 'sine')
      break
    case 'paw':
      playTone(ctx, 196, now, 0.09, 0.07, 'sine')
      break
    case 'heart':
      playTone(ctx, 440, now, 0.14, 0.05, 'sine')
      playTone(ctx, 554, now + 0.04, 0.14, 0.04, 'sine')
      break
    case 'stripe':
      playNoiseBurst(ctx, now, 0.05, 0.035, 'bandpass', 1800)
      break
    case 'note':
      playTone(ctx, SCALE[noteStep % SCALE.length], now, 0.18, 0.05, 'triangle')
      noteStep += 1
      break
    case 'ribbon':
      playTone(ctx, 880, now, 0.12, 0.04, 'triangle')
      break
    default:
      playTone(ctx, 659, now, 0.09, 0.05, 'sine')
  }
}

/** ぬりはじめで おんぷの 音階を ドから やりなおす。 */
export function resetStampMelody(): void {
  noteStep = 0
}

/** 「できた！」のファンファーレ。 */
export function playDoneSound(): void {
  if (!isSoundEnabled()) return
  const ctx = getSharedAudioContext()
  if (!ctx) return
  const now = ctx.currentTime
  ;[523, 659, 784, 1047].forEach((frequency, i) => playTone(ctx, frequency, now + i * 0.11, 0.28, 0.07, 'triangle'))
}
