import { getSharedAudioContext, isSoundEnabled, playTone } from '../../audio/sound'

export function playLabSound(kind: 'tap' | 'add' | 'discover' = 'tap') {
  if (!isSoundEnabled()) return
  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    const notes = kind === 'discover' ? [660, 880, 1100] : kind === 'add' ? [440, 660] : [560]
    notes.forEach((note, i) => playTone(ctx, note, ctx.currentTime + i * 0.075, 0.14, 0.065, 'sine'))
  } catch { /* Observation also works without audio. */ }
}
