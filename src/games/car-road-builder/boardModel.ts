import { directionDelta, type Direction } from './direction'
import { createPlacedPart, normalizePartRotation, rotatePlacedPart, type PartKind, type PlacedPart } from './partDefinitions'

export type BoardSize = Readonly<{ rows: number; cols: number }>
export type CellCoordinate = Readonly<{ row: number; col: number }>

/** A board cell deliberately stores only id/kind/rotation; connections are derived. */
export type BoardCell = CellCoordinate & Readonly<{
  id: string
  kind: PartKind | null
  rotationStep: number
}>

export type Board = Readonly<{
  size: BoardSize
  cells: readonly BoardCell[]
}>

export const INITIAL_BOARD_SIZE: BoardSize = { rows: 4, cols: 4 }
export const MAX_BOARD_SIZE: BoardSize = { rows: 5, cols: 5 }

function validDimension(value: number): number {
  return Math.max(1, Math.trunc(value))
}

export function normalizeBoardSize(size: Partial<BoardSize> = {}): BoardSize {
  return { rows: validDimension(size.rows ?? INITIAL_BOARD_SIZE.rows), cols: validDimension(size.cols ?? INITIAL_BOARD_SIZE.cols) }
}

export function cellId(row: number, col: number): string {
  return `cell-${row}-${col}`
}

function makeCell(row: number, col: number): BoardCell {
  return { id: cellId(row, col), row, col, kind: null, rotationStep: 0 }
}

export function createBoard(size: Partial<BoardSize> = INITIAL_BOARD_SIZE): Board {
  const normalized = normalizeBoardSize(size)
  const cells: BoardCell[] = []
  for (let row = 0; row < normalized.rows; row += 1) {
    for (let col = 0; col < normalized.cols; col += 1) cells.push(makeCell(row, col))
  }
  return { size: normalized, cells }
}

export const createInitialBoard = (size: Partial<BoardSize> = INITIAL_BOARD_SIZE): Board => createBoard(size)

export function cellAt(board: Board, row: number, col: number): BoardCell | undefined {
  if (row < 0 || row >= board.size.rows || col < 0 || col >= board.size.cols) return undefined
  return board.cells.find((cell) => cell.row === row && cell.col === col)
}

export function getCell(board: Board, ref: string | CellCoordinate): BoardCell | undefined {
  if (typeof ref === 'string') return board.cells.find((cell) => cell.id === ref)
  return cellAt(board, ref.row, ref.col)
}

export function neighborCoordinate(cell: CellCoordinate, direction: Direction): CellCoordinate {
  const delta = directionDelta(direction)
  return { row: cell.row + delta.row, col: cell.col + delta.col }
}

/** One-cell movement, including diagonal movement to the adjacent corner cell. */
export function neighborCell(board: Board, cell: string | CellCoordinate | BoardCell, direction: Direction): BoardCell | undefined
export function neighborCell(cell: CellCoordinate, direction: Direction): CellCoordinate
export function neighborCell(
  boardOrCell: Board | CellCoordinate,
  cellOrDirection: string | CellCoordinate | BoardCell | Direction,
  maybeDirection?: Direction,
): BoardCell | CellCoordinate | undefined {
  if (maybeDirection === undefined) {
    const cell = boardOrCell as CellCoordinate
    return neighborCoordinate(cell, cellOrDirection as Direction)
  }
  const board = boardOrCell as Board
  const cell = cellOrDirection as string | CellCoordinate | BoardCell
  const source = typeof cell === 'string' ? getCell(board, cell) : cellAt(board, cell.row, cell.col)
  if (!source) return undefined
  const target = neighborCoordinate(source, maybeDirection)
  return cellAt(board, target.row, target.col)
}

export const getNeighborCell = neighborCell

function replaceCell(board: Board, updated: BoardCell): Board {
  return { ...board, cells: board.cells.map((cell) => cell.id === updated.id ? updated : cell) }
}

function resolveTarget(board: Board, target: string | CellCoordinate): BoardCell | undefined {
  return getCell(board, target)
}

function partFromCell(cell: BoardCell): PlacedPart | null {
  return cell.kind === null ? null : createPlacedPart(cell.kind, cell.rotationStep)
}

export type PartPlacement = PlacedPart | PartKind

function normalizePlacement(part: PartPlacement): PlacedPart {
  return typeof part === 'string' ? createPlacedPart(part) : createPlacedPart(part.kind, part.rotationStep)
}

export function getCellPart(cell: BoardCell): PlacedPart | null {
  return partFromCell(cell)
}

export function findPartCell(board: Board, kind: PartKind): BoardCell | undefined {
  return board.cells.find((cell) => cell.kind === kind)
}

export function canPlacePart(board: Board, target: string | CellCoordinate, part: PartPlacement): boolean {
  const cell = resolveTarget(board, target)
  if (!cell) return false
  if (cell.kind !== null) return false
  const placement = normalizePlacement(part)
  if ((placement.kind === 'start' || placement.kind === 'goal') && board.cells.some((candidate) => candidate.kind === placement.kind && candidate.id !== cell.id)) return false
  return true
}

function setPartAt(board: Board, cell: BoardCell, part: PlacedPart | null): Board {
  return replaceCell(board, {
    ...cell,
    kind: part?.kind ?? null,
    rotationStep: part ? normalizePartRotation(part.kind, part.rotationStep) : 0,
  })
}

/** Clear a cell for an internal move operation without applying delete rules. */
function clearPart(board: Board, target: string | CellCoordinate): Board {
  const cell = resolveTarget(board, target)
  return cell ? setPartAt(board, cell, null) : board
}

export function placePart(board: Board, target: string | CellCoordinate, part: PartPlacement): Board {
  const cell = resolveTarget(board, target)
  if (!cell || !canPlacePart(board, target, part)) return board
  return setPartAt(board, cell, normalizePlacement(part))
}

export function placePartAt(board: Board, row: number, col: number, part: PartPlacement): Board {
  return placePart(board, { row, col }, part)
}

export function removePart(board: Board, target: string | CellCoordinate): Board {
  const cell = resolveTarget(board, target)
  if (!cell || cell.kind === 'start' || cell.kind === 'goal') return board
  return clearPart(board, target)
}

export const deletePart = removePart

export function canMovePart(board: Board, from: string | CellCoordinate, to: string | CellCoordinate): boolean {
  const source = resolveTarget(board, from)
  const target = resolveTarget(board, to)
  const part = source ? partFromCell(source) : null
  if (!source || !target || !part || target.id === source.id) return false
  if (target.kind !== null) return true
  return canPlacePart(clearPart(board, source.id), target, part)
}

/** Move or swap a part while preserving each part's orientation and cell IDs. */
export function movePart(board: Board, from: string | CellCoordinate, to: string | CellCoordinate): Board {
  const source = resolveTarget(board, from)
  const target = resolveTarget(board, to)
  const part = source ? partFromCell(source) : null
  if (!source || !target || !part || !canMovePart(board, from, to)) return board
  const targetPart = partFromCell(target)
  const cleared = clearPart(board, source.id)
  const moved = setPartAt(cleared, target, part)
  return targetPart ? setPartAt(moved, source, targetPart) : moved
}

export function rotatePart(board: Board, target: string | CellCoordinate, amount?: number): Board {
  const cell = resolveTarget(board, target)
  if (!cell || cell.kind === null) return board
  const part = rotatePlacedPart(createPlacedPart(cell.kind, cell.rotationStep), amount)
  return setPartAt(board, cell, part)
}

export const rotatePlacedPartOnBoard = rotatePart

export function isBoardFull(board: Board): boolean {
  return board.cells.every((cell) => cell.kind !== null)
}

export function canExpandBoard(board: Board, maxSize: BoardSize = MAX_BOARD_SIZE): boolean {
  return board.size.rows < maxSize.rows || board.size.cols < maxSize.cols
}

/** Expand east and south, preserving every existing cell and its part. */
export function expandBoard(board: Board, maxSize: BoardSize = MAX_BOARD_SIZE): Board {
  const nextRows = Math.min(board.size.rows + 1, Math.max(board.size.rows, maxSize.rows))
  const nextCols = Math.min(board.size.cols + 1, Math.max(board.size.cols, maxSize.cols))
  if (nextRows === board.size.rows && nextCols === board.size.cols) return board
  const cells: BoardCell[] = []
  for (let row = 0; row < nextRows; row += 1) {
    for (let col = 0; col < nextCols; col += 1) {
      const previous = cellAt(board, row, col)
      cells.push(previous ?? makeCell(row, col))
    }
  }
  return { size: { rows: nextRows, cols: nextCols }, cells }
}

export const enlargeBoard = expandBoard

export function boardHasStartAndGoal(board: Board): boolean {
  return Boolean(findPartCell(board, 'start') && findPartCell(board, 'goal'))
}
