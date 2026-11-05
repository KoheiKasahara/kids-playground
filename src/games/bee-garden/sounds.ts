import { getSharedAudioContext, isSoundEnabled, playTone } from '../../audio/sound'
export function playBeeSound(win = false): void {
  if (!isSoundEnabled()) return
  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    ;(win ? [523, 659, 784, 1047] : [659, 880]).forEach((note, i) => {
      playTone(ctx, note, ctx.currentTime + i * 0.09, 0.18, 0.15, 'triangle')
    })
  } catch { /* Visual feedback remains available without audio. */ }
}
