import type { GridCell } from './grid'
import type { PartTypeId } from './partTypes'
import { placePart, type PlacedPart } from './placement'

/**
 * ゲームの進行状態。
 * - edit    : パーツを置ける。ボールは開始位置で静止している
 * - running : 物理シミュレーション中。パーツは触れない
 * - cleared : ゴールに入った。ボールはゴールで止まっている
 *
 * Phase 2で追加する「途中停止して、その位置のまま編集へ戻る」は、
 * ここに stopped のような状態を足し、ボールの位置を状態へ持たせる形で拡張する。
 * 今はまだその情報を持たない（使わない仕組みを先に作らない）。
 */
export type PuzzlePhase = 'edit' | 'running' | 'cleared'

export type PuzzleState = {
  readonly phase: PuzzlePhase
  readonly parts: readonly PlacedPart[]
  /**
   * 物理世界の世代。「ボールをおとす」たびに増やす。
   * エンジン側はこの値の変化を見て世界を作り直すので、前回の実行の速度や
   * 位置が次の実行へ持ち越されないことを構造で保証できる。
   */
  readonly runId: number
  /** パーツIDの採番用。React の key と物理Bodyのラベルに使う */
  readonly nextPartNumber: number
}

export function createPuzzleState(): PuzzleState {
  return { phase: 'edit', parts: [], runId: 0, nextPartNumber: 1 }
}

/**
 * パーツを1つ置く。編集中でない、または置けない位置のときは null を返す
 * （呼び出し側が「置けなかった」ことを子どもへ伝えられるようにする）。
 */
export function tryPlacePart(
  state: PuzzleState,
  typeId: PartTypeId,
  cell: GridCell,
): PuzzleState | null {
  if (state.phase !== 'edit') return null
  const parts = placePart(state.parts, typeId, cell, `part-${state.nextPartNumber}`)
  if (!parts) return null
  return { ...state, parts, nextPartNumber: state.nextPartNumber + 1 }
}

/** 「ボールをおとす」。編集中のときだけ実行へ移る */
export function startRun(state: PuzzleState): PuzzleState {
  if (state.phase !== 'edit') return state
  return { ...state, phase: 'running', runId: state.runId + 1 }
}

/** ゴール到達。実行中のときだけクリアへ移る（同じ実行で二重に呼ばれても増えない） */
export function reachGoal(state: PuzzleState): PuzzleState {
  if (state.phase !== 'running') return state
  return { ...state, phase: 'cleared' }
}

/** 「ボールをもどす」。置いたパーツはそのままに、ボールだけ開始位置へ戻す */
export function returnBall(state: PuzzleState): PuzzleState {
  if (state.phase === 'edit') return state
  return { ...state, phase: 'edit' }
}

/** 「ぜんぶ けす」。パーツを全部外し、ボールも開始位置へ戻す */
export function clearAll(state: PuzzleState): PuzzleState {
  return { ...state, phase: 'edit', parts: [] }
}
