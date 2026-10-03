import { getSharedAudioContext, isSoundEnabled, playNoiseBurst, playTone } from '../../audio/sound'
import type { MarbleEvent } from './marbleWorld'

/**
 * ビーだまコースの効果音。共有 AudioContext で合成し、音源ファイルは持たない。
 * つくる（おく・つなぐ・まわす・けす）と、ころがす（しかけ・ゴール）の両方に音をつける。
 */

// ドラッグや連打で同じ音が重なりすぎないよう、音ごとに最小間隔を持つ。
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

/** パーツを ボードに おいた「ことっ」。 */
export function playMarblePlaceSound(): void {
  if (!ready('place', 60)) return
  const ctx = audio()
  if (!ctx) return
  const now = ctx.currentTime
  playTone(ctx, 330, now, 0.07, 0.16, 'triangle')
  playTone(ctx, 494, now + 0.03, 0.08, 0.1, 'sine')
}

/** みちが つながった「カチッ」。 */
export function playMarbleSnapSound(): void {
  if (!ready('snap', 60)) return
  const ctx = audio()
  if (!ctx) return
  const now = ctx.currentTime
  playTone(ctx, 880, now, 0.06, 0.1, 'triangle')
  playTone(ctx, 1320, now + 0.05, 0.1, 0.08, 'sine')
}

/** パーツを まわした「くるっ」。 */
export function playMarbleRotateSound(): void {
  if (!ready('rotate', 60)) return
  const ctx = audio()
  if (!ctx) return
  const now = ctx.currentTime
  playTone(ctx, 523.25, now, 0.06, 0.08, 'sine')
  playTone(ctx, 698.46, now + 0.05, 0.08, 0.08, 'sine')
}

/** パーツを けした・もどした「しゅっ」。 */
export function playMarbleEraseSound(): void {
  if (!ready('erase', 60)) return
  const ctx = audio()
  if (!ctx) return
  const now = ctx.currentTime
  playNoiseBurst(ctx, now, 0.12, 0.1, 'highpass', 2500)
  playTone(ctx, 620, now, 0.1, 0.06, 'sine')
  playTone(ctx, 410, now + 0.06, 0.1, 0.05, 'sine')
}

/** ビーだまを はなした「ころころ」。 */
export function playMarbleRollSound(): void {
  const ctx = audio()
  if (!ctx) return
  const now = ctx.currentTime
  ;[784, 659.25, 784, 987.77].forEach((frequency, index) => playTone(ctx, frequency, now + index * 0.07, 0.08, 0.09, 'triangle'))
}

/** ころがっているあいだの しかけの音。とぶ・おちる・かそく・くるくるで 音を変える。 */
export function playMarbleEventSound(kind: MarbleEvent['kind']): void {
  if (!ready(`event-${kind}`, 90)) return
  const ctx = audio()
  if (!ctx) return
  const now = ctx.currentTime
  switch (kind) {
    case 'takeoff':
      playTone(ctx, 523.25, now, 0.08, 0.09, 'sine')
      playTone(ctx, 1046.5, now + 0.06, 0.12, 0.08, 'sine')
      break
    case 'land':
      playTone(ctx, 262, now, 0.09, 0.2, 'triangle')
      playNoiseBurst(ctx, now, 0.06, 0.09, 'lowpass', 1200)
      break
    case 'boost':
      ;[440, 660, 880].forEach((frequency, index) => playTone(ctx, frequency, now + index * 0.04, 0.08, 0.08, 'triangle'))
      break
    case 'hit':
    default:
      playTone(ctx, 1174.66, now, 0.07, 0.07, 'triangle')
      break
  }
}

/** ゴールの ファンファーレ。 */
export function playMarbleGoalSound(): void {
  const ctx = audio()
  if (!ctx) return
  const now = ctx.currentTime
  ;[523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => playTone(ctx, frequency, now + index * 0.1, 0.24, 0.19, 'triangle'))
  playTone(ctx, 1567.98, now + 0.4, 0.3, 0.08, 'sine')
}

/** ビーだまが とちゅうで おちた「あれれ」。こわがらせないよう やさしく下がる。 */
export function playMarbleMissSound(): void {
  const ctx = audio()
  if (!ctx) return
  const now = ctx.currentTime
  playTone(ctx, 587.33, now, 0.14, 0.09, 'sine')
  playTone(ctx, 440, now + 0.13, 0.2, 0.08, 'sine')
}
