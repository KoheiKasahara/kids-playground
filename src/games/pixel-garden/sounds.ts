import { getSharedAudioContext, isSoundEnabled, playTone } from '../../audio/sound'

export type GardenSound = 'plant' | 'water' | 'bloom' | 'pick' | 'complete'
const NOTES: Record<GardenSound, readonly number[]> = {
  plant: [392, 523], water: [659, 880, 784], bloom: [523, 659, 784],
  pick: [784, 1047], complete: [523, 659, 784, 1047, 784, 1047],
}

export function playGardenSound(kind: GardenSound): void {
  if (!isSoundEnabled()) return
  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    NOTES[kind].forEach((note, index) => {
      playTone(ctx, note, ctx.currentTime + index * 0.09, 0.18, 0.15, 'triangle')
    })
  } catch {
    // 音声非対応でも、芽・花・花束の変化で遊べる。
  }
}
