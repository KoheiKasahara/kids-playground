import { describe, expect, test } from 'vitest'
import { CELL_SIZE, GRID_COLS, GRID_LEFT, GRID_ROWS, GRID_TOP } from './boardLayout'
import { cellCenter, cellKey, isInsideGrid, nearestCell, sameCell } from './grid'

describe('grid', () => {
  test('マスの中心は、マスの大きさとグリッドの原点から求まる', () => {
    expect(cellCenter({ col: 0, row: 0 })).toEqual({
      x: GRID_LEFT + CELL_SIZE / 2,
      y: GRID_TOP + CELL_SIZE / 2,
    })
    expect(cellCenter({ col: 2, row: 3 })).toEqual({
      x: GRID_LEFT + 2 * CELL_SIZE + CELL_SIZE / 2,
      y: GRID_TOP + 3 * CELL_SIZE + CELL_SIZE / 2,
    })
  })

  test('グリッドの内側だけを内側と判定する', () => {
    expect(isInsideGrid({ col: 0, row: 0 })).toBe(true)
    expect(isInsideGrid({ col: GRID_COLS - 1, row: GRID_ROWS - 1 })).toBe(true)
    expect(isInsideGrid({ col: -1, row: 0 })).toBe(false)
    expect(isInsideGrid({ col: 0, row: -1 })).toBe(false)
    expect(isInsideGrid({ col: GRID_COLS, row: 0 })).toBe(false)
    expect(isInsideGrid({ col: 0, row: GRID_ROWS })).toBe(false)
  })

  test('マスの中心をそのまま渡すと、同じマスへスナップする', () => {
    for (const cell of [
      { col: 0, row: 0 },
      { col: 3, row: 5 },
      { col: GRID_COLS - 1, row: GRID_ROWS - 1 },
    ]) {
      expect(nearestCell(cellCenter(cell))).toEqual(cell)
    }
  })

  test('マスの中心から少しずれた点も、同じマスへ吸着する（1px単位の調整が要らない）', () => {
    const center = cellCenter({ col: 2, row: 4 })
    const almostEdge = CELL_SIZE / 2 - 1
    expect(nearestCell({ x: center.x - almostEdge, y: center.y - almostEdge })).toEqual({ col: 2, row: 4 })
    expect(nearestCell({ x: center.x + almostEdge, y: center.y + almostEdge })).toEqual({ col: 2, row: 4 })
  })

  test('境界を越えた点は隣のマスになる', () => {
    const center = cellCenter({ col: 2, row: 4 })
    expect(nearestCell({ x: center.x + CELL_SIZE / 2 + 1, y: center.y })).toEqual({ col: 3, row: 4 })
    expect(nearestCell({ x: center.x, y: center.y + CELL_SIZE / 2 + 1 })).toEqual({ col: 2, row: 5 })
  })

  test('グリッドの外を指した点は、端へ寄せずに範囲外のマスを返す', () => {
    // スタート帯（グリッドより上）とゴール帯（グリッドより下）
    expect(nearestCell({ x: 30, y: GRID_TOP - 10 }).row).toBe(-1)
    expect(nearestCell({ x: 30, y: GRID_TOP + GRID_ROWS * CELL_SIZE + 10 }).row).toBe(GRID_ROWS)
    expect(nearestCell({ x: -10, y: GRID_TOP + 10 }).col).toBe(-1)
  })

  test('cellKey と sameCell は同じマスを同じものとして扱う', () => {
    expect(cellKey({ col: 1, row: 2 })).toBe(cellKey({ col: 1, row: 2 }))
    expect(cellKey({ col: 1, row: 2 })).not.toBe(cellKey({ col: 2, row: 1 }))
    expect(sameCell({ col: 1, row: 2 }, { col: 1, row: 2 })).toBe(true)
    expect(sameCell({ col: 1, row: 2 }, { col: 1, row: 3 })).toBe(false)
  })
})
