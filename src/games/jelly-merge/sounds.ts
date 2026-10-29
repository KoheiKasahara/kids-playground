import { getSharedAudioContext, isSoundEnabled, playTone } from '../../audio/sound'

export type JellySound = 'drop' | 'land' | 'merge' | 'win' | 'full' | 'undo'
export function playJellySound(kind: JellySound, chain = 1): void {
  if (!isSoundEnabled()) return
  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    const pitch = 440 * 2 ** (Math.min(6, Math.max(1, chain)) / 12)
    const notes = kind === 'merge' ? [pitch, pitch * 1.5, pitch * 2]
      : kind === 'win' ? [523, 659, 784, 1047, 1318]
        : kind === 'drop' ? [660, 440] : kind === 'land' ? [220, 330]
          : kind === 'full' ? [392, 330, 262] : [523, 392]
    notes.forEach((note, index) => playTone(ctx, note, ctx.currentTime + index * 0.065, 0.16, 0.14, 'triangle'))
  } catch {
    // The visual squash, burst and result remain sufficient without audio support.
  }
}
