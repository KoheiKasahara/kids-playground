import { describe, expect, test } from 'vitest'
import {
  BOARD_CELL_COUNT,
  BOARD_COLS,
  BOARD_ROWS,
  allBoardCells,
  cellKey,
  isInsideBoard,
} from './board'

describe('board: 盤面', () => {
  test('スマホ縦で遊びやすい6×8を採用している', () => {
    expect([BOARD_COLS, BOARD_ROWS]).toEqual([6, 8])
    expect(BOARD_CELL_COUNT).toBe(48)
  })

  test('盤面の内側だけを内側と判定する', () => {
    expect(isInsideBoard({ col: 0, row: 0 })).toBe(true)
    expect(isInsideBoard({ col: BOARD_COLS - 1, row: BOARD_ROWS - 1 })).toBe(true)
    expect(isInsideBoard({ col: -1, row: 0 })).toBe(false)
    expect(isInsideBoard({ col: 0, row: -1 })).toBe(false)
    expect(isInsideBoard({ col: BOARD_COLS, row: 0 })).toBe(false)
    expect(isInsideBoard({ col: 0, row: BOARD_ROWS })).toBe(false)
  })

  test('全マスを左上から行優先で重複なく並べる', () => {
    const cells = allBoardCells()
    expect(cells).toHaveLength(BOARD_CELL_COUNT)
    expect(cells[0]).toEqual({ col: 0, row: 0 })
    expect(cells[1]).toEqual({ col: 1, row: 0 })
    expect(cells[BOARD_CELL_COUNT - 1]).toEqual({ col: BOARD_COLS - 1, row: BOARD_ROWS - 1 })
    expect(new Set(cells.map(cellKey)).size).toBe(BOARD_CELL_COUNT)
  })
})
