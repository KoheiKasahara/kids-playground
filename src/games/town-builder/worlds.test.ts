import { describe, expect, it } from 'vitest'
import { isBuilding } from './parts'
import { CENTER_INDEX, carriesRoad, COLS, colOf, decodeTown, encodeTown, populationOf, rankOf, RANKS, ROWS, rowOf } from './town'
import { createTown, createWorld, randomSeed, STARTER_SEED, WORLDS } from './worlds'

const SEEDS = [1, 7, 99, 2026, 123456789]
const built = WORLDS.filter((world) => world.id !== 'empty')

describe('worlds', () => {
  it('offers many different worlds with unique names and icons', () => {
    expect(WORLDS.length).toBeGreaterThanOrEqual(8)
    expect(new Set(WORLDS.map((world) => world.id)).size).toBe(WORLDS.length)
    expect(new Set(WORLDS.map((world) => world.label)).size).toBe(WORLDS.length)
    expect(new Set(WORLDS.map((world) => world.icon)).size).toBe(WORLDS.length)
  })

  it('fills the whole wide map with valid tiles that can be saved and loaded', () => {
    for (const world of WORLDS) {
      for (const seed of SEEDS) {
        const town = createWorld(world.id, seed)
        expect(town).toHaveLength(COLS * ROWS)
        expect(town.some((tile) => tile.ground === 'water' && isBuilding(tile.part))).toBe(false)
        expect(decodeTown(encodeTown(town))).toEqual(town)
      }
    }
  })

  it('makes the same world from the same seed and a different one from another seed', () => {
    for (const world of built) {
      expect(createWorld(world.id, 5)).toEqual(createWorld(world.id, 5))
      expect(createWorld(world.id, 5)).not.toEqual(createWorld(world.id, 6))
    }
    expect(createTown()).toEqual(createWorld('river', STARTER_SEED))
    const seed = randomSeed()
    expect(Number.isInteger(seed) && seed >= 0).toBe(true)
  })

  it('starts every world with a small village on a road in the middle of the map', () => {
    for (const world of built) {
      for (const seed of SEEDS) {
        const town = createWorld(world.id, seed)
        expect(populationOf(town), `${world.id} ${seed}`).toBeGreaterThan(0)
        const nearRoad = town.some((tile, index) => carriesRoad(tile.part)
          && Math.abs(colOf(index) - colOf(CENTER_INDEX)) <= 1 && Math.abs(rowOf(index) - rowOf(CENTER_INDEX)) <= 1)
        expect(nearRoad, `${world.id} ${seed}`).toBe(true)
      }
    }
    expect(createWorld('empty', 1).every((tile) => tile.ground === 'grass' && tile.part === null)).toBe(true)
  })

  it('gives each world its own scenery', () => {
    const count = (id: Parameters<typeof createWorld>[0], test: (tile: ReturnType<typeof createWorld>[number]) => boolean) =>
      SEEDS.map((seed) => createWorld(id, seed).filter(test).length)
    const all = (values: number[], min: number) => values.every((value) => value >= min)

    // かわの まち：かわに はしが かかり、はじめは ちいさな むら。
    expect(all(count('river', (tile) => tile.ground === 'water' && tile.part === 'road'), 1)).toBe(true)
    expect(RANKS[rankOf(populationOf(createTown()))].label).toBe('むら')
    // しま：ほとんどが うみで、すなはまと やしのき、とうだいと おしろが ある。
    expect(all(count('island', (tile) => tile.ground === 'water'), COLS * ROWS * 0.5)).toBe(true)
    expect(all(count('island', (tile) => tile.ground === 'sand'), 30)).toBe(true)
    expect(all(count('island', (tile) => tile.part === 'palm'), 5)).toBe(true)
    expect(all(count('island', (tile) => tile.part === 'castle'), 1)).toBe(true)
    // もり：きが いっぱいで、おくに おしろが かくれて いる。
    expect(all(count('forest', (tile) => tile.part === 'tree' || tile.part === 'pine'), 600)).toBe(true)
    expect(all(count('forest', (tile) => tile.part === 'castle'), 1)).toBe(true)
    // おおきな まち：はじめから ひとが たくさん すみ、えきと せんろが ある。
    for (const seed of SEEDS) expect(populationOf(createWorld('city', seed))).toBeGreaterThanOrEqual(140)
    expect(all(count('city', (tile) => tile.part === 'station'), 1)).toBe(true)
    expect(all(count('city', (tile) => tile.part === 'crossing'), 1)).toBe(true)
    // でんしゃの まち：せんろが ぐるっと まわり、ふみきりと えきが 4つずつ。
    expect(all(count('rail', (tile) => tile.part === 'rail'), 100)).toBe(true)
    expect(count('rail', (tile) => tile.part === 'crossing')).toEqual(SEEDS.map(() => 4))
    expect(count('rail', (tile) => tile.part === 'station')).toEqual(SEEDS.map(() => 4))
    // おしろ：まんなかの おしろを おほりが かこみ、4つの はしで わたる。
    for (const seed of SEEDS) expect(createWorld('castle', seed)[CENTER_INDEX].part).toBe('castle')
    expect(count('castle', (tile) => tile.ground === 'water' && tile.part === 'road').every((value) => value >= 4)).toBe(true)
    // ゆき：じめんは ゆきで、もみのきと かまくらと ゆきだるま。
    expect(all(count('snow', (tile) => tile.ground === 'snow'), COLS * ROWS * 0.8)).toBe(true)
    expect(all(count('snow', (tile) => tile.part === 'igloo'), 3)).toBe(true)
    expect(all(count('snow', (tile) => tile.part === 'snowman'), 2)).toBe(true)
    // さばく：すなの なかに オアシスと ピラミッドと サボテン。
    expect(all(count('desert', (tile) => tile.ground === 'sand'), COLS * ROWS * 0.7)).toBe(true)
    expect(all(count('desert', (tile) => tile.part === 'pyramid'), 3)).toBe(true)
    expect(all(count('desert', (tile) => tile.part === 'cactus'), 10)).toBe(true)
    expect(all(count('desert', (tile) => tile.part === 'palm'), 5)).toBe(true)
  })
})
