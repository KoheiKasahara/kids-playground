import { describe, expect, test } from 'vitest'
import { ANIMALS, findAnimal, pickRival } from './animals'
import { FOOD_KINDS, FOODS } from './foods'

describe('gochiso-race animals and foods', () => {
  test('there are 12 different animals to choose from', () => {
    expect(ANIMALS).toHaveLength(12)
    expect(new Set(ANIMALS.map(a => a.id)).size).toBe(12)
    expect(new Set(ANIMALS.map(a => a.name)).size).toBe(12)
    for (const a of ANIMALS) {
      for (const color of [a.body, a.belly, a.accent, a.color]) expect(color).toMatch(/^#[0-9a-f]{6}$/)
      expect(findAnimal(a.id)).toBe(a)
    }
    expect(findAnimal('dragon')).toBeUndefined()
  })

  test('the rival is always a different animal', () => {
    for (const a of ANIMALS) {
      for (const r of [0, .3, .5, .9999]) {
        const rival = pickRival(a.id, () => r)
        expect(rival).not.toBe(a.id)
        expect(findAnimal(rival)).toBeDefined()
      }
    }
  })

  test('foods have names and points from small to big', () => {
    expect(FOOD_KINDS.length).toBeGreaterThanOrEqual(8)
    for (const kind of FOOD_KINDS) {
      expect(FOODS[kind].kind).toBe(kind)
      expect(FOODS[kind].name).not.toBe('')
      expect(FOODS[kind].points).toBeGreaterThan(0)
    }
    expect(Math.max(...FOOD_KINDS.map(k => FOODS[k].points))).toBe(10)
  })
})
