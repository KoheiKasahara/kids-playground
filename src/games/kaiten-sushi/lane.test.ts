import { describe, expect, test } from 'vitest'
import { PLATES_PER_GACHA } from './data'
import { DROP_S, LANE_LENGTH, SEATS, laneCoord, laneDelta, lanePoint } from './layout'
import {
  FRESH_TIME, LANE_CAPACITY, MIN_GAP, addRecipe, createLane, drainEvents, expressSeat, laneRecipes, lanePlates, plateAt, platePoint,
  plateS, sendExpress, spendTicket, stepLane, type LaneEvent, type LaneWorld,
} from './lane'
import { DEFAULT_RECIPE, type Recipe } from './recipe'

/** ほかの おきゃくさんが かってに ねがいごとを しないように して、ひとりだけ ちゅうもんさせる。 */
function quietLane(): LaneWorld {
  const world = createLane({ seed: 3 })
  for (const c of world.customers) c.wishIn = 9999
  return world
}

function run(world: LaneWorld, seconds: number, until?: (events: LaneEvent[]) => boolean): LaneEvent[] {
  const all: LaneEvent[] = []
  for (let t = 0; t < seconds; t += .05) {
    stepLane(world, .05)
    const events = drainEvents(world)
    all.push(...events)
    if (until?.(all)) break
  }
  return all
}

describe('レーンの みち', () => {
  test('s から もとめた ばしょを また s に もどせる（まんなかの せんの うえ）', () => {
    for (let s = 0; s < LANE_LENGTH; s += 7) {
      const p = lanePoint(s)
      const c = laneCoord(p.x, p.y)
      expect(Math.abs(laneDelta(c.s, s))).toBeLessThan(.01)
      expect(Math.abs(c.w)).toBeLessThan(.01)
    }
  })

  test('おくの まっすぐは みぎ → ひだり、てまえは ひだり → みぎ', () => {
    expect(lanePoint(DROP_S + 5).x).toBeGreaterThan(lanePoint(DROP_S).x)
    const farStart = LANE_LENGTH / 2 + 10
    expect(lanePoint(farStart).far).toBe(true)
    expect(lanePoint(farStart + 5).x).toBeLessThan(lanePoint(farStart).x)
  })
})

describe('かいてんレーン', () => {
  test('ながした おすしは たいしょうの まえに おかれる', () => {
    const world = quietLane()
    addRecipe(world, DEFAULT_RECIPE)
    const events = run(world, .1)
    expect(events).toContainEqual({ type: 'placed', id: expect.any(Number) })
    expect(lanePlates(world)).toHaveLength(1)
    expect(Math.abs(laneDelta(plateS(world, lanePlates(world)[0]), DROP_S))).toBeLessThan(3)
    expect(world.chef).toBeGreaterThan(0)
  })

  test('いっぱいに なったら ふるい おさらを さげ、おさらどうしは かさならない', () => {
    const world = quietLane()
    const removed: LaneEvent[] = []
    for (let i = 0; i < 12; i++) {
      addRecipe(world, { ...DEFAULT_RECIPE, neta: i % 2 ? 'salmon' : 'tamago' })
      removed.push(...run(world, 1.3).filter(e => e.type === 'removed'))
    }
    const plates = lanePlates(world)
    expect(plates).toHaveLength(LANE_CAPACITY)
    expect(removed).toHaveLength(12 - LANE_CAPACITY)
    const ss = plates.map(p => plateS(world, p))
    for (let i = 0; i < ss.length; i++) {
      for (let j = i + 1; j < ss.length; j++) expect(Math.abs(laneDelta(ss[i], ss[j]))).toBeGreaterThanOrEqual(MIN_GAP - .01)
    }
  })

  test('ちゅうもんの ネタが せきの まえに くると とって たべ、おさらが つみあがる', () => {
    const world = quietLane()
    const cat = world.customers[2]
    cat.wish = 'salmon'
    addRecipe(world, { ...DEFAULT_RECIPE, neta: 'maguro' })
    run(world, 1)
    addRecipe(world, { ...DEFAULT_RECIPE, neta: 'salmon' })
    const events = run(world, 40, all => all.some(e => e.type === 'eaten'))
    const grab = events.find(e => e.type === 'grab')
    expect(grab).toMatchObject({ seat: 2, recipe: { neta: 'salmon' } })
    expect(events.filter(e => e.type === 'bite')).toHaveLength(3)
    expect(events.find(e => e.type === 'eaten')).toMatchObject({ seat: 2, reaction: 'yummy', ticket: false })
    expect(cat.stack).toEqual(['ao'])
    expect(world.eaten).toBe(1)
    expect(cat.wish).toBeNull()
    // ちゅうもんしていない まぐろは のこって まわりつづける。
    expect(lanePlates(world).map(p => p.recipe.neta)).toEqual(['maguro'])
  })

  test('わさびいりは「ツーン」、きんぱくは「キラキラ」', () => {
    for (const [toppings, reaction] of [[['wasabi'], 'spicy'], [['kinpaku'], 'sparkle']] as const) {
      const world = quietLane()
      world.customers[1].wish = 'tamago'
      addRecipe(world, { ...DEFAULT_RECIPE, neta: 'tamago', toppings: [...toppings] })
      const events = run(world, 40, all => all.some(e => e.type === 'eaten'))
      expect(events.find(e => e.type === 'eaten')).toMatchObject({ seat: 1, reaction })
    }
  })

  test(`おさら ${PLATES_PER_GACHA}まいごとに ガチャけんが もらえる`, () => {
    const world = quietLane()
    world.eaten = PLATES_PER_GACHA - 1
    world.customers[0].wish = 'ebi'
    addRecipe(world, { ...DEFAULT_RECIPE, neta: 'ebi' })
    const events = run(world, 40, all => all.some(e => e.type === 'eaten'))
    expect(events.find(e => e.type === 'eaten')).toMatchObject({ ticket: true })
    expect(world.tickets).toBe(1)
    expect(spendTicket(world)).toBe(true)
    expect(spendTicket(world)).toBe(false)
    expect(world.tickets).toBe(0)
  })

  test('しんかんせんは ちゅうもんした おきゃくさんへ ちょくせつ とどけて もどる', () => {
    const world = quietLane()
    const recipe: Recipe = { ...DEFAULT_RECIPE, neta: 'uni', plate: 'kin' }
    expect(expressSeat(world, 'uni')).toBeNull()
    world.customers[4].wish = 'uni'
    expect(expressSeat(world, 'uni')).toBe(4)
    sendExpress(world, recipe, 4)
    expect(expressSeat(world, 'uni')).toBeNull()
    const events = run(world, 20, all => all.some(e => e.type === 'eaten'))
    expect(events[0]).toEqual({ type: 'train', phase: 'go' })
    expect(events).toContainEqual({ type: 'train', phase: 'arrive' })
    expect(events.find(e => e.type === 'eaten')).toMatchObject({ seat: 4, reaction: 'sparkle' })
    expect(lanePlates(world)).toHaveLength(0)
    run(world, 6)
    expect(world.train.phase).toBe('idle')
  })

  test('ながした ばかりの おすしは ねがいごとに されず、しばらく ながめられる', () => {
    const world = quietLane()
    world.random = () => 0
    addRecipe(world, { ...DEFAULT_RECIPE, neta: 'natto' })
    run(world, .2)
    const cat = world.customers[0]
    cat.wishIn = .05
    run(world, .2)
    expect(cat.wish).toBe('maguro')
    cat.wish = null
    cat.wishIn = FRESH_TIME
    const events = run(world, FRESH_TIME + 1, all => all.some(e => e.type === 'wish'))
    expect(events.find(e => e.type === 'wish')).toEqual({ type: 'wish', seat: 0, neta: 'natto' })
  })

  test('タップした ところの おさらが わかる', () => {
    const world = quietLane()
    addRecipe(world, DEFAULT_RECIPE)
    run(world, .1)
    const plate = lanePlates(world)[0]
    const p = platePoint(world, plate)
    expect(plateAt(world, p.x, p.y - 12)?.id).toBe(plate.id)
    expect(plateAt(world, p.x + 60, p.y)).toBeNull()
  })

  test('ほぞんした おすしを ならべなおし、ほぞん用に とりだせる', () => {
    const recipes: Recipe[] = Array.from({ length: 9 }, (_, i) => ({ ...DEFAULT_RECIPE, neta: i % 2 ? 'ika' : 'tako' }))
    const world = createLane({ recipes, eaten: 12, tickets: 2 })
    expect(lanePlates(world)).toHaveLength(LANE_CAPACITY)
    expect(world.eaten).toBe(12)
    expect(world.tickets).toBe(2)
    addRecipe(world, { ...DEFAULT_RECIPE, neta: 'uni' })
    expect(laneRecipes(world)).toHaveLength(LANE_CAPACITY)
    expect(laneRecipes(world).at(-1)?.neta).toBe('uni')
    expect(SEATS).toHaveLength(world.customers.length)
  })
})
