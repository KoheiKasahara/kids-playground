import { getSharedAudioContext, isSoundEnabled, playTone } from '../../audio/sound'

export type CraftSound = 'place' | 'remove' | 'select' | 'grow' | 'treasure' | 'complete' | 'pet' | 'step'

/** ふくすうの おとを じゅんばんに ならす（ドレミの ような みじかい フレーズ）。 */
const PHRASES: Partial<Record<CraftSound, readonly number[]>> = {
  grow: [392, 523, 659],
  treasure: [784, 988, 1319],
  complete: [523, 659, 784, 1047],
  pet: [660, 880],
}

export function playCraftSound(action: CraftSound) {
  if (!isSoundEnabled()) return
  const ctx = getSharedAudioContext()
  if (!ctx) return
  const phrase = PHRASES[action]
  if (phrase) {
    // おとが かさならないように ならべる（かさなると ほかの おとより おおきく なる）
    const gap = 0.12
    phrase.forEach((frequency, i) => playTone(ctx, frequency, ctx.currentTime + i * gap, 0.12, 0.08, action === 'pet' ? 'sine' : 'triangle'))
    return
  }
  if (action === 'step') {
    playTone(ctx, 330, ctx.currentTime, 0.08, 0.1, 'triangle')
    return
  }
  const frequency = action === 'place' ? 620 : action === 'remove' ? 260 : 820
  playTone(ctx, frequency, ctx.currentTime, 0.13, 0.13, 'triangle')
}
