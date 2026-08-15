export type DominoRuntimeState = {
  /** 直立からの傾き（ラジアン）。0が完全に立ち、Math.PI/2が完全に横倒し。 */
  tilt: number
  /** Rapierでsleep状態か。 */
  sleeping: boolean
}

/** 60度以上傾いたドミノを倒れたとみなす。 */
export const FALLEN_TILT_RAD = Math.PI / 3
/** 173個のうち92%以上が倒れて全体が静止したら通常完成とする。 */
export const COMPLETE_RATIO = 0.92
/** 連鎖が途中で止まっても80%以上ならタイムアウト完成とする。 */
export const TIMEOUT_RATIO = 0.8
/** 25秒を超えて動き続ける場合の上限時間。 */
export const HARD_TIMEOUT_MS = 25_000

export function isFallen(state: DominoRuntimeState): boolean {
  return state.tilt >= FALLEN_TILT_RAD
}

export function countFallen(states: DominoRuntimeState[]): number {
  return states.filter(isFallen).length
}

export type CompletionResult = {
  fallenRatio: number
  /** すべての剛体がsleepしているか。 */
  settled: boolean
  /** 通常判定またはタイムアウト判定で完成したか。 */
  complete: boolean
}

/**
 * 倒れた割合と全剛体のsleep状態から完成を判定する。
 * 長時間止まらない場合は、一定割合まで倒れていればタイムアウト完成とする。
 */
export function evaluateCompletion(
  states: DominoRuntimeState[],
  elapsedMs: number,
): CompletionResult {
  const fallenRatio = states.length === 0 ? 0 : countFallen(states) / states.length
  const settled = states.length > 0 && states.every((state) => state.sleeping)
  const completeBySettled = fallenRatio >= COMPLETE_RATIO && settled
  const completeByTimeout = elapsedMs >= HARD_TIMEOUT_MS && fallenRatio >= TIMEOUT_RATIO

  return {
    fallenRatio,
    settled,
    complete: completeBySettled || completeByTimeout,
  }
}
