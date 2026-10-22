import { describe, expect, test } from 'vitest'
import { COURSES, type Course, type Pad } from './courses'
import { FOODS } from './foods'
import { BEE_R, JUMP_SPEED, GRAVITY, RUNNER_H, RUNNER_W, SLIDE_H } from './race'

/** x の ところの じめんの たかさ（あなは null）。 */
function groundAt(course: Course, x: number): number | null {
  const span = course.spans.find(s => s.x0 <= x && s.x1 > x)
  return span ? span.top : null
}

/** いたは 1つの じめんの うえに ぜんぶ のっている。 */
function onOneSpan(course: Course, pad: Pad): boolean {
  return course.spans.some(s => s.x0 <= pad.x0 && s.x1 >= pad.x1 && s.top === pad.top)
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

  test.each(COURSES.map(c => [c.id, c] as const))('%s: tunnels, springs, boost pads and forks', (_, c) => {
    expect(c.blocks.length).toBeGreaterThanOrEqual(3)
    expect(c.boosts.length).toBeGreaterThanOrEqual(2)
    expect(c.springs.filter(s => s.fork).length).toBeGreaterThanOrEqual(1)
    expect(c.signs).toHaveLength(c.springs.filter(s => s.fork).length)
    for (const b of c.blocks) {
      // トンネルの したは あなの ない たいらな じめんで、スライディングなら くぐれて たったままだと ぶつかる。
      const floor = c.spans.find(s => s.x0 <= b.x0 - RUNNER_W && s.x1 >= b.x1 + RUNNER_W)
      expect(floor, `tunnel at ${b.x0}`).toBeDefined()
      expect(b.y0 - floor!.top).toBeGreaterThan(SLIDE_H)
      expect(b.y0 - floor!.top).toBeLessThan(RUNNER_H)
      expect(b.y1).toBeGreaterThan(b.y0)
      expect(c.springs.some(s => s.x0 < b.x1 && s.x1 > b.x0)).toBe(false)
    }
    for (const pad of [...c.springs, ...c.boosts]) {
      expect(onOneSpan(c, pad), `pad at ${pad.x0}`).toBe(true)
      expect(c.blocks.some(b => b.x0 < pad.x1 && b.x1 > pad.x0)).toBe(false)
    }
    // ジャンプだいは どうぶつ 2ひきぶん より ひろくて ふみやすい。
    for (const spring of c.springs) expect(spring.x1 - spring.x0).toBeGreaterThan(RUNNER_W * 2)
    for (const fork of c.springs.filter(s => s.fork)) {
      // わかれみち: ジャンプだいの すぐ あとに トンネル、うえには ふつうの ジャンプでは とどかない くもの みち。
      const gate = c.blocks.find(b => b.x0 >= fork.x1 && b.x0 - fork.x1 < 40)
      expect(gate, `fork at ${fork.x0}`).toBeDefined()
      const road = c.clouds.find(cl => cl.x0 > fork.x0 && cl.x0 < gate!.x1)
      expect(road, `fork at ${fork.x0}`).toBeDefined()
      expect(road!.top - fork.top).toBeGreaterThan(JUMP_SPEED ** 2 / (2 * GRAVITY))
      expect(road!.x1 - road!.x0).toBeGreaterThan(500)
      expect(c.foods.some(f => f.x > road!.x0 && f.x < road!.x1 && f.y > road!.top)).toBe(true)
    }
  })
})
