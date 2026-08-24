import { describe, expect, test } from 'vitest'
import { GRID_COLS, GRID_ROWS } from './boardLayout'
import {
  boardPointFromClient,
  canPlacePart,
  isInsideBoard,
  occupiedCellKeys,
  occupiedCells,
  overlapsExistingPart,
  placePart,
  type PlacedPart,
} from './placement'

const plankAt = (col: number, row: number, id = `part-${col}-${row}`): PlacedPart => ({
  id,
  typeId: 'plank',
  cell: { col, row },
})

describe('placement', () => {
  test('1マスのパーツは、そのアンカーセルだけを占有する', () => {
    expect(occupiedCells('plank', { col: 2, row: 3 })).toEqual([{ col: 2, row: 3 }])
    expect(occupiedCells('slopeLeft', { col: 0, row: 0 })).toEqual([{ col: 0, row: 0 }])
  })

  test('置かれた全パーツの占有マスを集計できる', () => {
    const keys = occupiedCellKeys([plankAt(0, 0), plankAt(1, 2)])
    expect(keys.size).toBe(2)
    expect(keys.has('0,0')).toBe(true)
    expect(keys.has('1,2')).toBe(true)
    expect(keys.has('1,1')).toBe(false)
  })

  test('ボード（グリッド）の外へは置けない', () => {
    expect(isInsideBoard('plank', { col: 0, row: 0 })).toBe(true)
    expect(isInsideBoard('plank', { col: GRID_COLS - 1, row: GRID_ROWS - 1 })).toBe(true)
    expect(isInsideBoard('plank', { col: -1, row: 0 })).toBe(false)
    expect(isInsideBoard('plank', { col: GRID_COLS, row: 0 })).toBe(false)
    // スタート帯（row: -1）とゴール帯（row: GRID_ROWS）はグリッドの外なので置けない
    expect(isInsideBoard('plank', { col: 0, row: -1 })).toBe(false)
    expect(isInsideBoard('plank', { col: 0, row: GRID_ROWS })).toBe(false)
  })

  test('既に置かれたパーツと重なる位置かを判定できる', () => {
    const parts = [plankAt(1, 1)]
    expect(overlapsExistingPart(parts, 'plank', { col: 1, row: 1 })).toBe(true)
    // 種類が違っても、同じマスを使うなら重なりとして弾く
    expect(overlapsExistingPart(parts, 'slopeRight', { col: 1, row: 1 })).toBe(true)
    expect(overlapsExistingPart(parts, 'plank', { col: 1, row: 2 })).toBe(false)
  })

  test('canPlacePart は ボード外 と 重なり の両方を弾く', () => {
    const parts = [plankAt(1, 1)]
    expect(canPlacePart(parts, 'plank', { col: 2, row: 1 })).toBe(true)
    expect(canPlacePart(parts, 'plank', { col: 1, row: 1 })).toBe(false)
    expect(canPlacePart(parts, 'plank', { col: GRID_COLS, row: 1 })).toBe(false)
  })

  test('placePart は置けたときだけ新しい配列を返し、元の配列は変えない', () => {
    const parts = [plankAt(1, 1)]
    const placed = placePart(parts, 'slopeLeft', { col: 2, row: 1 }, 'part-new')
    expect(placed).not.toBeNull()
    expect(placed).toHaveLength(2)
    expect(placed?.[1]).toEqual({ id: 'part-new', typeId: 'slopeLeft', cell: { col: 2, row: 1 } })
    expect(parts).toHaveLength(1)
  })

  test('placePart は重なる位置・ボード外では null を返す（元の場所へ戻す挙動に使う）', () => {
    const parts = [plankAt(1, 1)]
    expect(placePart(parts, 'plank', { col: 1, row: 1 }, 'part-new')).toBeNull()
    expect(placePart(parts, 'plank', { col: -1, row: 1 }, 'part-new')).toBeNull()
  })

  test('ポインタ座標を、盤面の拡縮を打ち消して論理座標へ戻す', () => {
    const rect = { left: 20, top: 100 }
    expect(boardPointFromClient(20, 100, rect, 1)).toEqual({ x: 0, y: 0 })
    expect(boardPointFromClient(80, 160, rect, 1)).toEqual({ x: 60, y: 60 })
    // 0.5倍で描画されている盤面では、画面上の30pxが論理60pxにあたる
    expect(boardPointFromClient(50, 130, rect, 0.5)).toEqual({ x: 60, y: 60 })
  })

  test('倍率が未計測(0)でも、NaNや無限大を盤面座標へ持ち込まない', () => {
    expect(boardPointFromClient(50, 130, { left: 20, top: 100 }, 0)).toEqual({ x: 0, y: 0 })
  })
})
