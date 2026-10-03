import { getSharedAudioContext, isSoundEnabled, playNoiseBurst, playTone } from '../../audio/sound'

/**
 * どうぶつのおふろ の効果音。共有 AudioContext で合成し、音源ファイルは持たない。
 * せっけん＝あわが「ぷくっ」、シャワー＝「じゃぶっ」、タオル＝「ふきっ」と、道具ごとに音を変える。
 * 音が出せなくても、泡・しずく・きらきらの絵で進み具合がわかる。
 */

// なでているあいだ鳴りっぱなしにならないよう、音ごとに最小間隔を持つ。
const lastPlayed = new Map<string, number>()
function ready(kind: string, intervalMs: number): boolean {
  const now = Date.now()
  if ((lastPlayed.get(kind) ?? -Infinity) + intervalMs > now) return false
  lastPlayed.set(kind, now)
  return true
}

function audio(): AudioContext | undefined {
  if (!isSoundEnabled()) return undefined
  return getSharedAudioContext()
}

/** ドレミソラ。きれいになった数だけ一段ずつ上がり、あと少しが音でもわかる。 */
const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98]

/** なでているあいだの「ごしごし」「しゃー」「ふきふき」。小さく短く、間引いて鳴らす。 */
export function playBathRubSound(step: number): void {
  if (!ready('rub', 150)) return
  try {
    const ctx = audio()
    if (!ctx) return
    const now = ctx.currentTime
    if (step === 0) playNoiseBurst(ctx, now, 0.09, 0.12, 'bandpass', 1800 + Math.random() * 600)
    else if (step === 1) playNoiseBurst(ctx, now, 0.12, 0.1, 'highpass', 3500)
    else playNoiseBurst(ctx, now, 0.1, 0.12, 'lowpass', 1200)
  } catch { /* 音が出せなくても あらえる。 */ }
}

/** よごれが1か所きれいになった音。道具ごとの手ざわりの音に、だんだん上がる音程を重ねる。 */
export function playBathCleanSound(step: number, cleanedCount: number): void {
  try {
    const ctx = audio()
    if (!ctx) return
    const now = ctx.currentTime
    const note = PENTATONIC[Math.max(0, Math.min(PENTATONIC.length - 1, cleanedCount - 1))]
    if (step === 0) {
      // あわが「ぷくっ」とふくらむ。
      playTone(ctx, note * 0.75, now, 0.06, 0.11, 'sine')
      playTone(ctx, note * 1.5, now + 0.04, 0.09, 0.1, 'sine')
    } else if (step === 1) {
      // しずくが「じゃぶっ」と流れる。
      playNoiseBurst(ctx, now, 0.16, 0.12, 'bandpass', 900)
      playTone(ctx, note, now + 0.03, 0.12, 0.11, 'triangle')
    } else {
      // タオルで「ふきっ」とふいて、きらっと光る。
      playNoiseBurst(ctx, now, 0.08, 0.07, 'highpass', 2500)
      playTone(ctx, note * 2, now + 0.05, 0.14, 0.08, 'sine')
    }
  } catch { /* 音が出せなくても あらえる。 */ }
}

/** ひとつの道具の番がおわった「できた！」。 */
export function playBathStepDoneSound(): void {
  try {
    const ctx = audio()
    if (!ctx) return
    const now = ctx.currentTime
    ;[659.25, 783.99, 1046.5].forEach((frequency, index) => playTone(ctx, frequency, now + index * 0.09, 0.2, 0.14, 'triangle'))
  } catch { /* 音が出せなくても つぎへ すすめる。 */ }
}

/** ぜんぶおわって「ぴかぴか！」。のぼる和音にきらきらを重ねる。 */
export function playBathFinishSound(): void {
  try {
    const ctx = audio()
    if (!ctx) return
    const now = ctx.currentTime
    ;[523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => playTone(ctx, frequency, now + index * 0.11, 0.3, 0.17, 'triangle'))
    ;[1567.98, 2093, 2637].forEach((frequency, index) => playTone(ctx, frequency, now + 0.45 + index * 0.07, 0.25, 0.06, 'sine'))
  } catch { /* 音が出せなくても おしまいの絵は出る。 */ }
}

/** どうぶつや つぎの道具を えらんだときの、かるい「ぽん」。 */
export function playBathSelectSound(): void {
  if (!ready('select', 80)) return
  try {
    const ctx = audio()
    if (!ctx) return
    const now = ctx.currentTime
    playTone(ctx, 660, now, 0.08, 0.1, 'sine')
    playTone(ctx, 990, now + 0.05, 0.1, 0.085, 'sine')
  } catch { /* 音が出せなくても えらべる。 */ }
}
