import { getSharedAudioContext, isSoundEnabled, playNoiseBurst, playTone } from '../../audio/sound'

export type IroSound = 'count' | 'go' | 'step' | 'switch' | 'drop' | 'safe' | 'fall' | 'win' | 'lose'

/** のこれ！いろのゆか の効果音。音が出なくても、かんばん・ゆか・ハートの見た目だけで遊べる。 */
export function playIroSound(kind: IroSound): void {
  if (!isSoundEnabled()) return
  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    const notes = (frequencies: readonly number[], gap: number, duration: number, volume: number, type: OscillatorType) =>
      frequencies.forEach((frequency, i) => playTone(ctx, frequency, now + i * gap, duration, volume, type))
    switch (kind) {
      case 'count':
        playTone(ctx, 587.33, now, 0.14, 0.14, 'square')
        break
      case 'go':
        notes([783.99, 1046.5], 0.06, 0.24, 0.14, 'square')
        break
      case 'step':
        playTone(ctx, 880, now, 0.07, 0.1, 'triangle')
        break
      case 'switch':
        // 「あっ！」と気づける 上下する音。
        notes([987.77, 739.99, 987.77, 1318.51], 0.06, 0.09, 0.12, 'square')
        break
      case 'drop':
        playNoiseBurst(ctx, now, 0.5, 0.22, 'lowpass', 700)
        playTone(ctx, 196, now, 0.35, 0.12, 'sine')
        break
      case 'safe':
        notes([659.25, 880, 1174.66], 0.07, 0.16, 0.13, 'triangle')
        break
      case 'fall':
        // 責めない「ざぶーん」。下がる音と水しぶき。
        playNoiseBurst(ctx, now + 0.05, 0.4, 0.18, 'bandpass', 1400)
        notes([523.25, 392, 293.66], 0.1, 0.18, 0.12, 'sine')
        break
      case 'win':
        notes([523.25, 659.25, 783.99, 1046.5, 1318.51], 0.11, 0.3, 0.15, 'triangle')
        break
      case 'lose':
        notes([659.25, 587.33, 523.25], 0.16, 0.28, 0.12, 'sine')
        break
    }
  } catch {
    /* 音が出せなくても、画面の動きで わかる。 */
  }
}
