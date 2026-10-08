import { getSharedAudioContext, getSoundOutput, isSoundEnabled, playNoiseBurst, playTone } from '../../audio/sound'

/**
 * くるくる ろくろ の こうかおん。おとの ファイルは つかわず Web Audio で その場で つくる。
 * ねんどの「ぬるっ」、ふでの「さらさら」、かまの「ごうごう」、やきあがりの「チーン」など。
 */

function context(): AudioContext | undefined {
  if (!isSoundEnabled()) return undefined
  try {
    return getSharedAudioContext()
  } catch {
    return undefined
  }
}

function glide(ctx: AudioContext, from: number, to: number, start: number, duration: number, volume: number, type: OscillatorType) {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(from, start)
  oscillator.frequency.exponentialRampToValueAtTime(to, start + duration)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  oscillator.connect(gain).connect(getSoundOutput(ctx))
  oscillator.start(start)
  oscillator.stop(start + duration + 0.02)
}

/** ねんどを おしている「ぬるっ」。widen は ふとく している とき。 */
export function playSculptSound(widen: boolean): void {
  const ctx = context()
  if (!ctx) return
  try {
    const now = ctx.currentTime
    playNoiseBurst(ctx, now, 0.16, 0.3, 'lowpass', widen ? 900 : 700)
    glide(ctx, widen ? 220 : 300, widen ? 300 : 210, now, 0.14, 0.12, 'triangle')
  } catch { /* おとが でなくても かたちは 見える。 */ }
}

/** のばす「ぐいーん」／つぶす「むぎゅっ」。 */
export function playStretchSound(direction: 1 | -1): void {
  const ctx = context()
  if (!ctx) return
  try {
    const now = ctx.currentTime
    if (direction === 1) glide(ctx, 260, 620, now, 0.26, 0.11, 'triangle')
    else glide(ctx, 520, 200, now, 0.22, 0.11, 'triangle')
    playNoiseBurst(ctx, now, 0.12, 0.06, 'lowpass', 600)
  } catch { /* おとは おまけ。 */ }
}

/** いろや ふでを えらんだ ときの かるい おと。 */
export function playSelectSound(step = 0): void {
  const ctx = context()
  if (!ctx) return
  try {
    playTone(ctx, 660 * 2 ** ((step % 12) / 12), ctx.currentTime, 0.08, 0.07, 'triangle')
  } catch { /* おとは おまけ。 */ }
}

/** うつわ ぜんたいを うわぐすりに つけた「とぷん」。 */
export function playDipSound(): void {
  const ctx = context()
  if (!ctx) return
  try {
    const now = ctx.currentTime
    glide(ctx, 900, 300, now, 0.18, 0.12, 'sine')
    glide(ctx, 500, 760, now + 0.12, 0.14, 0.07, 'sine')
  } catch { /* おとは おまけ。 */ }
}

/** ふでで かいている「さらさら」。 */
export function playPaintSound(): void {
  const ctx = context()
  if (!ctx) return
  try {
    playNoiseBurst(ctx, ctx.currentTime, 0.14, 0.16, 'bandpass', 2600)
  } catch { /* おとは おまけ。 */ }
}

/** もどす・さいしょから の「しゅっ」。 */
export function playUndoSound(): void {
  const ctx = context()
  if (!ctx) return
  try {
    const now = ctx.currentTime
    playNoiseBurst(ctx, now, 0.14, 0.1, 'highpass', 1500)
    playTone(ctx, 520, now, 0.1, 0.05, 'triangle')
  } catch { /* おとは おまけ。 */ }
}

/** かまの「ごうごう」。やいている あいだ（約 2.5びょう）なる。 */
export function playKilnSound(): void {
  const ctx = context()
  if (!ctx) return
  try {
    const now = ctx.currentTime
    for (let i = 0; i < 6; i++) playNoiseBurst(ctx, now + 0.5 + i * 0.32, 0.45, 0.16, 'lowpass', 260 + (i % 2) * 80)
    glide(ctx, 70, 110, now + 0.5, 1.9, 0.07, 'sawtooth')
  } catch { /* おとは おまけ。 */ }
}

/** やきあがり「チーン♪」。stars は おだいの ★（じゆうのときは 0）。 */
export function playDoneSound(stars = 0): void {
  const ctx = context()
  if (!ctx) return
  try {
    const now = ctx.currentTime
    playTone(ctx, 1568, now, 0.6, 0.09, 'sine')
    playTone(ctx, 3136, now, 0.3, 0.03, 'sine')
    const notes = stars >= 3 ? [523, 659, 784, 1047, 1319] : [523, 659, 784, 1047]
    notes.forEach((note, index) => playTone(ctx, note, now + 0.45 + index * 0.1, index === notes.length - 1 ? 0.4 : 0.14, 0.12, 'triangle'))
  } catch { /* おとが なくても できあがりは 見える。 */ }
}

/** たなに かざった「ことん」。 */
export function playShelfSound(): void {
  const ctx = context()
  if (!ctx) return
  try {
    const now = ctx.currentTime
    glide(ctx, 420, 300, now, 0.12, 0.12, 'sine')
    playNoiseBurst(ctx, now, 0.05, 0.1, 'bandpass', 1800)
    playTone(ctx, 880, now + 0.12, 0.2, 0.07, 'triangle')
  } catch { /* おとは おまけ。 */ }
}
