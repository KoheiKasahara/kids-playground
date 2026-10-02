import { describe, expect, test } from 'vitest'
import { FOODS, GRID, MAX_ANIMALS, OBJECTS, SPECIES } from './data'
import {
  addAnimal, addObject, checkAnimal, checkFood, checkObject, createWorld, dropFood, drainEvents, isNightClock, removeAt,
  ringPoint, stepWorld, zooRating, DAY_SECONDS, RING, type World,
} from './sim'
import { fromView, groundAt, toScreen, toView, viewDir } from './iso'

function run(world: World, seconds: number) {
  for (let t = 0; t < seconds; t += .05) stepWorld(world, .05)
}

describe('data', () => {
  test('どうぶつ・もの・えさの id が かさならず、どうぶつは たべられる えさが ある', () => {
    expect(new Set(SPECIES.map(s => s.id)).size).toBe(SPECIES.length)
    expect(new Set(OBJECTS.map(o => o.kind)).size).toBe(OBJECTS.length)
    const foods = new Set(FOODS.map(f => f.kind))
    for (const s of SPECIES) {
      expect(s.eats.length).toBeGreaterThan(0)
      for (const f of s.eats) expect(foods.has(f)).toBe(true)
      expect(s.limit).toBeGreaterThan(0)
    }
    // にくは にくしょく、くさは そうしょく。
    expect(SPECIES.find(s => s.id === 'lion')!.eats).toEqual(['meat'])
    expect(SPECIES.find(s => s.id === 'zebra')!.eats).toContain('grass')
    expect(SPECIES.find(s => s.id === 'giraffe')!.limit).toBe(1)
  })
})

describe('おく ルール', () => {
  test('キリンは 1とう まで', () => {
    const world = createWorld()
    expect(checkAnimal(world, 'giraffe', 2, 2).ok).toBe(true)
    addAnimal(world, 'giraffe', 2, 2)
    const second = checkAnimal(world, 'giraffe', 5, 5)
    expect(second.ok).toBe(false)
    if (!second.ok) expect(second.reason).toContain('キリンは 1とう')
  })

  test('どうぶつは ぜんぶで 上限まで', () => {
    const world = createWorld()
    let n = 0
    for (const s of SPECIES) {
      if (s.needsPond) continue
      for (let i = 0; i < s.limit && n < MAX_ANIMALS; i++, n++) addAnimal(world, s.id, n % GRID, Math.floor(n / GRID))
    }
    expect(world.animals.length).toBe(MAX_ANIMALS)
    const r = checkAnimal(world, 'rabbit', 10, 10)
    expect(r.ok).toBe(false)
  })

  test('ペンギンは いけが ないと おけず、いけの なかには おける', () => {
    const world = createWorld()
    const r = checkAnimal(world, 'penguin', 3, 3)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toContain('いけ')
    addObject(world, 'pond', 3, 3)
    expect(checkAnimal(world, 'penguin', 4, 4).ok).toBe(true)
    expect(checkAnimal(world, 'lion', 4, 4).ok).toBe(false)
  })

  test('ものは かさねられず、かこいから はみだせない', () => {
    const world = createWorld()
    addObject(world, 'tree', 1, 1)
    expect(checkObject(world, 'rock', 1, 1).ok).toBe(false)
    expect(checkObject(world, 'pond', GRID - 1, 0).ok).toBe(false)
    expect(checkObject(world, 'rock', -1, 0).ok).toBe(false)
    expect(checkAnimal(world, 'zebra', 1, 1).ok).toBe(false)
  })

  test('かたづけると もとに もどる', () => {
    const world = createWorld()
    addObject(world, 'rock', 4, 4)
    const a = addAnimal(world, 'panda', 8, 8)
    expect(removeAt(world, a.x, a.z)).toEqual({ kind: 'animal', species: 'panda' })
    expect(removeAt(world, 4.5, 4.5)).toEqual({ kind: 'object', object: 'rock' })
    expect(world.animals).toHaveLength(0)
    expect(world.objects).toHaveLength(0)
    expect(removeAt(world, 4.5, 4.5)).toBeNull()
  })
})

describe('えさ', () => {
  test('たべる どうぶつが いない えさは なげられない', () => {
    const world = createWorld()
    addAnimal(world, 'zebra', 2, 2)
    const r = checkFood(world, 'meat', 6, 6)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toContain('おにく')
    expect(checkFood(world, 'grass', 6, 6).ok).toBe(true)
  })

  test('おにくは ライオンが たべ、シマウマは たべない', () => {
    const world = createWorld(3)
    world.clock = .25
    const lion = addAnimal(world, 'lion', 2, 2)
    const zebra = addAnimal(world, 'zebra', 6, 6)
    const lionHunger = lion.hunger
    dropFood(world, 'meat', 6.5, 6.5)
    const seen: string[] = []
    for (let t = 0; t < 30 && world.foods.length; t += .05) {
      stepWorld(world, .05)
      for (const e of drainEvents(world)) if (e.type === 'eat' || e.type === 'ate') seen.push(`${e.type}:${e.animal.species}`)
    }
    expect(world.foods).toHaveLength(0)
    expect(seen).toContain('eat:lion')
    expect(seen).toContain('ate:lion')
    expect(seen.some(s => s.endsWith('zebra'))).toBe(false)
    expect(lion.hunger).toBeLessThan(lionHunger)
    expect(zebra.state).not.toBe('eat')
  })
})

describe('1日', () => {
  test('よるに なると ねむり、あさに おきる', () => {
    const world = createWorld(5)
    world.clock = .66
    const a = addAnimal(world, 'rabbit', 5, 5)
    run(world, DAY_SECONDS * .1)
    expect(isNightClock(world.clock)).toBe(true)
    expect(a.state).toBe('sleep')
    const r = checkFood(world, 'grass', 3, 3)
    expect(r.ok).toBe(false)
    run(world, DAY_SECONDS * .3)
    expect(world.night).toBe(false)
    run(world, 10)
    expect(a.state).not.toBe('sleep')
  })

  test('ひょうかは どうぶつが ふえると あがる', () => {
    const world = createWorld()
    expect(zooRating(world)).toBe(0)
    addAnimal(world, 'lion', 1, 1)
    const one = zooRating(world)
    for (const [s, x] of [['zebra', 3], ['elephant', 5], ['panda', 7], ['monkey', 9]] as const) addAnimal(world, s, x, 3)
    addObject(world, 'rock', 0, 8); addObject(world, 'tree', 2, 8); addObject(world, 'bamboo', 4, 8); addObject(world, 'flowers', 6, 8)
    expect(zooRating(world)).toBeGreaterThan(one)
  })
})

describe('iso', () => {
  test('画面 ↔ 地面の ざひょうが もどる', () => {
    for (let r = 0; r < 4; r++) {
      const [vx, vz] = toView(3.2, 7.9, r)
      const [x, z] = fromView(vx, vz, r)
      expect(x).toBeCloseTo(3.2)
      expect(z).toBeCloseTo(7.9)
      const [sx, sy] = toScreen(3.2, 0, 7.9, r)
      const [gx, gz] = groundAt(sx, sy, r)
      expect(gx).toBeCloseTo(3.2)
      expect(gz).toBeCloseTo(7.9)
    }
  })

  test('かいてんすると スプライトの むきも まわる', () => {
    expect(viewDir(0, 0)).toBe(0)
    expect(viewDir(0, 1)).not.toBe(viewDir(0, 0))
    expect(viewDir(Math.PI / 2, 0)).toBe(2)
  })

  test('そとの みちは 1しゅうで もとの ばしょ', () => {
    const [x0, z0] = ringPoint(1)
    const [x1, z1] = ringPoint(1 + RING)
    expect(x1).toBeCloseTo(x0)
    expect(z1).toBeCloseTo(z0)
  })
})
