import { getSharedAudioContext, isSoundEnabled, playTone } from '../../audio/sound'

export type CraftSound = 'place' | 'remove' | 'select' | 'grow' | 'treasure' | 'complete' | 'pet' | 'step'
  | 'cool' | 'harvest' | 'feed' | 'baby' | 'shear'

/** ふくすうの おとを じゅんばんに ならす（ドレミの ような みじかい フレーズ）。 */
const PHRASES: Partial<Record<CraftSound, readonly number[]>> = {
  grow: [392, 523, 659],
  treasure: [784, 988, 1319],
  complete: [523, 659, 784, 1047],
  pet: [660, 880],
  harvest: [523, 784],
  feed: [587, 740, 880],
  baby: [659, 880, 1047, 1319],
  shear: [988, 740],
  // ようがんが ひえて かたまる「じゅっ」
  cool: [220, 165],
}
const SOFT: readonly CraftSound[] = ['pet', 'feed', 'baby']

export function playCraftSound(action: CraftSound) {
  if (!isSoundEnabled()) return
  const ctx = getSharedAudioContext()
  if (!ctx) return
  const phrase = PHRASES[action]
  if (phrase) {
    // おとが かさならないように ならべる（かさなると ほかの おとより おおきく なる）
    const gap = 0.12
    const type = SOFT.includes(action) ? 'sine' : action === 'cool' ? 'square' : 'triangle'
    phrase.forEach((frequency, i) => playTone(ctx, frequency, ctx.currentTime + i * gap, 0.12, action === 'cool' ? 0.05 : 0.08, type))
    return
  }
  if (action === 'step') {
    playTone(ctx, 330, ctx.currentTime, 0.08, 0.1, 'triangle')
    return
  }
  const frequency = action === 'place' ? 620 : action === 'remove' ? 260 : 820
  playTone(ctx, frequency, ctx.currentTime, 0.13, 0.13, 'triangle')
}
