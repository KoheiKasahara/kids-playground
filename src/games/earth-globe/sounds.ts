import { getSharedAudioContext, isSoundEnabled, playTone } from '../../audio/sound'

/**
 * ちきゅうぎ のボタンの効果音。国を選んだ音は utils/quizSound の playGlobeCountrySelectSound。
 * ちかづく＝のぼる音、はなれる＝くだる音、ぜんたい＝ふわっと もどる音にして、向きを耳でもわかるようにする。
 */
export function playGlobeZoomSound(direction: 'in' | 'out' | 'reset'): void {
  if (!isSoundEnabled()) return
  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    const notes = direction === 'in' ? [523.25, 783.99] : direction === 'out' ? [783.99, 523.25] : [659.25, 523.25, 392]
    notes.forEach((frequency, index) => playTone(ctx, frequency, now + index * 0.06, 0.1, 0.05, 'sine'))
  } catch {
    // 音が出せなくても、ちきゅうぎは うごく。
  }
}
