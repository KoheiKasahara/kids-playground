import { afterAll, describe, expect, test } from 'vitest'
import { COLORS, COURSES, getStats, PARTS } from './data'
import { createRace, getRank, stepRace } from './race'
import type { Build } from './types'

describe('every parts combination finishes every course with bounded stats and a valid result', () => {
  const timings: number[] = []

  // Keep the full Cartesian product, but give each body its own bounded case
  // so coverage and other simulations do not share one wall-clock deadline.
  test.each(PARTS.body)('$id: every motor, tire and roller combination finishes every course', (body) => {
    for (const motor of PARTS.motor) {
      for (const tires of PARTS.tires) for (const rollers of PARTS.rollers) {
        const build: Build = { body: body.id, motor: motor.id, tires: tires.id, rollers: rollers.id, color: COLORS[0].id }
        for (const value of Object.values(getStats(build))) {
          expect(value).toBeGreaterThanOrEqual(1)
          expect(value).toBeLessThanOrEqual(5)
        }
        for (const course of COURSES) {
          const race = createRace(course, build)
          for (let frame = 0; frame < 500 && race.phase !== 'finished'; frame++) stepRace(race, .1)
          const label = `${course.id}: ${JSON.stringify(build)}`
          expect(race.phase, label).toBe('finished')
          expect(getRank(race), label).toBeGreaterThanOrEqual(1)
          expect(getRank(race), label).toBeLessThanOrEqual(3)
          expect(race.racers[0].finishTime, label).toBeGreaterThan(25)
          expect(race.racers[0].finishTime, label).toBeLessThan(40)
          timings.push(race.elapsed)
        }
      }
    }
  })

  // Preserve the original spread check over all bodies and courses.
  afterAll(() => {
    expect(Math.max(...timings) - Math.min(...timings)).toBeGreaterThan(3)
  })
})
