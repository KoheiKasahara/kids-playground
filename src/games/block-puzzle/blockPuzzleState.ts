import type { BoardCell } from './board'
import { DEFAULT_BLOCK_SHAPE_ID, NO_ROTATION, type BlockShapeId } from './blockShapes'
import { placeBlock, type PlacedBlock } from './placement'

/**
 * ブロックパズル全体の状態。描画に依存しない素のデータだけを持ち、
 * 更新関数はすべて非破壊（引数を変えず新しい状態を返す）。
 */
export type BlockPuzzleState = {
  /** 置いた順に並ぶ配置済みブロック。盤面の正本。 */
  readonly placedBlocks: readonly PlacedBlock[]
  /** パーツ一覧でいま選んでいる形。常にどれか1つが選ばれている。 */
  readonly selectedShapeId: BlockShapeId
  /** ブロックIDの採番用。Reactのkeyにも使う。 */
  readonly nextBlockNumber: number
}

export function createBlockPuzzleState(): BlockPuzzleState {
  return {
    placedBlocks: [],
    selectedShapeId: DEFAULT_BLOCK_SHAPE_ID,
    nextBlockNumber: 1,
  }
}

/** パーツ一覧で形を選ぶ。同じ形は何度でも選べる（消費という概念を持たない）。 */
export function selectShape(state: BlockPuzzleState, shapeId: BlockShapeId): BlockPuzzleState {
  if (state.selectedShapeId === shapeId) return state
  return { ...state, selectedShapeId: shapeId }
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
    rotation: NO_ROTATION,
  }
  const placedBlocks = placeBlock(state.placedBlocks, block)
  if (!placedBlocks) return null
  return { ...state, placedBlocks, nextBlockNumber: state.nextBlockNumber + 1 }
}
