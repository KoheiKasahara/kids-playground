import { describe, expect, test } from 'vitest'
import { BOARD_COLS, BOARD_ROWS } from './board'
import {
  createBlockPuzzleState,
  placeSelectedBlock,
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
