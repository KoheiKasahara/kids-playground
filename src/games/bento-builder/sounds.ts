import { getSharedAudioContext, isSoundEnabled, playTone } from '../../audio/sound'

export function playBentoSound(kind: 'add' | 'place' | 'remove' | 'finish') {
  if (!isSoundEnabled()) return
  try {
    const context = getSharedAudioContext()
    if (!context) return
    const notes = kind === 'finish' ? [523, 659, 784, 1047] : kind === 'remove' ? [440, 330] : kind === 'add' ? [660, 880] : [587]
    notes.forEach((note, i) => playTone(context, note, context.currentTime + i * 0.09, 0.16, 0.065, 'sine'))
  } catch { /* Audio is optional. */ }
}
