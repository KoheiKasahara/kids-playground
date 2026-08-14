import type { BallResult } from './types'

export type PinballScoreState = {
  /** 選択順の flagId。長さは BALL_COUNT */
  readonly flagIds: readonly string[]
  /** 各球の得点。まだ確定していない球は null。長さは flagIds と同じ */
  readonly scores: readonly (number | null)[]
}

/** 選択された flagId から初期状態を作る */
export function createScoreState(flagIds: readonly string[]): PinballScoreState {
  return {
    flagIds,
    scores: flagIds.map(() => null),
  }
}

/**
 * ballIndex の球の得点を確定する。
 * 物理エンジン側からは同じ球のセンサー通過イベントが複数回届く可能性があるため、
 * すでに確定済み、または範囲外の ballIndex なら状態を変えず同じ参照を返し、
 * 「1球の得点は一度だけ確定する」を保証する（二重加算の防止）。
 */
export function recordBallScore(state: PinballScoreState, ballIndex: number, score: number): PinballScoreState {
  if (ballIndex < 0 || ballIndex >= state.scores.length) return state
  if (state.scores[ballIndex] !== null) return state
  const nextScores = state.scores.slice()
  nextScores[ballIndex] = score
  return { ...state, scores: nextScores }
}

/** 確定済みの得点の合計 */
export function totalScore(state: PinballScoreState): number {
  return state.scores.reduce<number>((sum, score) => sum + (score ?? 0), 0)
}

/** 得点が確定した球の数 */
export function scoredCount(state: PinballScoreState): number {
  return state.scores.filter((score) => score !== null).length
}

/** 3球すべて確定したか */
export function isAllScored(state: PinballScoreState): boolean {
  return state.scores.every((score) => score !== null)
}

/** 結果画面に渡す形へ変換する。未確定の球は含めない */
export function toBallResults(state: PinballScoreState): BallResult[] {
  const results: BallResult[] = []
  state.scores.forEach((score, ballIndex) => {
    if (score === null) return
    const flagId = state.flagIds[ballIndex]
    results.push({ ballIndex, flagId, score })
  })
  return results
}
