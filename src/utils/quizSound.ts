/**
 * クイズの正解・不正解を知らせる効果音を Web Audio API で合成する。
 * 音声ファイルを追加せず標準APIだけで鳴らすことで、アセット追加やライセンスの心配なしに
 * オフライン（PWA）でも確実に再生できるようにする。
 * Web Audio 非対応環境（一部ブラウザやテスト環境の jsdom）では何もしない。
 */

type AudioContextConstructor = new () => AudioContext

function getAudioContextConstructor(): AudioContextConstructor | undefined {
  if (typeof window === 'undefined') return undefined
  const withWebkit = window as typeof window & { webkitAudioContext?: AudioContextConstructor }
  return withWebkit.AudioContext ?? withWebkit.webkitAudioContext
}

let sharedContext: AudioContext | undefined

function getAudioContext(): AudioContext | undefined {
  const Ctor = getAudioContextConstructor()
  if (!Ctor) return undefined
  if (!sharedContext) {
    sharedContext = new Ctor()
  }
  if (sharedContext.state === 'suspended') {
    // クリックなどのユーザー操作中に呼ばれるため resume() は許可される想定だが、
    // 環境によっては拒否されることがあるので失敗しても無視する。
    sharedContext.resume().catch(() => {})
  }
  return sharedContext
}

function playTone(
  ctx: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  volume: number,
  type: OscillatorType,
): void {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = type
  oscillator.frequency.value = frequency
  gain.gain.setValueAtTime(0, startTime)
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.02)
  gain.gain.linearRampToValueAtTime(0, startTime + duration)
  oscillator.connect(gain)
  gain.connect(ctx.destination)
  oscillator.start(startTime)
  oscillator.stop(startTime + duration)
}

/** せいかい音「ピンポーン」: 高いラ→低いミ の2音チャイム */
export function playCorrectSound(): void {
  const ctx = getAudioContext()
  if (!ctx) return
  const now = ctx.currentTime
  playTone(ctx, 880, now, 0.25, 0.2, 'sine') // ピン (A5)
  playTone(ctx, 659.25, now + 0.18, 0.35, 0.2, 'sine') // ポーン (E5)
}

/** ふせいかい音「ブブー」: 低い音を2回短く鳴らすブザー */
export function playIncorrectSound(): void {
  const ctx = getAudioContext()
  if (!ctx) return
  const now = ctx.currentTime
  playTone(ctx, 150, now, 0.18, 0.15, 'sawtooth')
  playTone(ctx, 150, now + 0.24, 0.28, 0.15, 'sawtooth')
}
