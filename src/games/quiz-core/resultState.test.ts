import { describe, expect, test } from 'vitest'
import { isQuizResultState } from './resultState'

describe('isQuizResultState', () => {
  test.each([
    [{ correctCount: 0, totalCount: 10 }, true],
    [{ correctCount: 10, totalCount: 10 }, true],
    [{ correctCount: 3, totalCount: 0 }, false],
    [{ correctCount: -1, totalCount: 10 }, false],
    [{ correctCount: 11, totalCount: 10 }, false],
    [{ correctCount: 1.5, totalCount: 10 }, false],
    [{ correctCount: 1, totalCount: Number.POSITIVE_INFINITY }, false],
    [{ correctCount: 1, totalCount: Number.NaN }, false],
    [{ correctCount: '1', totalCount: 10 }, false],
    [null, false],
  ])('accepts %o: %s', (value, expected) => {
    expect(isQuizResultState(value)).toBe(expected)
  })

  test('can require an expected total count', () => {
    expect(isQuizResultState({ correctCount: 7, totalCount: 10 }, 10)).toBe(true)
    expect(isQuizResultState({ correctCount: 7, totalCount: 9 }, 10)).toBe(false)
  })
})
