import { getSharedAudioContext, isSoundEnabled, playTone } from '../../audio/sound'

/** ペンタトニック（ソ・ラ・ド・レ・ミ）の半音位置。どの順番で鳴っても濁らない。 */
const PENTATONIC_STEPS = [0, 2, 5, 7, 9]
const PENTATONIC_ROOT = 196 // G3
/** いちばん星の多いせいざ（22こ）でも、さいごまで音が上がりつづける数。 */
const PENTATONIC_LENGTH = 22

/** 低めのソから上へたどる音。 */
const PENTATONIC = Array.from({ length: PENTATONIC_LENGTH }, (_, index) => {
  const octave = Math.floor(index / PENTATONIC_STEPS.length)
  const semitone = PENTATONIC_STEPS[index % PENTATONIC_STEPS.length]! + octave * 12
  return PENTATONIC_ROOT * 2 ** (semitone / 12)
})

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
