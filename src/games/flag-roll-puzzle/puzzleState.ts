import type { GridCell } from './grid'
import type { PartTypeId } from './partTypes'
import { placePart, removePart, type PlacedPart } from './placement'

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
   * 盤面でいま選んでいるパーツのid。選んでいなければ null。
   * Phase 1では「選んだ1枚だけ消す」ためだけに使うが、Phase 2で足す移動・回転も
   * 「まず選ぶ → 選んだものを操作する」という同じ流れになるため、選択状態は
   * 画面のローカルな状態ではなくゲームの状態として持たせてある。
   */
  readonly selectedPartId: string | null
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
  return { phase: 'edit', parts: [], selectedPartId: null, runId: 0, nextPartNumber: 1 }
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
  // 新しく置いたら、それまで選んでいたパーツの選択は解く（消す対象を取り違えないため）
  return { ...state, parts, selectedPartId: null, nextPartNumber: state.nextPartNumber + 1 }
}

/**
 * 盤面のパーツを選ぶ。編集中のときだけ受け付ける。
 * 同じパーツをもう一度選んだら選択を解く（タップだけで選び直せるようにする）。
 */
export function selectPart(state: PuzzleState, partId: string): PuzzleState {
  if (state.phase !== 'edit') return state
  if (!state.parts.some((part) => part.id === partId)) return state
  return { ...state, selectedPartId: state.selectedPartId === partId ? null : partId }
}

/** 選択を解く。何も選んでいなければ状態を変えない */
export function clearPartSelection(state: PuzzleState): PuzzleState {
  if (state.selectedPartId === null) return state
  return { ...state, selectedPartId: null }
}

/** 選んでいるパーツを1つだけ外す。編集中で、かつ選んでいるときだけ */
export function removeSelectedPart(state: PuzzleState): PuzzleState {
  if (state.phase !== 'edit' || state.selectedPartId === null) return state
  return { ...state, parts: removePart(state.parts, state.selectedPartId), selectedPartId: null }
}

/** 「ボールをおとす」。編集中のときだけ実行へ移る */
export function startRun(state: PuzzleState): PuzzleState {
  if (state.phase !== 'edit') return state
  return { ...state, phase: 'running', selectedPartId: null, runId: state.runId + 1 }
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
  return { ...state, phase: 'edit', parts: [], selectedPartId: null }
}
