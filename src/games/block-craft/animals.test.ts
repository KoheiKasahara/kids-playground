import { describe, expect, it } from 'vitest'
import { ANIMAL_SPAWNS, decodeHerd, feedAnimal, FLY_CLIMB, hatchDragon, herdFrom, MAX_HERD, chooseAnimalStep, shearSheep, type Cell } from './animals'
import { createWorld, DEFAULT_WORLD, editWorld, surfaceOf, toggleDoor, type World } from './world'

const SIZE = DEFAULT_WORLD.size

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
    const world = createWorld()
    const surface = surfaceOf(world)
    const options = new Int8Array(4)
    for (let i = 0; i < 40; i++) {
      const random = () => i / 40
      for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) {
        const here = surface(x, z)!
        const next = { x, z }
        if (!chooseAnimalStep(world, { x, z }, next, options, random)) continue
        expect(Math.abs(next.x - x) + Math.abs(next.z - z)).toBe(1)
        const ground = surface(next.x, next.z)!
        expect(['water', 'cactus']).not.toContain(ground.material)
        expect(Math.abs(ground.y - here.y)).toBeLessThanOrEqual(1)
      }
    }
  })
  it('stays put when fenced in', () => {
    const world = createWorld()
    for (const [x, z] of [[4, 5], [6, 5], [5, 4], [5, 6]]) {
      editWorld(world, { x, y: 3, z }, 'stone', 'place')
      editWorld(world, { x, y: 4, z }, 'stone', 'place')
    }
    const at = { x: 5, z: 5 }
    expect(chooseAnimalStep(world, at, { ...at }, new Int8Array(4), () => 0.5)).toBe(false)
  })
})

describe('fences and doors', () => {
  it('keep animals in a pen until the door opens', () => {
    const world = createWorld()
    for (const [x, z] of [[4, 5], [6, 5], [5, 4]]) editWorld(world, { x, y: 3, z }, 'fence', 'place')
    editWorld(world, { x: 5, y: 3, z: 6 }, 'door', 'place')
    const at = { x: 5, z: 5 }
    const to = { ...at }
    expect(chooseAnimalStep(world, at, to, new Int8Array(4), () => 0)).toBe(false)
    toggleDoor(world, { x: 5, y: 3, z: 6 })
    expect(chooseAnimalStep(world, at, to, new Int8Array(4), () => 0)).toBe(true)
    expect(to).toEqual({ x: 5, z: 6 })
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
      [{ ...herd[0], kind: 'unicorn' }], [{ id: 0, kind: 'dragon', x: 1, z: 1, wool: 'white' }], [{ ...herd[0], baby: 'yes' }], Array(MAX_HERD + 1).fill(herd[0])]
    for (const bad of broken) expect(decodeHerd(bad)).toBeNull()
  })
})

describe('dragons', () => {
  it('hatch from an egg as a baby with a new id, and not when the herd is full', () => {
    expect(hatchDragon([], { x: 2, z: 3 })).toEqual([{ id: 0, kind: 'dragon', x: 2, z: 3, baby: true }])
    const herd = herdFrom(ANIMAL_SPAWNS)
    const hatched = hatchDragon(herd, { x: 4, z: 4 })!
    expect(hatched.slice(0, -1)).toEqual(herd)
    expect(hatched.at(-1)).toEqual({ id: herd.length, kind: 'dragon', x: 4, z: 4, baby: true })
    expect(decodeHerd(JSON.parse(JSON.stringify(hatched)))).toEqual(hatched)
    const full = herdFrom(Array.from({ length: MAX_HERD }, (_, i) => ({ kind: 'rabbit' as const, x: i % SIZE, z: 0 })))
    expect(hatchDragon(full, { x: 1, z: 1 })).toBeNull()
  })
  it('grow up with wheat and have babies like the other animals', () => {
    const two = hatchDragon(hatchDragon([], { x: 1, z: 1 })!, { x: 2, z: 2 })!
    const grown = feedAnimal(feedAnimal(two, 0, { x: 1, z: 1 })!.herd, 1, { x: 2, z: 2 })!.herd
    expect(grown.every(a => !a.baby)).toBe(true)
    const friends = feedAnimal(grown, 0, { x: 1, z: 1 })!
    expect(friends.result).toBe('love')
    const family = feedAnimal(friends.herd, 1, { x: 5, z: 5 })!
    expect(family.result).toBe('baby')
    expect(family.herd.at(-1)).toEqual({ id: 2, kind: 'dragon', x: 5, z: 5, baby: true })
  })
  it('fly over water and lava and up to a few blocks, where walking animals cannot go', () => {
    const world = createWorld()
    // みずうみの きしから：まえ（z-1）は みず、みぎ（x+1）は ようがん、ひだり（x-1）は たかい いし
    const from = { x: 5, z: 2 }
    editWorld(world, { x: 6, y: 3, z: 2 }, 'lava', 'place')
    for (let y = 3; y < 3 + FLY_CLIMB; y++) editWorld(world, { x: 4, y, z: 2 }, 'stone', 'place')
    const reach = (target: World, flying: boolean, at: Cell = from) => {
      const found = new Set<string>()
      for (let i = 0; i < 4; i++) {
        const to = { ...at }
        if (chooseAnimalStep(target, at, to, new Int8Array(4), () => i / 4 + 0.01, flying)) found.add(`${to.x},${to.z}`)
      }
      return [...found].sort()
    }
    expect(surfaceOf(world)(5, 1)?.material).toBe('water')
    expect(surfaceOf(world)(6, 2)?.material).toBe('lava')
    expect(reach(world, false)).toEqual(['5,3'])
    expect(reach(world, true)).toEqual(['4,2', '5,1', '5,3', '6,2'])
    // もっと たかいと とべない。せかいの そとへも いかない
    editWorld(world, { x: 4, y: 3 + FLY_CLIMB, z: 2 }, 'stone', 'place')
    expect(reach(world, true)).toEqual(['5,1', '5,3', '6,2'])
    expect(reach(world, true, { x: 0, z: 0 })).toEqual(['0,1', '1,0'])
  })
})
