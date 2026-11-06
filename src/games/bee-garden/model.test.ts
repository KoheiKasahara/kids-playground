import { describe, expect, it } from 'vitest'
import { STAGES, adjacent, isComplete, moves, solution } from './model'

describe('bee garden routes', () => {
  it.each(STAGES)('$name has a rectangular, solvable garden', stage => {
    expect(stage.tiles).toHaveLength(stage.cols * stage.rows)
    expect(stage.tiles.filter(tile => tile === 'H')).toHaveLength(1)
    expect(new Set(stage.cells).size).toBe(stage.cells.length)
    const answer = solution(stage, [stage.cells[0]])!
    expect(answer).not.toBeNull()
    expect(isComplete(stage, answer)).toBe(true)
    expect(new Set(answer.slice(0, -1)).size).toBe(stage.cells.length)
    expect(answer.slice(1).every((cell, i) => adjacent(stage, answer[i], cell))).toBe(true)
    expect(moves(stage, answer)).toEqual([])
  })

  it('keeps stage order for saved progress and grows towards larger gardens', () => {
    expect(STAGES.slice(0, 6).map(stage => stage.cells.length)).toEqual([4, 6, 8, 10, 12, 16])
    expect(Math.max(...STAGES.map(stage => stage.cols))).toBeLessThanOrEqual(6)
    expect(STAGES.at(-1)!.cells.length).toBeGreaterThan(16)
    expect(STAGES.some(stage => stage.tiles.includes('^'))).toBe(true)
  })

  it('does not wrap rows, revisit flowers or enter the hive early', () => {
    const stage = STAGES[0]
    expect(adjacent(STAGES[4], 3, 4)).toBe(false)
    expect(moves(stage, [0, 1])).toEqual([3])
    expect(moves(stage, [0, 1, 3, 2])).toEqual([0])
    expect(moves(stage, [0, 1, 3])).toEqual([2])
  })

  it('detects a dead end and permits recovery by undoing the route', () => {
    const stage = STAGES[3]
    const path = [0, 1, 5, 4, 8, 9]
    expect(moves(stage, path)).toEqual([])
    expect(solution(stage, path)).toBeNull()
    expect(solution(stage, path.slice(0, 2))).not.toBeNull()
  })

  it('answers hints quickly even from unlucky routes in the largest gardens', () => {
    let seed = 7
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    for (const stage of STAGES.slice(-3)) {
      for (let trial = 0; trial < 20; trial++) {
        const path = [stage.cells[0]]
        for (let next = moves(stage, path); next.length; next = moves(stage, path)) path.push(next[Math.floor(random() * next.length)])
        for (let length = 1; length <= path.length; length++) {
          const started = performance.now()
          solution(stage, path.slice(0, length))
          expect(performance.now() - started).toBeLessThan(200)
        }
      }
    }
  })
})
