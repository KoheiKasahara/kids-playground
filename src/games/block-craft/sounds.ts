import { getSharedAudioContext, isSoundEnabled, playNoiseBurst, playTone } from '../../audio/sound'

export type CraftSound = 'place' | 'remove' | 'select' | 'grow' | 'treasure' | 'complete' | 'pet' | 'step'
  | 'cool' | 'harvest' | 'feed' | 'baby' | 'shear'
  | 'craft' | 'door' | 'fuse' | 'boom' | 'sleep' | 'morning' | 'eat'

/** ふくすうの おとを じゅんばんに ならす（ドレミの ような みじかい フレーズ）。 */
const PHRASES: Partial<Record<CraftSound, readonly number[]>> = {
  grow: [392, 523, 659],
  treasure: [784, 988, 1319],
  complete: [523, 659, 784, 1047],
  pet: [660, 880],
  harvest: [523, 784],
  feed: [587, 740, 880],
  baby: [659, 880, 1047, 1319],
  shear: [988, 740],
  // ようがんが ひえて かたまる「じゅっ」
  cool: [220, 165],
  // トントン キラーン
  craft: [523, 523, 1047, 1319],
  door: [392, 294],
  // おやすみの こもりうた と、あさの めざまし
  sleep: [659, 523, 392],
  morning: [523, 784, 1047],
  eat: [440, 587],
}
const SOFT: readonly CraftSound[] = ['pet', 'feed', 'baby', 'sleep', 'eat']

/** おんぷ ブロックの おと（ド レ ミ ファ ソ ラ シ ド）。 */
export const NOTE_NAMES = ['ド', 'レ', 'ミ', 'ファ', 'ソ', 'ラ', 'シ', 'ド'] as const
const NOTE_FREQUENCIES = [523, 587, 659, 698, 784, 880, 988, 1047] as const
/** たかさで おとが かわる（1だん あがるごとに 1つ たかく、8だんで ひとまわり）。 */
export const noteStep = (y: number) => ((y - 1) % NOTE_NAMES.length + NOTE_NAMES.length) % NOTE_NAMES.length

export function playNote(step: number) {
  if (!isSoundEnabled()) return
  const ctx = getSharedAudioContext()
  if (!ctx) return
  const frequency = NOTE_FREQUENCIES[step] ?? NOTE_FREQUENCIES[0]
  // オルゴールの ような おと（もとの おとと 1オクターブ うえを かさねる）
  playTone(ctx, frequency, ctx.currentTime, 0.4, 0.065, 'sine')
  playTone(ctx, frequency * 2, ctx.currentTime, 0.25, 0.02, 'sine')
}

export function playCraftSound(action: CraftSound) {
  if (!isSoundEnabled()) return
  const ctx = getSharedAudioContext()
  if (!ctx) return
  const phrase = PHRASES[action]
  if (phrase) {
    // おとが かさならないように ならべる（かさなると ほかの おとより おおきく なる）
    const gap = 0.12
    const type = SOFT.includes(action) ? 'sine' : action === 'cool' ? 'square' : 'triangle'
    phrase.forEach((frequency, i) => playTone(ctx, frequency, ctx.currentTime + i * gap, 0.12, action === 'cool' ? 0.05 : 0.08, type))
    return
  }
  if (action === 'fuse') {
    // しゅーっ
    playNoiseBurst(ctx, ctx.currentTime, 0.5, 0.1, 'highpass', 3500)
    return
  }
  if (action === 'boom') {
    // ドカーン（ひくい ざらざらと ひくい おと）
    playNoiseBurst(ctx, ctx.currentTime, 0.6, 0.3, 'lowpass', 700)
    playTone(ctx, 90, ctx.currentTime, 0.45, 0.2, 'sine')
    return
  }
  if (action === 'step') {
    playTone(ctx, 330, ctx.currentTime, 0.08, 0.1, 'triangle')
    return
  }
  const frequency = action === 'place' ? 620 : action === 'remove' ? 260 : 820
  playTone(ctx, frequency, ctx.currentTime, 0.13, 0.13, 'triangle')
}
