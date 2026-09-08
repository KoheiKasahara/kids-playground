import { describe, expect, it } from 'vitest'
import { area, beginGrab, center, createSlime, FLOOR, lift, outline, poke, squish, stepSlime, WIDTH, type Feel, type Slime } from './slimeSimulation'
const run = (s: Slime, count: number, feel: Feel = 'soft') => { for (let i = 0; i < count; i++) stepSlime(s, [], feel) }
const extent = (s: Slime, axis: 'x' | 'y') => Math.max(...s.points.map((p) => p[axis])) - Math.min(...s.points.map((p) => p[axis]))
function expectStable(s: Slime) {
  for (const p of s.points) {
    expect(Number.isFinite(p.x + p.y + p.px + p.py)).toBe(true)
    expect(p.x).toBeGreaterThanOrEqual(12)
    expect(p.x).toBeLessThanOrEqual(WIDTH - 12)
    expect(p.y).toBeGreaterThanOrEqual(12)
    expect(p.y).toBeLessThanOrEqual(FLOOR)
  }
  expect(area(s)).toBeGreaterThan(area(createSlime()) * 0.65)
  expect(area(s)).toBeLessThan(area(createSlime()) * 1.3)
}
describe('slime soft body', () => {
  it.each<Feel>(['soft', 'bouncy'])('lands without collapsing and settles (%s)', (feel) => {
    const s = createSlime()
    run(s, 900, feel)
    expectStable(s)
    expect(Math.max(...s.points.map((p) => p.y))).toBeCloseTo(FLOOR, 0)
    const before = center(s)
    run(s, 60, feel)
    expect(Math.hypot(center(s).x - before.x, center(s).y - before.y)).toBeLessThan(2)
  })
  it('only grabs the body or its forgiving rim, and allows two distinct fingers', () => {
    const s = createSlime()
    expect(beginGrab(s, { x: 20, y: 20 })).toBeNull()
    const first = beginGrab(s, { x: 440, y: 265 })!
    expect(first).not.toBeNull()
    const second = beginGrab(s, { x: 160, y: 265 }, [first])!
    expect(second.index).not.toBe(first.index)
  })
  it('stretches toward a held finger and recovers after release', () => {
    const s = createSlime()
    run(s, 180)
    const p = s.points[36]
    const grab = beginGrab(s, { x: p.x, y: p.y })!
    grab.target.y = 40
    for (let i = 0; i < 100; i++) stepSlime(s, [grab])
    expect(s.points[grab.index].y).toBeLessThan(100)
    const heldHeight = extent(s, 'y')
    run(s, 400)
    expectStable(s)
    expect(extent(s, 'y')).toBeLessThan(heldHeight)
    expect(center(s).y).toBeGreaterThan(300)
  })
  it.each<Feel>(['soft', 'bouncy'])('survives repeated opposing drags, squishes and drops (%s)', (feel) => {
    const s = createSlime()
    for (let round = 0; round < 20; round++) {
      const left = beginGrab(s, { ...s.points[24] })!
      const right = beginGrab(s, { ...s.points[0] }, [left])!
      left.target = { x: -1000, y: round % 2 ? -1000 : 1000 }
      right.target = { x: 2000, y: round % 2 ? 1000 : -1000 }
      for (let i = 0; i < 30; i++) stepSlime(s, [left, right], feel)
      squish(s); lift(s); run(s, 90, feel)
    }
    run(s, 300, feel)
    expectStable(s)
    expect(outline(s)).not.toMatch(/NaN|Infinity/)
  })
  it('a quick tap leaves a ripple without requiring a drag', () => {
    const s = createSlime()
    run(s, 180)
    const untouched = structuredClone(s)
    poke(s, 36)
    run(s, 8); run(untouched, 8)
    expect(Math.abs(s.points[36].y - untouched.points[36].y)).toBeGreaterThan(1)
    run(s, 300)
    expectStable(s)
  })
  it('squish flattens and widens; lift moves up then falls back', () => {
    const s = createSlime()
    run(s, 180)
    const w = extent(s, 'x'), h = extent(s, 'y')
    squish(s)
    expect(extent(s, 'x')).toBeGreaterThan(w)
    expect(extent(s, 'y')).toBeLessThan(h)
    run(s, 180)
    const y = center(s).y
    lift(s)
    expect(center(s).y).toBeLessThan(y - 70)
    run(s, 300)
    expect(center(s).y).toBeGreaterThan(y - 5)
    expectStable(s)
  })
})
