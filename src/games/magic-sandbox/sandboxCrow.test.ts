import { expect, it } from 'vitest'
import { Cell, Sandbox, renderSandbox } from './sandboxSimulation'

const half = () => 0.5
function sky(width = 120, height = 100) {
  const world = new Sandbox(width, height, half)
  world.cells.fill(Cell.Sand, 80 * width)
  return world
}
// Skip the wait the night would normally ask for.
function firstCrow(world: Sandbox) {
  world.setNight(true)
  world.crowDelay = 1
  world.step()
  expect(world.crows).toHaveLength(1)
  return world.crows[0]
}

it('waits for the night, then crosses the sky under the moon and is gone', () => {
  const world = sky()
  for (let i = 0; i < 600; i++) world.step()
  expect(world.crows).toHaveLength(0)
  world.setNight(true)
  // Not every night and not on every look: a crossing is worth waiting for.
  expect(world.crowDelay).toBeGreaterThanOrEqual(420)
  for (let i = 0; i < 400; i++) world.step()
  expect(world.crows).toHaveLength(0)
  const crow = firstCrow(world)
  // High in the sky where the moon hangs, far above the sand along the bottom.
  expect(crow.y).toBeGreaterThan(world.height * 0.15)
  expect(crow.y).toBeLessThan(world.height * 0.3)
  expect(crow.x < 0 || crow.x > world.width).toBe(true)
  const lane = crow.y
  let steps = 0
  while (world.crows.length && steps < 3000) { world.step(); steps++ }
  // It holds its height all the way across, and takes a few seconds over it.
  expect(crow.y).toBe(lane)
  expect(steps).toBeGreaterThan(120)
  expect(steps).toBeLessThan(700)
  expect(world.crows).toHaveLength(0)
})

it('holds one crossing at a time and sends the next one only after a long quiet stretch', () => {
  const world = sky(60, 60)
  world.setNight(true)
  const seen = new Set<object>()
  for (let i = 0; i < 4000; i++) {
    world.step()
    expect(world.crows.length).toBeLessThanOrEqual(1)
    for (const crow of world.crows) seen.add(crow)
  }
  expect(seen.size).toBeGreaterThanOrEqual(2)
})

it('flies on into the daylight once it has set off, and daytime sends no more', () => {
  const world = sky()
  const crow = firstCrow(world)
  world.setNight(false)
  const { x, y } = crow
  for (let i = 0; i < 60; i++) world.step()
  expect(world.crows[0]).toBe(crow)
  expect(Math.abs(crow.x - x)).toBeGreaterThan(10)
  expect(crow.y).toBe(y)
  for (let i = 0; i < 3000; i++) world.step()
  expect(world.crows).toHaveLength(0)
})

it('passes in front of sand and rock, and through them, without moving a grain', () => {
  const world = sky()
  const crow = firstCrow(world)
  crow.x = world.width / 2
  crow.y = 30
  // A hill heaped right up into the crow's lane, and a wall across its path.
  world.paint({ x: crow.x, y: crow.y }, Cell.Sand, 8)
  world.paint({ x: crow.x + 20, y: crow.y }, Cell.Stone, 6)
  const cells = world.cells.slice()
  const pixels = new Uint8ClampedArray(world.cells.length * 4)
  renderSandbox(world, pixels)
  let overSand = 0
  for (let y = crow.y - 6; y <= crow.y + 4; y++) for (let x = crow.x - 6; x <= crow.x + 6; x++) {
    const offset = (y * world.width + x) * 4
    if (world.get(x, y) === Cell.Sand && pixels[offset] === 45 && pixels[offset + 1] === 49 && pixels[offset + 2] === 68) overSand++
  }
  expect(overSand).toBeGreaterThan(20)
  expect(world.cells).toEqual(cells)
  for (let i = 0; i < 80; i++) world.step()
  // The wall is behind it now: nothing on the board can turn a crow back.
  expect(crow.x).toBeGreaterThan(world.width / 2 + 26)
})

it('keeps its lane and its pace when the board turns, and goes when the sandbox is cleared', () => {
  const world = sky()
  const crow = firstCrow(world)
  const lane = crow.y / world.height, across = crow.x / world.width, pace = crow.speed / world.width
  world.resize(200, 60)
  expect(crow.y / world.height).toBeCloseTo(lane)
  expect(crow.x / world.width).toBeCloseTo(across)
  expect(crow.speed / world.width).toBeCloseTo(pace)
  world.clear()
  expect(world.crows).toHaveLength(0)
})
