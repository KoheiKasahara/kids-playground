import { describe, expect, test } from 'vitest'
import { createStageBoard, STAGES } from './stageDefinitions'

describe('car road stage definitions', () => {
  test.each([
    ['normal', 4],
    ['wide', 5],
  ] as const)('%s creates a fresh square board with only its markers', (stageId, size) => {
    const board = createStageBoard(stageId)
    const occupied = board.cells.filter((cell) => cell.kind !== null)

    expect(board.size).toEqual(STAGES[stageId].size)
    expect(board.cells).toHaveLength(size * size)
    expect(occupied).toHaveLength(2)
    expect(board.cells.find((cell) => cell.kind === 'start')).toMatchObject({ row: 0, col: 0 })
    expect(board.cells.find((cell) => cell.kind === 'goal')).toMatchObject({ row: size - 1, col: size - 1 })
  })
})

