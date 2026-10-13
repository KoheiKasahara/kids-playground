import { describe, expect, test } from 'vitest'
import { HABITATS, MAX_RESIDENTS, RANKING, SPECIES, addResident, createExhibits } from './data'
import { PIXELS } from './pixelArt'

describe('venom lab exhibits', () => {
  test('every creature has a habitat, a complete pixel sprite and a source', () => {
    expect(new Set(SPECIES.map(s => s.id)).size).toBe(SPECIES.length)
    for (const s of SPECIES) {
      expect(HABITATS.some(h => h.id === s.habitat)).toBe(true)
      expect(new URL(s.source.url).protocol).toBe('https:')
      expect(s.fact.length).toBeGreaterThan(10)
      expect(s.venom.length).toBeGreaterThan(10)
      expect(PIXELS[s.sprite]).toHaveLength(16)
      for (const row of PIXELS[s.sprite]) {
        expect(row, s.sprite).toHaveLength(20)
        expect(row).toMatch(/^[.ABCEW]+$/)
      }
    }
  })

  test('only animals of the same environment can be added, including duplicates, up to capacity', () => {
    const initial = createExhibits()
    expect(addResident(initial, 'reef', 'golden-frog')).toBe(initial)
    expect(addResident(initial, 'reef', 'unknown')).toBe(initial)
    let exhibits = initial
    for (let i = 0; i < 20; i++) exhibits = addResident(exhibits, 'reef', 'blue-ring')
    expect(exhibits.reef).toHaveLength(MAX_RESIDENTS)
    expect(exhibits.forest).toBe(initial.forest)
    expect(exhibits.desert).toBe(initial.desert)
    expect(initial.reef).toHaveLength(3)
    expect(new Set(exhibits.reef.map(r => r.slot)).size).toBe(MAX_RESIDENTS)
    expect(new Set(Object.values(exhibits).flat().map(r => r.id)).size).toBe(Object.values(exhibits).flat().length)
    expect(addResident(exhibits, 'reef', 'blue-ring')).toBe(exhibits)
  })

  test('vacant positions can be refilled without moving other residents', () => {
    const exhibits = createExhibits()
    exhibits.forest = exhibits.forest.filter(r => r.slot !== 3)
    const next = addResident(exhibits, 'forest', 'golden-frog')
    expect(next.forest).toHaveLength(3)
    expect(next.forest.slice(0, 2)).toEqual(exhibits.forest)
    expect(new Set(next.forest.map(r => r.slot)).size).toBe(3)
  })

  test('ranking groups cover all species once, descending with shared levels', () => {
    expect(RANKING.map(g => g.level)).toEqual([5, 4, 3])
    expect(RANKING.flatMap(g => g.species.map(s => s.id)).sort()).toEqual(SPECIES.map(s => s.id).sort())
    for (const group of RANKING) expect(group.species.every(s => s.level === group.level)).toBe(true)
  })
})
