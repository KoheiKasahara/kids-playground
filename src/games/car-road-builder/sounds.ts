import { getSharedAudioContext, isSoundEnabled, playNoiseBurst, playTone } from '../../audio/sound'

/**
 * くるまのみちづくり の、みちを つくるときの効果音。出発・ゴール・走行音は utils/quizSound を使う。
 * 共有 AudioContext で合成し、音源ファイルは持たない。音が出せなくても文字と絵で結果がわかる。
 */

export type RoadEditSound = 'place' | 'move' | 'rotate' | 'remove' | 'nope'

// ドラッグや連打で同じ音が重なりすぎないよう、最小間隔を持つ。
let lastPlayedAt = -Infinity

export function playRoadEditSound(kind: RoadEditSound): void {
  if (!isSoundEnabled()) return
  const nowMs = Date.now()
  if (nowMs - lastPlayedAt < 50) return
  lastPlayedAt = nowMs
  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    switch (kind) {
      case 'place':
        // みちを おいた「ことっ」。
        playTone(ctx, 392, now, 0.07, 0.15, 'triangle')
        playTone(ctx, 587.33, now + 0.04, 0.09, 0.1, 'sine')
        break
      case 'move':
        // みちを うごかした「すっ」。
        playNoiseBurst(ctx, now, 0.08, 0.07, 'bandpass', 2200)
        playTone(ctx, 523.25, now + 0.03, 0.09, 0.11, 'sine')
        break
      case 'rotate':
        // みちを まわした「くるっ」。
        playTone(ctx, 523.25, now, 0.06, 0.1, 'sine')
        playTone(ctx, 783.99, now + 0.05, 0.08, 0.1, 'sine')
        break
      case 'remove':
        // みちを けした「しゅっ」。
        playNoiseBurst(ctx, now, 0.12, 0.09, 'highpass', 2500)
        playTone(ctx, 587.33, now, 0.08, 0.07, 'sine')
        playTone(ctx, 392, now + 0.06, 0.1, 0.06, 'sine')
        break
      case 'nope':
      default:
        // おけない ばしょ。こわがらせない やわらかい「ぷっ」。
        playTone(ctx, 330, now, 0.1, 0.1, 'sine')
        playTone(ctx, 262, now + 0.09, 0.12, 0.09, 'sine')
        break
    }
  } catch {
    // 音が出せなくても、みちは つくれる。
  }
}
