import type { GridCell } from './grid'
import { nextRotationType, type PartTypeId } from './partTypes'
import { movePart, placePart, removePart, rotatePart, type ParkedBallPosition, type PlacedPart } from './placement'

/**
 * ゲームの進行状態。
 * - edit    : パーツを置ける。ボールは開始位置で静止している
 * - running : 物理シミュレーション中。パーツは触れない
 * - stopped : 途中で止まった。位置を保って、そこからパーツを編集できる
 * - cleared : ゴールに入った。ゴール内では物理をそのまま継続する
 */
export type PuzzlePhase = 'edit' | 'running' | 'stopped' | 'cleared'

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
  /** stopped のときのボール中心。null は開始位置から始める状態 */
  readonly ballPosition: ParkedBallPosition
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
  return { phase: 'edit', parts: [], selectedPartId: null, ballPosition: null, runId: 0, nextPartNumber: 1 }
}

/** パーツを編集できる2つの状態。停止中も通常の編集操作を再利用する。 */
export function isEditingPhase(phase: PuzzlePhase): boolean {
  return phase === 'edit' || phase === 'stopped'
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
  if (!isEditingPhase(state.phase)) return null
  const parts = placePart(state.parts, typeId, cell, `part-${state.nextPartNumber}`, state.ballPosition)
  if (!parts) return null
  // 新しく置いたら、それまで選んでいたパーツの選択は解く（消す対象を取り違えないため）
  return { ...state, parts, selectedPartId: null, nextPartNumber: state.nextPartNumber + 1 }
}

/**
 * 置いてあるパーツを別のマスへ動かす。編集中で、動かせる位置のときだけ。
 * 動かせない位置なら null を返し、呼び出し側が「元の場所へ戻す」挙動を選べるようにする。
 * idは変えないので、選んでいたパーツはそのまま選ばれたまま移動する。
 */
export function tryMovePart(
  state: PuzzleState,
  partId: string,
  cell: GridCell,
): PuzzleState | null {
  if (!isEditingPhase(state.phase)) return null
  const parts = movePart(state.parts, partId, cell, state.ballPosition)
  if (!parts) return null
  return { ...state, parts }
}

/**
 * 盤面のパーツを選ぶ。編集中のときだけ受け付ける。
 * 同じパーツをもう一度選んだら選択を解く（タップだけで選び直せるようにする）。
 */
export function selectPart(state: PuzzleState, partId: string): PuzzleState {
  if (!isEditingPhase(state.phase)) return state
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
  if (!isEditingPhase(state.phase) || state.selectedPartId === null) return state
  return { ...state, parts: removePart(state.parts, state.selectedPartId), selectedPartId: null }
}

/** 選んでいるパーツを次の固定角度へ回す。置けない向きは現在のままにする。 */
export function rotateSelectedPart(state: PuzzleState): PuzzleState {
  if (!isEditingPhase(state.phase) || state.selectedPartId === null) return state
  const current = state.parts.find((part) => part.id === state.selectedPartId)
  if (!current) return state
  const parts = rotatePart(state.parts, current.id, nextRotationType(current.typeId), state.ballPosition)
  return parts ? { ...state, parts } : state
}

/** 「ボールをおとす」。開始位置、または途中停止位置から実行へ移る */
export function startRun(state: PuzzleState): PuzzleState {
  if (!isEditingPhase(state.phase)) return state
  return { ...state, phase: 'running', selectedPartId: null, runId: state.runId + 1 }
}

/** 実行中に途中停止した。物理エンジンから受け取った位置をそのまま保持する。 */
export function stopRun(state: PuzzleState, ballPosition: Exclude<ParkedBallPosition, null>): PuzzleState {
  if (state.phase !== 'running') return state
  return { ...state, phase: 'stopped', ballPosition }
}

/** ゴール到達。実行中のときだけクリアへ移る（同じ実行で二重に呼ばれても増えない） */
export function reachGoal(state: PuzzleState): PuzzleState {
  if (state.phase !== 'running') return state
  return { ...state, phase: 'cleared' }
}

/** 「ボールをもどす」。置いたパーツはそのままに、ボールだけ開始位置へ戻す */
export function returnBall(state: PuzzleState): PuzzleState {
  if (state.phase === 'edit') return state
  return { ...state, phase: 'edit', ballPosition: null, selectedPartId: null }
}

/** 「ぜんぶ けす」。パーツを全部外し、ボールも開始位置へ戻す */
export function clearAll(state: PuzzleState): PuzzleState {
  return { ...state, phase: 'edit', parts: [], selectedPartId: null, ballPosition: null }
}
