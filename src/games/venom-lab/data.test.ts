import { describe, expect, test } from 'vitest'
import { HABITATS, MAX_RESIDENTS, RANKING, SPECIES, addResident, createExhibits, matchesRankFilter } from './data'
import { renderFrame, SPRITE_H, SPRITE_W } from './sprite'

describe('venom lab exhibits', () => {
  test('40 domestic and international kinds span eight environments with multiple snakes and scorpions', () => {
    expect(SPECIES).toHaveLength(40)
    expect(HABITATS).toHaveLength(8)
    expect(SPECIES.filter(s => matchesRankFilter(s, 'snake'))).toHaveLength(21)
    expect(SPECIES.filter(s => matchesRankFilter(s, 'scorpion'))).toHaveLength(3)
    expect(SPECIES.filter(s => matchesRankFilter(s, 'japan'))).toHaveLength(17)
    const exhibits = createExhibits()
    for (const habitat of HABITATS) {
      expect(exhibits[habitat.id]).toHaveLength(3)
      expect(new Set(exhibits[habitat.id].map(r => r.slot)).size).toBe(3)
      for (const resident of exhibits[habitat.id]) {
        expect(resident.slot).toBeGreaterThanOrEqual(0)
        expect(resident.slot).toBeLessThan(MAX_RESIDENTS)
        expect(SPECIES.find(s => s.id === resident.speciesId)?.habitat).toBe(habitat.id)
      }
    }
    expect(SPECIES.filter(s => s.habitat === 'ryukyu').every(s => matchesRankFilter(s, 'snake'))).toBe(true)
    expect(SPECIES.filter(s => matchesRankFilter(s, 'sea')).every(s => s.habitat === 'reef')).toBe(true)
  })
  test('every creature has a habitat, a complete pixel sprite and a source', () => {
    expect(new Set(SPECIES.map(s => s.id)).size).toBe(SPECIES.length)
    for (const s of SPECIES) {
      expect(HABITATS.some(h => h.id === s.habitat)).toBe(true)
      expect(new URL(s.source.url).protocol).toBe('https:')
      expect(s.fact.length).toBeGreaterThan(10)
      expect(s.venom.length).toBeGreaterThan(10)
      for (const clip of ['idle', 'move', 'act'] as const) {
        for (const t of [0, .5]) {
          const image = renderFrame(s, { clip, t })
          expect(image.data).toHaveLength(SPRITE_W * SPRITE_H * 4)
          const opaque: number[] = []
          const colors = new Set<number>()
          for (let k = 0; k < SPRITE_W * SPRITE_H; k++) {
            if (image.data[k * 4 + 3] < 255) continue
            opaque.push(k)
            colors.add((image.data[k * 4] << 16) | (image.data[k * 4 + 1] << 8) | image.data[k * 4 + 2])
          }
          // ちゃんと からだが えがかれ、かげの だんかいが たくさん ある。
          expect(opaque.length, `${s.id} ${clip}`).toBeGreaterThan(SPRITE_W * SPRITE_H * .1)
          expect(colors.size, `${s.id} ${clip}`).toBeGreaterThan(12)
        }
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
