/**
 * 3投で1プレイのゲーム進行。
 *
 * 物理にもThree.jsにも依存しない小さな状態遷移だけを持つ。
 * 正解・不正解や失敗はなく、「何投目か」と「いくつ倒したか」だけを数える。
 */

/** 1プレイの投球数。Phase 1 は3投固定。 */
export const THROWS_PER_GAME = 3

export type BowlingPhase =
  /** ねらっている（ドラッグ待ち）。 */
  | 'aiming'
  /** 発射して、玉と積み木が動いている。 */
  | 'flying'
  /** 3投終わって結果を出している。 */
  | 'finished'

export type BowlingGameState = {
  phase: BowlingPhase
  /** 何投目か（0始まり）。 */
  throwIndex: number
  /** 投球ごとに倒した数。 */
  throwResults: readonly number[]
  /** 3投の合計。 */
  toppledTotal: number
}

export function createBowlingGameState(): BowlingGameState {
  return { phase: 'aiming', throwIndex: 0, throwResults: [], toppledTotal: 0 }
}

/** 発射した瞬間。ねらっている間だけ受け付ける。 */
export function startThrow(state: BowlingGameState): BowlingGameState {
  if (state.phase !== 'aiming') return state
  return { ...state, phase: 'flying' }
}

/**
 * 1投が落ち着いたとき。倒した数を記録し、次の投球か結果へ進む。
 *
 * 各投のはじめに積み木は組み直すので、合計は「3回ぶんの倒した数の和」になる。
 * 1投目で全部倒しても、2投目・3投目がつまらなくならないための決まり。
 */
export function finishThrow(state: BowlingGameState, toppled: number): BowlingGameState {
  if (state.phase !== 'flying') return state
  const safeToppled = Number.isFinite(toppled) ? Math.max(0, Math.floor(toppled)) : 0
  const throwResults = [...state.throwResults, safeToppled]
  const toppledTotal = throwResults.reduce((sum, value) => sum + value, 0)
  const nextThrowIndex = state.throwIndex + 1
  if (nextThrowIndex >= THROWS_PER_GAME) {
    return { phase: 'finished', throwIndex: THROWS_PER_GAME, throwResults, toppledTotal }
  }
  return { phase: 'aiming', throwIndex: nextThrowIndex, throwResults, toppledTotal }
}

/** 「もういちど」。前のプレイの記録を一切引き継がない。 */
export function restartGame(): BowlingGameState {
  return createBowlingGameState()
}

/** 画面に出す「何投目 / 全何投」。finished のときは全投数のままにする。 */
export function currentThrowNumber(state: BowlingGameState): number {
  return Math.min(THROWS_PER_GAME, state.throwIndex + (state.phase === 'finished' ? 0 : 1))
}
