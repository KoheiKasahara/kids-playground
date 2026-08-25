import { describe, expect, test } from 'vitest'
import { GRID_COLS, GRID_ROWS } from './boardLayout'
import {
  boardPointFromClient,
  canMovePart,
  canPlacePart,
  canRotatePart,
  isInsideBoard,
  occupiedCellKeys,
  occupiedCells,
  movePart,
  overlapsExistingPart,
  partAtCell,
  placePart,
  removePart,
  rotatePart,
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

  test('マスにあるパーツを引ける（盤面のパーツを選ぶときに使う）', () => {
    const parts = [plankAt(1, 1, 'part-a'), plankAt(3, 4, 'part-b')]
    expect(partAtCell(parts, { col: 1, row: 1 })?.id).toBe('part-a')
    expect(partAtCell(parts, { col: 3, row: 4 })?.id).toBe('part-b')
    expect(partAtCell(parts, { col: 2, row: 2 })).toBeNull()
    expect(partAtCell([], { col: 1, row: 1 })).toBeNull()
  })

  test('removePart は指定した1つだけを外し、元の配列は変えない', () => {
    const parts = [plankAt(1, 1, 'part-a'), plankAt(3, 4, 'part-b')]
    const removed = removePart(parts, 'part-a')
    expect(removed.map((part) => part.id)).toEqual(['part-b'])
    expect(parts).toHaveLength(2)
  })

  test('removePart に無いidを渡しても、残りは変わらない', () => {
    const parts = [plankAt(1, 1, 'part-a')]
    expect(removePart(parts, 'part-x').map((part) => part.id)).toEqual(['part-a'])
  })

  test('置いたパーツは、空いているマスへ動かせる', () => {
    const parts = [plankAt(1, 1, 'part-a'), plankAt(3, 4, 'part-b')]
    expect(canMovePart(parts, 'part-a', { col: 2, row: 2 })).toBe(true)
    // 自分自身とは重なりとみなさない（同じ場所へ戻す操作も許す）
    expect(canMovePart(parts, 'part-a', { col: 1, row: 1 })).toBe(true)
  })

  test('ほかのパーツの上・ボードの外へは動かせない', () => {
    const parts = [plankAt(1, 1, 'part-a'), plankAt(3, 4, 'part-b')]
    expect(canMovePart(parts, 'part-a', { col: 3, row: 4 })).toBe(false)
    expect(canMovePart(parts, 'part-a', { col: -1, row: 1 })).toBe(false)
    expect(canMovePart(parts, 'part-a', { col: GRID_COLS, row: 1 })).toBe(false)
    expect(canMovePart(parts, 'part-a', { col: 1, row: GRID_ROWS })).toBe(false)
    // 知らないidは動かせない
    expect(canMovePart(parts, 'part-x', { col: 2, row: 2 })).toBe(false)
  })

  test('movePart は id と並び順を保ったまま位置だけ変える', () => {
    const parts = [plankAt(1, 1, 'part-a'), plankAt(3, 4, 'part-b')]
    const moved = movePart(parts, 'part-a', { col: 5, row: 6 })
    expect(moved).not.toBeNull()
    expect(moved!.map((part) => part.id)).toEqual(['part-a', 'part-b'])
    expect(moved![0].cell).toEqual({ col: 5, row: 6 })
    expect(moved![1].cell).toEqual({ col: 3, row: 4 })
    // 元の配列は変わらない
    expect(parts[0].cell).toEqual({ col: 1, row: 1 })
  })

  test('movePart は動かせない位置では null を返す（元の場所へ戻す挙動に使う）', () => {
    const parts = [plankAt(1, 1, 'part-a'), plankAt(3, 4, 'part-b')]
    expect(movePart(parts, 'part-a', { col: 3, row: 4 })).toBeNull()
    expect(movePart(parts, 'part-a', { col: -1, row: 0 })).toBeNull()
  })

  test('回転できるときは、idとセルを保つ', () => {
    const parts = [plankAt(2, 3, 'part-a')]
    expect(canRotatePart(parts, 'part-a', 'slopeLeft')).toBe(true)
    const rotated = rotatePart(parts, 'part-a', 'slopeLeft')
    expect(rotated).toEqual([{ id: 'part-a', typeId: 'slopeLeft', cell: { col: 2, row: 3 } }])
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
