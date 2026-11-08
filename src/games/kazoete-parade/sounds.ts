import { getSharedAudioContext, isSoundEnabled, playNoiseBurst, playTone } from '../../audio/sound'

export type ParadeSound = 'show' | 'go' | 'tap' | 'untap' | 'stop' | 'ok' | 'count' | 'correct' | 'miss' | 'win' | 'lose'

/** こたえあわせで 1・2・3… と かぞえるたびに 1おと ずつ あがる ドレミ。 */
const COUNT_SCALE = [523.25, 587.33, 659.25, 698.46, 783.99, 880, 987.77, 1046.5, 1174.66, 1318.51]

/**
 * かぞえて！どうぶつパレード の効果音。音が出なくても、かんばん・かずの表示・🏅 の見た目だけで遊べる。
 * @param step count のとき なんびきめか（0から）。
 */
export function playParadeSound(kind: ParadeSound, step = 0): void {
  if (!isSoundEnabled()) return
  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    const notes = (frequencies: readonly number[], gap: number, duration: number, volume: number, type: OscillatorType) =>
      frequencies.forEach((frequency, i) => playTone(ctx, frequency, now + i * gap, duration, volume, type))
    switch (kind) {
      case 'show':
        // 「パッパカパーン」と パレードの はじまりを しらせる。
        notes([523.25, 659.25, 783.99, 659.25, 1046.5], 0.09, 0.16, 0.12, 'square')
        break
      case 'go':
        notes([783.99, 1046.5], 0.06, 0.22, 0.13, 'square')
        break
      case 'tap':
        // カウンターの「カチッ」。
        playNoiseBurst(ctx, now, 0.03, 0.16, 'highpass', 2400)
        playTone(ctx, 1567.98, now, 0.06, 0.12, 'square')
        break
      case 'untap':
        playTone(ctx, 659.25, now, 0.08, 0.11, 'triangle')
        break
      case 'stop':
        notes([783.99, 587.33], 0.12, 0.2, 0.12, 'triangle')
        break
      case 'ok':
        notes([659.25, 987.77], 0.07, 0.16, 0.13, 'triangle')
        break
      case 'count':
        playTone(ctx, COUNT_SCALE[Math.min(step, COUNT_SCALE.length - 1)]!, now, 0.18, 0.14, 'triangle')
        break
      case 'correct':
        notes([783.99, 987.77, 1174.66, 1567.98], 0.08, 0.2, 0.14, 'triangle')
        break
      case 'miss':
        // せめない「おしい」。やさしく さがる 2おと。
        notes([523.25, 440], 0.16, 0.24, 0.12, 'sine')
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
