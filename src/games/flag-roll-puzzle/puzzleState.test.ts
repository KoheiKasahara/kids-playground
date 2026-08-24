import { describe, expect, test } from 'vitest'
import {
  clearAll,
  clearPartSelection,
  createPuzzleState,
  reachGoal,
  removeSelectedPart,
  returnBall,
  selectPart,
  startRun,
  tryPlacePart,
} from './puzzleState'

/** 板を2枚置いた編集中の状態 */
function stateWithTwoParts() {
  const first = tryPlacePart(createPuzzleState(), 'plank', { col: 1, row: 1 })!
  return tryPlacePart(first, 'slopeLeft', { col: 3, row: 4 })!
}

describe('puzzleState', () => {
  test('最初は編集中で、パーツは何も置かれていない', () => {
    const state = createPuzzleState()
    expect(state.phase).toBe('edit')
    expect(state.parts).toEqual([])
    expect(state.runId).toBe(0)
  })

  test('編集中はパーツを置ける。IDは重複しない', () => {
    const first = tryPlacePart(createPuzzleState(), 'plank', { col: 1, row: 1 })
    expect(first).not.toBeNull()
    const second = tryPlacePart(first!, 'slopeLeft', { col: 2, row: 1 })
    expect(second).not.toBeNull()
    expect(second!.parts).toHaveLength(2)
    expect(second!.parts[0].id).not.toBe(second!.parts[1].id)
  })

  test('同じマスへは2つ置けない', () => {
    const placed = tryPlacePart(createPuzzleState(), 'plank', { col: 1, row: 1 })!
    expect(tryPlacePart(placed, 'slopeRight', { col: 1, row: 1 })).toBeNull()
    expect(placed.parts).toHaveLength(1)
  })

  test('ボードの外へは置けない', () => {
    expect(tryPlacePart(createPuzzleState(), 'plank', { col: -1, row: 1 })).toBeNull()
  })

  test('実行中はパーツを置けない（配置と実行を混ぜない）', () => {
    const running = startRun(tryPlacePart(createPuzzleState(), 'plank', { col: 1, row: 1 })!)
    expect(running.phase).toBe('running')
    expect(tryPlacePart(running, 'plank', { col: 2, row: 2 })).toBeNull()
  })

  test('「ボールをおとす」で実行へ移り、実行の世代(runId)が進む', () => {
    const state = createPuzzleState()
    const running = startRun(state)
    expect(running.phase).toBe('running')
    expect(running.runId).toBe(state.runId + 1)
    // 実行中にもう一度押しても二重に始まらない
    expect(startRun(running)).toBe(running)
  })

  test('ゴールは実行中のときだけ受け付ける', () => {
    const running = startRun(createPuzzleState())
    const cleared = reachGoal(running)
    expect(cleared.phase).toBe('cleared')
    // 同じ実行で二度呼ばれても状態は変わらない
    expect(reachGoal(cleared)).toBe(cleared)
    expect(reachGoal(createPuzzleState()).phase).toBe('edit')
  })

  test('「ボールをもどす」は、置いたパーツを残したまま編集へ戻す', () => {
    const placed = tryPlacePart(createPuzzleState(), 'plank', { col: 1, row: 1 })!
    const returned = returnBall(reachGoal(startRun(placed)))
    expect(returned.phase).toBe('edit')
    expect(returned.parts).toHaveLength(1)
  })

  test('盤面のパーツを選べる。同じパーツをもう一度選ぶと解除される', () => {
    const state = stateWithTwoParts()
    const [first, second] = state.parts
    expect(state.selectedPartId).toBeNull()

    const selected = selectPart(state, first.id)
    expect(selected.selectedPartId).toBe(first.id)
    expect(selectPart(selected, first.id).selectedPartId).toBeNull()
    expect(selectPart(selected, second.id).selectedPartId).toBe(second.id)
  })

  test('存在しないパーツや、実行中の選択は受け付けない', () => {
    const state = stateWithTwoParts()
    expect(selectPart(state, 'part-none')).toBe(state)
    const running = startRun(state)
    expect(selectPart(running, state.parts[0].id)).toBe(running)
  })

  test('選んだパーツを1つだけ消せる。ほかのパーツは残る', () => {
    const state = stateWithTwoParts()
    const [first, second] = state.parts
    const removed = removeSelectedPart(selectPart(state, first.id))
    expect(removed.parts.map((part) => part.id)).toEqual([second.id])
    expect(removed.selectedPartId).toBeNull()
  })

  test('何も選んでいなければ、消す操作は何も起こさない', () => {
    const state = stateWithTwoParts()
    expect(removeSelectedPart(state)).toBe(state)
    expect(clearPartSelection(state)).toBe(state)
  })

  test('実行中は選んでいたパーツを消せない', () => {
    const selected = selectPart(stateWithTwoParts(), 'part-1')
    const running = startRun(selected)
    // 実行へ移る時点で選択は解ける（実行中に消す対象が残らないようにする）
    expect(running.selectedPartId).toBeNull()
    expect(removeSelectedPart(running)).toBe(running)
  })

  test('新しくパーツを置くと、それまでの選択は解ける', () => {
    const selected = selectPart(stateWithTwoParts(), 'part-1')
    const placed = tryPlacePart(selected, 'plank', { col: 5, row: 6 })!
    expect(placed.selectedPartId).toBeNull()
  })

  test('「ぜんぶけす」は、パーツを全部外して編集へ戻す', () => {
    const placed = tryPlacePart(createPuzzleState(), 'plank', { col: 1, row: 1 })!
    const cleared = clearAll(startRun(placed))
    expect(cleared.phase).toBe('edit')
    expect(cleared.parts).toEqual([])
    expect(cleared.selectedPartId).toBeNull()
  })
})
