import { describe, expect, test } from 'vitest'
import { advanceStroke, finishStroke, startStroke } from './rollerStroke'
import { COLORS, PAPERS, PATTERNS } from './rollerData'

describe('distance sampled roller', () => {
  test('fast and slow events leave identical marks, including a release endpoint', () => {
    const fast = startStroke({ x: 0, y: 0 })
    const slow = startStroke({ x: 0, y: 0 })
    const expected = advanceStroke(fast, { x: 300, y: 0 }, 37)
    const actual = Array.from({ length: 100 }, (_, i) => advanceStroke(slow, { x: (i + 1) * 3, y: 0 }, 37)).flat()
    expect(actual).toEqual(expected)
    expect(actual.map(p => p.x)).toEqual([0, 37, 74, 111, 148, 185, 222, 259, 296])
  })
  test('carries leftover distance around corners and faces each segment', () => {
    const cursor = startStroke({ x: 0, y: 0 })
    expect(advanceStroke(cursor, { x: 15, y: 0 }, 20)).toEqual([{ x: 0, y: 0, angle: 0 }])
    expect(advanceStroke(cursor, { x: 15, y: 30 }, 20)).toEqual([
      { x: 15, y: 5, angle: Math.PI / 2 }, { x: 15, y: 25, angle: Math.PI / 2 },
    ])
    expect(advanceStroke(cursor, { x: 0, y: 30 }, 20)[0]).toEqual({ x: 0, y: 30, angle: Math.PI })
  })
  test('first mark follows direction; taps give one stamp; zero movement does not duplicate', () => {
    const cursor = startStroke({ x: 80, y: 80 })
    expect(advanceStroke(cursor, { x: 80, y: 80 }, 30)).toEqual([])
    expect(finishStroke(cursor)).toEqual([{ x: 80, y: 80, angle: 0 }])
    expect(advanceStroke(cursor, { x: 80, y: 60 }, 30)).toEqual([{ x: 80, y: 80, angle: -Math.PI / 2 }])
    expect(finishStroke(cursor)).toEqual([])
  })
  test('invalid samples do not corrupt the current stroke', () => {
    const cursor = startStroke({ x: 0, y: 0 })
    expect(advanceStroke(cursor, { x: NaN, y: 0 }, 20)).toEqual([])
    expect(advanceStroke(cursor, { x: 30, y: 0 }, 0)).toEqual([])
    expect(advanceStroke(cursor, { x: 30, y: 0 }, 20)).toHaveLength(2)
  })
  test('long sessions retain only a cursor and emit work proportional to distance', () => {
    const cursor = startStroke({ x: 0, y: 0 })
    let count = 0
    for (let i = 1; i <= 10000; i++) count += advanceStroke(cursor, { x: i, y: 0 }, 15).length
    expect(count).toBe(667)
    expect(cursor.remaining).toBe(5)
  })
  test('pickers have unique IDs and valid drawing data', () => {
    for (const data of [PATTERNS.map(p => p.id), COLORS.map(c => c.value), PAPERS.map(p => p.id)]) expect(new Set(data).size).toBe(data.length)
    for (const p of PATTERNS) { expect(p.path).toMatch(/^M/); expect(p.spacing).toBeGreaterThan(0) }
  })
})
