import { describe, expect, test } from 'vitest'
import { BOARD_CELL_COUNT, BOARD_COLS, BOARD_ROWS, cellKey } from './board'
import {
  canPlaceBlock,
  cellOwners,
  isBoardFull,
  isInsideBoardPlacement,
  occupiedCells,
  occupiedCellKeys,
  overlapsPlacedBlocks,
  placeBlock,
  placedBlockCells,
  type PlacedBlock,
} from './placement'

const block = (id: string, shapeId: PlacedBlock['shapeId'], col: number, row: number): PlacedBlock => ({
  id,
  shapeId,
  anchor: { col, row },
  rotation: 0,
})

describe('placement: 占有マス', () => {
  test('タップしたマスが基準セルになる', () => {
    expect(occupiedCells('single', { col: 3, row: 5 })).toEqual([{ col: 3, row: 5 }])
  })

  test('相対セルが基準位置ぶんだけずれる', () => {
    expect(occupiedCells('o', { col: 2, row: 1 })).toEqual([
      { col: 2, row: 1 },
      { col: 3, row: 1 },
      { col: 2, row: 2 },
      { col: 3, row: 2 },
    ])
  })

  test('基準セルより左へ伸びる形（L型）も正しく展開される', () => {
    expect(occupiedCells('l', { col: 3, row: 0 })).toEqual([
      { col: 3, row: 0 },
      { col: 1, row: 1 },
      { col: 2, row: 1 },
      { col: 3, row: 1 },
    ])
  })

  test('配置済みブロックからも同じ占有マスを導ける（占有マスは保存しない）', () => {
    expect(placedBlockCells(block('block-1', 'duo', 0, 0))).toEqual([
      { col: 0, row: 0 },
      { col: 1, row: 0 },
    ])
  })
})

describe('placement: 盤面内・盤面外の判定', () => {
  test('盤面のどの位置でも1マスは置ける', () => {
    for (let row = 0; row < BOARD_ROWS; row += 1) {
      for (let col = 0; col < BOARD_COLS; col += 1) {
        expect(canPlaceBlock([], 'single', { col, row })).toBe(true)
      }
    }
  })

  test('右端ぴったりに収まる位置は置ける', () => {
    // ながいぼう(4マス)は6列盤面の col=2 が右端ぴったり。
    expect(isInsideBoardPlacement('i', { col: BOARD_COLS - 4, row: 0 })).toBe(true)
    expect(canPlaceBlock([], 'i', { col: BOARD_COLS - 4, row: 0 })).toBe(true)
  })

  test('右へ1マスはみ出すと置けない', () => {
    expect(isInsideBoardPlacement('i', { col: BOARD_COLS - 3, row: 0 })).toBe(false)
    expect(canPlaceBlock([], 'i', { col: BOARD_COLS - 3, row: 0 })).toBe(false)
  })

  test('下へはみ出すと置けない', () => {
    expect(canPlaceBlock([], 'o', { col: 0, row: BOARD_ROWS - 2 })).toBe(true)
    expect(canPlaceBlock([], 'o', { col: 0, row: BOARD_ROWS - 1 })).toBe(false)
  })

  test('左へはみ出す形（L型を左端でタップ）は置けない', () => {
    expect(canPlaceBlock([], 'l', { col: 1, row: 0 })).toBe(false)
    expect(canPlaceBlock([], 'l', { col: 2, row: 0 })).toBe(true)
  })

  test('盤面の外のマスをタップした場合も置けない', () => {
    expect(canPlaceBlock([], 'single', { col: -1, row: 0 })).toBe(false)
    expect(canPlaceBlock([], 'single', { col: BOARD_COLS, row: 0 })).toBe(false)
    expect(canPlaceBlock([], 'single', { col: 0, row: BOARD_ROWS })).toBe(false)
  })
})

describe('placement: 重なりの判定', () => {
  const placed = [block('block-1', 'o', 1, 1)]

  test('既存ブロックと1マスでも重なると置けない', () => {
    expect(overlapsPlacedBlocks(placed, 'single', { col: 2, row: 2 })).toBe(true)
    expect(canPlaceBlock(placed, 'single', { col: 2, row: 2 })).toBe(false)
    // 横4マスの一部だけが重なる場合も弾く。
    expect(canPlaceBlock(placed, 'i', { col: 0, row: 1 })).toBe(false)
  })

  test('重ならない位置なら置ける', () => {
    expect(canPlaceBlock(placed, 'single', { col: 0, row: 0 })).toBe(true)
    expect(canPlaceBlock(placed, 'i', { col: 1, row: 3 })).toBe(true)
  })

  test('placeBlockは置けた場合だけ新しい配列を返し、元の配列を変えない', () => {
    const next = placeBlock(placed, block('block-2', 'single', 0, 0))
    expect(next).toHaveLength(2)
    expect(placed).toHaveLength(1)
    expect(placeBlock(placed, block('block-2', 'single', 1, 1))).toBeNull()
  })
})

describe('placement: 占有マスの一覧（#481/#482の土台）', () => {
  test('マスからブロックを引ける', () => {
    const blocks = [block('block-1', 'o', 0, 0), block('block-2', 'single', 3, 3)]
    const owners = cellOwners(blocks)
    expect(owners.get(cellKey({ col: 1, row: 1 }))?.id).toBe('block-1')
    expect(owners.get(cellKey({ col: 3, row: 3 }))?.id).toBe('block-2')
    expect(owners.get(cellKey({ col: 5, row: 5 }))).toBeUndefined()
  })

  test('占有マス数は置いたブロックのセル数の合計になる', () => {
    const blocks = [block('block-1', 'o', 0, 0), block('block-2', 'i', 0, 4)]
    expect(occupiedCellKeys(blocks).size).toBe(8)
    expect(occupiedCellKeys([]).size).toBe(0)
  })

  test('盤面をすべて1マスで埋めると占有マス数が総マス数と一致する', () => {
    const blocks: PlacedBlock[] = []
    for (let row = 0; row < BOARD_ROWS; row += 1) {
      for (let col = 0; col < BOARD_COLS; col += 1) {
        const next = placeBlock(blocks, block(`block-${col}-${row}`, 'single', col, row))
        expect(next).not.toBeNull()
        blocks.splice(0, blocks.length, ...next!)
      }
    }
    expect(occupiedCellKeys(blocks).size).toBe(BOARD_CELL_COUNT)
  })
})

describe('placement: isBoardFull（#482の完成判定）', () => {
  test('何も置いていなければ完成ではない', () => {
    expect(isBoardFull([])).toBe(false)
  })

  test('1マスでも空きがあれば完成ではない', () => {
    const blocks: PlacedBlock[] = []
    for (let row = 0; row < BOARD_ROWS; row += 1) {
      for (let col = 0; col < BOARD_COLS; col += 1) {
        // 最後の1マス（右下）だけ空けておく。
        if (row === BOARD_ROWS - 1 && col === BOARD_COLS - 1) continue
        const next = placeBlock(blocks, block(`block-${col}-${row}`, 'single', col, row))
        expect(next).not.toBeNull()
        blocks.splice(0, blocks.length, ...next!)
      }
    }
    expect(isBoardFull(blocks)).toBe(false)
  })

  test('最後の空きマスが埋まった瞬間に完成になる（行単位の消去はしない）', () => {
    const blocks: PlacedBlock[] = []
    for (let row = 0; row < BOARD_ROWS; row += 1) {
      for (let col = 0; col < BOARD_COLS; col += 1) {
        const next = placeBlock(blocks, block(`block-${col}-${row}`, 'single', col, row))
        expect(next).not.toBeNull()
        blocks.splice(0, blocks.length, ...next!)
        const isLastCell = row === BOARD_ROWS - 1 && col === BOARD_COLS - 1
        expect(isBoardFull(blocks)).toBe(isLastCell)
      }
    }
  })

  test('形が混ざっていてもマス基準で判定する（形ごとの数は問わない）', () => {
    let blocks: PlacedBlock[] = []
    blocks = placeBlock(blocks, block('block-o', 'o', 0, 0))!
    for (let row = 0; row < BOARD_ROWS; row += 1) {
      for (let col = 0; col < BOARD_COLS; col += 1) {
        if (col < 2 && row < 2) continue // 上の o(2x2) と重なるマスは飛ばす。
        blocks = placeBlock(blocks, block(`block-${col}-${row}`, 'single', col, row))!
      }
    }
    expect(isBoardFull(blocks)).toBe(true)
  })
})
