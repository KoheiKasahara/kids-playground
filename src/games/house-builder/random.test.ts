import { describe, expect, test } from 'vitest'
import { HOUSE_TYPES, SHAPES, findShape } from './data'
import { floorCount, frontEdge, roomSize, roomsOn } from './plan'
import { randomDesign } from './random'
import { parseDesign } from './save'

/** おなじ たねから おなじ じゅんばんの かずを だす。 */
function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1)

describe('house-builder random', () => {
  test('おなじ たねなら おなじ おうちに なる', () => {
    expect(randomDesign(seeded(7))).toEqual(randomDesign(seeded(7)))
  })

  test('おまかせの おうちは はみださず かさならず、ほぞんしても そのまま もどる', () => {
    for (const seed of SEEDS) {
      const design = randomDesign(seeded(seed))
      expect(parseDesign(JSON.parse(JSON.stringify(design))), `seed ${seed}`).toEqual(design)
      expect(new Set(design.rooms.map((r) => r.id)).size, `seed ${seed}`).toBe(design.rooms.length)
    }
  })

  test('1かいの おもてに げんかん、どの かいにも へやが あり、かいだんは おなじ ところで つながる', () => {
    for (const seed of SEEDS) {
      const design = randomDesign(seeded(seed))
      const front = frontEdge(findShape(design.shape))
      const entrance = roomsOn(design, 0).find((r) => r.type === 'entrance')
      expect(entrance, `seed ${seed}`).toBeDefined()
      const { w, h } = roomSize(entrance!)
      expect(Array.from({ length: w }, (_, i) => front[entrance!.x + i]).includes(entrance!.y + h), `seed ${seed}`).toBe(true)
      expect(roomsOn(design, 0).some((r) => r.type === 'living'), `seed ${seed}`).toBe(true)

      const floors = floorCount(design)
      const stairs = design.rooms.filter((r) => r.type === 'stairs')
      expect(stairs, `seed ${seed}`).toHaveLength(floors > 1 ? floors : 0)
      for (const s of stairs) expect(s, `seed ${seed}`).toMatchObject({ x: stairs[0].x, y: stairs[0].y, size: stairs[0].size, turned: stairs[0].turned })
      for (let floor = 0; floor < floors; floor++) expect(roomsOn(design, floor).length, `seed ${seed} floor ${floor}`).toBeGreaterThan(stairs.length > 0 ? 1 : 0)
    }
  })

  test('いえの しゅるいも かたちも いろいろ でる', () => {
    const designs = SEEDS.map((seed) => randomDesign(seeded(seed)))
    expect(new Set(designs.map((d) => d.houseType)).size).toBe(HOUSE_TYPES.length)
    expect(new Set(designs.map((d) => d.shape)).size).toBe(SHAPES.length)
    expect(new Set(designs.map((d) => d.exterior.wall)).size).toBeGreaterThan(5)
  })
})
