/**
 * 玉の運動と倒壊数から「演出イベント」を作る層（Phase 4）。
 *
 * useTsumikiBowlingEngine.ts は元々 IMPACT_SPEED_DROP という1本のしきい値だけで
 * 「強くぶつかった」を検出していた。Phase 4 ではそこへ「バウンド」「短時間で
 * まとめて崩れた（大崩壊）」の検出を足すため、判定ロジックをここへ切り出す。
 *
 * Three.js/Rapier/DOM に一切依存しない純粋関数だけを置き、vitest で
 * 「このフレーム差分ならイベントが出る/出ない」をそのまま検証できるようにする。
 * 時間経過は Date.now() を使わず、呼び出し側が渡す stepMs の積算だけで扱う
 * （テストで時間を完全にコントロールできるようにするため）。
 */

export type FeedbackVec3 = { x: number; y: number; z: number }
export type BallMotion = { position: FeedbackVec3; velocity: FeedbackVec3; speed: number }

/** 1フレームでこの速度差が生じたら「強くぶつかった」[m/s]。既存エンジンの値をそのまま使う。 */
export const IMPACT_SPEED_DROP = 5
/** ここまで落ちたら強さ1.0とみなす[m/s]。 */
export const IMPACT_STRONG_DROP = 22
/** バウンド判定: 下向きにこれ以上の速さで落ちていて、かつ上向きへ転じたら1バウンド[m/s]。 */
export const BOUNCE_MIN_DOWN_SPEED = 3
export const BOUNCE_MIN_UP_SPEED = 1.5
/** ここまで跳ね上がったら強さ1.0とみなす[m/s]。 */
export const BOUNCE_STRONG_UP_SPEED = 12
/** 同じイベントを短時間に連発させないための最小間隔[ms]。 */
export const IMPACT_MIN_INTERVAL_MS = 90
export const BOUNCE_MIN_INTERVAL_MS = 110
/** この数がこの時間内に倒れたら「たくさん崩れた」。 */
export const BIG_COLLAPSE_COUNT = 5
export const BIG_COLLAPSE_WINDOW_MS = 450

export type BallFeedbackEvent =
  | { kind: 'impact'; strength: number; position: FeedbackVec3 }
  | { kind: 'bounce'; index: number; strength: number; position: FeedbackVec3 }

export type FeedbackState = {
  /** 前フレームの速さ[m/s]。速度が急に落ちたら衝突とみなす。 */
  lastSpeed: number
  /** 前フレームの鉛直速度[m/s]。バウンド検出（下向き→上向きの反転）に使う。 */
  lastVelocityY: number
  /** lastVelocityY がまだ意味のある値を持っていない（初回フレーム）か。 */
  hasLastVelocity: boolean
  /** 直前の衝突イベントからの経過時間[ms]。 */
  msSinceLastImpact: number
  /** 直前のバウンドイベントからの経過時間[ms]。 */
  msSinceLastBounce: number
  /** この投球で何回バウンドしたか（連続バウンドの音程を上げるのに使う）。 */
  bounceCount: number
  /** 「大崩壊」判定窓の経過時間[ms]。窓が開いていない間は0のまま。 */
  collapseWindowMs: number
  /** 上の窓の中で倒れた積み木の数。 */
  collapseCountInWindow: number
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

export function createFeedbackState(): FeedbackState {
  return {
    lastSpeed: 0,
    lastVelocityY: 0,
    hasLastVelocity: false,
    // 「間隔が十分空いている」を初期値として表すため、無限大にしておく
    // （0で始めると1フレーム目からクールダウン中と誤判定してしまう）。
    msSinceLastImpact: Number.POSITIVE_INFINITY,
    msSinceLastBounce: Number.POSITIVE_INFINITY,
    bounceCount: 0,
    collapseWindowMs: 0,
    collapseCountInWindow: 0,
  }
}

/** 投球ごとに呼ぶ。前の投球のバウンド回数・崩壊窓を引き継がない。 */
export function resetFeedbackState(state: FeedbackState): void {
  state.lastSpeed = 0
  state.lastVelocityY = 0
  state.hasLastVelocity = false
  state.msSinceLastImpact = Number.POSITIVE_INFINITY
  state.msSinceLastBounce = Number.POSITIVE_INFINITY
  state.bounceCount = 0
  state.collapseWindowMs = 0
  state.collapseCountInWindow = 0
}

/**
 * 1ステップぶん玉の運動を進め、このステップで新しく起きたイベントを返す。
 * 玉が場外のときは呼び出し側でスキップする（呼び出し側の責務）。
 */
export function updateBallFeedback(
  state: FeedbackState,
  motion: BallMotion,
  stepMs: number,
): BallFeedbackEvent[] {
  const events: BallFeedbackEvent[] = []
  state.msSinceLastImpact += stepMs
  state.msSinceLastBounce += stepMs

  // 速度が急に落ちた = 何かへ強くぶつかった合図（重力だけでは1フレームでここまで変わらない）。
  const drop = state.lastSpeed - motion.speed
  if (drop >= IMPACT_SPEED_DROP && state.msSinceLastImpact >= IMPACT_MIN_INTERVAL_MS) {
    const strength = clamp01((drop - IMPACT_SPEED_DROP) / (IMPACT_STRONG_DROP - IMPACT_SPEED_DROP))
    events.push({ kind: 'impact', strength, position: motion.position })
    state.msSinceLastImpact = 0
  }

  // 下向きに落ちていた速度が、次のフレームで上向きへ転じたら1バウンド。
  if (
    state.hasLastVelocity &&
    state.lastVelocityY <= -BOUNCE_MIN_DOWN_SPEED &&
    motion.velocity.y >= BOUNCE_MIN_UP_SPEED &&
    state.msSinceLastBounce >= BOUNCE_MIN_INTERVAL_MS
  ) {
    state.bounceCount += 1
    const strength = clamp01(motion.velocity.y / BOUNCE_STRONG_UP_SPEED)
    events.push({ kind: 'bounce', index: state.bounceCount, strength, position: motion.position })
    state.msSinceLastBounce = 0
  }

  state.lastSpeed = motion.speed
  state.lastVelocityY = motion.velocity.y
  state.hasLastVelocity = true
  return events
}

/**
 * このステップで新しく倒れた積み木の数を「大崩壊」判定窓へ足す。
 * delta が0のフレームでも、窓が開いている間（count > 0）は経過時間だけ進める。
 * 窓が時間切れ（BIG_COLLAPSE_WINDOW_MS超過）のまま次の倒壊が来たら、
 * 古い窓は捨てて今回ぶんだけの新しい窓としてやり直す。
 */
export function noteToppled(state: FeedbackState, delta: number, stepMs: number): void {
  if (delta > 0) {
    if (state.collapseCountInWindow > 0 && state.collapseWindowMs > BIG_COLLAPSE_WINDOW_MS) {
      state.collapseCountInWindow = 0
      state.collapseWindowMs = 0
    }
    state.collapseCountInWindow += delta
  }
  if (state.collapseCountInWindow > 0) {
    state.collapseWindowMs += stepMs
  }
}

/**
 * 窓の中で BIG_COLLAPSE_COUNT 以上倒れていたら「大崩壊」を1回返し、窓をリセットする。
 * 満たしていなければ0を返し、窓はそのまま（まだ増える可能性を残す）。
 */
export function takeBigCollapse(state: FeedbackState): number {
  if (state.collapseCountInWindow >= BIG_COLLAPSE_COUNT) {
    const count = state.collapseCountInWindow
    state.collapseCountInWindow = 0
    state.collapseWindowMs = 0
    return count
  }
  return 0
}
