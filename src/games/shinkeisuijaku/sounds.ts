import { getSharedAudioContext, isSoundEnabled, playTone } from '../../audio/sound'

/** カードをめくった「ポン」。連打で何度も鳴るので短く軽い音にする。 */
export function playCardFlipSound(): void {
  if (!isSoundEnabled()) return
  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    playTone(ctx, 700, ctx.currentTime, 0.1, 0.08, 'triangle')
  } catch {
    /* 音が出せなくても めくる操作は続けられる。 */
  }
}

/** ペアが揃った「キラーン」。2音の上行で達成感を出す。 */
export function playCardMatchSound(): void {
  if (!isSoundEnabled()) return
  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    playTone(ctx, 659.25, now, 0.14, 0.12, 'triangle')
    playTone(ctx, 987.77, now + 0.08, 0.22, 0.1, 'sine')
  } catch {
    /* 音が出せなくても そろったことは画面でわかる。 */
  }
}

/** ちがったときの「ふわっ」と下がる2音。責めない柔らかい音にする。 */
export function playCardMismatchSound(): void {
  if (!isSoundEnabled()) return
  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    playTone(ctx, 392, now, 0.14, 0.06, 'sine')
    playTone(ctx, 294, now + 0.1, 0.18, 0.05, 'sine')
  } catch {
    /* 音が出せなくても もう一度めくれる。 */
  }
}

/** 全ペアが揃った「できた！」のファンファーレ。 */
export function playAllMatchedSound(): void {
  if (!isSoundEnabled()) return
  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    const frequencies = [523.25, 659.25, 783.99, 1046.5]
    frequencies.forEach((frequency, index) => {
      playTone(ctx, frequency, now + index * 0.11, 0.32, 0.18, 'triangle')
    })
    playTone(ctx, 2093, now + 0.34, 0.42, 0.08, 'sine')
  } catch {
    /* 音が出せなくても、できた！の表示は出る。 */
  }
}
