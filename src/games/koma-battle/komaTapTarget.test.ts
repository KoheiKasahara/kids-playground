import { describe, expect, it } from 'vitest'
import { findNearestKomaTapTarget } from './komaTapTarget'

describe('findNearestKomaTapTarget', () => {
  const targets = [
    { index: 0, x: 100, y: 120 },
    { index: 1, x: 180, y: 120 },
  ]

  it('見た目の中心から少し外れた位置も広い円で拾う', () => {
    expect(findNearestKomaTapTarget({ x: 142, y: 120 }, targets, 52)).toBe(1)
  })

  it('2体の判定が重なる場所では画面上で近い1体だけを選ぶ', () => {
    expect(findNearestKomaTapTarget({ x: 132, y: 120 }, targets, 52)).toBe(0)
    expect(findNearestKomaTapTarget({ x: 151, y: 120 }, targets, 52)).toBe(1)
  })

  it('どのコマからも離れた空きフィールドは反応しない', () => {
    expect(findNearestKomaTapTarget({ x: 20, y: 20 }, targets, 52)).toBeNull()
  })

  it('壊れた座標や半径を対象にしない', () => {
    expect(findNearestKomaTapTarget({ x: Number.NaN, y: 20 }, targets, 52)).toBeNull()
    expect(findNearestKomaTapTarget({ x: 100, y: 120 }, targets, 0)).toBeNull()
  })
})
