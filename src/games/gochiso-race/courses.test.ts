import { describe, expect, test } from 'vitest'
import { COURSES, type Course } from './courses'
import { FOODS } from './foods'
import { BEE_R, RUNNER_H } from './race'

/** x の ところの じめんの たかさ（あなは null）。 */
function groundAt(course: Course, x: number): number | null {
  const span = course.spans.find(s => s.x0 <= x && s.x1 > x)
  return span ? span.top : null
}

describe('gochiso-race courses', () => {
  test('three courses get harder in order', () => {
    expect(COURSES.map(c => c.id)).toEqual(['meadow', 'sweets', 'starry'])
    expect(new Set(COURSES.map(c => c.name)).size).toBe(COURSES.length)
    const speeds = COURSES.map(c => c.rival.speed)
    expect([...speeds].sort()).toEqual(speeds)
    for (const c of COURSES) {
      expect(c.rival.speed).toBeLessThan(1)
      expect(c.goal - c.start).toBeGreaterThan(5000)
    }
  })

  test.each(COURSES.map(c => [c.id, c] as const))('%s: the ground is in order and every gap and step can be jumped', (_, c) => {
    expect(c.spans[0].x0).toBeLessThan(c.start)
    c.spans.forEach((span, i) => {
      expect(span.x1).toBeGreaterThan(span.x0)
      const next = c.spans[i + 1]
      if (!next) return
      expect(next.x0).toBeGreaterThanOrEqual(span.x1)
      // あなは 1かいの ジャンプで とびこせる はば。
      expect(next.x0 - span.x1).toBeLessThanOrEqual(130)
      // のぼる だんは ジャンプで とどく たかさ。
      expect(next.top - span.top).toBeLessThanOrEqual(100)
    })
    expect(groundAt(c, c.start)).toBe(0)
    expect(groundAt(c, c.goal)).not.toBeNull()
    expect(c.end).toBeGreaterThan(c.goal + 300)
  })

  test.each(COURSES.map(c => [c.id, c] as const))('%s: food, pounders, bees and clouds sit in sensible places', (_, c) => {
    expect(c.foods.map(f => f.id)).toEqual(c.foods.map((_, i) => i))
    expect([...c.foods].sort((a, b) => a.x - b.x).map(f => f.id)).toEqual(c.foods.map(f => f.id))
    expect(c.foodTotal).toBe(c.foods.reduce((sum, f) => sum + FOODS[f.kind].points, 0))
    for (const f of c.foods) {
      expect(f.x).toBeGreaterThan(c.start)
      expect(f.x).toBeLessThan(c.goal)
      expect(f.y).toBeGreaterThan(0)
      expect(f.y).toBeLessThan(320)
    }
    for (const p of c.pounders) expect(groundAt(c, p.x + p.w / 2)).toBe(p.base)
    for (const bee of c.bees) {
      // はちは じめんに もぐらない。
      expect(bee.y - bee.amp - BEE_R).toBeGreaterThanOrEqual(groundAt(c, bee.x) ?? 0)
    }
    for (const cloud of c.clouds) {
      // くもの したを くぐって はしれる。
      const below = groundAt(c, (cloud.x0 + cloud.x1) / 2)
      if (below !== null) expect(cloud.top - below).toBeGreaterThanOrEqual(RUNNER_H + 20)
    }
    expect(c.foods.some(f => FOODS[f.kind].points >= 5)).toBe(true)
  })
})
