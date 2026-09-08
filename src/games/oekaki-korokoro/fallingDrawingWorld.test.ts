import { afterEach, describe, expect, test } from 'vitest'
import { appendDrawingPoint, BASKET, createDrawingWorld, MAX_OBJECTS, MAX_SEGMENTS } from './fallingDrawingWorld'
import type { Point } from './rollerStroke'

const worlds: ReturnType<typeof createDrawingWorld>[] = []
function setup() { const w = createDrawingWorld(); worlds.push(w); return w }
function step(w: ReturnType<typeof setup>, count = 180) { for (let i = 0; i < count; i++) w.step() }
afterEach(() => { worlds.forEach(w => w.destroy()); worlds.length = 0 })

describe('falling drawings', () => {
  test('released strokes fall, collide and form a stack rather than passing through each other', () => {
    const w = setup()
    const lower = w.addStroke([{ x: 360, y: 500 }, { x: 570, y: 500 }], 'red')!
    step(w)
    const upper = w.addStroke([{ x: 360, y: 200 }, { x: 570, y: 200 }], 'blue')!
    const startY = upper.body.position.y
    step(w)
    expect(upper.body.position.y).toBeGreaterThan(startY + 300)
    expect(lower.body.position.y).toBeCloseTo(680, 0)
    expect(upper.body.position.y).toBeLessThan(lower.body.position.y - 15)
    expect(upper.body.position.y).toBeGreaterThan(lower.body.position.y - 25)
  })

  test('taps and closed loops become solid bodies; heavy scribbles can knock a standing stick over', () => {
    const w = setup()
    expect(w.addStroke([{ x: 30, y: 30 }], 'red')!.body.circleRadius).toBe(10)
    const ring = w.addStroke(Array.from({ length: 65 }, (_, i) => ({ x: 460 + Math.cos(i / 64 * Math.PI * 2) * 45, y: 100 + Math.sin(i / 64 * Math.PI * 2) * 45 })), 'green')!
    expect(ring.body.parts.length).toBeGreaterThan(8)
    const stick = w.addStroke([{ x: 450, y: 650 }, { x: 450, y: 520 }], 'blue')!
    step(w, 240)
    expect(Math.abs(stick.body.angle)).toBeGreaterThan(.3)
    for (const item of w.items) expect(Number.isFinite(item.body.position.y)).toBe(true)
  })

  test('a ball inside the basket celebrates once and undo removes only the latest addition', () => {
    const w = setup()
    w.addBall({ x: (BASKET.left + BASKET.right) / 2, y: 180 })
    step(w, 100)
    expect(w.goals).toBe(1)
    expect(w.celebration).toBeGreaterThan(0)
    step(w, 180)
    expect(w.goals).toBe(1)
    w.undo()
    expect(w.items).toHaveLength(1)
    expect(w.canUndo).toBe(false)
    w.undo()
    expect(w.items).toHaveLength(1)
  })

  test('evicting an old support wakes the settled drawing above it', () => {
    const w = setup()
    const lower = w.addStroke([{ x: 360, y: 500 }, { x: 570, y: 500 }], 'red')!
    step(w)
    const upper = w.addStroke([{ x: 360, y: 200 }, { x: 570, y: 200 }], 'blue')!
    step(w)
    expect(upper.body.isSleeping).toBe(true)
    const before = upper.body.position.y
    for (let i = 0; i < MAX_OBJECTS - 1; i++) w.addBall({ x: 30, y: 100 })
    expect(w.items).not.toContain(lower)
    expect(w.items).toContain(upper)
    step(w)
    expect(upper.body.position.y).toBeGreaterThan(before + 15)
  })

  test('draining wakes a settled pile, drops it through the floor and returns to a playable world', () => {
    const w = setup()
    const item = w.addStroke([{ x: 360, y: 200 }, { x: 570, y: 200 }], 'red')!
    step(w)
    w.drain()
    expect(w.draining).toBe(true)
    expect(w.addBall({ x: 30, y: 30 })).toBeUndefined()
    expect(w.addStroke([{ x: 30, y: 30 }], 'red')).toBeUndefined()
    step(w, 45)
    expect(item.body.position.y).toBeGreaterThan(720)
    step(w, 50)
    expect(w.draining).toBe(false)
    expect(w.items).toHaveLength(1)
    expect(w.goals).toBe(0)
    const fresh = w.addBall({ x: 500, y: 80 })!
    step(w)
    expect(fresh.body.position.y).toBeGreaterThan(640)
    expect(fresh.body.position.y).toBeLessThan(690)
  })

  test('long scribbles, repeated additions and invalid inputs have bounded work and remain finite', () => {
    const points: Point[] = []
    for (let i = 0; i < 10000; i++) appendDrawingPoint(points, { x: 100 + i % 700, y: 200 + Math.sin(i) * 100 })
    expect(points.length).toBeLessThanOrEqual(128)
    const w = setup()
    expect(w.addStroke([{ x: NaN, y: 0 }], 'red')).toBeUndefined()
    expect(w.addBall({ x: 0, y: Infinity })).toBeUndefined()
    for (let i = 0; i < MAX_OBJECTS + 5; i++) {
      const item = w.addStroke(points, 'red')!
      expect(item.body.parts.length).toBeLessThanOrEqual(MAX_SEGMENTS + 1)
    }
    expect(w.items).toHaveLength(MAX_OBJECTS)
    step(w, 10)
    for (const item of w.items) expect(Number.isFinite(item.body.position.y)).toBe(true)
  })
})
