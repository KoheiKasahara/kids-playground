import { getSharedAudioContext, isSoundEnabled, playTone } from '../../audio/sound'

/**
 * 走行画面の効果音。共有 AudioContext だけを使い、音源ファイルは持たない。
 * 音が出せない環境でも走りは見えるので、失敗しても何もせず先へ進む。
 */

/** 「かそく！」の合図。低い音から高い音へ上げて、ぐんと出る感じにする。 */
export function playDriveBoostSound(): void {
  if (!isSoundEnabled()) return
  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    playTone(ctx, 196, now, 0.12, 0.05, 'sawtooth')
    playTone(ctx, 330, now + 0.08, 0.14, 0.045, 'triangle')
    playTone(ctx, 494, now + 0.18, 0.16, 0.04, 'triangle')
  } catch {
    /* 音が出せなくても くるまは かそくする。 */
  }
}
