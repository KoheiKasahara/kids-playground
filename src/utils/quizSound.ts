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
    sharedContext = new Ctor()
  }
  if (sharedContext.state === 'suspended') {
    // クリックなどのユーザー操作中に呼ばれるため resume() は許可される想定だが、
    // 環境によっては拒否されることがあるので失敗しても無視する。
    sharedContext.resume().catch(() => {})
  }
  return sharedContext
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
  if (!soundEnabled) return
  const ctx = getAudioContext()
  if (!ctx) return
  const now = ctx.currentTime
  playTone(ctx, 880, now, 0.25, 0.2, 'sine') // ピン (A5)
  playTone(ctx, 659.25, now + 0.18, 0.35, 0.2, 'sine') // ポーン (E5)
}

/** ふせいかい音「ブブー」: 低い音を2回短く鳴らすブザー */
export function playIncorrectSound(): void {
  if (!soundEnabled) return
  const ctx = getAudioContext()
  if (!ctx) return
  const now = ctx.currentTime
  playTone(ctx, 150, now, 0.18, 0.15, 'sawtooth')
  playTone(ctx, 150, now + 0.24, 0.28, 0.15, 'sawtooth')
}

/**
 * パネルを1枚めくったときの「ポン♪」音。
 * びっくりさせない柔らかい音にするため、低音は避けて 600Hz〜1kHz 帯の一音だけを
 * 短く（130ms）鳴らす。正解音より控えめな音量にしてある。
 */
export function playPanelOpenSound(): void {
  if (!soundEnabled) return
  const ctx = getAudioContext()
  if (!ctx) return
  const now = ctx.currentTime
  playTone(ctx, 740, now, 0.13, 0.12, 'triangle')
}

/** メジャーペンタトニックスケール（ド・レ・ミ・ソ・ラ）の半音オフセット。黒鍵を含まないので不協和になりにくい */
const PENTATONIC_STEPS = [0, 2, 4, 7, 9]
/** playPanelRevealSound の基準周波数（D5） */
const REVEAL_BASE_FREQUENCY = 587.33

/**
 * 正解後（または不正解後の種明かし）に、残りのパネルを連続でめくっていくときの音。
 * 残り枚数（total）に関わらず、burst 全体でペンタトニックスケール1オクターブぶんだけ
 * 均等に駆け上がるよう、step を 0〜1 の進捗率に正規化してからスケールの音数に割り当てる
 * （残りが2枚でも15枚でも、常に587Hz(D5)〜988Hz(B5)程度の範囲に収まり、耳に刺さらない）。
 * 最後の1枚（step === total）だけさらに一段高く鳴らして「見えた！」の達成感を出す。
 * 連続再生されるため、通常のパネル音より小さい音量・短い長さにしてある。
 */
export function playPanelRevealSound(step: number, total: number): void {
  if (!soundEnabled) return
  const ctx = getAudioContext()
  if (!ctx) return
  const safeTotal = Math.max(1, Math.trunc(total))
  const safeStep = Math.min(Math.max(Math.trunc(step), 1), safeTotal)
  const isLast = safeStep >= safeTotal

  const progress = safeTotal > 1 ? (safeStep - 1) / (safeTotal - 1) : 0
  const scaleIndex = Math.round(progress * (PENTATONIC_STEPS.length - 1)) // 0〜4
  const semitones = PENTATONIC_STEPS[scaleIndex] + (isLast ? 5 : 0)
  const frequency = REVEAL_BASE_FREQUENCY * 2 ** (semitones / 12)

  const now = ctx.currentTime
  playTone(ctx, frequency, now, 0.1, 0.08, 'sine')
}
