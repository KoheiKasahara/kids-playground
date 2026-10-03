import { getSharedAudioContext, isSoundEnabled, playNoiseBurst, playTone } from '../../audio/sound'

/** つなげるたびに 1おとずつ あがる ドレミ（ペンタトニック）。つづけるほど たのしく なる。 */
const COMBO_SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760, 2093]

/** カードを つないだ「ポン」。combo が ふえるほど たかい おとに する。 */
export function playConnectSound(combo: number): void {
  if (!isSoundEnabled()) return
  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    const frequency = COMBO_SCALE[Math.min(COMBO_SCALE.length - 1, Math.max(0, combo - 1))]!
    playTone(ctx, frequency, now, 0.16, 0.13, 'triangle')
    playTone(ctx, frequency * 2, now + 0.03, 0.1, 0.04, 'sine')
  } catch {
    /* 音が出せなくても、カードが うごくので わかる。 */
  }
}

/** したの カードが とれるように なった「キラッ」。 */
export function playFreedSound(): void {
  if (!isSoundEnabled()) return
  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    const now = ctx.currentTime + 0.12
    playTone(ctx, 1975.53, now, 0.08, 0.04, 'sine')
    playTone(ctx, 2637.02, now + 0.06, 0.12, 0.035, 'sine')
  } catch {
    /* 音が出せなくても、カードが ひかるので わかる。 */
  }
}

/** やまを めくった「シュッ・ペラッ」。 */
export function playDrawSound(): void {
  if (!isSoundEnabled()) return
  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    playNoiseBurst(ctx, now, 0.12, 0.08, 'bandpass', 2400)
    playTone(ctx, 440, now + 0.08, 0.1, 0.06, 'triangle')
  } catch {
    /* 音が出せなくても、めくった カードが みえる。 */
  }
}

/** つなげられない カードを さわった「ぷにゅ」。責めない やわらかい おとに する。 */
export function playNopeSound(): void {
  if (!isSoundEnabled()) return
  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    playTone(ctx, 311.13, now, 0.1, 0.06, 'sine')
    playTone(ctx, 261.63, now + 0.08, 0.14, 0.05, 'sine')
  } catch {
    /* 音が出せなくても、カードが ぷるぷる ゆれる。 */
  }
}

/** ぜんぶ つなげた「できた！」の ファンファーレ。 */
export function playClearSound(): void {
  if (!isSoundEnabled()) return
  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    const melody = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5]
    const times = [0, 0.12, 0.24, 0.36, 0.56, 0.68]
    melody.forEach((frequency, index) => {
      playTone(ctx, frequency, now + times[index]!, index === melody.length - 1 ? 0.5 : 0.2, 0.15, 'triangle')
    })
    playTone(ctx, 2093, now + 0.7, 0.5, 0.06, 'sine')
  } catch {
    /* 音が出せなくても、けっかは 画面に でる。 */
  }
}

/** つなげられなく なった「あれれ」。かなしすぎない 2おと。 */
export function playStuckSound(): void {
  if (!isSoundEnabled()) return
  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    playTone(ctx, 523.25, now, 0.18, 0.08, 'sine')
    playTone(ctx, 392, now + 0.18, 0.3, 0.07, 'sine')
  } catch {
    /* 音が出せなくても、けっかは 画面に でる。 */
  }
}
