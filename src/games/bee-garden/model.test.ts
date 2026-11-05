import { describe, expect, it } from 'vitest'
import { STAGES, adjacent, isComplete, moves, solution } from './model'

describe('bee garden routes', () => {
  it.each(STAGES)('$name has a solvable garden with unique in-bounds cells', stage => {
    expect(new Set(stage.cells).size).toBe(stage.cells.length)
    expect(stage.cells.every(cell => cell >= 0 && cell < 16)).toBe(true)
    const answer = solution(stage, [stage.cells[0]])!
    expect(answer).not.toBeNull()
    expect(isComplete(stage, answer)).toBe(true)
    expect(new Set(answer.slice(0, -1)).size).toBe(stage.cells.length)
    expect(answer.slice(1).every((cell, i) => adjacent(answer[i], cell))).toBe(true)
    expect(moves(stage, answer)).toEqual([])
  })
  it('does not wrap rows, revisit flowers or enter the hive early', () => {
    expect(adjacent(3, 4)).toBe(false)
    const stage = STAGES[0]
    expect(moves(stage, [5, 6])).toEqual([10])
    expect(moves(stage, [5, 6, 10, 9])).toEqual([5])
  })
  it('detects a dead end and permits recovery by undoing the route', () => {
    const stage = STAGES[3]
    const path = [0, 1, 5, 4, 8, 9]
    expect(moves(stage, path)).toEqual([])
    expect(solution(stage, path)).toBeNull()
    expect(solution(stage, path.slice(0, 2))).not.toBeNull()
  })
})
