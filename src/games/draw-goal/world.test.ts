import { describe, expect, test } from 'vitest'
import Matter from 'matter-js'
import { BALL_RADIUS, HEIGHT, STAGES, STAR_RADIUS, WARP_RADIUS, WIDTH } from './stages'
import { appendPoint, createWorld, MAX_LINES, MAX_POINTS, MAX_SEGMENTS, SETTLE_FRAMES } from './world'
import type { Point } from './stroke'

function run(world: ReturnType<typeof createWorld>) {
  for (let i = 0; i < 1200 && (world.state === 'running' || world.state === 'scored'); i++) world.step()
}
// Wide, imprecise example roads. Test the actual physics, not a mocked goal flag.
const solutions: Point[][][] = [
  [[{ x: 55, y: 175 }, { x: 285, y: 520 }]],
  [[{ x: 345, y: 175 }, { x: 115, y: 520 }]],
  [[{ x: 125, y: 200 }, { x: 285, y: 520 }]],
  [[{ x: 45, y: 160 }, { x: 260, y: 260 }, { x: 285, y: 520 }], [{ x: 340, y: 260 }, { x: 340, y: 470 }]],
  [[{ x: 145, y: 295 }, { x: 290, y: 520 }]],
  [[{ x: 100, y: 175 }, { x: 185, y: 325 }], [{ x: 235, y: 345 }, { x: 295, y: 520 }]],
  [[{ x: 35, y: 150 }, { x: 150, y: 300 }]],
  [[{ x: 55, y: 150 }, { x: 130, y: 235 }]],
  [[{ x: 45, y: 175 }, { x: 125, y: 245 }]],
  [[{ x: 55, y: 150 }, { x: 150, y: 255 }]],
]
// Stars the example road sweeps up on its way. Stage 5 keeps its star on a flatter road, off this one.
const picks = [1, 1, 1, 1, 0, 2, 1, 2, 3, 2]
describe('fixed drawing roads', () => {
  test.each(STAGES.map((s, i) => [s.name, i] as const))('%s has a playable route', (_name, i) => {
    const world = createWorld(STAGES[i])
    for (const line of solutions[i]) expect(world.addStroke(line)).toBe(true)
    const before = world.lines.flatMap(l => l.bodies.map(b => ({ ...b.position })))
    world.start()
    run(world)
    expect(world.state, JSON.stringify(world.ball.position)).toBe('goal')
    expect(world.collected.filter(Boolean)).toHaveLength(picks[i])
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
      world.start()
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
  test('only entering the cup counts, and the ball rolls to rest in the cup', () => {
    const world = createWorld(STAGES[0])
    world.start()
    Matter.Body.setPosition(world.ball, { x: STAGES[0].goal.x, y: STAGES[0].goal.y - 20 })
    world.step()
    expect(world.state).toBe('running')
    Matter.Body.setPosition(world.ball, { x: STAGES[0].goal.x - 40, y: STAGES[0].goal.y + 25 })
    Matter.Body.setVelocity(world.ball, { x: 4, y: 0 })
    world.step()
    expect(world.state).toBe('scored')
    // The ball keeps rolling inside the cup instead of freezing where it crossed the rim.
    const entry = { ...world.ball.position }
    run(world)
    expect(world.state).toBe('goal')
    expect(world.ball.position.y).toBeGreaterThan(entry.y)
    expect(world.ball.position.y).toBeCloseTo(STAGES[0].goal.y + 80 - 6 - BALL_RADIUS, 0)
    expect(world.ball.speed).toBeLessThan(.3)
    const position = { ...world.ball.position }
    world.step()
    expect(world.ball.position).toEqual(position)
    world.retry(true)
    expect(world.state).toBe('ready')
    world.destroy()
  })
  test('the celebration still arrives when the ball never settles', () => {
    const world = createWorld(STAGES[0])
    world.start()
    Matter.Body.setPosition(world.ball, { x: STAGES[0].goal.x, y: STAGES[0].goal.y + 40 })
    world.step()
    expect(world.state).toBe('scored')
    for (let i = 0; i <= SETTLE_FRAMES; i++) {
      Matter.Body.setVelocity(world.ball, { x: 5, y: 0 })
      world.step()
    }
    expect(world.state).toBe('goal')
    world.destroy()
  })
  test('drawn roads wait for start, and extra roads can be added first', () => {
    const world = createWorld(STAGES[5])
    for (const line of solutions[5]) expect(world.addStroke(line)).toBe(true)
    for (let i = 0; i < 120; i++) world.step()
    expect(world.state).toBe('ready')
    expect(world.ball.position).toEqual(STAGES[5].ball)
    world.start()
    run(world)
    expect(world.state).toBe('goal')
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

describe('stars, wind and warps', () => {
  test('stage pieces stay on the board and away from the ball and the cup', () => {
    for (const stage of STAGES) {
      const spots = [...stage.stars ?? [], ...stage.warp ? [stage.warp.from, stage.warp.to] : []]
      for (const spot of spots) {
        expect(spot.x, stage.name).toBeGreaterThanOrEqual(0)
        expect(spot.x, stage.name).toBeLessThanOrEqual(WIDTH)
        expect(spot.y, stage.name).toBeLessThanOrEqual(HEIGHT)
        // Nothing may sit on the ball or inside the cup, where it would be picked up for free.
        expect(Math.hypot(spot.x - stage.ball.x, spot.y - stage.ball.y), stage.name).toBeGreaterThan(BALL_RADIUS + STAR_RADIUS)
        expect(spot.y < stage.goal.y + 10 || Math.abs(spot.x - stage.goal.x) > 60, stage.name).toBe(true)
      }
      // A warp that lands back on its own mouth would loop forever.
      if (stage.warp) expect(Math.hypot(stage.warp.to.x - stage.warp.from.x, stage.warp.to.y - stage.warp.from.y), stage.name).toBeGreaterThan(WARP_RADIUS * 2)
    }
  })
  test('rolling over a star picks it up once, and a retry puts every star back', () => {
    const stage = STAGES.findIndex(s => (s.stars ?? []).length > 0)
    const world = createWorld(STAGES[stage])
    expect(world.collected).toEqual([false])
    world.start()
    Matter.Body.setPosition(world.ball, STAGES[stage].stars![0])
    world.step()
    expect(world.collected).toEqual([true])
    world.retry()
    expect(world.collected).toEqual([false])
    world.destroy()
  })
  test('wind holds the ball up and pushes it sideways', () => {
    const stage = STAGES.find(s => (s.winds ?? []).length > 0)!
    const wind = stage.winds![0]
    const world = createWorld(stage)
    world.start()
    Matter.Body.setPosition(world.ball, { x: wind.x, y: wind.y })
    for (let i = 0; i < 30; i++) world.step()
    const blown = { ...world.ball.position }
    // The same drop outside the box falls faster and stays on its own column.
    const plain = createWorld({ ...stage, winds: [] })
    plain.start()
    Matter.Body.setPosition(plain.ball, { x: wind.x, y: wind.y })
    for (let i = 0; i < 30; i++) plain.step()
    expect(blown.y).toBeLessThan(plain.ball.position.y)
    expect(Math.sign(blown.x - plain.ball.position.x)).toBe(Math.sign(wind.push.x))
    world.destroy()
    plain.destroy()
  })
  test('the warp carries the ball to the exit and always drops it straight down', () => {
    const stage = STAGES.find(s => s.warp)!
    const world = createWorld(stage)
    world.start()
    Matter.Body.setPosition(world.ball, stage.warp!.from)
    Matter.Body.setVelocity(world.ball, { x: -5, y: 2 })
    world.step()
    expect(world.warps).toBe(1)
    expect(world.ball.position.x).toBeCloseTo(stage.warp!.to.x, 0)
    expect(world.ball.position.y).toBeGreaterThan(stage.warp!.to.y)
    expect(world.ball.velocity.x).toBeCloseTo(0, 1)
    // The mouth stays quiet for a moment so the exit cannot feed straight back into it.
    for (let i = 0; i < 5; i++) world.step()
    expect(world.warps).toBe(1)
    world.retry()
    expect(world.warps).toBe(0)
    world.destroy()
  })
})
