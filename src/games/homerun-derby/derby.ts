import { BALLS, PITCH_SPEED, type PitchKind, type Stage } from './stages'

// ホームランダービーの すすみかた（ピッチャーが なげる → バットを ふる → とんでいく）。
// 絵も 音も もたない ので、canvas なしで テストできる。きょりは メートル、じかんは びょう。

export type Vec3 = { x: number; y: number; z: number }

/** ピッチャーが ボールを はなす ばしょ。z は ホームから ピッチャーへの きょり。 */
export const RELEASE: Vec3 = { x: .3, y: 1.9, z: 16.6 }
/** バットに あたる ばしょ（ホームの すこし まえ）。 */
export const CONTACT: Vec3 = { x: .05, y: .9, z: .4 }
/** うたなかった ボールが キャッチャーミットに おさまる すすみぐあい（1 = バットの ところ）。 */
export const MITT_PROGRESS = 1.3

/** ピタッと とまる ボールが とまる ところ と、とまる じかん。 */
export const STOP_AT = .45
export const STOP_TIME = .75
/** とまった あとは すこし はやく なる。 */
const STOP_BOOST = 1.35

/** このくらい ずれても バットに あたる[s]。 */
export const HIT_WINDOW = .2
/** ぴったり と いえる ずれ[s]。 */
export const JUST_WINDOW = .05

/** なげる まえの ため[s]。さいしょの 1きゅうは あいての なまえを みせる ぶん ながい。 */
export const WINDUP = 1.1
export const FIRST_WINDUP = 2.2
/** うった しゅんかんを みせる じかん[s]。 */
export const IMPACT = .45
/** けっかを みせる じかん[s]。 */
export const RESULT_TIME: Record<Outcome, number> = { homerun: 1.9, hit: 1.3, foul: 1.2, miss: 1.1 }

/** フェンスの たかさ[m]。 */
export const FENCE_HEIGHT = 3
/** ファウルラインの かくど（まんなかから）。 */
export const FOUL_ANGLE = Math.PI / 4
const DEG = Math.PI / 180

export type Phase = 'windup' | 'pitch' | 'impact' | 'flight' | 'result' | 'done'
export type Outcome = 'homerun' | 'hit' | 'foul' | 'miss'
/** うつのが はやかったか おそかったか。 */
export type Timing = 'early' | 'just' | 'late'
export type MissReason = 'early' | 'late' | 'looking'

export type Hit = {
  outcome: Exclude<Outcome, 'miss'>
  /** とんだ きょり（じめんの たかさに おちる ところ）[m]。 */
  distance: number
  /** まんなかを 0 と した むき。マイナスが ひだり（レフト）。 */
  angle: number
  /** いちばん たかい ところ[m]。 */
  peak: number
  /** s = 0 → 1 を すすむ じかん[s]。 */
  time: number
  /** ボールが とまる ところ（ホームランは スタンドに はいった ところ）。 */
  end: number
  /** その むきの フェンスまでの きょり[m]。 */
  fence: number
  timing: Timing
}

export type DerbyEvent =
  | { type: 'windup' }
  | { type: 'release'; kind: PitchKind }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'swing'; contact: boolean }
  | { type: 'contact'; hit: Hit }
  | { type: 'land'; hit: Hit; homeruns: number }
  | { type: 'miss'; reason: MissReason }
  | { type: 'done'; homeruns: number; stars: number }

export type Derby = {
  stage: Stage
  phase: Phase
  /** いまの フェーズに はいってからの じかん[s]。 */
  t: number
  /** いま なげている ボールの ばんごう（0から）。 */
  index: number
  results: Outcome[]
  homeruns: number
  /** ふった ときの ずれ と、バットに あたる じかん（あたらない ときは null）。 */
  swing: { at: number; error: number; contactAt: number | null } | null
  hit: Hit | null
  miss: MissReason | null
  paused: boolean
  events: DerbyEvent[]
  random: () => number
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

export function pitchKind(derby: Derby): PitchKind {
  return derby.stage.pitches[derby.index] ?? 'straight'
}

/** ボールが はなれてから バットの ところに とどくまでの じかん[s]。 */
export function arrivalTime(kind: PitchKind, travel: number): number {
  const duration = travel * PITCH_SPEED[kind]
  if (kind === 'stop') return duration * STOP_AT + STOP_TIME + duration * (1 - STOP_AT) / STOP_BOOST
  return duration
}

/** ボールが はなれてから t びょう たった ときの すすみぐあい（0 = て、1 = バット）。 */
export function pitchProgress(kind: PitchKind, travel: number, t: number): number {
  const duration = travel * PITCH_SPEED[kind]
  if (kind !== 'stop') return t / duration
  const stopStart = duration * STOP_AT
  if (t < stopStart) return t / duration
  if (t < stopStart + STOP_TIME) return STOP_AT
  return STOP_AT + (t - stopStart - STOP_TIME) * STOP_BOOST / duration
}

/** すすみぐあい p の ときの ボールの いち と みえかた（alpha 0 で みえない）。 */
export function pitchPoint(kind: PitchKind, p: number): Vec3 & { alpha: number } {
  const q = clamp01(p)
  let x = lerp(RELEASE.x, CONTACT.x, p)
  // すこし やまなりに とんでくる。
  let y = lerp(RELEASE.y, CONTACT.y, p) + .45 * Math.sin(Math.PI * q)
  const z = lerp(RELEASE.z, CONTACT.z, p)
  let alpha = 1
  if (kind === 'hop') y = lerp(RELEASE.y, CONTACT.y, p) + Math.abs(Math.sin(q * Math.PI * 3)) * 1.1 * (1 - q * .4)
  else if (kind === 'wave') x += Math.sin(q * Math.PI * 4) * .9 * (1 - q * .6)
  else if (kind === 'curve') x += 1.4 * Math.sin(Math.PI * q ** .75)
  else if (kind === 'slow') y += .9 * Math.sin(Math.PI * q)
  else if (kind === 'ghost') alpha = q < .28 ? 1 : q < .38 ? 1 - (q - .28) / .1 : q < .8 ? 0 : clamp01((q - .8) / .08)
  return { x, y, z, alpha }
}

/** その むきの フェンスまでの きょり[m]。まんなかが いちばん とおい。 */
export function fenceDistance(angle: number): number {
  return 92 + 18 * Math.cos(2 * Math.max(-FOUL_ANGLE, Math.min(FOUL_ANGLE, angle)))
}

/** スタンドの たかさ[m]。フェンスの うしろで だんだん たかく なる。 */
export function standHeight(distance: number, fence: number): number {
  return FENCE_HEIGHT + Math.max(0, distance - fence) * .55
}

function heightAt(peak: number, s: number) {
  return CONTACT.y * (1 - s) + 4 * peak * s * (1 - s)
}

/** うった ずれ（マイナスが はやい）と ばらつき（0〜1）から、とびかたを きめる。 */
export function hitFromTiming(error: number, jitter: number): Hit {
  const q = clamp01(Math.abs(error) / HIT_WINDOW)
  const power = 1 - q ** 1.6
  const carry = 30 + 115 * power * (.95 + jitter * .1)
  const angle = (error / HIT_WINDOW) * 55 * DEG + (jitter - .5) * 6 * DEG
  const fence = fenceDistance(angle)
  const timing: Timing = Math.abs(error) <= JUST_WINDOW ? 'just' : error < 0 ? 'early' : 'late'
  if (Math.abs(angle) > FOUL_ANGLE) {
    const distance = Math.round(carry * .7)
    return { outcome: 'foul', distance, angle, peak: 8 + 14 * power, time: 1 + distance / 90, end: 1, fence, timing }
  }
  const peak = 6 + 32 * power
  const sFence = fence / carry
  const clears = sFence < 1 && heightAt(peak, sFence) > FENCE_HEIGHT + .5
  if (!clears) {
    // フェンスに とどかない（とどきそうでも てまえに おちる）。
    const distance = Math.round(Math.min(carry, fence - 4))
    return { outcome: 'hit', distance, angle, peak: Math.min(peak, 6 + distance * .22), time: 1.1 + distance / 85, end: 1, fence, timing }
  }
  const distance = Math.round(carry)
  // スタンドに はいった ところで とまる。
  let end = 1
  for (let s = sFence; s <= 1; s += .005) {
    if (heightAt(peak, s) <= standHeight(carry * s, fence)) { end = s; break }
  }
  return { outcome: 'homerun', distance, angle, peak, time: 1.2 + distance / 80, end, fence, timing }
}

/** とんでいる ボールの いち。t は うってからの じかん[s]。 */
export function flightPoint(hit: Hit, t: number): Vec3 {
  const s = Math.min(hit.end, Math.max(0, t / hit.time))
  const d = hit.distance * s
  return { x: Math.sin(hit.angle) * d, y: Math.max(0, heightAt(hit.peak, s)), z: Math.cos(hit.angle) * d }
}

export function flightDuration(hit: Hit): number {
  return hit.time * hit.end
}

/** ホームランの かずで ほしを きめる。めあてに とどかなければ 0。 */
export function starsFor(stage: Stage, homeruns: number): number {
  if (homeruns < stage.goal) return 0
  if (homeruns < BALLS - 1) return 1
  if (homeruns < BALLS) return 2
  return 3
}

export function createDerby(stage: Stage, random: () => number = Math.random): Derby {
  return {
    stage, phase: 'windup', t: 0, index: 0, results: [], homeruns: 0,
    swing: null, hit: null, miss: null, paused: false, events: [{ type: 'windup' }], random,
  }
}

export function windupTime(derby: Derby): number {
  return derby.index === 0 ? FIRST_WINDUP : WINDUP
}

/** いま なげている ボールの すすみぐあい。 */
export function currentProgress(derby: Derby): number {
  return derby.phase === 'pitch' ? pitchProgress(pitchKind(derby), derby.stage.travel, derby.t) : 0
}

export function canSwing(derby: Derby): boolean {
  return derby.phase === 'pitch' && !derby.swing
}

/** バットを ふる。ふれた ときは true。 */
export function swingBat(derby: Derby): boolean {
  if (!canSwing(derby)) return false
  const arrival = arrivalTime(pitchKind(derby), derby.stage.travel)
  const error = derby.t - arrival
  const contact = Math.abs(error) <= HIT_WINDOW * derby.stage.assist
  derby.swing = { at: derby.t, error, contactAt: contact ? Math.max(derby.t, arrival) : null }
  derby.events.push({ type: 'swing', contact })
  return true
}

function enter(derby: Derby, phase: Phase) {
  derby.phase = phase
  derby.t = 0
}

function finishPitch(derby: Derby, outcome: Outcome) {
  derby.results.push(outcome)
  if (outcome === 'homerun') derby.homeruns++
  enter(derby, 'result')
}

/** dt びょう すすめる。おきた ことは events に たまる。 */
export function stepDerby(derby: Derby, dt: number): void {
  if (derby.phase === 'done') return
  derby.t += dt
  const kind = pitchKind(derby)
  switch (derby.phase) {
    case 'windup':
      if (derby.t >= windupTime(derby)) {
        enter(derby, 'pitch')
        derby.events.push({ type: 'release', kind })
      }
      break
    case 'pitch': {
      const progress = pitchProgress(kind, derby.stage.travel, derby.t)
      const paused = kind === 'stop' && progress === STOP_AT && derby.t > 0
      if (paused !== derby.paused) {
        derby.paused = paused
        derby.events.push({ type: paused ? 'pause' : 'resume' })
      }
      const swing = derby.swing
      if (swing?.contactAt != null && derby.t >= swing.contactAt) {
        // assist で ずれを ちいさく みて、はじめの あいてほど とおくへ とばしやすく する。
        const hit = hitFromTiming(swing.error / derby.stage.assist, derby.random())
        derby.hit = hit
        enter(derby, 'impact')
        derby.events.push({ type: 'contact', hit })
      } else if (progress >= MITT_PROGRESS) {
        derby.miss = !swing ? 'looking' : swing.error < 0 ? 'early' : 'late'
        derby.paused = false
        finishPitch(derby, 'miss')
        derby.events.push({ type: 'miss', reason: derby.miss })
      }
      break
    }
    case 'impact':
      if (derby.t >= IMPACT) enter(derby, 'flight')
      break
    case 'flight':
      if (derby.hit && derby.t >= flightDuration(derby.hit)) {
        finishPitch(derby, derby.hit.outcome)
        derby.events.push({ type: 'land', hit: derby.hit, homeruns: derby.homeruns })
      }
      break
    case 'result': {
      const last = derby.results[derby.results.length - 1] ?? 'miss'
      if (derby.t < RESULT_TIME[last]) break
      if (derby.index + 1 >= BALLS) {
        enter(derby, 'done')
        derby.events.push({ type: 'done', homeruns: derby.homeruns, stars: starsFor(derby.stage, derby.homeruns) })
      } else {
        derby.index++
        derby.swing = null
        derby.hit = null
        derby.miss = null
        enter(derby, 'windup')
        derby.events.push({ type: 'windup' })
      }
      break
    }
  }
}

export function drainEvents(derby: Derby): DerbyEvent[] {
  const events = derby.events
  derby.events = []
  return events
}

/** あと なんぼん ホームランが ひつようか。 */
export function homerunsNeeded(derby: Derby): number {
  return Math.max(0, derby.stage.goal - derby.homeruns)
}

/** のこりの ボール（いま なげている ボールを ふくむ）。 */
export function ballsLeft(derby: Derby): number {
  return BALLS - derby.results.length
}
