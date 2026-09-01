import { describe, expect, test } from 'vitest'
import { cellAt, createInitialBoard, expandBoard, movePart, placePart, removePart, rotatePart } from './boardModel'
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

  test('keeps start and goal when deletion is requested, while allowing them to move', () => {
    let board = createInitialBoard({ rows: 5, cols: 5 })
    board = placePart(board, { row: 0, col: 0 }, createPlacedPart('start', 2))
    board = placePart(board, { row: 4, col: 4 }, createPlacedPart('goal', 2))

    expect(removePart(board, { row: 0, col: 0 })).toBe(board)
    expect(removePart(board, { row: 4, col: 4 })).toBe(board)

    const movedStart = movePart(board, { row: 0, col: 0 }, { row: 1, col: 1 })
    expect(cellAt(movedStart, 0, 0)?.kind).toBeNull()
    expect(cellAt(movedStart, 1, 1)).toMatchObject({ kind: 'start', rotationStep: 2 })

    const movedGoal = movePart(movedStart, { row: 4, col: 4 }, { row: 3, col: 3 })
    expect(cellAt(movedGoal, 4, 4)?.kind).toBeNull()
    expect(cellAt(movedGoal, 3, 3)).toMatchObject({ kind: 'goal', rotationStep: 2 })
  })

  test('swaps a marker with an occupied road cell without losing either part', () => {
    let board = createInitialBoard()
    board = placePart(board, { row: 0, col: 0 }, createPlacedPart('start', 2))
    board = placePart(board, { row: 0, col: 1 }, createPlacedPart('straight', 3))

    const swapped = movePart(board, { row: 0, col: 0 }, { row: 0, col: 1 })

    expect(cellAt(swapped, 0, 0)).toMatchObject({ kind: 'straight', rotationStep: 3 })
    expect(cellAt(swapped, 0, 1)).toMatchObject({ kind: 'start', rotationStep: 2 })
    expect(swapped.cells.filter((cell) => cell.kind !== null)).toHaveLength(2)
  })

  test('swaps start and goal while keeping one of each marker', () => {
    let board = createInitialBoard()
    board = placePart(board, { row: 0, col: 0 }, createPlacedPart('start', 5))
    board = placePart(board, { row: 1, col: 1 }, createPlacedPart('goal', 2))

    const swapped = movePart(board, { row: 0, col: 0 }, { row: 1, col: 1 })

    expect(cellAt(swapped, 0, 0)).toMatchObject({ kind: 'goal', rotationStep: 2 })
    expect(cellAt(swapped, 1, 1)).toMatchObject({ kind: 'start', rotationStep: 5 })
    expect(swapped.cells.filter((cell) => cell.kind === 'start')).toHaveLength(1)
    expect(swapped.cells.filter((cell) => cell.kind === 'goal')).toHaveLength(1)
  })

  test('moves a placed part without changing its orientation', () => {
    let board = createInitialBoard({ rows: 5, cols: 5 })
    board = placePart(board, { row: 2, col: 2 }, createPlacedPart('curve', 7))

    const moved = movePart(board, { row: 2, col: 2 }, { row: 4, col: 4 })

    expect(cellAt(moved, 2, 2)?.kind).toBeNull()
    expect(cellAt(moved, 4, 4)).toMatchObject({ kind: 'curve', rotationStep: 7 })
  })

  test('swaps occupied road cells and rejects out-of-board move targets', () => {
    let board = createInitialBoard()
    board = placePart(board, { row: 0, col: 0 }, createPlacedPart('straight', 2))
    board = placePart(board, { row: 0, col: 1 }, createPlacedPart('curve', 7))

    const swapped = movePart(board, { row: 0, col: 0 }, { row: 0, col: 1 })
    expect(cellAt(swapped, 0, 0)).toMatchObject({ kind: 'curve', rotationStep: 7 })
    expect(cellAt(swapped, 0, 1)).toMatchObject({ kind: 'straight', rotationStep: 2 })
    expect(movePart(board, { row: 0, col: 0 }, { row: -1, col: 0 })).toBe(board)
  })
})
