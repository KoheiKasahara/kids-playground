import { getSharedAudioContext, isSoundEnabled, playTone } from '../../audio/sound'

// つぶが 1こ とどくたびに 鳴らすと うるさいので、音ごとに 最小間隔を持つ。
const lastPlayed = new Map<string, number>()
function ready(kind: string, interval: number): boolean {
  const now = Date.now()
  if ((lastPlayed.get(kind) ?? 0) + interval > now) return false
  lastPlayed.set(kind, now)
  return true
}

/** みずが すいしゃに とどいた ときの「ぽちゃん」。ながれている あいだ つづく。 */
export function playDropSound(): void {
  if (!isSoundEnabled() || !ready('drop', 130)) return
  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    playTone(ctx, 620, now, 0.07, 0.04, 'sine')
    playTone(ctx, 900, now + 0.03, 0.08, 0.03, 'sine')
  } catch { /* 音が出せなくても みずは とどく。 */ }
}

/** ゴンドラが 1つ てっぺんを こえた ときの ごほうび音。のこりが へるほど 高くなる。 */
export function playRiderSound(riders: number, total: number): void {
  if (!isSoundEnabled()) return
  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    const step = total > 0 ? Math.min(1, riders / total) : 0
    playTone(ctx, 660 + Math.round(step * 6) * 55, now, 0.12, 0.05, 'triangle')
    playTone(ctx, 990 + Math.round(step * 6) * 80, now + 0.06, 0.14, 0.04, 'sine')
  } catch { /* 音が出せなくても ゴンドラは まわる。 */ }
}

/** ステージクリアの ファンファーレ。 */
export function playWheelClearSound(): void {
  if (!isSoundEnabled()) return
  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((frequency, index) => {
      playTone(ctx, frequency, now + index * 0.1, 0.22, 0.05, 'triangle')
    })
  } catch { /* 音が出せなくても クリアできる。 */ }
}
