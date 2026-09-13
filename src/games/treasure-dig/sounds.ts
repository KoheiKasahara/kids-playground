import { getSharedAudioContext, isSoundEnabled, playTone } from '../../audio/sound'

// 連続で なぞる あいだ 鳴りっぱなしに ならないよう、音ごとに 最小間隔を持つ。
const lastPlayed = new Map<string, number>()
function ready(kind: string, interval: number) {
  const now = Date.now()
  if ((lastPlayed.get(kind) ?? 0) + interval > now) return false
  lastPlayed.set(kind, now)
  return true
}

/** すなを ほった ときの「ざくっ」。低い短音だけにして、なぞっても うるさくしない。 */
export function playDigSound(): void {
  if (!isSoundEnabled() || !ready('dig', 110)) return
  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    playTone(ctx, 150, now, 0.06, 0.05, 'triangle')
    playTone(ctx, 98, now + 0.03, 0.07, 0.04, 'sine')
  } catch { /* 音が出せなくても ほれる。 */ }
}

/** たからが はこに入った ときの「チャリン」。たまるほど 少し高くして、伸びを感じさせる。 */
export function playTreasureSound(collected: number, need: number): void {
  if (!isSoundEnabled() || !ready('treasure', 80)) return
  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    const step = Math.min(1, need > 0 ? collected / need : 0)
    playTone(ctx, 880 + Math.round(step * 8) * 40, now, 0.08, 0.05, 'triangle')
    playTone(ctx, 1320 + Math.round(step * 8) * 60, now + 0.04, 0.1, 0.04, 'sine')
  } catch { /* 音が出せなくても つぶは たまる。 */ }
}

/** ステージクリアの ファンファーレ。 */
export function playDigClearSound(): void {
  if (!isSoundEnabled()) return
  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((frequency, index) => playTone(ctx, frequency, now + index * 0.11, 0.22, 0.06, 'triangle'))
  } catch { /* 音が出せなくても クリアは クリア。 */ }
}
