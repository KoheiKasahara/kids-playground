/**
 * つみきボウリングの効果音（Phase 4）。
 *
 * 「何を鳴らすか」を決める純粋関数（launchTones 等）と、`createBowlingSoundGate` の
 * 多重再生制御は DOM/Web Audio に一切依存させず、そのままテストできるようにしてある。
 * 実際に音を鳴らす部分（createBowlingSoundController）だけが
 * `src/utils/quizSound.ts` の共有 AudioContext を使う。
 *
 * 玉ごとの音の違いがこのゲームの「触感の主役」（Issue #472）:
 * - どっしりだま: 低い「ドン/ゴン」。破壊力を耳でも感じさせる。
 * - はずむだま  : 軽く高めの「ポンッ」。連続バウンドで音程がだんだん上がる。
 * - ちいさいだま: 「シュッ」と駆け上がる短音。3種類でいちばん速い印象を耳でも作る。
 *
 * 幼児向けなので、耳に刺さる2kHz超の音は使わない。積み木がまとめて崩れたときの
 * 「カラカラ」（clatterTones）も、何十個倒れても音を重ねすぎない（最大2音）。
 */

import { getSharedAudioContext, isSoundEnabled } from '../../utils/quizSound'
import type { BowlingBallId } from './bowlingBalls'

export type BowlingTone = {
  frequency: number
  /** 再生開始までの遅延[ms]。複数音を少しずらして重ねるのに使う。 */
  delay: number
  duration: number
  volume: number
  type: OscillatorType
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

// ---------------------------------------------------------------------------
// 「何を鳴らすか」（純粋関数）
// ---------------------------------------------------------------------------

/** 発射音「ビューン」。玉ごとに音色をはっきり変える。 */
export function launchTones(ballId: BowlingBallId, power: number): BowlingTone[] {
  const p = clamp01(power)
  switch (ballId) {
    case 'heavy':
      // どっしり: 低い「ドッ」を1発。パワーで基音と音量がわずかに上がる。
      return [{ frequency: 96 + p * 26, delay: 0, duration: 110, volume: 0.05 + p * 0.05, type: 'triangle' }]
    case 'bouncy':
      // はずむ: 軽い「ポンッ」を2音重ねて、跳ねる予感を出す。
      return [
        { frequency: 480 + p * 120, delay: 0, duration: 60, volume: 0.04 + p * 0.03, type: 'sine' },
        { frequency: 700 + p * 160, delay: 35, duration: 70, volume: 0.035 + p * 0.03, type: 'sine' },
      ]
    case 'small':
    default:
      // ちいさい: 「シュッ」と駆け上がる3音（合計135ms）。他の玉よりはっきり速い印象にする。
      return [
        { frequency: 620, delay: 0, duration: 45, volume: 0.05 + p * 0.03, type: 'sine' },
        { frequency: 900, delay: 45, duration: 45, volume: 0.05 + p * 0.03, type: 'sine' },
        { frequency: 1180, delay: 90, duration: 45, volume: 0.05 + p * 0.03, type: 'sine' },
      ]
  }
}

/** 衝突音。どっしりだまの「ドン/ゴン」が基準で、他の玉より明確に低い（heavy < small）。 */
export function impactTones(ballId: BowlingBallId, strength: number): BowlingTone[] {
  const s = clamp01(strength)
  switch (ballId) {
    case 'heavy':
      // どっしり: 低い「ドン/ゴン」。強いほど基音・音量とも上がる。
      return [
        { frequency: 100 + s * 45, delay: 0, duration: 130, volume: 0.06 + s * 0.06, type: 'triangle' },
        { frequency: 180 + s * 60, delay: 10, duration: 90, volume: 0.02 + s * 0.02, type: 'sine' },
      ]
    case 'bouncy':
      // はずむ: 中音の短い「コンッ」。連続バウンドの主役はbounceTones側なのでここは控えめ。
      return [{ frequency: 420 + s * 160, delay: 0, duration: 70, volume: 0.03 + s * 0.03, type: 'sine' }]
    case 'small':
    default:
      // ちいさい: 乾いた高めの短音。
      return [{ frequency: 760 + s * 220, delay: 0, duration: 55, volume: 0.03 + s * 0.03, type: 'triangle' }]
  }
}

/** メジャーペンタトニックの半音オフセット。黒鍵を含まないので不協和になりにくい（quizSound.tsの手法と同じ）。 */
const BOUNCE_PENTATONIC_STEPS = [0, 2, 4, 7, 9]
const BOUNCE_BASE_FREQUENCY = 520

/**
 * バウンド音。はずむだまが主役で、連続バウンドのたびにペンタトニックで音程が上がり、
 * 5段目で頭打ちにする（延々と上がり続けると耳に刺さるため）。頭打ち後は音量だけ少しずつ下げる。
 * はずむだま以外は控えめな音色にして、「バウンド＝はずむだまの見せ場」を保つ。
 */
export function bounceTones(ballId: BowlingBallId, bounceIndex: number): BowlingTone[] {
  const index = Number.isFinite(bounceIndex) ? Math.max(1, Math.trunc(bounceIndex)) : 1
  const cappedIndex = Math.min(index, BOUNCE_PENTATONIC_STEPS.length)
  const overflow = Math.max(0, index - BOUNCE_PENTATONIC_STEPS.length)
  const semitones = BOUNCE_PENTATONIC_STEPS[cappedIndex - 1]!
  const frequency = BOUNCE_BASE_FREQUENCY * 2 ** (semitones / 12)
  // 頭打ち後は音量だけ少しずつ下げる。下げすぎて0.02(volumeレンジの下限)を割らないよう
  // 0.6で止める。
  const decay = Math.max(0.6, 1 - overflow * 0.08)
  if (ballId === 'bouncy') {
    return [{ frequency, delay: 0, duration: 70, volume: 0.06 * decay, type: 'sine' }]
  }
  return [{ frequency: frequency * 0.75, delay: 0, duration: 50, volume: 0.035 * decay, type: 'sine' }]
}

/**
 * 積み木が倒れた「カラカラ」。何十個まとめて倒れても音を重ねすぎないよう、
 * 最大2音までしか鳴らさない（3個以上でも音数は増やさず、音量だけわずかに上げる）。
 */
export function clatterTones(count: number): BowlingTone[] {
  const c = Number.isFinite(count) ? Math.max(1, Math.trunc(count)) : 1
  const loudness = Math.min(c, 5)
  const volume = Math.min(0.09, 0.035 + loudness * 0.008)
  const tones: BowlingTone[] = [
    { frequency: 380 + Math.min(c, 6) * 12, delay: 0, duration: 45, volume, type: 'triangle' },
  ]
  if (c >= 2) {
    tones.push({ frequency: 460 + Math.min(c, 6) * 10, delay: 18, duration: 40, volume: volume * 0.8, type: 'sine' })
  }
  return tones
}

/** 1投で全部倒したときの「やった！」。3投終わりのresultTonesより短く軽い。 */
export function perfectTones(): BowlingTone[] {
  return [
    { frequency: 523.25, delay: 0, duration: 140, volume: 0.09, type: 'triangle' },
    { frequency: 659.25, delay: 70, duration: 150, volume: 0.09, type: 'triangle' },
    { frequency: 783.99, delay: 140, duration: 160, volume: 0.09, type: 'triangle' },
    { frequency: 1046.5, delay: 210, duration: 260, volume: 0.1, type: 'sine' },
  ]
}

/** 3投終わりの締めくくり。perfectTonesより落ち着いた低めのファンファーレ。 */
export function resultTones(): BowlingTone[] {
  return [
    { frequency: 392.0, delay: 0, duration: 150, volume: 0.08, type: 'triangle' },
    { frequency: 523.25, delay: 90, duration: 170, volume: 0.08, type: 'triangle' },
    { frequency: 659.25, delay: 180, duration: 220, volume: 0.09, type: 'sine' },
  ]
}

// ---------------------------------------------------------------------------
// 多重再生制御（「ガガガガ」対策）
// ---------------------------------------------------------------------------

export type BowlingSoundKind = 'launch' | 'impact' | 'bounce' | 'clatter' | 'perfect' | 'result'

/** 種類ごとのクールダウン[ms]。同じ種類の音が短時間に連発しないようにする。 */
export const BOWLING_SOUND_COOLDOWN_MS: Record<BowlingSoundKind, number> = {
  launch: 120,
  impact: 90,
  bounce: 110,
  clatter: 70,
  perfect: 600,
  result: 600,
}

/** 直近200msに鳴らしてよい音の合計数。積み木が一斉に崩れても「ガガガガ」にしない上限。 */
export const MAX_ACTIVE_BOWLING_VOICES = 6
const VOICE_WINDOW_MS = 200

/**
 * 「鳴らしてよいか」をクールダウン＋直近の音数上限の二段構えで判定するゲート。
 * perfect/result はクールダウンだけ効かせ、音数上限の対象からは外す
 * （積み木の崩壊音でお祝いの音が潰れないようにするため）。
 */
export function createBowlingSoundGate(): {
  request: (kind: BowlingSoundKind, nowMs: number, voices: number) => boolean
} {
  const lastPlayedAt: Partial<Record<BowlingSoundKind, number>> = {}
  const recentVoiceLog: { atMs: number; voices: number }[] = []

  function prune(nowMs: number): void {
    while (recentVoiceLog.length > 0 && nowMs - recentVoiceLog[0]!.atMs > VOICE_WINDOW_MS) {
      recentVoiceLog.shift()
    }
  }

  return {
    request(kind, nowMs, voices) {
      const cooldown = BOWLING_SOUND_COOLDOWN_MS[kind]
      const last = lastPlayedAt[kind]
      if (last !== undefined && nowMs - last < cooldown) return false

      const exemptFromVoiceCap = kind === 'perfect' || kind === 'result'
      if (!exemptFromVoiceCap) {
        prune(nowMs)
        const activeVoices = recentVoiceLog.reduce((sum, entry) => sum + entry.voices, 0)
        if (activeVoices + voices > MAX_ACTIVE_BOWLING_VOICES) return false
      }

      lastPlayedAt[kind] = nowMs
      if (!exemptFromVoiceCap) {
        recentVoiceLog.push({ atMs: nowMs, voices })
      }
      return true
    },
  }
}

// ---------------------------------------------------------------------------
// 実際に鳴らすコントローラ
// ---------------------------------------------------------------------------

type TrackedNode = { oscillator: OscillatorNode; gain: GainNode }

export type BowlingSoundController = {
  playLaunch(ballId: BowlingBallId, power: number): void
  playImpact(ballId: BowlingBallId, strength: number): void
  playBounce(ballId: BowlingBallId, bounceIndex: number): void
  playClatter(count: number): void
  playPerfect(): void
  playResult(): void
  dispose(): void
}

/**
 * つみきボウリング1プレイぶんの音声状態を束ねる。
 * `koma-battle`（createKomaBattleSoundController）と同じく、予約したノードは
 * Set で追跡して onended で disconnect し、dispose() で残りを全部stopする。
 */
export function createBowlingSoundController(): BowlingSoundController {
  const gate = createBowlingSoundGate()
  const activeNodes = new Set<TrackedNode>()
  let disposed = false

  function playTones(kind: BowlingSoundKind, tones: BowlingTone[]): void {
    if (disposed || !isSoundEnabled() || tones.length === 0) return
    try {
      const ctx = getSharedAudioContext()
      if (!ctx) return
      // tones全体をひとまとまりの「鳴らそうとしている音」として一度にゲートへ通す
      // （一部だけ許可すると、和音や連続音の一部だけ欠けて不自然になるため）。
      if (!gate.request(kind, Date.now(), tones.length)) return
      const now = ctx.currentTime
      for (const tone of tones) {
        const oscillator = ctx.createOscillator()
        const gain = ctx.createGain()
        oscillator.type = tone.type
        oscillator.frequency.value = tone.frequency
        const startTime = now + tone.delay / 1000
        const stopTime = startTime + tone.duration / 1000
        gain.gain.setValueAtTime(0, startTime)
        gain.gain.linearRampToValueAtTime(tone.volume, startTime + 0.012)
        gain.gain.linearRampToValueAtTime(0, stopTime)
        oscillator.connect(gain)
        gain.connect(ctx.destination)
        const tracked: TrackedNode = { oscillator, gain }
        activeNodes.add(tracked)
        oscillator.onended = () => {
          activeNodes.delete(tracked)
          try {
            gain.disconnect()
          } catch {
            /* 解放済み/テスト用ノード */
          }
          try {
            oscillator.disconnect()
          } catch {
            /* 解放済み/テスト用ノード */
          }
        }
        oscillator.start(startTime)
        oscillator.stop(stopTime)
      }
    } catch {
      // 音声APIの不調でゲーム進行を止めない。
    }
  }

  return {
    playLaunch(ballId, power) {
      playTones('launch', launchTones(ballId, power))
    },
    playImpact(ballId, strength) {
      playTones('impact', impactTones(ballId, strength))
    },
    playBounce(ballId, bounceIndex) {
      playTones('bounce', bounceTones(ballId, bounceIndex))
    },
    playClatter(count) {
      playTones('clatter', clatterTones(count))
    },
    playPerfect() {
      playTones('perfect', perfectTones())
    },
    playResult() {
      playTones('result', resultTones())
    },
    dispose() {
      if (disposed) return
      disposed = true
      for (const node of activeNodes) {
        try {
          node.oscillator.stop()
        } catch {
          /* 既に停止済み */
        }
        try {
          node.oscillator.disconnect()
        } catch {
          /* 解放済み/テスト用ノード */
        }
        try {
          node.gain.disconnect()
        } catch {
          /* 解放済み/テスト用ノード */
        }
      }
      activeNodes.clear()
    },
  }
}
