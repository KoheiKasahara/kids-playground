import { getSharedAudioContext, isSoundEnabled, playTone } from '../../audio/sound'

export function playSnowSound(win: boolean, count: number) {
  if (!isSoundEnabled()) return
  const ctx = getSharedAudioContext()
  if (!ctx) return
  const notes = win ? [523, 659, 784, 1047] : [440 * 2 ** ((count % 8) / 12)]
  notes.forEach((note, index) => playTone(ctx, note, ctx.currentTime + index * 0.13, 0.16, 0.08, 'sine'))
}
