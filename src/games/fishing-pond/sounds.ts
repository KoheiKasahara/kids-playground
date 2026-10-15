import { getSharedAudioContext, isSoundEnabled, playTone } from '../../audio/sound'

const NOTES = {
  cast: [440, 330],
  nibble: [659],
  bite: [784, 1047],
  reel: [587, 784],
  escape: [392, 294],
  catch: [523, 659, 784],
  complete: [523, 659, 784, 1047, 1319],
} as const

/** 連打で何度も鳴る音は短く切り、重なってもうるさくしない。 */
const SHORT: ReadonlySet<keyof typeof NOTES> = new Set(['reel', 'nibble'])

export function playFishingSound(kind: keyof typeof NOTES): void {
  if (!isSoundEnabled()) return
  try {
    const context = getSharedAudioContext()
    if (!context) return
    const short = SHORT.has(kind)
    NOTES[kind].forEach((frequency, index) => {
      playTone(context, frequency, context.currentTime + index * (short ? 0.04 : 0.1), short ? 0.09 : 0.22, 0.1, 'triangle')
    })
  } catch {
    // 音声が使えなくても浮き・メーター・魚の動きで遊べる。
  }
}
