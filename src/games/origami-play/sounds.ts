import { getSharedAudioContext, isSoundEnabled, playNoiseBurst, playTone } from '../../audio/sound'

export function playFoldSound() {
  if (!isSoundEnabled()) return
  const context = getSharedAudioContext()
  if (!context) return
  playNoiseBurst(context, context.currentTime, 0.3, 0.055, 'lowpass', 1600)
  playTone(context, 660, context.currentTime + 0.16, 0.15, 0.025, 'sine')
}

export function playFinishSound() {
  if (!isSoundEnabled()) return
  const context = getSharedAudioContext()
  if (!context) return
  for (const [index, frequency] of [523.25, 659.25, 783.99].entries()) {
    playTone(context, frequency, context.currentTime + index * 0.14, 0.3, 0.035, 'sine')
  }
}
