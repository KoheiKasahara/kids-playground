import { describe, expect, it } from 'vitest'
import { walkable } from './animals'
import { BIOMES, biome, isBiomeId, type BiomeId } from './biomes'
import { foundTreasures, HEIGHT, inside, isStable, key, SIZE, surfaceOf } from './world'

describe.each(BIOMES.map(b => [b.id, b] as const))('%s world', (_, land) => {
  const world = land.create()
  it('is a valid world with a full floor and every treasure hidden in place', () => {
    expect(new Set(world.map(key)).size).toBe(world.length)
    expect(world.every(inside)).toBe(true)
    expect(world.filter(b => b.y === 0)).toHaveLength(SIZE * SIZE)
    expect(world.every(b => b.y < HEIGHT)).toBe(true)
    expect(foundTreasures(world)).toEqual([])
    expect(land.create()).toEqual(world)
  })
  it('does not change by itself under the lava, ice and snow rules', () => {
    expect(isStable(world)).toBe(true)
  })
  it('puts its animals on open ground, never on trees, water or lava', () => {
    const surface = surfaceOf(world)
    expect(land.spawns.length).toBeGreaterThanOrEqual(4)
    // あかちゃんが うまれるように、おなじ どうぶつが 2ひき いじょう いる
    expect(land.spawns.some(a => land.spawns.filter(b => b.kind === a.kind).length >= 2)).toBe(true)
    expect(new Set(land.spawns.map(a => `${a.x},${a.z}`)).size).toBe(land.spawns.length)
    for (const spawn of land.spawns) {
      const ground = surface(spawn.x, spawn.z)
      expect(walkable(ground)).toBe(true)
      expect(['grass', 'sand', 'snow', 'dirt']).toContain(ground?.material)
    }
  })
})

describe('biomes', () => {
  it('each has its own look and features', () => {
    const has = (id: BiomeId, material: string) => biome(id).create().some(b => b.material === material)
    expect(has('desert', 'sandstone') && has('desert', 'lava') && has('desert', 'cactus')).toBe(true)
    expect(has('snow', 'ice') && has('snow', 'mushroom')).toBe(true)
    expect(has('island', 'coral') && has('island', 'lava') && has('island', 'shell')).toBe(true)
    expect(new Set(BIOMES.map(b => b.sky)).size).toBe(BIOMES.length)
    // ちけいを まわると けいとの いろが ぜんぶ そろう
    expect(new Set(BIOMES.flatMap(b => b.spawns.map(a => a.wool)).filter(Boolean))).toEqual(new Set(['white', 'pink', 'yellow', 'blue']))
    expect([isBiomeId('desert'), isBiomeId('moon'), isBiomeId(undefined)]).toEqual([true, false, false])
  })
})
