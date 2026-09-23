import { getSharedAudioContext, isSoundEnabled, playTone } from '../../audio/sound'

/** ペンタトニック（ド・レ・ミ・ソ・ラ）を上へたどる音。どの順番で鳴っても濁らない。 */
const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760, 2093]

/** 星をつないだ「きらん」。つないだ数だけ音が上がっていく。 */
export function playConnectSound(order: number): void {
  if (!isSoundEnabled()) return
  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    const frequency = PENTATONIC[Math.min(order, PENTATONIC.length - 1)]!
    playTone(ctx, frequency, now, 0.22, 0.09, 'triangle')
    playTone(ctx, frequency * 2, now + 0.03, 0.14, 0.03, 'sine')
  } catch {
    /* 音が出せなくても、線がのびるので つないだことはわかる。 */
  }
}

/** ちがう星をさわったときの「ぽよん」。責めない柔らかさにする。 */
export function playWrongSound(): void {
  if (!isSoundEnabled()) return
  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    playTone(ctx, 330, now, 0.14, 0.05, 'sine')
    playTone(ctx, 294, now + 0.09, 0.18, 0.04, 'sine')
  } catch {
    /* 音が出せなくても、つぎの星が光って教える。 */
  }
}

/** せいざ ができたときの、きらきら上がっていく和音。 */
export function playCompleteSound(): void {
  if (!isSoundEnabled()) return
  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    ;[783.99, 1046.5, 1318.51, 1567.98, 2093].forEach((frequency, index) => {
      playTone(ctx, frequency, now + index * 0.08, 0.5, 0.08, 'triangle')
    })
  } catch {
    /* 音が出せなくても、形がかがやいて動き出す。 */
  }
}
