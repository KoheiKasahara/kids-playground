import { getSharedAudioContext, isSoundEnabled, playTone } from '../../audio/sound'

export function playDeliverySound(kind: 'step' | 'collect' | 'water' | 'harvest' | 'repair' | 'deliver' | 'complete'): void {
  if (!isSoundEnabled()) return
  try {
    const context = getSharedAudioContext()
    if (!context) return
    const melodies: Record<typeof kind, number[]> = {
      step: [392], collect: [523, 659], water: [784, 659, 523],
      harvest: [523, 784, 1047], repair: [330, 440, 659],
      deliver: [523, 659, 784, 1047], complete: [523, 659, 784, 1047, 988, 1319],
    }
    melodies[kind].forEach((frequency, index) => {
      playTone(context, frequency, context.currentTime + index * 0.09, 0.16, 0.055, 'triangle')
    })
  } catch { /* Sound is optional; every action also has visual feedback. */ }
}
