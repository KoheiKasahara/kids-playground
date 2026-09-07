/**
 * クイズの正解・不正解、パネルめくりの手触りを知らせる効果音を Web Audio API で合成する。
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

/** 音を鳴らすかどうか。将来 UI から ON/OFF できるようにするための切り替えフラグ（既定は ON）。 */
let soundEnabled = true

/** サウンドの ON/OFF を切り替える。false にすると、以降すべての play* 関数が即座に何もしなくなる。 */
export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled
}

/** 現在サウンドが有効かどうかを返す。 */
export function isSoundEnabled(): boolean {
  return soundEnabled
}

function getAudioContext(): AudioContext | undefined {
  const Ctor = getAudioContextConstructor()
  if (!Ctor) return undefined
  if (!sharedContext) {
    try {
      sharedContext = new Ctor()
    } catch {
      return undefined
    }
  }
  if (sharedContext.state === 'suspended') {
    // クリックなどのユーザー操作中に呼ばれるため resume() は許可される想定だが、
    // 環境によっては拒否されることがあるので失敗しても無視する。
    sharedContext.resume().catch(() => {})
  }
  return sharedContext
}

/**
 * 共有 AudioContext をそのまま取得したいゲーム側モジュール（つみきボウリング等）向けの窓口。
 * iOSで複数のAudioContextを作らないため、各ゲームは必ずこれを使い回し、
 * 自前で `new AudioContext()` しないこと。挙動はgetAudioContextと同じ
 * （非対応環境ではundefined、既存の共有インスタンスをresumeして返す）。
 */
export function getSharedAudioContext(): AudioContext | undefined {
  return getAudioContext()
}

/**
 * AudioContext を用意して resume するだけの関数。
 * iOS Safari は「ユーザー操作イベントの中で最初に AudioContext を作る/resume する」ことを
 * 要求するため、パネルタップや選択肢クリックなどのイベントハンドラの先頭で呼んでおく。
 * setTimeout 経由で少し後から鳴らす音（パネルの連続めくりなど）も、ここで先に
 * resume 済みにしておくことで iOS でも確実に鳴るようにする。
 */
export function primeAudio(): void {
  if (!soundEnabled) return
  getAudioContext()
}

export function playTone(
  ctx: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  volume: number,
  type: OscillatorType,
): void {
  const tone = createToneNodes(ctx, frequency, startTime, duration, volume, type)
  tone.oscillator.start(startTime)
  tone.oscillator.stop(startTime + duration)
}

export function createToneNodes(
  ctx: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  volume: number,
  type: OscillatorType,
): { oscillator: OscillatorNode; gain: GainNode } {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = type
  oscillator.frequency.value = frequency
  gain.gain.setValueAtTime(0, startTime)
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.02)
  gain.gain.linearRampToValueAtTime(0, startTime + duration)
  oscillator.connect(gain)
  gain.connect(ctx.destination)
  return { oscillator, gain }
}

