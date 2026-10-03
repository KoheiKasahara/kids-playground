/**
 * クイズの正解・不正解、パネルめくりの手触りを知らせる効果音を Web Audio API で合成する。
 * 音声ファイルを追加せず標準APIだけで鳴らすことで、アセット追加やライセンスの心配なしに
 * オフライン（PWA）でも確実に再生できるようにする。
 * Web Audio 非対応環境（一部ブラウザやテスト環境の jsdom）では何もしない。
 *
 * すべての音は ctx.destination ではなく getSoundOutput(ctx) へつなぐ。
 * ここでゲームごとの音量補正（gameSoundLevels.ts）と音割れ防止のリミッターをかけ、
 * どのゲームでも同じくらいの大きさで聞こえるようにしている。
 */
import { gameSoundLevelDb } from './gameSoundLevels'

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

// ---- 共通の出口（音量補正 + リミッター） ---------------------------------------

/** 出口のリミッター。重なった音で波形が割れるのを防ぐためのもので、ふだんの音量はほぼ変えない。 */
const LIMITER = { threshold: -6, knee: 6, ratio: 12, attack: 0.003, release: 0.2 } as const

/** AudioContext ごとの共通の出口（音量補正をかける GainNode）。ピアノのように自前の Context を持つゲームもある。 */
const soundOutputs = new Map<AudioContext, GainNode>()
let activeGameId: string | undefined

function dbToGain(db: number): number {
  return 10 ** (db / 20)
}

/**
 * 効果音・BGMをつなぐ共通の出口。ゲーム側は `ctx.destination` へ直接つながず、必ずここへつなぐ。
 * AudioContextごとに1組だけ作り、遊んでいるゲームの音量補正をここで一括してかける。
 * 古いブラウザやテスト用のモックでノードを作れないときは destination をそのまま返す。
 */
export function getSoundOutput(ctx: AudioContext): AudioNode {
  const existing = soundOutputs.get(ctx)
  if (existing) return existing
  try {
    const input = ctx.createGain()
    input.gain.value = dbToGain(gameSoundLevelDb(activeGameId))
    let limiter: DynamicsCompressorNode | undefined
    try {
      limiter = ctx.createDynamicsCompressor()
      limiter.threshold.value = LIMITER.threshold
      limiter.knee.value = LIMITER.knee
      limiter.ratio.value = LIMITER.ratio
      limiter.attack.value = LIMITER.attack
      limiter.release.value = LIMITER.release
    } catch {
      limiter = undefined
    }
    if (limiter) {
      input.connect(limiter)
      limiter.connect(ctx.destination)
    } else {
      input.connect(ctx.destination)
    }
    for (const [context] of soundOutputs) if (context.state === 'closed') soundOutputs.delete(context)
    soundOutputs.set(ctx, input)
    return input
  } catch {
    return ctx.destination
  }
}

/**
 * 遊んでいるゲームを伝え、そのゲームの音量補正を共通の出口へ反映する。
 * App が画面遷移のたびに呼ぶので、ゲーム側から呼ぶ必要はない。ゲーム外（ホーム）では undefined。
 */
export function setActiveSoundGame(gameId: string | undefined): void {
  activeGameId = gameId
  const gain = dbToGain(gameSoundLevelDb(gameId))
  for (const input of soundOutputs.values()) {
    try {
      input.gain.value = gain
    } catch {
      // 閉じた Context などで設定できなくても、画面遷移は止めない。
    }
  }
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
  gain.connect(getSoundOutput(ctx))
  return { oscillator, gain }
}


let noiseBuffer: AudioBuffer | undefined

/**
 * 「さらさら」「しゃっ」のようなザラついた短い音（ホワイトノイズをフィルタに通したもの）。
 * すなやローラーのように音程のない音を、音声ファイルなしで鳴らすために使う。
 * ノイズのバッファは1回だけ作って使い回す。
 */
export function playNoiseBurst(
  ctx: AudioContext,
  startTime: number,
  duration: number,
  volume: number,
  filterType: BiquadFilterType,
  frequency: number,
): void {
  if (!noiseBuffer || noiseBuffer.sampleRate !== ctx.sampleRate) {
    noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  const source = ctx.createBufferSource()
  source.buffer = noiseBuffer
  const filter = ctx.createBiquadFilter()
  filter.type = filterType
  filter.frequency.value = frequency
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, startTime)
  gain.gain.linearRampToValueAtTime(volume, startTime + Math.min(0.02, duration / 3))
  gain.gain.linearRampToValueAtTime(0, startTime + duration)
  source.connect(filter)
  filter.connect(gain)
  gain.connect(getSoundOutput(ctx))
  source.start(startTime, Math.random() * 0.3)
  source.stop(startTime + duration)
}
