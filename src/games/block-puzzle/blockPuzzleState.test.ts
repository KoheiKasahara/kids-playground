import { describe, expect, test } from 'vitest'
import { BOARD_COLS, BOARD_ROWS } from './board'
import {
  createBlockPuzzleState,
  deleteSelectedPlacedBlock,
  moveSelectedPlacedBlock,
  placeSelectedBlock,
  rotatePendingShape,
  rotateSelectedPlacedBlock,
  selectPlacedBlock,
  selectShape,
  type BlockPuzzleState,
} from './blockPuzzleState'

/** 置けた前提で状態を進める小さなヘルパー（置けなければテストを失敗させる）。 */
function place(state: BlockPuzzleState, col: number, row: number): BlockPuzzleState {
  const next = placeSelectedBlock(state, { col, row })
  expect(next, `(${col},${row}) に置けるはず`).not.toBeNull()
  return next!
}

describe('blockPuzzleState', () => {
  test('最初は何も置かれておらず、1マスが選ばれている', () => {
    const state = createBlockPuzzleState()
    expect(state.placedBlocks).toEqual([])
    expect(state.selectedShapeId).toBe('single')
  })

  test('形を選ぶと選択中の形が変わる（置いたものには影響しない）', () => {
    const state = place(createBlockPuzzleState(), 0, 0)
    const selected = selectShape(state, 't')
    expect(selected.selectedShapeId).toBe('t')
    expect(selected.placedBlocks).toEqual(state.placedBlocks)
  })

  test('選んでいる形が、タップしたマスを基準セルにして置かれる', () => {
    const state = place(selectShape(createBlockPuzzleState(), 'o'), 2, 3)
    expect(state.placedBlocks).toEqual([
      { id: 'block-1', shapeId: 'o', anchor: { col: 2, row: 3 }, rotation: 0 },
    ])
  })

  test('配置済みブロックには一意なIDが振られる', () => {
    let state = place(createBlockPuzzleState(), 0, 0)
    state = place(state, 1, 0)
    state = place(state, 2, 0)
    expect(state.placedBlocks.map((placed) => placed.id)).toEqual(['block-1', 'block-2', 'block-3'])
  })

  test('同じ形を何個でも置ける', () => {
    let state = selectShape(createBlockPuzzleState(), 'o')
    state = place(state, 0, 0)
    state = place(state, 2, 0)
    state = place(state, 4, 0)
    expect(state.placedBlocks).toHaveLength(3)
    expect(state.placedBlocks.every((placed) => placed.shapeId === 'o')).toBe(true)
  })

  test('1マスブロックは繰り返し使える（盤面を全部埋められる）', () => {
    let state = createBlockPuzzleState()
    for (let row = 0; row < BOARD_ROWS; row += 1) {
      for (let col = 0; col < BOARD_COLS; col += 1) {
        state = place(state, col, row)
      }
    }
    expect(state.placedBlocks).toHaveLength(BOARD_COLS * BOARD_ROWS)
  })

  test('盤面外へはみ出す位置ではnullを返し、状態を変えない', () => {
    const state = selectShape(createBlockPuzzleState(), 'i')
    expect(placeSelectedBlock(state, { col: BOARD_COLS - 3, row: 0 })).toBeNull()
    expect(state.placedBlocks).toEqual([])
  })

  test('重なる位置ではnullを返し、パーツも消費しない', () => {
    const state = place(createBlockPuzzleState(), 1, 1)
    expect(placeSelectedBlock(state, { col: 1, row: 1 })).toBeNull()
    // 置けなかった後も、同じ形をほかの場所へ置ける。
    const next = place(state, 2, 1)
    expect(next.placedBlocks).toHaveLength(2)
  })

  test('更新関数は元の状態を書き換えない', () => {
    const state = createBlockPuzzleState()
    place(state, 0, 0)
    selectShape(state, 'z')
    expect(state.placedBlocks).toEqual([])
    expect(state.selectedShapeId).toBe('single')
  })
})

describe('blockPuzzleState: まわす（未配置パーツ）', () => {
  test('まわすたびに向きが90度ずつ進み、置いたときにその向きで置かれる', () => {
    let state = selectShape(createBlockPuzzleState(), 'i')
    expect(state.pendingRotation).toBe(0)
    state = rotatePendingShape(state)
    expect(state.pendingRotation).toBe(90)
    state = place(state, 2, 2)
    expect(state.placedBlocks[0]).toMatchObject({ shapeId: 'i', rotation: 90 })
  })

  test('4回まわすと元の向きに戻る', () => {
    let state = createBlockPuzzleState()
    for (let i = 0; i < 4; i += 1) {
      state = rotatePendingShape(state)
    }
    expect(state.pendingRotation).toBe(0)
  })

  test('対称形（1マス）をまわしても盤面には影響せず、置ける位置は変わらない', () => {
    let state = selectShape(createBlockPuzzleState(), 'single')
    state = rotatePendingShape(state)
    expect(placeSelectedBlock(state, { col: 3, row: 3 })).not.toBeNull()
  })

  test('形を選び直すと向きは0に戻る', () => {
    let state = selectShape(createBlockPuzzleState(), 'i')
    state = rotatePendingShape(state)
    state = selectShape(state, 'o')
    expect(state.pendingRotation).toBe(0)
  })
})

describe('blockPuzzleState: 配置済みパーツの選択', () => {
  test('IDを指定して選ぶと選択される', () => {
    const state = place(createBlockPuzzleState(), 1, 1)
    const selected = selectPlacedBlock(state, 'block-1')
    expect(selected.selectedPlacedBlockId).toBe('block-1')
  })

  test('選んでいるIDをもう一度指定すると選択が解ける（トグル）', () => {
    let state = place(createBlockPuzzleState(), 1, 1)
    state = selectPlacedBlock(state, 'block-1')
    state = selectPlacedBlock(state, 'block-1')
    expect(state.selectedPlacedBlockId).toBeNull()
  })

  test('別のIDを指定すると選択が切り替わる', () => {
    let state = place(createBlockPuzzleState(), 1, 1)
    state = place(state, 3, 3)
    state = selectPlacedBlock(state, 'block-1')
    state = selectPlacedBlock(state, 'block-2')
    expect(state.selectedPlacedBlockId).toBe('block-2')
  })
})

describe('blockPuzzleState: 配置済みパーツの回転', () => {
  test('選んでいるブロックが盤面内・重ならない向きへまわせる', () => {
    let state = selectShape(createBlockPuzzleState(), 'i')
    state = place(state, 1, 1)
    state = selectPlacedBlock(state, 'block-1')
    const rotated = rotateSelectedPlacedBlock(state)
    expect(rotated).not.toBeNull()
    expect(rotated!.placedBlocks[0]).toMatchObject({ id: 'block-1', rotation: 90 })
    // 選択も維持される。
    expect(rotated!.selectedPlacedBlockId).toBe('block-1')
  })

  test('回転すると盤面外へ出る場合はnullを返し、状態を変えない', () => {
    let state = selectShape(createBlockPuzzleState(), 'i')
    // 横4マスをいちばん下の行ぴったりに置く。縦へ回すとはみ出す。
    state = place(state, 0, BOARD_ROWS - 1)
    state = selectPlacedBlock(state, 'block-1')
    const rotated = rotateSelectedPlacedBlock(state)
    expect(rotated).toBeNull()
    expect(state.placedBlocks[0]).toMatchObject({ rotation: 0, anchor: { col: 0, row: BOARD_ROWS - 1 } })
  })

  test('回転すると他パーツと重なる場合はnullを返し、状態を変えない', () => {
    let state = selectShape(createBlockPuzzleState(), 'i')
    state = place(state, 0, 0)
    state = selectShape(state, 'single')
    state = place(state, 0, 2)
    state = selectPlacedBlock(state, 'block-1')
    const rotated = rotateSelectedPlacedBlock(state)
    expect(rotated).toBeNull()
    expect(state.placedBlocks).toHaveLength(2)
    expect(state.placedBlocks[0]).toMatchObject({ rotation: 0 })
  })

  test('何も選んでいなければnullを返す', () => {
    const state = place(createBlockPuzzleState(), 0, 0)
    expect(rotateSelectedPlacedBlock(state)).toBeNull()
  })
})

describe('blockPuzzleState: 配置済みパーツの移動', () => {
  test('あいている位置へ移動できる', () => {
    let state = place(createBlockPuzzleState(), 1, 1)
    state = selectPlacedBlock(state, 'block-1')
    const moved = moveSelectedPlacedBlock(state, { col: 4, row: 5 })
    expect(moved).not.toBeNull()
    expect(moved!.placedBlocks[0]).toMatchObject({ id: 'block-1', anchor: { col: 4, row: 5 } })
    expect(moved!.selectedPlacedBlockId).toBe('block-1')
  })

  test('移動先が盤面外の場合はnullを返し、元の位置を保つ', () => {
    let state = place(createBlockPuzzleState(), 1, 1)
    state = selectPlacedBlock(state, 'block-1')
    const moved = moveSelectedPlacedBlock(state, { col: BOARD_COLS, row: 1 })
    expect(moved).toBeNull()
    expect(state.placedBlocks[0]).toMatchObject({ anchor: { col: 1, row: 1 } })
  })

  test('移動先が他パーツと重なる場合はnullを返し、パーツが消えず元の位置を保つ', () => {
    let state = place(createBlockPuzzleState(), 1, 1)
    state = place(state, 4, 4)
    state = selectPlacedBlock(state, 'block-1')
    const moved = moveSelectedPlacedBlock(state, { col: 4, row: 4 })
    expect(moved).toBeNull()
    expect(state.placedBlocks).toHaveLength(2)
    expect(state.placedBlocks[0]).toMatchObject({ anchor: { col: 1, row: 1 } })
  })

  test('何も選んでいなければnullを返す', () => {
    const state = place(createBlockPuzzleState(), 0, 0)
    expect(moveSelectedPlacedBlock(state, { col: 1, row: 1 })).toBeNull()
  })
})

describe('blockPuzzleState: けす（削除）', () => {
  test('選んでいるブロックを削除でき、そのセルは他のブロックが使える', () => {
    let state = place(createBlockPuzzleState(), 1, 1)
    state = selectPlacedBlock(state, 'block-1')
    const deleted = deleteSelectedPlacedBlock(state)
    expect(deleted).not.toBeNull()
    expect(deleted!.placedBlocks).toEqual([])
    expect(deleted!.selectedPlacedBlockId).toBeNull()
    // 在庫という概念はないので、同じ形をまた同じ場所へ置ける。
    expect(placeSelectedBlock(deleted!, { col: 1, row: 1 })).not.toBeNull()
  })

  test('何も選んでいなければnullを返し、何も変えない', () => {
    const state = place(createBlockPuzzleState(), 0, 0)
    expect(deleteSelectedPlacedBlock(state)).toBeNull()
    expect(state.placedBlocks).toHaveLength(1)
  })
})
