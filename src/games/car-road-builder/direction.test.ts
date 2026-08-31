import { describe, expect, test } from 'vitest'
import { DIRECTIONS, DIRECTION_DELTAS, oppositeDirection, rotateDirection } from './direction'

describe('car road directions', () => {
  test('all directions have reciprocal opposites', () => {
    for (const direction of DIRECTIONS) expect(oppositeDirection(oppositeDirection(direction))).toBe(direction)
  })

  test('rotation advances clockwise through all eight ports', () => {
    expect(DIRECTIONS.map((direction) => rotateDirection('N', DIRECTIONS.indexOf(direction)))).toEqual([...DIRECTIONS])
    expect(rotateDirection('N', 8)).toBe('N')
    expect(rotateDirection('N', -1)).toBe('NW')
  })

  test('diagonal deltas move one row and one column', () => {
    expect(DIRECTION_DELTAS.NE).toEqual({ row: -1, col: 1 })
    expect(DIRECTION_DELTAS.SW).toEqual({ row: 1, col: -1 })
  })
})
