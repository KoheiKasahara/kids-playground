import { describe, expect, test } from 'vitest'
import { cellAt, createInitialBoard, expandBoard, movePart, placePart, rotatePart } from './boardModel'
import { createPlacedPart } from './partDefinitions'

describe('car road board', () => {
  test('starts at four by four and expands east and south preserving cells', () => {
    let board = createInitialBoard()
    board = placePart(board, { row: 0, col: 0 }, createPlacedPart('curve', 7))
    const old = cellAt(board, 0, 0)
    board = expandBoard(board)
    expect(board.size).toEqual({ rows: 5, cols: 5 })
    expect(cellAt(board, 0, 0)).toEqual(old)
    expect(cellAt(board, 4, 4)?.kind).toBeNull()
  })

  test('supports placement, movement, rotation and one start/goal each', () => {
    let board = createInitialBoard()
    board = placePart(board, { row: 0, col: 0 }, 'start')
    expect(placePart(board, { row: 0, col: 1 }, 'start')).toBe(board)
    board = placePart(board, { row: 1, col: 1 }, 'straight')
    expect(rotatePart(board, { row: 1, col: 1 }).cells.find((cell) => cell.row === 1 && cell.col === 1)?.rotationStep).toBe(1)
    board = movePart(board, { row: 1, col: 1 }, { row: 1, col: 2 })
    expect(cellAt(board, 1, 1)?.kind).toBeNull()
    expect(cellAt(board, 1, 2)?.kind).toBe('straight')
  })

  test('moves a placed part without changing its orientation', () => {
    let board = createInitialBoard({ rows: 5, cols: 5 })
    board = placePart(board, { row: 2, col: 2 }, createPlacedPart('curve', 7))

    const moved = movePart(board, { row: 2, col: 2 }, { row: 4, col: 4 })

    expect(cellAt(moved, 2, 2)?.kind).toBeNull()
    expect(cellAt(moved, 4, 4)).toMatchObject({ kind: 'curve', rotationStep: 7 })
  })

  test('rejects occupied and out-of-board move targets without changing the board', () => {
    let board = createInitialBoard()
    board = placePart(board, { row: 0, col: 0 }, createPlacedPart('straight', 2))
    board = placePart(board, { row: 0, col: 1 }, 'curve')

    expect(movePart(board, { row: 0, col: 0 }, { row: 0, col: 1 })).toBe(board)
    expect(movePart(board, { row: 0, col: 0 }, { row: -1, col: 0 })).toBe(board)
    expect(cellAt(board, 0, 0)).toMatchObject({ kind: 'straight', rotationStep: 2 })
    expect(cellAt(board, 0, 1)?.kind).toBe('curve')
  })
})
