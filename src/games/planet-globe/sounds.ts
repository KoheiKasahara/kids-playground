import { getSharedAudioContext, isSoundEnabled, playTone } from '../../audio/sound'

/**
 * たいようけい のボタンの効果音。とくちょうスポットを見つけた音は utils/quizSound の playPlanetSpotSelectSound。
 * 宇宙らしい まるい正弦波で、ボタンの種類ごとに音の動きを変える。
 */
export type PlanetUiSound = 'body' | 'mode' | 'zoom-in' | 'zoom-out' | 'toggle'

const NOTES: Record<PlanetUiSound, number[]> = {
  body: [392, 587.33, 783.99],
  mode: [523.25, 659.25],
  'zoom-in': [523.25, 783.99],
  'zoom-out': [783.99, 523.25],
  toggle: [659.25],
}

export function playPlanetUiSound(kind: PlanetUiSound): void {
  if (!isSoundEnabled()) return
  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    NOTES[kind].forEach((frequency, index) => playTone(ctx, frequency, now + index * 0.06, 0.12, 0.045, 'sine'))
  } catch {
    // 音が出せなくても、天体は見られる。
  }
}
