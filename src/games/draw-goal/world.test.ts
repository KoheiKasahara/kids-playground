import { describe, expect, test } from 'vitest'
import Matter from 'matter-js'
import { STAGES } from './stages'
import { appendPoint, createWorld, MAX_LINES, MAX_POINTS, MAX_SEGMENTS } from './world'
import type { Point } from './stroke'

function run(world: ReturnType<typeof createWorld>) {
  for (let i = 0; i < 1200 && world.state === 'running'; i++) world.step()
}
// Wide, imprecise example roads. Test the actual physics, not a mocked goal flag.
const solutions: Point[][][] = [
  [[{ x: 55, y: 175 }, { x: 285, y: 520 }]],
  [[{ x: 345, y: 175 }, { x: 115, y: 520 }]],
  [[{ x: 125, y: 200 }, { x: 285, y: 520 }]],
  [[{ x: 45, y: 160 }, { x: 260, y: 260 }, { x: 285, y: 520 }], [{ x: 340, y: 260 }, { x: 340, y: 470 }]],
  [[{ x: 145, y: 295 }, { x: 290, y: 520 }]],
  [[{ x: 100, y: 175 }, { x: 185, y: 325 }], [{ x: 235, y: 345 }, { x: 295, y: 520 }]],
]
describe('fixed drawing roads', () => {
  test.each(STAGES.map((s, i) => [s.name, i] as const))('%s has a playable route', (_name, i) => {
    const world = createWorld(STAGES[i])
    for (const line of solutions[i]) expect(world.addStroke(line)).toBe(true)
    const before = world.lines.flatMap(l => l.bodies.map(b => ({ ...b.position })))
    run(world)
    expect(world.state, JSON.stringify(world.ball.position)).toBe('goal')
    expect(world.lines.flatMap(l => l.bodies.map(b => b.position))).toEqual(before)
    expect(world.lines.every(l => l.bodies.every(b => b.isStatic))).toBe(true)
    world.destroy()
  })
  test.each(STAGES)('$name needs a drawn road', stage => {
    const world = createWorld(stage)
    world.start()
    run(world)
    expect(world.state).toBe('retry')
    world.destroy()
  })
  test.each([-18, 0, 18])('early stages accept different roads (offset %i)', offset => {
    for (const i of [0, 1, 2]) {
      const world = createWorld(STAGES[i])
      world.addStroke(solutions[i][0].map(p => ({ x: p.x + offset, y: p.y })))
      run(world)
      expect(world.state, `stage ${i + 1}, offset ${offset}`).toBe('goal')
      world.destroy()
    }
  })
  test('waits for a line, falls with gravity, detects misses and resets without losing roads', () => {
    const world = createWorld(STAGES[0])
    for (let i = 0; i < 60; i++) world.step()
    expect(world.ball.position).toEqual(STAGES[0].ball)
    world.start()
    world.step()
    expect(world.ball.position.y).toBeGreaterThan(STAGES[0].ball.y)
    run(world)
    expect(world.state).toBe('retry')
    world.retry()
    expect(world.addStroke(solutions[0][0])).toBe(true)
    world.retry()
    expect(world.lines).toHaveLength(1)
    expect(world.ball.position).toEqual(STAGES[0].ball)
    expect(world.ball.velocity).toEqual({ x: 0, y: 0 })
    world.undo()
    expect(world.lines).toHaveLength(0)
    world.destroy()
  })
  test('only entering the cup counts, and a goal is stable', () => {
    const world = createWorld(STAGES[0])
    world.start()
    Matter.Body.setPosition(world.ball, { x: STAGES[0].goal.x, y: STAGES[0].goal.y - 20 })
    world.step()
    expect(world.state).toBe('running')
    Matter.Body.setPosition(world.ball, { x: STAGES[0].goal.x, y: STAGES[0].goal.y + 40 })
    world.step()
    expect(world.state).toBe('goal')
    const position = { ...world.ball.position }
    world.step()
    expect(world.ball.position).toEqual(position)
    world.retry(true)
    expect(world.state).toBe('ready')
    world.destroy()
  })
  test('bounds scribbles and ignores invalid, tiny and overlapping lines', () => {
    const world = createWorld(STAGES[0])
    expect(world.addStroke([{ x: NaN, y: Infinity }])).toBe(false)
    expect(world.addStroke([{ x: 10, y: 10 }])).toBe(false)
    expect(world.addStroke([{ x: 70, y: 90 }, { x: 130, y: 90 }])).toBe(false)
    const points: Point[] = []
    for (let i = 0; i < 10000; i++) appendPoint(points, { x: i % 390, y: 250 + i % 200 })
    expect(points.length).toBeLessThanOrEqual(MAX_POINTS)
    for (let i = 0; i < MAX_LINES + 5; i++) world.addStroke(points)
    expect(world.lines).toHaveLength(MAX_LINES)
    expect(world.lines.every(l => l.bodies.length <= MAX_SEGMENTS)).toBe(true)
    world.retry(true)
    expect(world.lines).toHaveLength(0)
    world.destroy()
  })
})
