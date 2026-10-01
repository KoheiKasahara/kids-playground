import { getSharedAudioContext, isSoundEnabled, playTone } from '../../audio/sound'

/** おだいの しゃぼんだまを わった「ぱちん」。高い音から さっと上がる短い2音。 */
export function playPopSound(): void {
  if (!isSoundEnabled()) return
  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    playTone(ctx, 1046.5, now, 0.06, 0.1, 'sine')
    playTone(ctx, 1567.98, now + 0.04, 0.1, 0.07, 'triangle')
  } catch {
    /* 音が出せなくても、はじけたことは画面でわかる。 */
  }
}

/** ちがう しゃぼんだまを さわったときの「ぽよん」。責めない柔らかさにする。 */
export function playBoingSound(): void {
  if (!isSoundEnabled()) return
  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    playTone(ctx, 330, now, 0.12, 0.06, 'sine')
    playTone(ctx, 392, now + 0.08, 0.14, 0.05, 'sine')
  } catch {
    /* 音が出せなくても、ぷるぷる ゆれるので わかる。 */
  }
}

/** ぜんぶ われた「できた！」。結果表示にあわせて鳴らす。 */
export function playClearSound(): void {
  if (!isSoundEnabled()) return
  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    const frequencies = [659.25, 783.99, 1046.5, 1318.51]
    frequencies.forEach((frequency, index) => {
      playTone(ctx, frequency, now + index * 0.11, 0.3, 0.14, 'triangle')
    })
  } catch {
    /* 音が出せなくても、結果は画面に出る。 */
  }
}
