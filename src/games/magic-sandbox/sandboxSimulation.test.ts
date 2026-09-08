import { describe, expect, it } from 'vitest'
import { Cell, Sandbox, renderSandbox } from './sandboxSimulation'
const advance = (world: Sandbox, steps = 100) => { for (let i = 0; i < steps; i++) world.step() }
const count = (world: Sandbox, material: number) => world.cells.filter(c => c === material).length
function seeded() {
  let seed = 1234
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x100000000 }
}
function bed(material: number) {
  const world = new Sandbox(48, 48, seeded())
  world.cells.fill(material, 36 * 48)
  world.paint({ x: 24, y: 34 }, Cell.Seed, 0)
  return world
}
describe('falling sand play loop', () => {
  it('sand falls, accumulates and cannot leave the closed bottom', () => {
    const world = new Sandbox(32, 32, seeded())
    world.paint({ x: 16, y: 3 }, Cell.Sand, 3)
    const grains = count(world, Cell.Sand)
    advance(world)
    expect(count(world, Cell.Sand)).toBe(grains)
    expect(world.cells.slice(0, 16 * 32).some(Boolean)).toBe(false)
    expect(world.cells.slice(31 * 32).some(c => c === Cell.Sand)).toBe(true)
  })
  it('water fills a stone container and cannot tunnel through its walls', () => {
    const world = new Sandbox(40, 40, seeded())
    world.stroke({ x: 8, y: 0 }, { x: 8, y: 30 }, Cell.Stone, 0)
    world.stroke({ x: 30, y: 0 }, { x: 30, y: 30 }, Cell.Stone, 0)
    world.stroke({ x: 8, y: 30 }, { x: 30, y: 30 }, Cell.Stone, 0)
    world.paint({ x: 19, y: 9 }, Cell.Water, 5)
    const water = count(world, Cell.Water)
    advance(world, 200)
    expect(count(world, Cell.Water)).toBe(water)
    for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) {
      if (world.get(x, y) === Cell.Water) { expect(x).toBeGreaterThan(8); expect(x).toBeLessThan(30); expect(y).toBeLessThan(30) }
    }
    expect(world.get(10, 29)).toBe(Cell.Water)
    expect(world.get(28, 29)).toBe(Cell.Water)
  })
  it('sand sinks through water, becomes damp, and preserves water', () => {
    const world = new Sandbox(24, 24, seeded())
    world.cells.fill(Cell.Water, 12 * 24)
    world.paint({ x: 12, y: 3 }, Cell.Sand, 2)
    const water = count(world, Cell.Water), sand = count(world, Cell.Sand)
    advance(world, 160)
    expect(count(world, Cell.Water)).toBe(water)
    expect(count(world, Cell.Mud)).toBe(sand)
    expect(world.cells.slice(23 * 24).some(c => c === Cell.Mud)).toBe(true)
  })
  it('seeds grow gradually into flowers only on damp sand', () => {
    const wet = bed(Cell.Mud), dry = bed(Cell.Sand), stone = bed(Cell.Stone)
    advance(wet, 30)
    expect(count(wet, Cell.Stem)).toBeGreaterThan(0)
    expect(wet.flowers).toBe(0)
    advance(wet); advance(dry, 150); advance(stone, 150)
    expect(wet.flowers).toBe(1)
    expect(count(wet, Cell.Petal)).toBeGreaterThan(0)
    expect(dry.flowers).toBe(0)
    expect(stone.flowers).toBe(0)
  })
  it('a child can water the starting sand, sow seeds and grow flowers even in a puddle', () => {
    const world = new Sandbox(48, 48, seeded())
    world.prepare()
    world.paint({ x: 24, y: 12 }, Cell.Water, 6)
    advance(world, 100)
    expect(count(world, Cell.Mud)).toBeGreaterThan(0)
    for (let x = 5; x < 44; x += 6) world.paint({ x, y: 4 }, Cell.Seed, 0)
    advance(world, 180)
    expect(world.flowers).toBeGreaterThan(0)
  })
  it('erasing a growing root prevents later regrowth and clearing removes plants', () => {
    const world = bed(Cell.Mud)
    advance(world, 24)
    world.paint({ x: 24, y: 35 }, Cell.Empty, 2)
    advance(world)
    expect(world.flowers).toBe(0)
    world.clear(); advance(world)
    expect(world.cells.some(Boolean)).toBe(false)
  })
  it('shaking lifts loose grains without destroying them or moving stone', () => {
    const world = new Sandbox(40, 40, seeded())
    world.prepare()
    world.stroke({ x: 1, y: 20 }, { x: 10, y: 20 }, Cell.Stone, 0)
    advance(world)
    const before = world.cells.slice(), sand = count(world, Cell.Sand)
    world.shake()
    expect(world.cells).not.toEqual(before)
    expect(count(world, Cell.Sand)).toBe(sand)
    before.forEach((cell, i) => { if (cell === Cell.Stone) expect(world.cells[i]).toBe(Cell.Stone) })
    advance(world)
    expect(count(world, Cell.Sand)).toBe(sand)
  })
  it('fast strokes stay connected; erasing opens a passage; boundary brushes stay bounded', () => {
    const world = new Sandbox(32, 32, seeded())
    world.stroke({ x: 1, y: 15 }, { x: 30, y: 15 }, Cell.Stone, 1)
    for (let x = 1; x <= 30; x++) expect(world.get(x, 15)).toBe(Cell.Stone)
    world.paint({ x: 16, y: 15 }, Cell.Empty, 3)
    expect(world.get(16, 15)).toBe(Cell.Empty)
    world.paint({ x: -1, y: -1 }, Cell.Water, 3)
    advance(world)
    expect(world.cells.length).toBe(1024)
    expect(Object.keys(world.cells).length).toBe(1024)
  })
  it('renders empty cells transparent and all materials opaque', () => {
    const world = new Sandbox(10, 10)
    for (let i = 0; i <= Cell.Root; i++) world.cells[i] = i
    const pixels = new Uint8ClampedArray(400)
    renderSandbox(world, pixels)
    expect(pixels[3]).toBe(0)
    for (let i = 1; i <= Cell.Root; i++) expect(pixels[i * 4 + 3]).toBe(255)
  })
})
