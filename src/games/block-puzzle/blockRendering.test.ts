import { describe, expect, test } from 'vitest'
import { cellBounds, cellEdges, normalizeCells } from './blockRendering'
import { blockShape } from './blockShapes'

describe('blockRendering', () => {
  test('セル群を囲む長方形を求める', () => {
    expect(cellBounds(blockShape('i').cells)).toEqual({ minCol: 0, minRow: 0, cols: 4, rows: 1 })
    expect(cellBounds(blockShape('l').cells)).toEqual({ minCol: -2, minRow: 0, cols: 3, rows: 2 })
    expect(cellBounds([{ col: 3, row: 5 }])).toEqual({ minCol: 3, minRow: 5, cols: 1, rows: 1 })
  })

  test('負の相対セルを持つ形も左上そろえに直せる', () => {
    expect(normalizeCells(blockShape('l').cells)).toEqual([
      { col: 2, row: 0 },
      { col: 0, row: 1 },
      { col: 1, row: 1 },
      { col: 2, row: 1 },
    ])
  })

  test('1マスは四辺すべてが外周', () => {
    expect(cellEdges([{ col: 0, row: 0 }], { col: 0, row: 0 })).toEqual({
      top: true,
      right: true,
      bottom: true,
      left: true,
    })
  })

  test('隣り合うセルの間は外周にならない（1つのパーツに見せるため）', () => {
    const cells = normalizeCells(blockShape('duo').cells)
    expect(cellEdges(cells, { col: 0, row: 0 }).right).toBe(false)
    expect(cellEdges(cells, { col: 1, row: 0 }).left).toBe(false)
    expect(cellEdges(cells, { col: 0, row: 0 }).left).toBe(true)
    expect(cellEdges(cells, { col: 1, row: 0 }).right).toBe(true)
  })

  test('T型の出っぱりの根元だけが内側の辺になる', () => {
    const cells = normalizeCells(blockShape('t').cells)
    // 下段まんなかのセルは上だけが内側。
    expect(cellEdges(cells, { col: 1, row: 1 })).toEqual({
      top: false,
      right: true,
      bottom: true,
      left: true,
    })
    // 上段まんなかのセルは左右と下が内側。
    expect(cellEdges(cells, { col: 1, row: 0 })).toEqual({
      top: true,
      right: false,
      bottom: false,
      left: false,
    })
  })
})
