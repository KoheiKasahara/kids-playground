import { describe, expect, it } from 'vitest'
import { Cell, Sandbox, renderSandbox } from './sandboxSimulation'
import { stepCrabs, stepTurtles } from './sandboxCrabs'

function flat() {
  const world = new Sandbox(120, 70, () => 0.5)
  world.cells.fill(Cell.Sand, 55 * world.width)
  return world
}
function tick(world: Sandbox, count = 1) {
  for (let i = 0; i < count; i++) { stepCrabs(world, () => 0.5); stepTurtles(world, () => 0.5) }
}
describe.each(['crab', 'turtle'] as const)('%s at night', kind => {
  function setup() {
    const world = flat()
    if (kind === 'crab') world.addCrab(); else world.addTurtle()
    const creature = [...world.crabs, ...world.turtles][0]
    world.setNight(true)
    creature.wave = 0; creature.sleepDelay = 1
    tick(world)
    expect(creature.sleeping).toBeGreaterThanOrEqual(180)
    return { world, creature }
  }
  it('sleeps for a few seconds, freezes movement, draws sleep breaths and wakes naturally', () => {
    const { world, creature } = setup()
    const { x, y, phase, sleeping } = creature
    tick(world, sleeping - 1)
    expect([creature.x, creature.y, creature.phase]).toEqual([x, y, phase])
    const pixels = new Uint8ClampedArray(world.cells.length * 4)
    renderSandbox(world, pixels)
    expect(pixels.some((value, i) => i % 4 === 0 && value === 215 && pixels[i + 1] === 233 && pixels[i + 2] === 255)).toBe(true)
    tick(world)
    expect(creature.sleeping).toBe(0)
    expect(creature.sleepDelay).toBeGreaterThanOrEqual(480)
    expect(creature.x).not.toBe(x)
    world.setNight(false)
    tick(world, 1800)
    expect(creature.sleeping).toBe(0)
  })
  it('wakes immediately for daylight, taps, painting and shaking, including while paused', () => {
    const { world, creature } = setup()
    world.setNight(false)
    expect(creature.sleeping).toBe(0)
    world.setNight(true)
    creature.sleeping = 200
    if (kind === 'crab') world.tapCrab({ x: creature.x, y: creature.y - 4 })
    else world.tapTurtle({ x: creature.x, y: creature.y - 4 })
    expect(creature.sleeping).toBe(0)
    expect(creature.wave).toBe(90)
    for (const material of [Cell.Sand, Cell.Water, Cell.Empty]) {
      creature.sleeping = 200
      world.paint({ x: creature.x, y: creature.y - 4 }, material, 1)
      expect(creature.sleeping).toBe(0)
    }
    creature.sleeping = 200
    world.shake()
    expect(creature.sleeping).toBe(0)
  })
  it.each([Cell.Sand, Cell.Water])('wakes when falling material %s reaches its body', material => {
    const { world, creature } = setup()
    world.cells[(Math.round(creature.y) - 4) * world.width + Math.round(creature.x)] = material
    tick(world)
    expect(creature.sleeping).toBe(0)
    creature.sleepDelay = 0
    tick(world)
    expect(creature.sleeping).toBe(0)
  })
  it('wakes to fall or dig when its ground changes', () => {
    const { world, creature } = setup()
    world.cells.fill(Cell.Empty)
    const y = creature.y
    tick(world)
    expect(creature.sleeping).toBe(0)
    expect(creature.y).toBeGreaterThan(y)
    creature.sleeping = 200
    world.cells.fill(Cell.Sand, 50 * world.width)
    tick(world)
    expect(creature.sleeping).toBe(0)
    expect(creature.digging).toBe(true)
  })
  it('wakes for a nearby flower and completes the usual meal and growth', () => {
    const world = flat()
    world.cells.fill(Cell.Mud, 55 * world.width)
    world.paint({ x: 45, y: 54 }, Cell.Seed, 0)
    for (let i = 0; i < 80; i++) world.step()
    expect(world.bloomingFlowers()).toHaveLength(1)
    if (kind === 'crab') world.addCrab(); else world.addTurtle()
    const creature = [...world.crabs, ...world.turtles][0]
    creature.x = 37; creature.y = 54; creature.fullness = 0; creature.wave = 0
    world.setNight(true)
    creature.sleeping = 200
    tick(world)
    expect(creature.sleeping).toBe(0)
    expect(creature.eating).toBeGreaterThan(0)
    tick(world, 90)
    expect(creature.growth).toBe(1)
    expect(world.bloomingFlowers()).toHaveLength(0)
  })
})

it('assigns independent bedtimes, permits just one sleeping crab and schedules night arrivals', () => {
  let value = 0.1
  const world = new Sandbox(120, 70, () => { value = (value + 0.17) % 1; return value })
  world.cells.fill(Cell.Sand, 55 * world.width)
  world.addCrab(); world.addCrab()
  world.crabs[0].x = 30; world.crabs[1].x = 85
  world.setNight(true)
  expect(world.crabs[0].sleepDelay).not.toBe(world.crabs[1].sleepDelay)
  for (const crab of world.crabs) crab.wave = 0
  const first = world.crabs[0].sleepDelay < world.crabs[1].sleepDelay ? 0 : 1
  tick(world, world.crabs[first].sleepDelay)
  expect(world.crabs[first].sleeping).toBeGreaterThan(0)
  expect(world.crabs[1 - first].sleeping).toBe(0)
  world.addTurtle()
  expect(world.turtles[0].sleepDelay).toBeGreaterThanOrEqual(480)
})

it('keeps water, sand and plant growth identical between day and night', () => {
  const day = flat(), night = flat()
  night.setNight(true)
  for (const world of [day, night]) {
    world.paint({ x: 35, y: 54 }, Cell.Water, 4)
    world.paint({ x: 35, y: 44 }, Cell.Seed, 0)
  }
  for (let i = 0; i < 150; i++) { day.step(); night.step() }
  expect(night.cells).toEqual(day.cells)
  expect(night.flowers).toBe(day.flowers)
  expect(night.flowers).toBeGreaterThan(0)
})
