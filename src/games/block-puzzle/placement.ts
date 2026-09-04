import { BOARD_CELL_COUNT, cellKey, isInsideBoard, type BoardCell } from './board'
import { shapeCells, type BlockRotation, type BlockShapeId, NO_ROTATION } from './blockShapes'

/**
 * 盤面に置かれたブロック1個。盤面の正本はこの配列であり、
 * 「どのマスが何色か」の色配列は持たない（描画のたびにここから導出する）。
 *
 * 占有マスも保存せず placedBlockCells() で導出するため、
 * #481 で anchor / rotation を書き換えるだけで移動・回転が成立し、
 * 占有マスとの食い違いが構造的に起きない。
 */
export type PlacedBlock = {
  /** 一意なID。#481 の「配置済みパーツを選ぶ・動かす・消す」はこのIDを鍵にする。 */
  readonly id: string
  readonly shapeId: BlockShapeId
  /** 基準セルの絶対位置（＝置いたときにタップされたマス）。 */
  readonly anchor: BoardCell
  readonly rotation: BlockRotation
}

/** その形・向き・基準位置が占有する、盤面の絶対マス一覧。 */
export function occupiedCells(
  shapeId: BlockShapeId,
  anchor: BoardCell,
  rotation: BlockRotation = NO_ROTATION,
): BoardCell[] {
  return shapeCells(shapeId, rotation).map((offset) => ({
    col: anchor.col + offset.col,
    row: anchor.row + offset.row,
  }))
}

/** 配置済みブロックが占有する絶対マス一覧。 */
export function placedBlockCells(block: PlacedBlock): BoardCell[] {
  return occupiedCells(block.shapeId, block.anchor, block.rotation)
}

/**
 * マス → そのマスを占有しているブロック の対応表。
 * 描画（マスの色・読み上げラベル）と重なり判定の両方がこれ1つを使う。
 * #481 の「盤面をタップして配置済みパーツを選ぶ」も、#482 の「全マス埋まったか」も
 * この表から素直に導ける（後者は size === BOARD_CELL_COUNT）。
 */
export function cellOwners(blocks: readonly PlacedBlock[]): Map<string, PlacedBlock> {
  const owners = new Map<string, PlacedBlock>()
  for (const block of blocks) {
    for (const cell of placedBlockCells(block)) {
      owners.set(cellKey(cell), block)
    }
  }
  return owners
}

/** 置かれている全ブロックが占有しているマスのキー集合。 */
export function occupiedCellKeys(blocks: readonly PlacedBlock[]): Set<string> {
  return new Set(cellOwners(blocks).keys())
}

/** 占有マスがすべて盤面の内側に収まるか（盤面外への配置を拒否する）。 */
export function isInsideBoardPlacement(
  shapeId: BlockShapeId,
  anchor: BoardCell,
  rotation: BlockRotation = NO_ROTATION,
): boolean {
  return occupiedCells(shapeId, anchor, rotation).every(isInsideBoard)
}

/** 既に置かれているブロックと1マスでも重なるか。 */
export function overlapsPlacedBlocks(
  blocks: readonly PlacedBlock[],
  shapeId: BlockShapeId,
  anchor: BoardCell,
  rotation: BlockRotation = NO_ROTATION,
): boolean {
  const taken = occupiedCellKeys(blocks)
  return occupiedCells(shapeId, anchor, rotation).some((cell) => taken.has(cellKey(cell)))
}

/** そのマスへ置けるか。盤面外と、既存ブロックとの重なりの両方を弾く。 */
export function canPlaceBlock(
  blocks: readonly PlacedBlock[],
  shapeId: BlockShapeId,
  anchor: BoardCell,
  rotation: BlockRotation = NO_ROTATION,
): boolean {
  return (
    isInsideBoardPlacement(shapeId, anchor, rotation) &&
    !overlapsPlacedBlocks(blocks, shapeId, anchor, rotation)
  )
}

/**
 * ブロックを1つ追加した新しい配列を返す。置けない位置なら null を返す。
 * 例外にしないのは、幼児向けに「置けなかっただけ」で失敗扱いにせず、
 * 呼び出し側が軽い表示だけを返せるようにするため。
 */
export function placeBlock(
  blocks: readonly PlacedBlock[],
  block: PlacedBlock,
): PlacedBlock[] | null {
  if (!canPlaceBlock(blocks, block.shapeId, block.anchor, block.rotation)) return null
  return [...blocks, block]
}

/**
 * 盤面の全マスがブロックで埋まっているか（#482 の完成条件）。
 * 行単位の消去は行わないため、ここでは「マス」の占有数だけを見る
 * （何個のブロックで埋まったかは問わない）。1マスでも空きがあれば false。
 */
export function isBoardFull(blocks: readonly PlacedBlock[]): boolean {
  return cellOwners(blocks).size === BOARD_CELL_COUNT
}
