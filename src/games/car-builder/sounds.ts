import { getSharedAudioContext, isSoundEnabled, playNoiseBurst, playTone } from '../../audio/sound'

/**
 * 走行画面の効果音。共有 AudioContext だけを使い、音源ファイルは持たない。
 * 音が出せない環境でも走りは見えるので、失敗しても何もせず先へ進む。
 */

/** 「かそく！」の合図。低い音から高い音へ上げて、ぐんと出る感じにする。 */
export function playDriveBoostSound(): void {
  if (!isSoundEnabled()) return
  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    playTone(ctx, 196, now, 0.12, 0.16, 'sawtooth')
    playTone(ctx, 330, now + 0.08, 0.14, 0.17, 'triangle')
    playTone(ctx, 494, now + 0.18, 0.16, 0.15, 'triangle')
  } catch {
    /* 音が出せなくても くるまは かそくする。 */
  }
}

/** つくる画面で ボタンを ひらく・とじるときの、かるい「ぽん」。 */
export function playCarMenuSound(): void {
  if (!isSoundEnabled()) return
  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    playTone(ctx, 587.33, now, 0.07, 0.1, 'sine')
    playTone(ctx, 880, now + 0.04, 0.09, 0.08, 'sine')
  } catch {
    /* 音が出せなくても えらべる。 */
  }
}

/** パーツや いろを えらんで くるまが かわった「カチャッ」。 */
export function playCarPartSelectSound(): void {
  if (!isSoundEnabled()) return
  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    playNoiseBurst(ctx, now, 0.04, 0.08, 'highpass', 3000)
    playTone(ctx, 660, now, 0.06, 0.12, 'triangle')
    playTone(ctx, 990, now + 0.05, 0.1, 0.1, 'triangle')
  } catch {
    /* 音が出せなくても くるまは かわる。 */
  }
}

/** 「はしる！」で エンジンが かかる「ブルルン」。 */
export function playCarDriveStartSound(): void {
  if (!isSoundEnabled()) return
  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    for (let i = 0; i < 3; i++) playTone(ctx, 110 + i * 8, now + i * 0.07, 0.08, 0.08, 'sawtooth')
    playTone(ctx, 392, now + 0.22, 0.14, 0.1, 'triangle')
    playTone(ctx, 587.33, now + 0.32, 0.2, 0.12, 'triangle')
  } catch {
    /* 音が出せなくても はしれる。 */
  }
}

/** 1しゅう はしった「ピロリン」。 */
export function playCarLapSound(): void {
  if (!isSoundEnabled()) return
  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    ;[783.99, 987.77, 1174.66, 1567.98].forEach((frequency, index) => playTone(ctx, frequency, now + index * 0.08, 0.18, 0.17, 'triangle'))
  } catch {
    /* 音が出せなくても しゅうすうは ふえる。 */
  }
}
