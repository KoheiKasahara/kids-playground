/**
 * 勝敗・終了状態の判定。
 *
 * Rapierに一切依存しない純粋な状態機械にしてあるので、
 * 「一瞬の傾きでは負けにならない」「一定時間低速なら停止」といった要件を
 * 物理シミュレーションを回さずに時間依存なしでテストできる。
 */

import { OUT_FLOOR_Y } from './komaPhysics'
import { OUT_RADIUS } from './komaStadium'

/** 敗北（1個モードでは終了）の理由。 */
export type KomaDefeatReason = 'toppled' | 'stopped' | 'outOfArena'

/** 転倒とみなす傾き。約57度。 */
export const TOPPLE_TILT_RAD = 0.6
/**
 * 転倒判定を解除する傾き。約40度。
 * 判定に入る角度より小さくすることで、しきい値付近で付いたり消えたりしない。
 */
export const TOPPLE_RELEASE_TILT_RAD = 0.4
/** この時間だけ倒れ続けて初めて転倒。衝突で一瞬傾いただけでは負けにしない。 */
export const TOPPLE_SUSTAIN_MS = 500

/** 停止とみなす自転速度[rad/s]。 */
export const STOP_SPIN_SPEED = 3.5
/** 停止判定を解除する自転速度。ヒステリシス。 */
export const STOP_RELEASE_SPIN_SPEED = 5
/** 停止とみなす並進速度[m/s]。まだ滑っている間は停止にしない。 */
export const STOP_LINEAR_SPEED = 0.35
/** この時間だけ低速が続いて初めて停止。 */
export const STOP_SUSTAIN_MS = 700

/** 場外がこの時間続いたら確定。壁の上を一瞬かすめただけでは負けにしない。 */
export const OUT_SUSTAIN_MS = 200

/**
 * 開始直後のこの時間は敗北判定をしない。
 * 発射の瞬間に接地が乱れても「開始直後に負け」にならないようにする。
 */
export const START_GRACE_MS = 800

/**
 * ほぼ同時に決着した場合の許容幅。この範囲に収まっていれば引き分け。
 *
 * 先に条件を満たしたほうが負け、という規則が1フレーム差(約8ms)で決まらないようにするための幅。
 * 一方で、倒れたコマがもう一方を巻き添えにして倒すことは実際によく起きるため、
 * ここを広く取りすぎると引き分けばかりになる。物理ステップ7回ぶんに相当する60msにしている。
 */
export const SIMULTANEOUS_WINDOW_MS = 60

/**
 * 試合時間の上限。減衰の設計上ここへ到達する前に決着するはずだが、
 * 何かの拍子に永遠に終わらない状態を作らないための安全網として置く。
 */
export const MATCH_TIME_LIMIT_MS = 45000

export type KomaSample = {
  /** 直立からの傾き[rad]。 */
  tiltRad: number
  /** コマ自身の軸まわりの回転速度[rad/s]。符号は問わない。 */
  spinSpeed: number
  /** 並進速度の大きさ[m/s]。 */
  linearSpeed: number
  /** 中心からの水平距離[m]。 */
  radius: number
  /** 高さ[m]。床より十分下なら落下＝場外。 */
  y: number
}

export type KomaJudgeState = {
  /** 敗北が確定した理由。未確定はnull。 */
  defeatReason: KomaDefeatReason | null
  /** 敗北が確定した時刻[ms]。未確定はnull。 */
  defeatedAtMs: number | null
  /** 各条件が連続して成立している時間[ms]。 */
  toppledForMs: number
  stoppedForMs: number
  outForMs: number
}

export function createKomaJudgeState(): KomaJudgeState {
  return {
    defeatReason: null,
    defeatedAtMs: null,
    toppledForMs: 0,
    stoppedForMs: 0,
    outForMs: 0,
  }
}

/** サンプルが場外の位置にあるか。 */
export function isOutOfArena(sample: Pick<KomaSample, 'radius' | 'y'>): boolean {
  if (!Number.isFinite(sample.radius) || !Number.isFinite(sample.y)) return true
  return sample.radius >= OUT_RADIUS || sample.y <= OUT_FLOOR_Y
}

/**
 * 1ステップぶん判定を進める。
 *
 * @param state       直前の状態。
 * @param sample      現在の観測値。
 * @param deltaMs     前回からの経過時間。
 * @param elapsedMs   試合開始からの経過時間。猶予時間の判定に使う。
 */
export function updateKomaJudge(
  state: KomaJudgeState,
  sample: KomaSample,
  deltaMs: number,
  elapsedMs: number,
): KomaJudgeState {
  // 一度決まった敗北は覆さない。
  if (state.defeatReason !== null) return state

  const step = Number.isFinite(deltaMs) && deltaMs > 0 ? deltaMs : 0

  // 場外だけは猶予時間中でも数える。発射で場外へ飛ぶことは無く、
  // 逆にここを止めると落下し続けるコマを拾えなくなる。
  const outForMs = isOutOfArena(sample) ? state.outForMs + step : 0

  // 傾きは「入るしきい値」と「抜けるしきい値」を分ける。
  let toppledForMs = state.toppledForMs
  if (sample.tiltRad >= TOPPLE_TILT_RAD) {
    toppledForMs += step
  } else if (sample.tiltRad <= TOPPLE_RELEASE_TILT_RAD) {
    toppledForMs = 0
  }
  // 間の角度では、たまった時間を増やしも減らしもしない。

  const spin = Math.abs(sample.spinSpeed)
  let stoppedForMs = state.stoppedForMs
  if (spin <= STOP_SPIN_SPEED && sample.linearSpeed <= STOP_LINEAR_SPEED) {
    stoppedForMs += step
  } else if (spin >= STOP_RELEASE_SPIN_SPEED) {
    stoppedForMs = 0
  }

  const next: KomaJudgeState = {
    defeatReason: null,
    defeatedAtMs: null,
    toppledForMs,
    stoppedForMs,
    outForMs,
  }

  if (outForMs >= OUT_SUSTAIN_MS) {
    next.defeatReason = 'outOfArena'
    next.defeatedAtMs = elapsedMs
    return next
  }
  // 場外以外は開始直後の猶予時間を過ぎてから確定させる。
  if (elapsedMs < START_GRACE_MS) return next

  if (toppledForMs >= TOPPLE_SUSTAIN_MS) {
    next.defeatReason = 'toppled'
    next.defeatedAtMs = elapsedMs
    return next
  }
  if (stoppedForMs >= STOP_SUSTAIN_MS) {
    next.defeatReason = 'stopped'
    next.defeatedAtMs = elapsedMs
    return next
  }
  return next
}

/** 決着のしかた。 */
export type MatchOutcome =
  | { kind: 'win'; winnerIndex: number; loserIndex: number; reason: KomaDefeatReason }
  | { kind: 'draw'; reason: 'simultaneous' | 'timeLimit' }
  /** 1個モードの終了。勝敗ではなく、どう終わったかだけを持つ。 */
  | { kind: 'soloFinished'; reason: KomaDefeatReason }

/**
 * 2個対戦の決着を判定する。まだ決まっていなければnull。
 *
 * 先に敗北条件を満たした側を負けとするが、SIMULTANEOUS_WINDOW_MS以内に
 * 両方が決まった場合は引き分けにする。そのため、片方だけが決まった直後は
 * すぐ確定させず、相手が続かないことを確認できるまで待つ。
 */
export function decideMatchOutcome(
  states: readonly KomaJudgeState[],
  elapsedMs: number,
): MatchOutcome | null {
  if (states.length === 1) {
    const only = states[0]!
    if (only.defeatReason === null) {
      return elapsedMs >= MATCH_TIME_LIMIT_MS
        ? { kind: 'soloFinished', reason: 'stopped' }
        : null
    }
    return { kind: 'soloFinished', reason: only.defeatReason }
  }

  const first = states[0]!
  const second = states[1]!

  if (first.defeatReason !== null && second.defeatReason !== null) {
    const gap = Math.abs(first.defeatedAtMs! - second.defeatedAtMs!)
    if (gap <= SIMULTANEOUS_WINDOW_MS) {
      return { kind: 'draw', reason: 'simultaneous' }
    }
    const loserIndex = first.defeatedAtMs! < second.defeatedAtMs! ? 0 : 1
    const loser = loserIndex === 0 ? first : second
    return {
      kind: 'win',
      winnerIndex: loserIndex === 0 ? 1 : 0,
      loserIndex,
      reason: loser.defeatReason!,
    }
  }

  const settledIndex =
    first.defeatReason !== null ? 0 : second.defeatReason !== null ? 1 : -1
  if (settledIndex >= 0) {
    const settled = settledIndex === 0 ? first : second
    // 相手が続けて決着する可能性がある間は確定させない。
    if (elapsedMs - settled.defeatedAtMs! < SIMULTANEOUS_WINDOW_MS) return null
    return {
      kind: 'win',
      winnerIndex: settledIndex === 0 ? 1 : 0,
      loserIndex: settledIndex,
      reason: settled.defeatReason!,
    }
  }

  if (elapsedMs >= MATCH_TIME_LIMIT_MS) {
    return { kind: 'draw', reason: 'timeLimit' }
  }
  return null
}
