import type { BoardCell } from './board'
import {
  DEFAULT_BLOCK_SHAPE_ID,
  NO_ROTATION,
  nextRotation,
  type BlockRotation,
  type BlockShapeId,
} from './blockShapes'
import {
  canPlaceBlock,
  isInsideBoardPlacement,
  occupiedCells,
  overlapsPlacedBlocks,
  placeBlock,
  placedBlockCells,
  type PlacedBlock,
} from './placement'

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
 * いま選んでいる配置済みブロックを90度回す。回した結果が盤面外へ出る、または
 * 他のブロックと重なる場合でも、回転そのものは必ず成功させる（#483）。
 * そのかわりその場所のままでは「まだ確定していない（はみ出た／重なった）」状態になり、
 * isSelectedPlacedBlockConfirmed() で検知できる。確定させるには、その状態のまま
 * 動かせる場所（タップまたはドラッグ）へ移動させるか、けす で取り除く。
 * 選んでいるブロックがなければ null を返す。
 */
export function rotateSelectedPlacedBlock(state: BlockPuzzleState): BlockPuzzleState | null {
  const target = state.placedBlocks.find((block) => block.id === state.selectedPlacedBlockId)
  if (!target) return null

  const rotation = nextRotation(target.rotation)
  const placedBlocks = state.placedBlocks.map((block) =>
    block.id === target.id ? { ...block, rotation } : block,
  )
  return { ...state, placedBlocks }
}

/**
 * いま選んでいる配置済みブロックが、いまの場所・向きのまま盤面に収まっているか。
 * 選んでいるブロックがなければ（判定の対象がないので）true を返す。
 * #483 の回転は常に成功するため、この確定判定を使って
 * 「はみ出た／重なったままの状態」を見た目や案内で知らせる。
 */
export function isSelectedPlacedBlockConfirmed(state: BlockPuzzleState): boolean {
  const target = state.placedBlocks.find((block) => block.id === state.selectedPlacedBlockId)
  if (!target) return true
  const others = state.placedBlocks.filter((block) => block.id !== target.id)
  return canPlaceBlock(others, target.shapeId, target.anchor, target.rotation)
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
 * ドラッグで配置済みブロックを動かす（#483）。タップでの移動と違い、
 * 移動先がふさがっていても、そこにいるパーツがちょうど1つだけで、
 * お互いの場所を交換しても盤面内・重なりなしに収まるなら入れ替える。
 * 移動も入れ替えもできない場合は null を返し、呼び出し側が
 * （ドラッグを離した位置を戻すなど）軽い視覚フィードバックだけを出せるようにする。
 * 成功した場合は動かしたブロックを選択状態にする。
 */
export function moveOrSwapPlacedBlock(
  state: BlockPuzzleState,
  blockId: string,
  targetAnchor: BoardCell,
): BlockPuzzleState | null {
  const target = state.placedBlocks.find((block) => block.id === blockId)
  if (!target) return null

  const others = state.placedBlocks.filter((block) => block.id !== blockId)

  if (canPlaceBlock(others, target.shapeId, targetAnchor, target.rotation)) {
    const placedBlocks = state.placedBlocks.map((block) =>
      block.id === blockId ? { ...block, anchor: targetAnchor } : block,
    )
    return { ...state, placedBlocks, selectedPlacedBlockId: blockId }
  }

  // 移動先がふさがっている場合、そこと重なるパーツがちょうど1つだけなら入れ替えを試す。
  const targetCells = occupiedCells(target.shapeId, targetAnchor, target.rotation)
  const overlapping = others.filter((block) =>
    placedBlockCells(block).some((cell) =>
      targetCells.some((targetCell) => targetCell.col === cell.col && targetCell.row === cell.row),
    ),
  )
  if (overlapping.length !== 1) return null

  const partner = overlapping[0]
  const rest = others.filter((block) => block.id !== partner.id)
  const movedTarget: PlacedBlock = { ...target, anchor: targetAnchor }
  const movedPartner: PlacedBlock = { ...partner, anchor: target.anchor }

  const swapValid =
    isInsideBoardPlacement(movedTarget.shapeId, movedTarget.anchor, movedTarget.rotation) &&
    isInsideBoardPlacement(movedPartner.shapeId, movedPartner.anchor, movedPartner.rotation) &&
    !overlapsPlacedBlocks(rest, movedTarget.shapeId, movedTarget.anchor, movedTarget.rotation) &&
    !overlapsPlacedBlocks(rest, movedPartner.shapeId, movedPartner.anchor, movedPartner.rotation) &&
    !overlapsPlacedBlocks([movedTarget], movedPartner.shapeId, movedPartner.anchor, movedPartner.rotation)
  if (!swapValid) return null

  const placedBlocks = state.placedBlocks.map((block) => {
    if (block.id === movedTarget.id) return movedTarget
    if (block.id === movedPartner.id) return movedPartner
    return block
  })
  return { ...state, placedBlocks, selectedPlacedBlockId: blockId }
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
