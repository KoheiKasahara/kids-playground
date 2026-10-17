import { describe, expect, test } from 'vitest'
import { PRIZES, type PrizeId } from './data'
import { pickPrize } from './gacha'
import { LANE_CAPACITY } from './lane'
import { rng } from './pixel'
import { DEFAULT_RECIPE } from './recipe'
import { EMPTY_SAVE, parseSave } from './save'

describe('ほぞん', () => {
  test('おかしな データは からっぽから はじめる', () => {
    expect(parseSave(null)).toEqual(EMPTY_SAVE)
    expect(parseSave('broken')).toEqual(EMPTY_SAVE)
    expect(parseSave({ lane: 'x', eaten: -3, tickets: 1.5, prizes: {} })).toEqual(EMPTY_SAVE)
  })

  test('つかえる ところだけ のこす', () => {
    const save = parseSave({
      lane: [DEFAULT_RECIPE, { ...DEFAULT_RECIPE, neta: 'cheese' }, ...Array.from({ length: 10 }, () => ({ ...DEFAULT_RECIPE, plate: 'kin' }))],
      eaten: 23,
      tickets: 500,
      prizes: ['maneki', 'maneki', 'robot', 'kinsushi'],
    })
    expect(save.lane).toHaveLength(LANE_CAPACITY)
    expect(save.lane[0]).toEqual(DEFAULT_RECIPE)
    expect(save.eaten).toBe(23)
    expect(save.tickets).toBe(99)
    expect(save.prizes).toEqual(['maneki', 'kinsushi'])
  })
})

describe('ガチャ', () => {
  test('まだ もっていない たからものが でやすく、いつかは ぜんぶ そろう', () => {
    const random = rng(11)
    const owned = new Set<PrizeId>()
    let spins = 0
    while (owned.size < PRIZES.length && spins < 400) {
      owned.add(pickPrize([...owned], random))
      spins++
    }
    expect(owned.size).toBe(PRIZES.length)
    expect(spins).toBeLessThan(200)
  })

  test('きんの おすしは たまに だけ', () => {
    const random = rng(5)
    const n = 2000
    let rare = 0
    for (let i = 0; i < n; i++) if (pickPrize([], random) === 'kinsushi') rare++
    expect(rare / n).toBeGreaterThan(.03)
    expect(rare / n).toBeLessThan(.12)
  })
})
