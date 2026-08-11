import { describe, expect, test } from 'vitest'
import { deltaE2000, deltaE2000Lab, labFromHex } from './colorDifference'

describe('deltaE2000Lab', () => {
  test.each([
    [{ L: 50, a: 2.6772, b: -79.7751 }, { L: 50, a: 0, b: -82.7485 }, 2.0425],
    [{ L: 50, a: 0, b: 0 }, { L: 50, a: -1, b: 2 }, 2.3669],
    [{ L: 50, a: 2.5, b: 0 }, { L: 73, a: 25, b: -18 }, 27.1492],
    [{ L: 50, a: 2.5, b: 0 }, { L: 61, a: -5, b: 29 }, 22.8977],
    [{ L: 60.2574, a: -34.0099, b: 36.2677 }, { L: 60.4626, a: -34.1751, b: 39.4387 }, 1.2644],
    [{ L: 22.7233, a: 20.0904, b: -46.694 }, { L: 23.0331, a: 14.973, b: -42.5619 }, 2.0373],
  ])('published reference pair matches within 1e-4 (expected %#)', (first, second, expected) => {
    expect(deltaE2000Lab(first, second)).toBeCloseTo(expected, 4)
  })

  test('同じ色の距離は0', () => {
    const lab = labFromHex('#e94b3c')
    expect(lab).toBeDefined()
    expect(deltaE2000Lab(lab as NonNullable<typeof lab>, lab as NonNullable<typeof lab>)).toBe(0)
  })

  test('対称: どちら向きでも同じ距離', () => {
    const a = { L: 50, a: 20, b: -10 }
    const b = { L: 30, a: -5, b: 40 }
    expect(deltaE2000Lab(a, b)).toBeCloseTo(deltaE2000Lab(b, a), 10)
  })
})

describe('labFromHex', () => {
  test('不正な16進数は undefined', () => {
    expect(labFromHex('not-a-color')).toBeUndefined()
    expect(labFromHex('#fff')).toBeUndefined()
    expect(labFromHex('#gggggg')).toBeUndefined()
  })

  test('大文字小文字を区別しない', () => {
    expect(labFromHex('#E94B3C')).toEqual(labFromHex('#e94b3c'))
  })
})

describe('deltaE2000 (hex wrapper)', () => {
  test('白と黒はほぼ最大距離', () => {
    expect(deltaE2000('#ffffff', '#000000')).toBeGreaterThan(95)
  })

  test('同じ色は0', () => {
    expect(deltaE2000('#3977c7', '#3977c7')).toBe(0)
  })

  test('不正な16進数は NaN', () => {
    expect(deltaE2000('nope', '#3977c7')).toBeNaN()
    expect(deltaE2000('#3977c7', 'nope')).toBeNaN()
  })
})
