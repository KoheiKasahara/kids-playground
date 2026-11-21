import { getSharedAudioContext, isSoundEnabled, playTone } from '../../audio/sound'

const notes = { start: [392, 784], boost: [523, 784, 1047], finish: [523, 659, 784, 1047] }

export function raceChime(cue: keyof typeof notes) {
  if (!isSoundEnabled()) return
  const ctx = getSharedAudioContext()
  if (!ctx) return
  notes[cue].forEach((frequency, index) => {
    playTone(ctx, frequency, ctx.currentTime + index * 0.085, 0.17, 0.16, 'triangle')
  })
}
