import { getSharedAudioContext, isSoundEnabled, playTone } from '../../audio/sound'

/**
 * 「おちてくる」モードの効果音（#711）。共有 AudioContext を使い、音源ファイルは持たない。
 * 音が出せない環境でも遊びは成立するので、失敗しても何もせず先へ進む。
 */

/** ブロックが積まれた瞬間の、みじかい「ことん」。何度も鳴るので低く小さくする。 */
export function playBlockLandSound(): void {
  if (!isSoundEnabled()) return
  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    playTone(ctx, 196, now, 0.07, 0.05, 'triangle')
    playTone(ctx, 131, now + 0.04, 0.09, 0.04, 'sine')
  } catch {
    /* 音が出せなくても ブロックは つめる。 */
  }
}

/** よこ1れつがそろったときの、のぼっていくキラキラ。そろえた段が多いほど長くなる。 */
export function playLineClearSound(rows: number): void {
  if (!isSoundEnabled()) return
  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    const notes = [523.25, 659.25, 783.99, 1046.5]
    const count = Math.min(notes.length, 2 + Math.max(0, rows - 1))
    for (let index = 0; index < count; index += 1) {
      playTone(ctx, notes[index], now + index * 0.08, 0.18, 0.06, 'triangle')
    }
  } catch {
    /* 音が出せなくても そろったことは 画面で わかる。 */
  }
}

/** いっぱいまで積み上がったときの合図。負けを責めない、やわらかい下がり方にする。 */
export function playStackFullSound(): void {
  if (!isSoundEnabled()) return
  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    playTone(ctx, 392, now, 0.16, 0.05, 'sine')
    playTone(ctx, 294, now + 0.14, 0.24, 0.05, 'sine')
  } catch {
    /* 音が出せなくても もういっかい あそべる。 */
  }
}
