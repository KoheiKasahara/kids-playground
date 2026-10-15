import { getSharedAudioContext, isSoundEnabled, playTone } from '../../audio/sound'

const NOTES = {
  cast: [440, 330],
  bite: [784, 1047],
  catch: [523, 659, 784],
  complete: [523, 659, 784, 1047, 1319],
} as const

export function playFishingSound(kind: keyof typeof NOTES): void {
  if (!isSoundEnabled()) return
  try {
    const context = getSharedAudioContext()
    if (!context) return
    NOTES[kind].forEach((frequency, index) => {
      playTone(context, frequency, context.currentTime + index * 0.1, 0.22, 0.1, 'triangle')
    })
  } catch {
    // 音声が使えなくても浮き・合図・魚のジャンプで遊べる。
  }
}
