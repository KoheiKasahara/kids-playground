import { describe, expect, test } from 'vitest'
import { SECTORS, buildRingMask, buildRingMasks, buildRingShapes, normalizeSector, totalGapWidth, wallRuns } from './rings'

describe('buildRingMask', () => {
  test('すきまを 指定しなければ ぐるりと かべになる', () => {
    const mask = buildRingMask([])
    expect(mask).toHaveLength(SECTORS)
    expect(mask.every((cell) => cell === 1)).toBe(true)
  })

  test('すきまは 中心角から 左右へ ひろがる', () => {
    const mask = buildRingMask([{ center: 90, width: 20 }])
    expect(mask[90]).toBe(0)
    expect(mask[80]).toBe(0)
    expect(mask[100]).toBe(0)
    expect(mask[79]).toBe(1)
    expect(mask[101]).toBe(1)
  })

  test('0度を またぐ すきまも 途切れない', () => {
    const mask = buildRingMask([{ center: 0, width: 30 }])
    expect(mask[0]).toBe(0)
    expect(mask[SECTORS - 10]).toBe(0)
    expect(mask[10]).toBe(0)
    expect(mask[180]).toBe(1)
  })

  test('すきまを ふたつ あけられる', () => {
    const mask = buildRingMask([{ center: 90, width: 16 }, { center: 270, width: 16 }])
    expect(mask[90]).toBe(0)
    expect(mask[270]).toBe(0)
    expect(mask[180]).toBe(1)
    expect(mask.reduce((sum, cell) => sum + cell, 0)).toBeLessThan(SECTORS)
  })
})

describe('buildRingMasks', () => {
  test('かべの ない slot は null のままにする', () => {
    const masks = buildRingMasks([{ slot: 2, gaps: [{ center: 90, width: 20 }] }], 5)
    expect(masks).toHaveLength(5)
    expect(masks[0]).toBeNull()
    expect(masks[2]?.[90]).toBe(0)
  })

  test('範囲の そとの slot は 無視する', () => {
    const masks = buildRingMasks([{ slot: 9, gaps: [] }, { slot: -1, gaps: [] }], 5)
    expect(masks.every((mask) => mask === null)).toBe(true)
  })
})

test('normalizeSector は マイナスでも 0..359 に おさまる', () => {
  expect(normalizeSector(-1)).toBe(SECTORS - 1)
  expect(normalizeSector(SECTORS)).toBe(0)
  expect(normalizeSector(-SECTORS - 5)).toBe(SECTORS - 5)
})

test('totalGapWidth は すきまの 合計角度を 返す', () => {
  expect(totalGapWidth({ slot: 0, gaps: [{ center: 0, width: 20 }, { center: 180, width: 10 }] })).toBe(30)
})

describe('wallRuns', () => {
  test('すきまが なければ ひとまわり ぶんの かべ 1本になる', () => {
    expect(wallRuns(buildRingMask([]))).toEqual([{ from: 0, length: SECTORS }])
  })

  test('すきまが ひとつなら かべも ひとつづき', () => {
    const runs = wallRuns(buildRingMask([{ center: 90, width: 20 }]))
    expect(runs).toHaveLength(1)
    expect(runs[0].length).toBe(SECTORS - 21)
    expect(runs[0].from).toBe(101)
  })

  test('0度を またぐ かべも 分かれずに ひとつづきになる', () => {
    const runs = wallRuns(buildRingMask([{ center: 180, width: 20 }]))
    expect(runs).toHaveLength(1)
    expect(runs[0].from).toBe(191)
    expect(runs[0].length).toBe(SECTORS - 21)
  })

  test('すきまが ふたつなら かべも ふたつ', () => {
    const runs = wallRuns(buildRingMask([{ center: 90, width: 20 }, { center: 270, width: 20 }]))
    expect(runs).toHaveLength(2)
    expect(runs.reduce((sum, run) => sum + run.length, 0)).toBe(SECTORS - 42)
  })

  test('ぜんぶ すきまなら かべは なくなる', () => {
    expect(wallRuns(buildRingMask([{ center: 0, width: 360 }]))).toEqual([])
  })
})

test('buildRingShapes は slot ごとの かべの かたちを 返す', () => {
  const shapes = buildRingShapes([{ slot: 3, gaps: [{ center: 90, width: 20 }] }])
  expect(shapes).toHaveLength(1)
  expect(shapes[0].slot).toBe(3)
  expect(shapes[0].runs[0].length).toBe(SECTORS - 21)
})
