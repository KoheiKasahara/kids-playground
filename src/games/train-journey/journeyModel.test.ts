import { describe, expect, test } from 'vitest'
import { Vector3 } from 'three'
import { advanceJourney, boostJourney, BOOST_SECONDS, CAR_SPACING, createJourneyCourse, createJourneyMotion, railOrientation, sampleJourney, TRACK_Y, type JourneyRoute } from './journeyModel'

const course = createJourneyCourse()

describe('continuous three-dimensional railway', () => {
  test('trains stay upright in every direction on a slope, including directly north', () => {
    for (let angle = 0; angle <= Math.PI * 2; angle += Math.PI / 40) {
      for (const slope of [-0.4, 0, 0.4]) {
        const tangent = new Vector3(Math.sin(angle), slope, Math.cos(angle)).normalize()
        const rotation = railOrientation(tangent)
        expect(new Vector3(0, 0, 1).applyQuaternion(rotation).distanceTo(tangent)).toBeLessThan(0.00001)
        expect(new Vector3(0, 1, 0).applyQuaternion(rotation).y).toBeGreaterThan(0.9)
      }
    }
  })
  test('both branches meet the common line with matching position and direction', () => {
    for (const branch of ['bridge', 'forest'] as const) {
      const curve = course.curves[branch]
      expect(curve.getPointAt(0).distanceTo(course.curves.common.getPointAt(1))).toBeLessThan(0.00001)
      expect(curve.getPointAt(1).distanceTo(course.curves.common.getPointAt(0))).toBeLessThan(0.00001)
      expect(curve.getTangentAt(0).dot(course.curves.common.getTangentAt(1))).toBeGreaterThan(0.999)
      expect(curve.getTangentAt(1).dot(course.curves.common.getTangentAt(0))).toBeGreaterThan(0.999)
    }
  })
  test('ramps stay above ground and the high route crosses above the lower railway', () => {
    const bridge = course.curves.bridge.getSpacedPoints(800)
    expect(Math.min(...bridge.map(p => p.y))).toBeGreaterThanOrEqual(TRACK_Y - 0.0001)
    expect(Math.max(...bridge.map(p => p.y))).toBeGreaterThan(5.5)
    expect(Math.max(...Array.from({ length: 800 }, (_, i) => Math.abs(course.curves.bridge.getTangentAt(i / 800).y)))).toBeLessThan(0.55)
    const lower = course.curves.forest.getSpacedPoints(400)
    const crossing = bridge.filter(p => p.y > 5 && lower.some(q => Math.hypot(p.x - q.x, p.z - q.z) < 0.6))
    expect(crossing.length).toBeGreaterThan(0)
    expect(Math.min(...crossing.map(p => p.y - TRACK_Y))).toBeGreaterThan(3)
  })
})

describe('train journey motion', () => {
  test('front bogies sample the next branch instead of stopping at the joint', () => {
    const motion = createJourneyMotion(course)
    motion.distance = course.lengths.common - 0.1
    const front = sampleJourney(motion, course, -0.52, 'forest')
    expect(front.edge).toBe('forest')
    expect(front.position.distanceTo(course.curves.forest.getPointAt(0.42 / course.lengths.forest))).toBeLessThan(0.00001)
  })
  test.each<JourneyRoute>(['bridge', 'forest'])('takes the selected %s branch and returns to the station', route => {
    const motion = createJourneyMotion(course)
    const visited = new Set<string>()
    for (let i = 0; i < 6000; i++) {
      advanceJourney(motion, course, 1 / 60, route, 'bullet')
      visited.add(motion.edge)
      if (motion.visits === 1) break
    }
    expect(visited).toEqual(new Set(['common', route]))
    expect(motion.visits).toBe(1)
    expect(motion.distance).toBeCloseTo(course.stationDistance, 5)
    expect(motion.dwell).toBeGreaterThan(2)
    expect(motion.speed).toBe(0)
  })
  test('changing the point behind the cab never diverts a trailing car', () => {
    const motion = createJourneyMotion(course)
    motion.distance = course.lengths.common - 0.04
    motion.dwell = 0
    motion.speed = 4.8
    advanceJourney(motion, course, 0.02, 'bridge', 'bullet')
    expect(motion.edge).toBe('bridge')
    expect(sampleJourney(motion, course, CAR_SPACING).edge).toBe('common')
    for (let i = 0; i < 90; i++) advanceJourney(motion, course, 1 / 60, 'forest', 'bullet')
    expect(motion.edge).toBe('bridge')
    expect(sampleJourney(motion, course, CAR_SPACING * 2).edge).toBe('bridge')
  })
  test('repeated point toggles do not teleport the cab or carriages, including loop seams', () => {
    const motion = createJourneyMotion(course)
    let previous = [0, 1, 2].map(i => sampleJourney(motion, course, i * CAR_SPACING).position)
    let maximumStep = 0
    for (let i = 0; i < 18000; i++) {
      advanceJourney(motion, course, 1 / 60, i % 7 < 4 ? 'bridge' : 'forest', 'cargo')
      const next = [0, 1, 2].map(j => sampleJourney(motion, course, j * CAR_SPACING).position)
      next.forEach((p, j) => { maximumStep = Math.max(maximumStep, p.distanceTo(previous[j])) })
      previous = next
    }
    expect(maximumStep).toBeLessThan(0.11)
    expect(motion.visits).toBeGreaterThan(3)
    expect(motion.history.length).toBeLessThanOrEqual(6)
  })
  test('boost departs the station, increases speed, expires, and cannot stack', () => {
    const motion = createJourneyMotion(course)
    boostJourney(motion)
    for (let i = 0; i < 120; i++) { boostJourney(motion); advanceJourney(motion, course, 1 / 60, 'bridge', 'bullet') }
    expect(motion.dwell).toBe(0)
    expect(motion.speed).toBeGreaterThan(7)
    expect(motion.speed).toBeLessThanOrEqual(4.8 * 1.85)
    expect(motion.boostRemaining).toBeLessThanOrEqual(BOOST_SECONDS)
    for (let i = 0; i < 300; i++) advanceJourney(motion, course, 1 / 60, 'bridge', 'bullet')
    expect(motion.boostRemaining).toBe(0)
    expect(motion.speed).toBeCloseTo(4.8, 1)
  })
  test('equivalent elapsed time at different frame rates gives equivalent motion', () => {
    const a = createJourneyMotion(course)
    const b = createJourneyMotion(course)
    a.dwell = b.dwell = 0
    for (let i = 0; i < 1200; i++) advanceJourney(a, course, 1 / 60, 'forest', 'steam')
    for (let i = 0; i < 600; i++) advanceJourney(b, course, 1 / 30, 'forest', 'steam')
    expect(sampleJourney(a, course).position.distanceTo(sampleJourney(b, course).position)).toBeLessThan(0.1)
  })
})
