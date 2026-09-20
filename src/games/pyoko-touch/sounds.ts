import { getSharedAudioContext, isSoundEnabled, playTone } from '../../audio/sound'

/** なかまをつかまえた「ぴこん」。連続で鳴るので短く軽い2音にする。 */
export function playCatchSound(): void {
  if (!isSoundEnabled()) return
  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    playTone(ctx, 784, now, 0.1, 0.1, 'triangle')
    playTone(ctx, 1174.66, now + 0.06, 0.16, 0.08, 'sine')
  } catch {
    /* 音が出せなくても、つかまえたことは画面でわかる。 */
  }
}

/** はちにさわったときの「ふわっ」と下がる音。責めない柔らかさにする。 */
export function playOopsSound(): void {
  if (!isSoundEnabled()) return
  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    playTone(ctx, 349.23, now, 0.14, 0.06, 'sine')
    playTone(ctx, 261.63, now + 0.1, 0.2, 0.05, 'sine')
  } catch {
    /* 音が出せなくても、点が もどったことは画面でわかる。 */
  }
}

/** じかん切れの「できた！」。結果表示にあわせて鳴らす。 */
export function playFinishSound(): void {
  if (!isSoundEnabled()) return
  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    const frequencies = [523.25, 659.25, 783.99, 1046.5]
    frequencies.forEach((frequency, index) => {
      playTone(ctx, frequency, now + index * 0.12, 0.32, 0.16, 'triangle')
    })
  } catch {
    /* 音が出せなくても、結果は画面に出る。 */
  }
}
