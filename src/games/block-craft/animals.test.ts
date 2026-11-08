import { describe, expect, it } from 'vitest'
import { ANIMAL_SPAWNS, decodeHerd, feedAnimal, herdFrom, MAX_HERD, nextCell, shearSheep } from './animals'
import { createWorld, editWorld, SIZE, surfaceOf } from './world'

describe('animals', () => {
  it('start on dry ground inside the world', () => {
    const surface = surfaceOf(createWorld())
    for (const spawn of ANIMAL_SPAWNS) {
      expect(spawn.x).toBeGreaterThanOrEqual(0)
      expect(spawn.x).toBeLessThan(SIZE)
      expect(surface(spawn.x, spawn.z)?.material).toBe('grass')
    }
  })
  it('step to a neighbor, never into water, onto cactus, up high steps or outside', () => {
    const surface = surfaceOf(createWorld())
    for (let i = 0; i < 40; i++) {
      const random = () => i / 40
      for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) {
        const here = surface(x, z)!
        const next = nextCell(surface, { x, z }, random)
        if (next.x === x && next.z === z) continue
        expect(Math.abs(next.x - x) + Math.abs(next.z - z)).toBe(1)
        const ground = surface(next.x, next.z)!
        expect(['water', 'cactus']).not.toContain(ground.material)
        expect(Math.abs(ground.y - here.y)).toBeLessThanOrEqual(1)
      }
    }
  })
  it('stays put when fenced in', () => {
    let world = createWorld()
    for (const [x, z] of [[4, 5], [6, 5], [5, 4], [5, 6]]) {
      world = editWorld(world, { x, y: 3, z }, 'stone', 'place')
      world = editWorld(world, { x, y: 4, z }, 'stone', 'place')
    }
    const at = { x: 5, z: 5 }
    expect(nextCell(surfaceOf(world), at, () => 0.5)).toBe(at)
  })
})

describe('making friends with animals', () => {
  const herd = herdFrom([{ kind: 'sheep', x: 1, z: 1, wool: 'white' }, { kind: 'sheep', x: 2, z: 2, wool: 'pink' }, { kind: 'chicken', x: 3, z: 3 }])
  it('becomes friends when fed, and two friends of the same kind have a baby', () => {
    const first = feedAnimal(herd, 0, { x: 1, z: 1 })!
    expect(first.result).toBe('love')
    expect(first.herd[0].love).toBe(true)
    // ちがう どうぶつ どうしでは うまれない
    const chicken = feedAnimal(first.herd, 2, { x: 3, z: 3 })!
    expect(chicken.result).toBe('love')
    const second = feedAnimal(chicken.herd, 1, { x: 5, z: 6 })!
    expect(second.result).toBe('baby')
    expect(second.herd).toHaveLength(4)
    expect(second.herd[3]).toEqual({ id: 3, kind: 'sheep', x: 5, z: 6, baby: true, wool: 'pink' })
    expect(second.herd.filter(a => a.love).map(a => a.kind)).toEqual(['chicken'])
    const grown = feedAnimal(second.herd, 3, { x: 5, z: 6 })!
    expect(grown.result).toBe('grow')
    expect(grown.herd[3].baby).toBeUndefined()
    expect(feedAnimal(herd, 99, { x: 0, z: 0 })).toBeNull()
  })
  it('stops having babies at the herd limit', () => {
    const full = herdFrom(Array.from({ length: MAX_HERD }, (_, i) => ({ kind: 'rabbit' as const, x: i % SIZE, z: 0 })))
      .map((a, i) => i === 0 ? { ...a, love: true } : a)
    const fed = feedAnimal(full, 1, { x: 1, z: 0 })!
    expect(fed.result).toBe('love')
    expect(fed.herd).toHaveLength(MAX_HERD)
  })
  it('shears wool once, and wheat grows it back', () => {
    const shorn = shearSheep(herd, 1)!
    expect(shorn.wool).toBe('pink')
    expect(shorn.herd[1].sheared).toBe(true)
    expect(shearSheep(shorn.herd, 1)).toBeNull()
    expect(shearSheep(herd, 2)).toBeNull()
    const regrown = feedAnimal(shorn.herd, 1, { x: 2, z: 2 })!
    expect(regrown.result).toBe('wool')
    expect(regrown.herd[1].sheared).toBeUndefined()
  })
  it('round trips saved animals and rejects broken ones', () => {
    const saved = feedAnimal(shearSheep(herd, 0)!.herd, 2, { x: 3, z: 3 })!.herd
    expect(decodeHerd(JSON.parse(JSON.stringify(saved)))).toEqual(saved)
    const broken = [null, {}, [{ ...herd[0], id: 'x' }], [herd[0], herd[0]], [{ ...herd[0], x: SIZE }], [{ ...herd[2], wool: 'pink' }],
      [{ ...herd[0], kind: 'dragon' }], [{ ...herd[0], baby: 'yes' }], Array(MAX_HERD + 1).fill(herd[0])]
    for (const bad of broken) expect(decodeHerd(bad)).toBeNull()
  })
})
