/**
 * 1投が終わったかどうかの判定。
 *
 * 「◯秒待ったら次」という固定秒数だけに頼ると、まだ積み木が転がっている
 * 途中で次の投球が始まったり、逆にとっくに止まっているのに待たされたりする。
 * ここでは剛体の速度を見て「十分落ち着いた状態が続いたか」で判断し、
 * 最大待機時間だけを保険として持たせている。
 */

/** この速度以下なら止まっているとみなす[m/s]。 */
export const SETTLE_LINEAR_SPEED = 0.45
/** この角速度以下なら止まっているとみなす[rad/s]。 */
export const SETTLE_ANGULAR_SPEED = 1.5
/** 落ち着いた状態がこれだけ続いたら次の投球へ。 */
export const SETTLE_STABLE_MS = 520
/**
 * 発射直後は必ずこの時間だけ待つ。
 * 玉が積み木へ到達する前（最速でも約0.4秒、最弱でも約0.8秒）に
 * 「止まった」と判定させないための下限。
 */
export const SETTLE_MIN_THROW_MS = 900
/** 何かが延々と転がり続けても、ここで打ち切る。 */
export const SETTLE_MAX_THROW_MS = 7000

export type MotionSample = {
  linearSpeed: number
  angularSpeed: number
}

export type SettleReason = 'stable' | 'timeout'

export type SettleState = {
  elapsedMs: number
  stableMs: number
  settled: boolean
  reason: SettleReason | null
}

export function createSettleState(): SettleState {
  return { elapsedMs: 0, stableMs: 0, settled: false, reason: null }
}

/** すべてのサンプルが静止しきい値を下回っているか。 */
export function isCalm(samples: readonly MotionSample[]): boolean {
  return samples.every(
    (sample) =>
      Number.isFinite(sample.linearSpeed) &&
      Number.isFinite(sample.angularSpeed) &&
      sample.linearSpeed <= SETTLE_LINEAR_SPEED &&
      sample.angularSpeed <= SETTLE_ANGULAR_SPEED,
  )
}

/**
 * 1ステップぶん進める。落ち着いた（＝次の投球へ移ってよい）ときにtrueを返す。
 * 一度trueになった状態を渡し続けても、trueのままで二重に進行しない。
 */
export function updateSettleState(
  state: SettleState,
  samples: readonly MotionSample[],
  stepMs: number,
): boolean {
  if (state.settled) return true
  state.elapsedMs += stepMs
  if (isCalm(samples)) {
    state.stableMs += stepMs
  } else {
    state.stableMs = 0
  }
  if (state.elapsedMs >= SETTLE_MAX_THROW_MS) {
    state.settled = true
    state.reason = 'timeout'
    return true
  }
  if (state.elapsedMs >= SETTLE_MIN_THROW_MS && state.stableMs >= SETTLE_STABLE_MS) {
    state.settled = true
    state.reason = 'stable'
    return true
  }
  return false
}
