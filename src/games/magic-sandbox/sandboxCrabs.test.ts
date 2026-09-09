import { describe, expect, it } from 'vitest'
import { Cell, Sandbox, renderSandbox } from './sandboxSimulation'
import { stepCrabs } from './sandboxCrabs'

function flat() {
  const world = new Sandbox(80, 60, () => 0.5)
  for (let y = 50; y < 60; y++) for (let x = 0; x < 80; x++) world.cells[y * 80 + x] = Cell.Sand
  return world
}

describe('sandbox crabs', () => {
  it('adds at most two, handles a full board, and clears with the world', () => {
    const world = flat()
    expect(world.addCrab()).toBe(true)
    expect(world.addCrab()).toBe(true)
    expect(world.addCrab()).toBe(false)
    expect(world.crabs).toHaveLength(2)
    world.clear()
    expect(world.crabs).toHaveLength(0)
    world.cells.fill(Cell.Stone)
    expect(world.addCrab()).toBe(false)
  })

  it('emerges gradually through settled sand without moving or deleting grains', () => {
    const world = flat()
    world.addCrab()
    const crab = world.crabs[0]
    const initialY = crab.y
    for (let y = 35; y < 50; y++) for (let x = 0; x < 80; x++) world.cells[y * 80 + x] = Cell.Sand
    const grains = world.cells.slice()
    const pixels = new Uint8ClampedArray(world.cells.length * 4)
    const visible = () => {
      renderSandbox(world, pixels)
      let count = 0
      for (let i = 3; i < 35 * world.width * 4; i += 4) if (pixels[i]) count++
      return count
    }
    expect(visible()).toBe(0)
    stepCrabs(world, () => 0.5)
    expect(initialY - crab.y).toBeGreaterThan(0)
    expect(initialY - crab.y).toBeLessThan(0.1)
    for (let i = 0; i < 130; i++) stepCrabs(world, () => 0.5)
    const claws = visible()
    expect(claws).toBeGreaterThan(0)
    for (let i = 0; i < 180; i++) stepCrabs(world, () => 0.5)
    expect(visible()).toBeGreaterThan(claws)
    expect(crab.y).toBeLessThan(35)
    expect(world.cells).toEqual(grains)
  })

  it.each([Cell.Stone, Cell.Seed])('turns away from protected material %s without damaging it', material => {
    const world = flat()
    world.addCrab()
    const crab = world.crabs[0]
    crab.wave = 0; crab.direction = 1; crab.decision = 1000
    const x = Math.round(crab.x) + 7
    world.cells[48 * 80 + x] = material
    for (let i = 0; i < 15; i++) stepCrabs(world, () => 0.5)
    expect(crab.direction).toBe(-1)
    expect(world.get(x, 48)).toBe(material)
  })

  it('waves on a tap and greets a nearby friend before separating', () => {
    const world = flat()
    world.addCrab(); world.addCrab()
    const [a, b] = world.crabs
    expect(world.tapCrab({ x: a.x, y: a.y - 4 })).toBe(true)
    expect(a.wave).toBe(90)
    expect(world.tapCrab({ x: 0, y: 0 })).toBe(false)
    a.x = 25; b.x = 45
    a.cooldown = b.cooldown = 0
    stepCrabs(world, () => 0.5)
    expect(a.direction).toBe(1)
    expect(b.direction).toBe(-1)
    expect(a.wave).toBeGreaterThan(90)
    expect(b.wave).toBeGreaterThan(90)
    for (let i = 0; i < 115; i++) stepCrabs(world, () => 0.5)
    expect(a.direction).toBe(-1)
    expect(b.direction).toBe(1)
    expect(b.x - a.x).toBeGreaterThan(20)
  })

  it('sometimes chooses nearby water and falls when its support is erased', () => {
    const world = flat()
    world.addCrab()
    const crab = world.crabs[0]
    crab.wave = 0; crab.decision = 0
    world.cells[48 * 80 + 25] = Cell.Water
    const choices = [0.5, 0.8, 0.8, 0.1]
    stepCrabs(world, () => choices.shift() ?? 0.5)
    expect(crab.direction).toBe(-1)
    world.cells.fill(Cell.Empty)
    const y = crab.y
    stepCrabs(world, () => 0.5)
    expect(crab.y).toBeGreaterThan(y)
  })
})


it.each([Cell.Stem, Cell.Petal, Cell.Pollen, Cell.Root])('walks through grown plant material %s without changing it', material => {
  const world = flat()
  world.addCrab()
  const crab = world.crabs[0]
  crab.wave = 0; crab.direction = 1; crab.decision = 1000
  const x = Math.round(crab.x) + 7
  for (let y = 40; y < 50; y++) world.cells[y * 80 + x] = material
  const cells = world.cells.slice()
  for (let i = 0; i < 200; i++) stepCrabs(world, () => 0.5)
  expect(crab.x).toBeGreaterThan(x + 6)
  expect(crab.direction).toBe(1)
  expect(world.cells).toEqual(cells)
})

it('ignores grown plants when spawning, falling and digging upward', () => {
  const world = flat()
  for (let x = 0; x < 80; x++) world.cells[30 * 80 + x] = Cell.Petal
  world.addCrab()
  const crab = world.crabs[0]
  expect(crab.y).toBe(49)
  crab.y = 29
  stepCrabs(world, () => 0.5)
  expect(crab.y).toBeGreaterThan(29)
  crab.y = 49
  for (let x = 0; x < 80; x++) world.cells[49 * 80 + x] = Cell.Sand
  world.cells[45 * 80 + Math.round(crab.x)] = Cell.Stem
  stepCrabs(world, () => 0.5)
  expect(crab.y).toBeLessThan(49)
  expect(world.get(Math.round(crab.x), 45)).toBe(Cell.Stem)
})
