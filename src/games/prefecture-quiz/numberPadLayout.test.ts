import { describe, expect, test } from 'vitest'
import { columnsForCount, tightColumnsForCount } from './numberPadLayout'

describe('columnsForCount', () => {
  test.each([
    [1, 1], [2, 2], [3, 3], [4, 4], [5, 3], [6, 3], [7, 4], [8, 4], [9, 3],
  ])('%i件のときは%i列', (count, expected) => {
    expect(columnsForCount(count)).toBe(expected)
  })

  test('9件（最大の地方）は3列3行になる', () => {
    const columns = columnsForCount(9)
    expect(columns).toBe(3)
    expect(Math.ceil(9 / columns)).toBe(3)
  })
})

describe('tightColumnsForCount', () => {
  test.each([
    [1, 1], [2, 2], [3, 3], [4, 4], [5, 3], [6, 3], [7, 4], [8, 4], [9, 5],
  ])('%i件のときは%i列', (count, expected) => {
    expect(tightColumnsForCount(count)).toBe(expected)
  })

  test('9件でも行数は2行以内に収まる', () => {
    const columns = tightColumnsForCount(9)
    expect(Math.ceil(9 / columns)).toBeLessThanOrEqual(2)
  })
})
