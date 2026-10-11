import { getSharedAudioContext, isSoundEnabled, playTone } from '../../audio/sound'

function notes(frequencies: number[], duration: number, volume: number) {
  if (!isSoundEnabled()) return
  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    frequencies.forEach((frequency, index) => {
      playTone(ctx, frequency, ctx.currentTime + index * 0.12, duration, volume, 'triangle')
    })
  } catch {
    // The bounce and result stay visible when audio is unavailable.
  }
}

export function playTapSound() {
  notes([260, 180], 0.07, 0.18)
}

export function playStartSound() {
  notes([392, 523.25], 0.18, 0.14)
}

export function playFinishSound() {
  notes([523.25, 659.25, 783.99, 1046.5], 0.32, 0.16)
}
