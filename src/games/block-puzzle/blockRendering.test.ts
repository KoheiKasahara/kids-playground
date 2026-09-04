import { describe, expect, test } from 'vitest'
import { cellBounds, cellEdges, normalizeCells, outlinePolygonPoints } from './blockRendering'
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

  describe('outlinePolygonPoints（#510: 選択枠を形なりの1本の輪郭にする）', () => {
    test('1マスは、そのマス自身を囲む四角形（1周ぶんの5頂点）になる', () => {
      expect(outlinePolygonPoints([{ col: 0, row: 0 }])).toEqual([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
        { x: 0, y: 0 },
      ])
    })

    test('2マス（横並び）は、内側の継ぎ目を挟まない1本の輪郭になる（セルの境目の頂点は残るが、内側に段差は出ない）', () => {
      const cells = normalizeCells(blockShape('duo').cells)
      expect(outlinePolygonPoints(cells)).toEqual([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 1 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
        { x: 0, y: 0 },
      ])
    })

    test('T型は、空きマスまで囲む長方形にならず、出っぱりに沿った1本の輪郭になる', () => {
      const cells = normalizeCells(blockShape('t').cells)
      expect(outlinePolygonPoints(cells)).toEqual([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 1 },
        { x: 2, y: 1 },
        { x: 2, y: 2 },
        { x: 1, y: 2 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
        { x: 0, y: 0 },
      ])
    })

    test('L型は、凹んだ角でも途切れずにつながった1本の輪郭になる', () => {
      const cells = normalizeCells(blockShape('l').cells)
      expect(outlinePolygonPoints(cells)).toEqual([
        { x: 2, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 1 },
        { x: 3, y: 2 },
        { x: 2, y: 2 },
        { x: 1, y: 2 },
        { x: 0, y: 2 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 2, y: 0 },
      ])
    })

    test('S型・Z型も、輪郭が始点に戻る1つの閉じたループになる', () => {
      for (const id of ['s', 'z'] as const) {
        const cells = normalizeCells(blockShape(id).cells)
        const points = outlinePolygonPoints(cells)
        expect(points.length).toBeGreaterThan(1)
        expect(points[0]).toEqual(points[points.length - 1])
        // 内側の継ぎ目を挟んだ分だけ頂点が増えるだけで、各セルの4辺の合計を超えない。
        expect(points.length - 1).toBeLessThanOrEqual(cells.length * 4)
      }
    })
  })
})
