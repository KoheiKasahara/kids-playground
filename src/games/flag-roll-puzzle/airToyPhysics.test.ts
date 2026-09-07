import { Bodies, Body, Composite, Engine } from 'matter-js'
import { describe, expect, it } from 'vitest'
import { createAirToyRuntime } from './airToyPhysics'
import { BALL_RADIUS, CELL_SIZE } from './boardLayout'
import { cellCenter } from './grid'
import { createPuzzlePartBodies } from './usePuzzleEngine'
import type { PlacedPart } from './placement'
import { GRAVITY, STEP_MS } from './puzzlePhysics'
import { createPuzzleState, tryPlacePart } from './puzzleState'

const part = (typeId: PlacedPart['typeId'], col = 3, row = 4, id = typeId): PlacedPart => ({ id, typeId, cell: { col, row } })
const ballAt = (p: PlacedPart) => { const c = cellCenter(p.cell); return Bodies.circle(c.x, c.y, BALL_RADIUS) }

describe('air toys', () => {
  it.each(['fanRight', 'fanDown', 'fanLeft', 'fanUp', 'bubbleLift', 'warpIn', 'warpOut'] as const)('%s has no invisible solid board', id => {
    expect(createPuzzlePartBodies(part(id))).toEqual([])
  })
  it.each([['fanRight', 1, 0], ['fanDown', 0, 1], ['fanLeft', -1, 0], ['fanUp', 0, -1]] as const)('fan direction %s and bounded acceleration', (id, x, y) => {
    const p = part(id); const ball = ballAt(p); const runtime = createAirToyRuntime([p])
    for (let i = 0; i < 200; i++) runtime.step('a', ball, i * STEP_MS, [])
    expect(ball.velocity.x).toBeCloseTo(x * 6)
    expect(ball.velocity.y).toBeCloseTo(y * 6)
    Body.setPosition(ball, { x: ball.position.x + CELL_SIZE, y: ball.position.y })
    Body.setVelocity(ball, { x: 0, y: 0 })
    runtime.step('a', ball, 4000, [])
    expect(ball.speed).toBe(0)
  })
  it('upward wind reverses a falling ball with real gravity', () => {
    const p = part('fanUp'); const ball = ballAt(p); const engine = Engine.create({ gravity: { ...GRAVITY } })
    Body.setPosition(ball, { x: ball.position.x, y: ball.position.y - 25 })
    Body.setVelocity(ball, { x: 0, y: 5 })
    Composite.add(engine.world, ball)
    const runtime = createAirToyRuntime([p]); let rose = false
    for (let i = 0; i < 90; i++) {
      Engine.update(engine, STEP_MS); runtime.step('a', ball, i * STEP_MS, [])
      if (ball.velocity.y < -1) rose = true
    }
    expect(rose).toBe(true)
  })
  it('bubble lifts two cells then releases sideways; balls and new runs are independent', () => {
    const p = part('bubbleLift'); const ball = ballAt(p); const startY = ball.position.y
    const engine = Engine.create({ gravity: { ...GRAVITY } }); Composite.add(engine.world, ball)
    const runtime = createAirToyRuntime([p]); expect(runtime.step('a', ball, 0, []).carried).toBe(true)
    let released = false
    for (let i = 1; i < 110; i++) {
      Engine.update(engine, STEP_MS)
      if (!runtime.step('a', ball, i * STEP_MS, []).carried) { released = true; break }
    }
    expect(released).toBe(true)
    expect(startY - ball.position.y).toBeGreaterThanOrEqual(CELL_SIZE * 2)
    expect(ball.velocity.x).toBe(3)
    Body.setPosition(ball, cellCenter(p.cell))
    expect(runtime.step('a', ball, 1000, []).carried).toBe(false)
    expect(runtime.step('b', ballAt(p), 1000, []).carried).toBe(true)
    expect(createAirToyRuntime([p]).step('a', ball, 0, []).carried).toBe(true)
  })
  it('bubble pops at a solid ceiling and has a timeout', () => {
    const p = part('bubbleLift'); const ball = ballAt(p); const runtime = createAirToyRuntime([p])
    runtime.step('a', ball, 0, [])
    const ceiling = Bodies.rectangle(ball.position.x, ball.position.y - BALL_RADIUS, 60, 10, { isStatic: true })
    expect(runtime.step('a', ball, STEP_MS, [ceiling]).carried).toBe(false)
    const other = ballAt(p); runtime.step('b', other, 0, [])
    expect(runtime.step('b', other, 1800, []).carried).toBe(false)
  })
  it('warp transports each ball to the exit, resets speed, and prevents immediate loops', () => {
    const entrance = part('warpIn'); const exit = part('warpOut', 1, 7)
    const runtime = createAirToyRuntime([entrance, exit])
    for (const id of ['a', 'b']) {
      const ball = ballAt(entrance); Body.setVelocity(ball, { x: 15, y: -10 })
      runtime.step(id, ball, 0, [])
      expect(ball.position).toEqual(cellCenter(exit.cell)); expect(ball.velocity).toEqual({ x: 0, y: 3 })
      Body.setPosition(ball, cellCenter(entrance.cell)); runtime.step(id, ball, 100, [])
      expect(ball.position).toEqual(cellCenter(entrance.cell))
      runtime.step(id, ball, 700, []); expect(ball.position).toEqual(cellCenter(exit.cell))
    }
  })
  it('unpaired warp is pass-through and placement allows only one exit', () => {
    const entrance = part('warpIn'); const ball = ballAt(entrance)
    createAirToyRuntime([entrance]).step('a', ball, 0, [])
    expect(ball.position).toEqual(cellCenter(entrance.cell))
    const state = tryPlacePart(createPuzzleState(), 'warpOut', { col: 1, row: 2 })
    expect(state?.parts).toHaveLength(1)
    expect(tryPlacePart(state!, 'warpOut', { col: 3, row: 2 })).toBeNull()
  })
})
