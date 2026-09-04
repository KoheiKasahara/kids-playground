import type { BoardCell } from './board'
import {
  DEFAULT_BLOCK_SHAPE_ID,
  NO_ROTATION,
  nextRotation,
  type BlockRotation,
  type BlockShapeId,
} from './blockShapes'
import { canPlaceBlock, placeBlock, type PlacedBlock } from './placement'

/**
 * ブロックパズル全体の状態。描画に依存しない素のデータだけを持ち、
 * 更新関数はすべて非破壊（引数を変えず新しい状態を返す）。
 */
export type BlockPuzzleState = {
  /** 置いた順に並ぶ配置済みブロック。盤面の正本。 */
  readonly placedBlocks: readonly PlacedBlock[]
  /** パーツ一覧でいま選んでいる形。常にどれか1つが選ばれている。 */
  readonly selectedShapeId: BlockShapeId
  /** まだ置いていない選択中の形の向き。まわすボタンで進み、置いたときにそのまま使われる。 */
  readonly pendingRotation: BlockRotation
  /**
   * 盤面上でいま選んでいる配置済みブロックのID。
   * これが立っている間は「配置済みパーツを編集するモード」になり、
   * 盤面タップは新規配置ではなく移動先の指定として扱われる。
   */
  readonly selectedPlacedBlockId: string | null
  /** ブロックIDの採番用。Reactのkeyにも使う。 */
  readonly nextBlockNumber: number
}

export function createBlockPuzzleState(): BlockPuzzleState {
  return {
    placedBlocks: [],
    selectedShapeId: DEFAULT_BLOCK_SHAPE_ID,
    pendingRotation: NO_ROTATION,
    selectedPlacedBlockId: null,
    nextBlockNumber: 1,
  }
}

/**
 * パーツ一覧で形を選ぶ。同じ形は何度でも選べる（消費という概念を持たない）。
 * 配置済みパーツの選択中に押した場合は、そちらの選択を解いて新規配置モードへ戻す
 * （パーツ一覧の選択と盤面上パーツの選択を同時に持たせないことで混同を防ぐ）。
 */
export function selectShape(state: BlockPuzzleState, shapeId: BlockShapeId): BlockPuzzleState {
  if (
    state.selectedShapeId === shapeId &&
    state.pendingRotation === NO_ROTATION &&
    state.selectedPlacedBlockId === null
  ) {
    return state
  }
  return {
    ...state,
    selectedShapeId: shapeId,
    pendingRotation: NO_ROTATION,
    selectedPlacedBlockId: null,
  }
}

/**
 * まだ置いていない選択中の形を90度回す。盤面には触れないので必ず成功する。
 */
export function rotatePendingShape(state: BlockPuzzleState): BlockPuzzleState {
  return { ...state, pendingRotation: nextRotation(state.pendingRotation) }
}

/**
 * 選んでいる形を、タップされたマスを基準セルにして置く。
 * 置けない位置なら null を返し、呼び出し側が軽い視覚フィードバックだけを出せるようにする。
 */
export function placeSelectedBlock(
  state: BlockPuzzleState,
  cell: BoardCell,
): BlockPuzzleState | null {
  const block: PlacedBlock = {
    id: `block-${state.nextBlockNumber}`,
    shapeId: state.selectedShapeId,
    anchor: cell,
    rotation: state.pendingRotation,
  }
  const placedBlocks = placeBlock(state.placedBlocks, block)
  if (!placedBlocks) return null
  return { ...state, placedBlocks, nextBlockNumber: state.nextBlockNumber + 1 }
}

/**
 * 盤面上のブロックをタップして、その1パーツ全体を選ぶ。
 * すでに選んでいるブロックをもう一度タップすると選択を解く（トグル）。
 */
export function selectPlacedBlock(state: BlockPuzzleState, blockId: string): BlockPuzzleState {
  const selectedPlacedBlockId = state.selectedPlacedBlockId === blockId ? null : blockId
  return { ...state, selectedPlacedBlockId }
}

/** 盤面上パーツの選択を解く（何も選んでいなければ何もしない）。 */
export function clearPlacedBlockSelection(state: BlockPuzzleState): BlockPuzzleState {
  if (state.selectedPlacedBlockId === null) return state
  return { ...state, selectedPlacedBlockId: null }
}

/**
 * いま選んでいる配置済みブロックを90度回す。
 * 回した結果が盤面外へ出る、または他のブロックと重なる場合は何も変えずに null を返す
 * （選択も向きも位置も、呼び出し前のまま残る）。
 */
export function rotateSelectedPlacedBlock(state: BlockPuzzleState): BlockPuzzleState | null {
  const target = state.placedBlocks.find((block) => block.id === state.selectedPlacedBlockId)
  if (!target) return null

  const rotation = nextRotation(target.rotation)
  const others = state.placedBlocks.filter((block) => block.id !== target.id)
  if (!canPlaceBlock(others, target.shapeId, target.anchor, rotation)) return null

  const placedBlocks = state.placedBlocks.map((block) =>
    block.id === target.id ? { ...block, rotation } : block,
  )
  return { ...state, placedBlocks }
}

/**
 * いま選んでいる配置済みブロックを、タップされたマスを新しい基準セルにして動かす。
 * 移動先が盤面外へ出る、または他のブロックと重なる場合は何も変えずに null を返し、
 * 元の位置をそのまま守る（操作の途中でパーツが消えることはない）。
 */
export function moveSelectedPlacedBlock(
  state: BlockPuzzleState,
  cell: BoardCell,
): BlockPuzzleState | null {
  const target = state.placedBlocks.find((block) => block.id === state.selectedPlacedBlockId)
  if (!target) return null

  const others = state.placedBlocks.filter((block) => block.id !== target.id)
  if (!canPlaceBlock(others, target.shapeId, cell, target.rotation)) return null

  const placedBlocks = state.placedBlocks.map((block) =>
    block.id === target.id ? { ...block, anchor: cell } : block,
  )
  return { ...state, placedBlocks }
}

/**
 * いま選んでいる配置済みブロックを削除する。何も選んでいなければ null を返す。
 * パーツ在庫という概念は持たないので、削除した形も一覧からまた何度でも選べる。
 */
export function deleteSelectedPlacedBlock(state: BlockPuzzleState): BlockPuzzleState | null {
  if (state.selectedPlacedBlockId === null) return null
  const placedBlocks = state.placedBlocks.filter(
    (block) => block.id !== state.selectedPlacedBlockId,
  )
  return { ...state, placedBlocks, selectedPlacedBlockId: null }
}

/**
 * 「ぜんぶけす」。プレイ途中でも盤面だけを空にする（#482）。
 * いま選んでいる形・向きはそのまま残し、置き直す作業をすぐ再開できるようにする
 * （パーツ一覧まで初期化する「もういっかい」とはここが違う）。
 */
export function resetBoard(state: BlockPuzzleState): BlockPuzzleState {
  if (state.placedBlocks.length === 0 && state.selectedPlacedBlockId === null) return state
  return { ...state, placedBlocks: [], selectedPlacedBlockId: null }
}
