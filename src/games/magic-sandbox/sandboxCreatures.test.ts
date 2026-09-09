import { describe, expect, it } from 'vitest'
import { Cell, Sandbox, renderSandbox } from './sandboxSimulation'
import { EATING_STEPS, FULL_STEPS, stepCrabs, stepTurtles } from './sandboxCrabs'

function garden() {
  const world = new Sandbox(100, 70, () => 0.5)
  world.cells.fill(Cell.Mud, 55 * world.width)
  for (const x of [25, 45, 65]) world.paint({ x, y: 54 }, Cell.Seed, 0)
  for (let i = 0; i < 80; i++) world.step()
  expect(world.bloomingFlowers()).toHaveLength(3)
  return world
}
function tick(world: Sandbox, steps = 1) {
  for (let i = 0; i < steps; i++) { stepCrabs(world, () => 0.5); stepTurtles(world, () => 0.5) }
}
const kinds = ['crab', 'turtle'] as const
function add(world: Sandbox, kind: typeof kinds[number]) {
  expect(kind === 'crab' ? world.addCrab() : world.addTurtle()).toBe(true)
  return kind === 'crab' ? world.crabs.at(-1)! : world.turtles.at(-1)!
}

describe.each(kinds)('%s flower play', kind => {
  it('approaches a flower, finishes eating before growing, stays full and caps growth at three sizes', () => {
    const world = garden()
    const creature = add(world, kind)
    creature.x = 10; creature.fullness = 0
    const before = world.cells.slice()
    for (let i = 0; i < 600 && !creature.eating; i++) tick(world)
    expect(creature.x).toBeGreaterThan(10)
    expect(creature.eating).toBe(EATING_STEPS)
    expect(creature.growth).toBe(0)
    expect(world.cells).toEqual(before)
    tick(world, EATING_STEPS)
    expect(creature.growth).toBe(1)
    expect(creature.fullness).toBe(FULL_STEPS)
    expect(creature.celebration).toBeGreaterThan(0)
    expect(world.bloomingFlowers()).toHaveLength(2)
    expect(world.flowers).toBe(3)
    const after = world.cells.slice()
    tick(world, FULL_STEPS - 1)
    expect(world.cells).toEqual(after)
    expect(creature.target).toBeNull()
    // Let the next two meals finish, including a meal at maximum size.
    for (const expected of [2, 2]) {
      const flower = world.bloomingFlowers()[0]
      creature.x = flower.x - 8; creature.y = 54
      creature.fullness = 0; creature.search = 0
      tick(world, EATING_STEPS + 1)
      expect(creature.growth).toBe(expected)
      expect(creature.fullness).toBe(FULL_STEPS)
    }
    expect(world.bloomingFlowers()).toHaveLength(0)
    for (let i = 0; i < before.length; i++) {
      if (before[i] >= Cell.Stem) expect(world.cells[i]).toBe(Cell.Empty)
      else expect(world.cells[i]).toBe(before[i])
    }
    for (let i = 0; i < 100; i++) world.step()
    expect(world.bloomingFlowers()).toHaveLength(0)
    expect(world.flowers).toBe(3)
  })

  it('cancels an erased flower or a buried meal without phantom growth', () => {
    const world = garden()
    const creature = add(world, kind)
    creature.x = 18; creature.fullness = 0
    tick(world)
    expect(creature.eating).toBeGreaterThan(0)
    world.paint(creature.target!, Cell.Empty, 2)
    tick(world, EATING_STEPS + 1)
    expect(creature.growth).toBe(0)
    creature.x = 38; creature.search = 0
    tick(world)
    expect(creature.eating).toBeGreaterThan(0)
    world.cells.fill(Cell.Sand, 35 * world.width, 55 * world.width)
    const y = creature.y
    tick(world)
    expect(creature.digging).toBe(true)
    expect(creature.y).toBeCloseTo(y - 0.055)
    expect(creature.target).toBeNull()
    expect(creature.eating).toBe(0)
    expect(creature.growth).toBe(0)
  })

  it('does not eat through stone or pursue inaccessible flowers forever', () => {
    const world = garden()
    const creature = add(world, kind)
    creature.x = 18; creature.fullness = 0
    world.stroke({ x: 22, y: 35 }, { x: 22, y: 54 }, Cell.Stone, 0)
    tick(world, EATING_STEPS + 1)
    expect(creature.growth).toBe(0)
    expect(world.bloomingFlowers()).toHaveLength(3)
    creature.target = { x: 65, y: 44 }; creature.pursuit = 1
    tick(world)
    expect(creature.target).toBeNull()
  })

  it.each([0, 2])('emerges gradually at growth %s with increasing visible body and no displaced grains', growth => {
    const world = new Sandbox(100, 70, () => 0.5)
    world.cells.fill(Cell.Sand, 55 * world.width)
    const creature = add(world, kind)
    creature.growth = growth
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
    const y = creature.y
    tick(world)
    expect(y - creature.y).toBeGreaterThan(0)
    expect(y - creature.y).toBeLessThan(0.1)
    tick(world, 340)
    const partial = visible()
    expect(partial).toBeGreaterThan(0)
    tick(world, 160)
    expect(visible()).toBeGreaterThan(partial)
    expect(creature.y).toBeLessThan(30)
    expect(world.cells).toEqual(grains)
  })

  it('can walk away from a boundary after growing beside it', () => {
    const world = garden()
    const creature = add(world, kind)
    creature.x = 7; creature.growth = 2; creature.direction = 1
    creature.wave = 0; creature.decision = 1000; creature.fullness = FULL_STEPS
    tick(world, 200)
    expect(creature.x).toBeGreaterThan(14)
  })

  it('passes through green plants and petals without colliding or eating while full', () => {
    const world = garden()
    const creature = add(world, kind)
    creature.x = 10; creature.direction = 1; creature.wave = 0; creature.decision = 1000
    creature.fullness = FULL_STEPS
    const cells = world.cells.slice()
    tick(world, 700)
    expect(creature.x).toBeGreaterThan(36)
    expect(creature.direction).toBe(1)
    expect(world.cells).toEqual(cells)
  })
})

it('allows two crabs and one turtle, shares flower reservations and clears both kinds', () => {
  const world = garden()
  const a = add(world, 'crab'), b = add(world, 'crab'), c = add(world, 'turtle')
  expect(world.addCrab()).toBe(false)
  expect(world.addTurtle()).toBe(false)
  a.x = 16; b.x = 38; c.x = 60
  for (const creature of [a, b, c]) creature.fullness = 0
  tick(world)
  expect(new Set([a.target?.x, b.target?.x, c.target?.x]).size).toBe(3)
  tick(world, EATING_STEPS)
  expect([a.growth, b.growth, c.growth]).toEqual([1, 1, 1])
  expect(world.bloomingFlowers()).toHaveLength(0)
  world.clear()
  expect(world.crabs).toHaveLength(0)
  expect(world.turtles).toHaveLength(0)
  world.cells.fill(Cell.Stone)
  expect(world.addTurtle()).toBe(false)
})

it('only one animal can gain growth from the last flower', () => {
  const world = garden()
  for (const flower of world.bloomingFlowers().slice(1)) world.eatFlower(flower)
  const a = add(world, 'crab'), b = add(world, 'turtle')
  a.x = b.x = world.bloomingFlowers()[0].x - 7
  a.fullness = b.fullness = 0
  tick(world, EATING_STEPS + 500)
  expect(a.growth + b.growth).toBe(1)
  expect(world.bloomingFlowers()).toHaveLength(0)
})

it('turtles walk more slowly than crabs and react to a tap', () => {
  const world = new Sandbox(100, 70, () => 0.5)
  world.cells.fill(Cell.Sand, 55 * world.width)
  const crab = add(world, 'crab'), turtle = add(world, 'turtle')
  for (const creature of [crab, turtle]) { creature.wave = 0; creature.direction = -1; creature.decision = 1000 }
  const cx = crab.x, tx = turtle.x
  tick(world, 100)
  expect(tx - turtle.x).toBeLessThan(cx - crab.x)
  expect(tx - turtle.x).toBeGreaterThan(0)
  expect(world.tapTurtle({ x: turtle.x, y: turtle.y - 4 })).toBe(true)
  expect(turtle.wave).toBe(90)
})

describe.each([0, 2])('creature spacing at growth %s', growth => {
  it.each(['crab', 'turtle'] as const)('separates a crab and %s even when resting at the same position beside a wall', kind => {
    const world = garden()
    const a = add(world, 'crab'), b = add(world, kind)
    for (const c of [a, b]) {
      c.x = 7 * (1 + growth * 0.25); c.growth = growth
      c.resting = true; c.wave = 90; c.decision = 1000
    }
    tick(world, 400)
    expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual(18 * (1 + growth * 0.25))
    expect(Math.min(a.x, b.x)).toBeGreaterThanOrEqual(7 * (1 + growth * 0.25))
  })

  it('turns away from another species while pursuing a flower', () => {
    const world = garden()
    const a = add(world, 'crab'), b = add(world, 'turtle')
    a.x = 10; b.x = 40
    for (const c of [a, b]) { c.growth = growth; c.fullness = 0; c.wave = 0 }
    for (let i = 0; i < 700; i++) {
      tick(world)
      // Meals may enlarge the body, but walking must never cross the other animal.
      expect(b.x - a.x).toBeGreaterThan(17)
    }
  })
})

it.each(kinds)('renders the %s in front of plants while terrain still masks its body', kind => {
  const world = garden()
  const c = add(world, kind)
  c.x = 15
  const pixels = new Uint8ClampedArray(world.cells.length * 4)
  const index = (Math.round(c.y - 3) * world.width + c.x) * 4
  renderSandbox(world, pixels)
  const body = pixels.slice(index, index + 4)
  for (const material of [Cell.Stem, Cell.Petal, Cell.Pollen, Cell.Root, Cell.Sand, Cell.Mud, Cell.Stone, Cell.Seed]) {
    world.cells[index / 4] = material
    renderSandbox(world, pixels)
    if (material >= Cell.Stem) expect(pixels.slice(index, index + 4)).toEqual(body)
    else expect(pixels.slice(index, index + 4)).not.toEqual(body)
    expect(world.cells[index / 4]).toBe(material)
  }
})

it.each([30, 80])('withers the whole plant when its support disappears after %s steps', steps => {
  const world = new Sandbox(100, 70, () => 0.5)
  world.cells.fill(Cell.Mud, 55 * world.width)
  world.paint({ x: 25, y: 54 }, Cell.Seed, 0)
  for (let i = 0; i < steps; i++) world.step()
  expect(world.cells.some(c => c === Cell.Stem)).toBe(true)
  world.cells.fill(Cell.Empty, 55 * world.width)
  world.step()
  expect(world.cells.some(c => c >= Cell.Stem)).toBe(false)
  for (let i = 0; i < 80; i++) world.step()
  expect(world.bloomingFlowers()).toHaveLength(0)
})

it('withers an erased root without deleting replacement material or neighboring plants', () => {
  const world = garden()
  const neighbors = world.cells.slice()
  world.paint({ x: 25, y: 54 }, Cell.Empty, 0)
  world.paint({ x: 25, y: 50 }, Cell.Empty, 0)
  world.paint({ x: 25, y: 50 }, Cell.Stone, 0)
  world.step()
  expect(world.get(25, 50)).toBe(Cell.Stone)
  expect(world.bloomingFlowers()).toHaveLength(2)
  for (let y = 0; y < 55; y++) {
    for (let x = 23; x <= 27; x++) expect(world.get(x, y)).toBe(x === 25 && y === 50 ? Cell.Stone : Cell.Empty)
    for (let x = 43; x <= 67; x++) expect(world.get(x, y)).toBe(neighbors[y * world.width + x])
  }
})
