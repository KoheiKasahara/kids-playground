import { describe, expect, it } from 'vitest'
import { Cell, Sandbox, renderSandbox } from './sandboxSimulation'
import { PERCH_STEPS, POLLEN_STEPS, pollinate, stepButterflies, type Butterfly } from './sandboxButterfly'

const half = () => 0.5
function flat(material: number = Cell.Sand) {
  const world = new Sandbox(100, 70, half)
  world.cells.fill(material, 55 * world.width)
  return world
}
function garden() {
  const world = flat(Cell.Mud)
  world.paint({ x: 50, y: 54 }, Cell.Seed, 0)
  for (let i = 0; i < 80; i++) world.step()
  expect(world.bloomingFlowers()).toHaveLength(1)
  return world
}
const tick = (world: Sandbox, count = 1) => { for (let i = 0; i < count; i++) stepButterflies(world, half) }
function add(world: Sandbox) {
  expect(world.addButterfly()).toBe(true)
  return world.butterflies[0]
}
const seeds = (world: Sandbox) => world.cells.filter(cell => cell === Cell.Seed).length

describe('sandbox butterfly', () => {
  it('adds at most one, handles a full board and clears with the world', () => {
    const world = flat()
    expect(world.addButterfly()).toBe(true)
    expect(world.addButterfly()).toBe(false)
    expect(world.butterflies).toHaveLength(1)
    world.clear()
    expect(world.butterflies).toHaveLength(0)
    world.cells.fill(Cell.Stone)
    expect(world.addButterfly()).toBe(false)
  })

  it('flies to a bloom, rests on it and leaves it for the crabs to eat', () => {
    const world = garden()
    const butterfly = add(world)
    const bloom = world.bloomingFlowers()[0]
    const plants = world.cells.slice()
    for (let i = 0; i < 600 && !butterfly.perch; i++) tick(world)
    expect(butterfly.perch).toBe(PERCH_STEPS)
    expect(butterfly.resting).toBe(true)
    expect([butterfly.x, butterfly.y]).toEqual([bloom.x, bloom.y - 4])
    expect(butterfly.pollen).toBe(POLLEN_STEPS)
    // The flower itself is untouched: only the crabs and the turtle eat blooms.
    expect(world.bloomingFlowers()).toEqual([bloom])
    plants.forEach((cell, i) => { if (cell >= Cell.Stem) expect(world.cells[i]).toBe(cell) })
    const resting = { ...butterfly }
    tick(world, PERCH_STEPS - 1)
    expect([butterfly.x, butterfly.y]).toEqual([resting.x, resting.y])
    tick(world)
    expect(butterfly.perch).toBe(0)
    expect(butterfly.target).toBeNull()
  })

  it('sows fresh seeds beside the bloom that sprout into new flowers', () => {
    const world = garden()
    const butterfly = add(world)
    butterfly.cooldown = 0
    for (let i = 0; i < 600 && !butterfly.perch; i++) tick(world)
    expect(seeds(world)).toBe(2)
    for (const x of [62, 68]) expect(world.get(x, 54)).toBe(Cell.Seed)
    // Landing again keeps the pollen puff, but seeds wait for the next cooldown.
    expect(butterfly.cooldown).toBeGreaterThan(0)
    for (let i = 0; i < 200; i++) world.step()
    expect(world.bloomingFlowers()).toHaveLength(3)
    expect(world.flowers).toBe(3)
    expect(seeds(world)).toBe(0)
  })

  it('prefers damp sand, falls back to dry sand and never sows through an obstacle', () => {
    const world = garden()
    const butterfly = add(world)
    butterfly.cooldown = 0
    world.cells.fill(Cell.Sand, 55 * world.width, 56 * world.width)
    for (let x = 30; x <= 40; x++) world.cells[55 * world.width + x] = Cell.Mud
    butterfly.x = 40; butterfly.y = 40
    butterfly.target = world.bloomingFlowers()[0]
    for (let i = 0; i < 600 && !butterfly.perch; i++) tick(world)
    expect([world.get(32, 54), world.get(38, 54)]).toEqual([Cell.Seed, Cell.Seed])
    expect(seeds(world)).toBe(2)

    const dry = flat()
    const lonely = add(dry)
    lonely.x = 50; lonely.y = 40
    dry.stroke({ x: 32, y: 45 }, { x: 68, y: 45 }, Cell.Stone, 0)
    expect(pollen(dry, lonely)).toBe(0)
    dry.stroke({ x: 32, y: 45 }, { x: 68, y: 45 }, Cell.Empty, 0)
    expect(pollen(dry, lonely)).toBe(2)
    expect(seeds(dry)).toBe(2)
  })

  it('rises gradually out of poured sand without moving a grain', () => {
    const world = flat()
    const butterfly = add(world)
    butterfly.y = 40
    world.cells.fill(Cell.Sand, 30 * world.width)
    const grains = world.cells.slice()
    const pixels = new Uint8ClampedArray(world.cells.length * 4)
    const visible = () => {
      renderSandbox(world, pixels)
      let count = 0
      for (let i = 3; i < 30 * world.width * 4; i += 4) if (pixels[i]) count++
      return count
    }
    expect(visible()).toBe(0)
    tick(world)
    expect(butterfly.digging).toBe(true)
    expect(40 - butterfly.y).toBeCloseTo(0.06)
    tick(world, 150)
    const wingtips = visible()
    expect(wingtips).toBeGreaterThan(0)
    tick(world, 150)
    expect(visible()).toBeGreaterThan(wingtips)
    expect(butterfly.y).toBeLessThan(30)
    expect(butterfly.digging).toBe(false)
    expect(world.cells).toEqual(grains)
  })

  it('stays out of stone walls and never disturbs the sandbox while flying', () => {
    const world = flat()
    const butterfly = add(world)
    world.stroke({ x: 60, y: 4 }, { x: 60, y: 54 }, Cell.Stone, 1)
    butterfly.x = 50; butterfly.y = 30; butterfly.direction = 1; butterfly.decision = 1000
    const cells = world.cells.slice()
    for (let i = 0; i < 200; i++) {
      tick(world)
      expect(butterfly.x).toBeLessThan(57)
    }
    expect(butterfly.direction).toBe(-1)
    expect(world.cells).toEqual(cells)
  })

  it('drops a bloom a crab has eaten and looks for another one', () => {
    const world = garden()
    const butterfly = add(world)
    butterfly.search = 1; butterfly.wave = 0
    tick(world)
    expect(butterfly.target).toEqual(world.bloomingFlowers()[0])
    world.eatFlower(butterfly.target!)
    tick(world)
    expect(butterfly.target).toBeNull()
    expect(butterfly.perch).toBe(0)
  })

  it('settles down to sleep at night and wakes for daylight, a tap, sand or a shake', () => {
    const world = flat()
    const butterfly = add(world)
    world.setNight(true)
    butterfly.wave = 0; butterfly.sleepDelay = 1
    for (let i = 0; i < 400 && !butterfly.sleeping; i++) tick(world)
    expect(butterfly.sleeping).toBeGreaterThanOrEqual(180)
    expect(butterfly.y).toBeGreaterThan(50)
    const { x, y, sleeping } = butterfly
    tick(world, sleeping - 1)
    expect([butterfly.x, butterfly.y]).toEqual([x, y])
    const pixels = new Uint8ClampedArray(world.cells.length * 4)
    renderSandbox(world, pixels)
    expect(pixels.some((value, i) => i % 4 === 0 && value === 215 && pixels[i + 1] === 233 && pixels[i + 2] === 255)).toBe(true)
    tick(world)
    expect(butterfly.sleeping).toBe(0)
    expect(butterfly.sleepDelay).toBeGreaterThanOrEqual(480)

    for (const wake of [
      () => world.setNight(false),
      () => world.tapButterfly({ x: butterfly.x, y: butterfly.y }),
      () => world.paint({ x: butterfly.x, y: butterfly.y - 3 }, Cell.Water, 1),
      () => world.shake(),
    ]) {
      world.setNight(true)
      butterfly.sleeping = 200
      wake()
      expect(butterfly.sleeping).toBe(0)
    }
    world.setNight(true)
    butterfly.sleeping = 200
    world.cells[(Math.round(butterfly.y) - 4) * world.width + Math.round(butterfly.x)] = Cell.Sand
    tick(world)
    expect(butterfly.sleeping).toBe(0)
  })

  it('shows a pollen puff that drifts away and fades after the landing', () => {
    const world = flat()
    const butterfly = add(world)
    const pixels = new Uint8ClampedArray(world.cells.length * 4)
    const specks = () => {
      renderSandbox(world, pixels)
      let count = 0
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i] === 255 && pixels[i + 1] === 226 && pixels[i + 2] === 97) count++
      }
      return count
    }
    expect(specks()).toBe(0)
    butterfly.pollen = POLLEN_STEPS
    expect(specks()).toBeGreaterThan(0)
    butterfly.pollen = 0
    expect(specks()).toBe(0)
  })

  it('flutters away from a tap and ignores taps while it is buried', () => {
    const world = flat()
    const butterfly = add(world)
    const direction = butterfly.direction
    expect(world.tapButterfly({ x: butterfly.x, y: butterfly.y })).toBe(true)
    expect(butterfly.wave).toBe(90)
    expect(butterfly.direction).toBe(-direction)
    expect(butterfly.target).toBeNull()
    const y = butterfly.y
    tick(world, 20)
    expect(butterfly.y).toBeLessThan(y)
    expect(world.tapButterfly({ x: 0, y: 0 })).toBe(false)
    world.cells.fill(Cell.Sand)
    expect(world.tapButterfly({ x: butterfly.x, y: butterfly.y })).toBe(false)
  })
})

// Lands the butterfly where it already is and reports how many seeds the pollen left.
function pollen(world: Sandbox, butterfly: Butterfly) {
  butterfly.cooldown = 0
  const sown = pollinate(world, butterfly, half)
  expect(butterfly.pollen).toBe(POLLEN_STEPS)
  return sown
}
