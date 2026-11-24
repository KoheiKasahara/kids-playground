import { getSharedAudioContext, isSoundEnabled, playNoiseBurst, playTone } from '../../audio/sound'
import type { Cue } from './voyage'

const tunes: Record<Cue, number[]> = {
  start: [392, 523, 659], water: [480, 690], splash: [660, 880], retreat: [659, 784, 1047],
  bump: [330, 247], clear: [523, 659, 784, 1047], return: [523, 392, 330],
}

export function fleetSound(cue: Cue) {
  if (!isSoundEnabled()) return
  const ctx = getSharedAudioContext()
  if (!ctx) return
  const quick = cue === 'water' || cue === 'splash'
  const beat = quick ? 0.045 : 0.105
  tunes[cue].forEach((hz, i) => {
    playTone(ctx, hz, ctx.currentTime + i * beat, quick ? 0.1 : 0.2, quick ? 0.12 : 0.16, 'triangle')
  })
  if (quick || cue === 'bump') playNoiseBurst(ctx, ctx.currentTime, 0.12, 0.16, 'bandpass', quick ? 1650 : 600)
}
