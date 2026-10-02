import { getSharedAudioContext, isSoundEnabled, playTone } from '../../audio/sound'

/**
 * サーキットレースの効果音（Issue #784 A8）。音声ファイルを使わず Web Audio で合成する。
 * 共有 AudioContext を使い回し、ゲームを出るときも close はしない（audio/sound の方針）。
 */

/** レース開始の「ピッ・ピッ・ポーン」。 */
export function playRaceStartSound(): void {
  if (!isSoundEnabled()) return
  const ctx = getSharedAudioContext()
  if (!ctx) return
  const now = ctx.currentTime
  playTone(ctx, 660, now, 0.12, 0.08, 'square')
  playTone(ctx, 660, now + 0.35, 0.12, 0.08, 'square')
  playTone(ctx, 1320, now + 0.7, 0.4, 0.09, 'square')
}

/** かそくボタンの「ブォン！」。低い音から一気に上がる。 */
export function playBoostSound(): void {
  if (!isSoundEnabled()) return
  const ctx = getSharedAudioContext()
  if (!ctx) return
  const now = ctx.currentTime
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = 'sawtooth'
  oscillator.frequency.setValueAtTime(110, now)
  oscillator.frequency.exponentialRampToValueAtTime(440, now + 0.35)
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(0.07, now + 0.03)
  gain.gain.linearRampToValueAtTime(0, now + 0.4)
  oscillator.connect(gain)
  gain.connect(ctx.destination)
  oscillator.start(now)
  oscillator.stop(now + 0.42)
}

/** スペシャル発動の「キラキラーン」。 */
export function playSpecialSound(): void {
  if (!isSoundEnabled()) return
  const ctx = getSharedAudioContext()
  if (!ctx) return
  const now = ctx.currentTime
  ;[784, 988, 1175, 1568].forEach((frequency, i) => {
    playTone(ctx, frequency, now + i * 0.07, 0.22, 0.06, 'triangle')
  })
}

export type EngineHum = {
  /** うなり音を鳴らし始める（すでに鳴っていれば何もしない）。 */
  start(): void
  /** ふわっと小さくして止める。 */
  stop(): void
  /** かそく中は音を高く・大きくする。 */
  rev(): void
}

/**
 * 走っているあいだ小さく鳴り続けるエンジンのうなり。
 * 低いのこぎり波を2つ重ねてローパスでまるめ、ゆっくり揺らして「ブーン」と聞こえるようにする。
 */
export function createEngineHum(): EngineHum {
  let nodes: { oscillators: OscillatorNode[]; lfo: OscillatorNode; gain: GainNode; ctx: AudioContext } | null = null
  const BASE_VOLUME = 0.035

  function start() {
    if (nodes || !isSoundEnabled()) return
    const ctx = getSharedAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(BASE_VOLUME, now + 0.4)
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 420
    filter.connect(gain)
    gain.connect(ctx.destination)

    const oscillators = [72, 108].map((frequency) => {
      const oscillator = ctx.createOscillator()
      oscillator.type = 'sawtooth'
      oscillator.frequency.value = frequency
      oscillator.connect(filter)
      oscillator.start(now)
      return oscillator
    })
    // エンジンの回転の揺れ。周波数を少しだけ上下させる。
    const lfo = ctx.createOscillator()
    const lfoGain = ctx.createGain()
    lfo.frequency.value = 7
    lfoGain.gain.value = 6
    lfo.connect(lfoGain)
    oscillators.forEach((oscillator) => lfoGain.connect(oscillator.frequency))
    lfo.start(now)
    nodes = { oscillators, lfo, gain, ctx }
  }

  function stop() {
    if (!nodes) return
    const { oscillators, lfo, gain, ctx } = nodes
    nodes = null
    const now = ctx.currentTime
    try {
      gain.gain.cancelScheduledValues(now)
      gain.gain.setValueAtTime(gain.gain.value, now)
      gain.gain.linearRampToValueAtTime(0, now + 0.25)
      oscillators.forEach((oscillator) => oscillator.stop(now + 0.3))
      lfo.stop(now + 0.3)
    } catch {
      // すでに止まっているノードは無視する。
    }
  }

  function rev() {
    if (!nodes) return
    const { oscillators, gain, ctx } = nodes
    const now = ctx.currentTime
    oscillators.forEach((oscillator, i) => {
      const base = i === 0 ? 72 : 108
      oscillator.frequency.cancelScheduledValues(now)
      oscillator.frequency.setValueAtTime(base * 1.8, now)
      oscillator.frequency.linearRampToValueAtTime(base, now + 1.2)
    })
    gain.gain.cancelScheduledValues(now)
    gain.gain.setValueAtTime(BASE_VOLUME * 1.8, now)
    gain.gain.linearRampToValueAtTime(BASE_VOLUME, now + 1.2)
  }

  return { start, stop, rev }
}
