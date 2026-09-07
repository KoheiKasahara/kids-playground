import { getSharedAudioContext, isSoundEnabled, playTone } from '../../audio/sound'

/**
 * ぷかぷかレスキューの「みずをふやす／へらす」。
 * ボタンを押したことが分かる短いポチャッという1音だけを鳴らす。
 * 押しっぱなしのあいだ鳴り続けるとうるさいため、連打防止の間隔を長めに取る。
 */
const PUKUPUKA_WATER_SOUND_MIN_INTERVAL_MS = 220
let lastPukupukaWaterSoundAt: number | null = null

export function playPukupukaWaterSound(direction: 'fill' | 'drain'): void {
  if (!isSoundEnabled()) return

  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    const wallClockNow = Date.now()
    if (
      lastPukupukaWaterSoundAt !== null
      && wallClockNow - lastPukupukaWaterSoundAt < PUKUPUKA_WATER_SOUND_MIN_INTERVAL_MS
    ) return
    lastPukupukaWaterSoundAt = wallClockNow

    const now = ctx.currentTime
    // 増やすときは上がる2音、減らすときは下がる2音にして、音だけでも向きが分かるようにする。
    const [first, second] = direction === 'fill' ? [523.25, 783.99] : [659.25, 392.0]
    playTone(ctx, first, now, 0.1, 0.07, 'sine')
    playTone(ctx, second, now + 0.05, 0.12, 0.06, 'sine')
  } catch {
    // 音が出せない環境でも水位の操作はそのまま続ける。
  }
}

/** ぷかぷかレスキューの仕掛け操作。仕掛けごとに違う短音で結果を返す。 */
export function playPukupukaActionSound(kind: 'gate' | 'board' | 'wheel'): void {
  if (!isSoundEnabled()) return

  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    if (kind === 'gate') {
      playTone(ctx, 330, now, 0.09, 0.07, 'square')
      playTone(ctx, 440, now + 0.06, 0.12, 0.06, 'triangle')
    } else if (kind === 'board') {
      playTone(ctx, 659.25, now, 0.08, 0.06, 'triangle')
      playTone(ctx, 523.25, now + 0.055, 0.11, 0.06, 'triangle')
    } else {
      playTone(ctx, 392, now, 0.09, 0.055, 'sine')
      playTone(ctx, 523.25, now + 0.07, 0.14, 0.06, 'sine')
    }
  } catch {
    // 音を出せない環境でも仕掛けの操作はそのまま続ける。
  }
}

/** ぷかぷかレスキューのゴール。短い上昇アルペジオ1回だけ。 */
const PUKUPUKA_GOAL_SOUND_MIN_INTERVAL_MS = 600
let lastPukupukaGoalSoundAt: number | null = null

export function playPukupukaGoalSound(): void {
  if (!isSoundEnabled()) return

  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    const wallClockNow = Date.now()
    if (
      lastPukupukaGoalSoundAt !== null
      && wallClockNow - lastPukupukaGoalSoundAt < PUKUPUKA_GOAL_SOUND_MIN_INTERVAL_MS
    ) return
    lastPukupukaGoalSoundAt = wallClockNow

    const now = ctx.currentTime
    playTone(ctx, 587.33, now, 0.14, 0.09, 'triangle')
    playTone(ctx, 739.99, now + 0.08, 0.14, 0.09, 'triangle')
    playTone(ctx, 880.0, now + 0.16, 0.3, 0.1, 'sine')
    playTone(ctx, 1174.66, now + 0.24, 0.28, 0.06, 'sine')
  } catch {
    // 音が出せない環境でもゴール表示はそのまま出す。
  }
}

