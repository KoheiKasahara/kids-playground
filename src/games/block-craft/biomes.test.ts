import { describe, expect, it } from 'vitest'
import { SPAWN_GROUND, spawnHerd } from './animals'
import { BIOMES, biome, isBiomeId, type BiomeId } from './biomes'
import { encodeGrid } from './saveCodec'
import { NEW_WORLD } from './terrain'
import { DEFAULT_WORLD, foundTreasures, isStable, startWalker, surfaceOf, walk, type Material } from './world'

const SEED = 5
const worlds = new Map(BIOMES.map(land => [land.id, land.create(NEW_WORLD, SEED)]))
const has = (id: BiomeId, ...materials: Material[]) => {
  const found = new Set([...worlds.get(id)!.blocks()].map(b => b.material))
  return materials.every(material => found.has(material))
}

describe.each(BIOMES.map(b => [b.id, b] as const))('%s world', (id, land) => {
  const world = worlds.get(id)!
  const center = Math.floor(world.size / 2)
  it('is a wide world with a full floor, every treasure hidden, and the same shape for the same seed', () => {
    expect(world).toMatchObject(NEW_WORLD)
    for (let x = 0; x < world.size; x++) for (let z = 0; z < world.size; z++) expect(world.codeAt(x, 0, z)).not.toBe(0)
    expect(world.treasures.length).toBeGreaterThan(20)
    expect(foundTreasures(world)).toEqual([])
    for (const t of world.treasures) expect(world.topY(t.x, t.z)).toBeGreaterThan(t.y)
    expect(encodeGrid(land.create(NEW_WORLD, SEED)).cells).toBe(encodeGrid(world).cells)
    expect(encodeGrid(land.create(NEW_WORLD, SEED + 1)).cells).not.toBe(encodeGrid(world).cells)
    expect(encodeGrid(land.create()).cells).toBe(encodeGrid(land.create(NEW_WORLD, 0)).cells)
  })
  it('does not change by itself: no lava, ice or snow reactions and no sand hanging in the air', () => {
    expect(isStable(world)).toBe(true)
    for (const b of world.blocks()) if (b.material === 'sand') expect(world.codeAt(b.x, b.y - 1, b.z)).not.toBe(0)
  })
  it('starts on an open plaza where the player can stand and walk away', () => {
    const start = startWalker(world, center, center)
    expect(world.topY(center, center)).toBe(start.y - 1)
    expect(SPAWN_GROUND).toContain(surfaceOf(world)(center, center)?.material)
    for (const dir of [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }]) expect(walk(world, start, dir)).not.toEqual(start)
  })
  it('puts its animals near the start on open ground, never on trees, water or lava', () => {
    const herd = spawnHerd(world, land.animals, SEED)
    const surface = surfaceOf(world)
    expect(herd).toHaveLength(land.animals.length)
    expect(herd.length).toBeGreaterThanOrEqual(4)
    // あかちゃんが うまれるように、おなじ どうぶつが 2ひき いじょう いる
    expect(herd.some(a => herd.filter(b => b.kind === a.kind).length >= 2)).toBe(true)
    expect(new Set(herd.map(a => `${a.x},${a.z}`)).size).toBe(herd.length)
    expect(herd.map(a => a.id)).toEqual(herd.map((_, index) => index))
    for (const animal of herd) {
      expect(SPAWN_GROUND).toContain(surface(animal.x, animal.z)?.material)
      expect(world.topY(animal.x, animal.z)).toBe(world.topY(animal.x, animal.z, true))
      expect(Math.hypot(animal.x - center, animal.z - center)).toBeLessThan(20)
    }
    expect(spawnHerd(world, land.animals, SEED)).toEqual(herd)
  })
  it('also fits the smallest world', () => {
    const small = land.create(DEFAULT_WORLD, SEED)
    expect(small).toMatchObject(DEFAULT_WORLD)
    expect(foundTreasures(small)).toEqual([])
    expect(isStable(small)).toBe(true)
    expect(spawnHerd(small, land.animals, SEED).length).toBeGreaterThanOrEqual(4)
  })
})

describe('biomes', () => {
  it('each has its own look and features', () => {
    expect(has('meadow', 'grass', 'water', 'flower', 'snow', 'plank', 'wheat', 'stonebrick')).toBe(true)
    expect(has('desert', 'sandstone', 'lava', 'cactus', 'gold', 'water')).toBe(true)
    expect(has('snow', 'ice', 'mushroom', 'pumpkin', 'lamp')).toBe(true)
    expect(has('island', 'coral', 'lava', 'shell', 'plank', 'cloud')).toBe(true)
    expect(has('forest', 'mushcap', 'mushroom', 'plank', 'lamp', 'melon')).toBe(true)
    expect(has('volcano', 'lava', 'obsidian', 'gold', 'water', 'crystal')).toBe(true)
    expect(has('sky', 'cloud', 'water', 'grass', 'crystal')).toBe(true)
    expect(has('castle', 'stonebrick', 'glass', 'farmland', 'wheat', 'water')).toBe(true)
    expect(has('crystal', 'crystal', 'glass', 'ice', 'water')).toBe(true)
    expect(has('adventure', 'snow', 'sand', 'cactus', 'coral', 'sandstone', 'leaf')).toBe(true)
    expect(BIOMES.length).toBeGreaterThanOrEqual(10)
    expect(new Set(BIOMES.map(b => b.sky)).size).toBe(BIOMES.length)
    expect(new Set(BIOMES.map(b => b.label)).size).toBe(BIOMES.length)
    // ちけいを まわると けいとの いろが ぜんぶ そろう
    expect(new Set(BIOMES.flatMap(b => b.animals.map(a => a.wool)).filter(Boolean))).toEqual(new Set(['white', 'pink', 'yellow', 'blue']))
    expect([isBiomeId('desert'), isBiomeId('sky'), isBiomeId('moon'), isBiomeId(undefined)]).toEqual([true, true, false, false])
    expect(biome('castle').label).toBe('おしろ')
  })
  it('floats sky islands above a sea of clouds, joined by bridges that can be walked', () => {
    const world = worlds.get('sky')!
    const center = Math.floor(world.size / 2)
    const home = world.topY(center, center, true)
    expect(home).toBeGreaterThan(8)
    let clouds = 0
    for (let x = 0; x < world.size; x++) for (let z = 0; z < world.size; z++) if (world.topY(x, z) <= 3) clouds++
    expect(clouds).toBeGreaterThan(world.area / 2)
    // まんなかの しまから、あるいて べつの しまへ わたれる
    const reached = new Set<string>()
    const queue = [startWalker(world, center, center)]
    while (queue.length) {
      const at = queue.pop()!
      const id = `${at.x},${at.z}`
      if (reached.has(id) || at.y < 4) continue
      reached.add(id)
      for (const dir of [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }]) queue.push(walk(world, at, dir))
    }
    const farthest = Math.max(...[...reached].map(id => { const [x, z] = id.split(',').map(Number); return Math.hypot(x - center, z - center) }))
    expect(farthest).toBeGreaterThan(world.size * 0.3)
  })
})
