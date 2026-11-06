import { getSharedAudioContext, isSoundEnabled, playTone } from '../../audio/sound'

export function playCraftSound(action: 'place' | 'remove' | 'select') {
  if (!isSoundEnabled()) return
  const ctx = getSharedAudioContext()
  if (!ctx) return
  const frequency = action === 'place' ? 620 : action === 'remove' ? 260 : 820
  playTone(ctx, frequency, ctx.currentTime, 0.13, 0.13, 'triangle')
}
