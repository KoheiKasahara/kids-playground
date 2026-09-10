import { getSharedAudioContext, isSoundEnabled, playTone } from '../../audio/sound'

/** ほしを ひろった ときの みじかい「キラン♪」。ゴールの チャイムより かるい音にする。 */
export function playStarSound(): void {
  if (!isSoundEnabled()) return
  const ctx = getSharedAudioContext()
  if (!ctx) return
  const now = ctx.currentTime
  playTone(ctx, 988, now, 0.1, 0.07, 'triangle')
  playTone(ctx, 1319, now + 0.07, 0.14, 0.06, 'sine')
}

/** ワープに はいった ときの「ヒュン」。上がる音で 別の ばしょへ とんだ ことを つたえる。 */
export function playWarpSound(): void {
  if (!isSoundEnabled()) return
  const ctx = getSharedAudioContext()
  if (!ctx) return
  const now = ctx.currentTime
  playTone(ctx, 420, now, 0.12, 0.07, 'sine')
  playTone(ctx, 780, now + 0.08, 0.16, 0.06, 'sine')
}
