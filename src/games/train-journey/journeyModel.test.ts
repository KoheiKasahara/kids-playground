import { describe, expect, test } from 'vitest'
import { Vector3 } from 'three'
import { advanceJourney, boostJourney, BOOST_SECONDS, CAR_SPACING, createJourneyCourse, createJourneyMotion, defaultRoutes, MAP_ORDER, nextRoute, railOrientation, ROUTE_ORDER, ROUTES, sampleJourney, TRACK_Y, upcomingSwitch, type JourneyRoute } from './journeyModel'

const course = createJourneyCourse()
const downtown = createJourneyCourse('downtown')
/** Horizontal gap between two edges, ignoring the ends where they fan together. */
function separation(a: string, b: string, map = downtown, skip = 9) {
  const points = map.curves[a].getSpacedPoints(500)
  const others = map.curves[b].getSpacedPoints(500)
  let closest = Infinity
  points.forEach((p, i) => {
    const distance = i / 500 * map.lengths[a]
    if (distance < skip || distance > map.lengths[a] - skip) return
    for (const q of others) if (Math.abs(p.y - q.y) < 2.6) closest = Math.min(closest, Math.hypot(p.x - q.x, p.z - q.z))
  })
  return closest
}

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
  test.each([...MAP_ORDER])('every %s branch leaves its point and rejoins the next trunk with matching position and direction', id => {
    const map = createJourneyCourse(id)
    for (const point of map.switches) {
      const trunk = map.curves[point.trunk]
      const next = map.curves[point.next]
      for (const branch of point.branches) {
        const curve = map.curves[branch]
        expect(ROUTES[branch]).toBeDefined()
        expect(curve.getPointAt(0).distanceTo(trunk.getPointAt(1))).toBeLessThan(0.00001)
        expect(curve.getPointAt(1).distanceTo(next.getPointAt(0))).toBeLessThan(0.00001)
        expect(curve.getTangentAt(0).dot(trunk.getTangentAt(1))).toBeGreaterThan(0.999)
        expect(curve.getTangentAt(1).dot(next.getTangentAt(0))).toBeGreaterThan(0.999)
      }
    }
  })
  test('downtown has two points, one with three ways and one with two', () => {
    expect(downtown.switches.map(point => point.branches.length)).toEqual([3, 2])
    // Every trunk is longer than a whole train, so a point is never set under one.
    for (const point of downtown.switches) expect(downtown.lengths[point.trunk]).toBeGreaterThan(CAR_SPACING * 3)
  })
  test('downtown branches keep their own ground, and only the viaduct leaves it', () => {
    const edges = Object.keys(downtown.curves)
    for (const a of edges) for (const b of edges) if (a < b) expect(separation(a, b), `${a} / ${b}`).toBeGreaterThan(2.4)
    for (const edge of edges) {
      const points = downtown.curves[edge].getSpacedPoints(600)
      expect(Math.min(...points.map(p => p.y))).toBeGreaterThanOrEqual(TRACK_Y - 0.0001)
      const slope = Math.max(...Array.from({ length: 600 }, (_, i) => Math.abs(downtown.curves[edge].getTangentAt(i / 600).y)))
      expect(slope, edge).toBeLessThan(edge === 'skyway' ? 0.55 : 0.0001)
    }
    expect(Math.max(...downtown.curves.skyway.getSpacedPoints(600).map(p => p.y))).toBeGreaterThan(4)
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
  test('the town branch stays level and keeps its own ground until the junction', () => {
    const points = course.curves.city.getSpacedPoints(700)
    expect(Math.min(...points.map(p => p.y))).toBeCloseTo(TRACK_Y, 6)
    expect(Math.max(...points.map(p => p.y))).toBeCloseTo(TRACK_Y, 6)
    const others = [course.curves.common, course.curves.bridge, course.curves.forest].flatMap(curve => curve.getSpacedPoints(900))
    let closest = Infinity
    points.forEach((p, i) => {
      // Inside nine metres of the turnout and the merge, branches fan together.
      const distance = i / 700 * course.lengths.city
      if (distance < 9 || distance > course.lengths.city - 9) return
      for (const q of others) if (Math.abs(p.y - q.y) < 2.6) closest = Math.min(closest, Math.hypot(p.x - q.x, p.z - q.z))
    })
    expect(closest).toBeGreaterThan(1.5)
  })
})

describe('train journey motion', () => {
  test('front bogies sample the next branch instead of stopping at the joint', () => {
    const motion = createJourneyMotion(course)
    motion.distance = course.lengths.common - 0.1
    const front = sampleJourney(motion, course, -0.52, ['forest'])
    expect(front.edge).toBe('forest')
    expect(front.position.distanceTo(course.curves.forest.getPointAt(0.42 / course.lengths.forest))).toBeLessThan(0.00001)
  })
  test.each<JourneyRoute>([...ROUTE_ORDER])('takes the selected %s branch and returns to the station', route => {
    const motion = createJourneyMotion(course)
    const visited = new Set<string>()
    for (let i = 0; i < 6000; i++) {
      advanceJourney(motion, course, 1 / 60, [route], 'bullet')
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
    advanceJourney(motion, course, 0.02, ['bridge'], 'bullet')
    expect(motion.edge).toBe('bridge')
    expect(sampleJourney(motion, course, CAR_SPACING).edge).toBe('common')
    for (let i = 0; i < 90; i++) advanceJourney(motion, course, 1 / 60, ['forest'], 'bullet')
    expect(motion.edge).toBe('bridge')
    expect(sampleJourney(motion, course, CAR_SPACING * 2).edge).toBe('bridge')
  })
  test.each([...MAP_ORDER])('repeated point toggles on the %s map do not teleport the cab or carriages, including loop seams', id => {
    const course = createJourneyCourse(id)
    const motion = createJourneyMotion(course)
    let previous = [0, 1, 2].map(i => sampleJourney(motion, course, i * CAR_SPACING).position)
    let maximumStep = 0
    for (let i = 0; i < 18000; i++) {
      advanceJourney(motion, course, 1 / 60, course.switches.map((point, s) => point.branches[(i + s) % point.branches.length]), 'cargo')
      const next = [0, 1, 2].map(j => sampleJourney(motion, course, j * CAR_SPACING).position)
      next.forEach((p, j) => { maximumStep = Math.max(maximumStep, p.distanceTo(previous[j])) })
      previous = next
    }
    expect(maximumStep).toBeLessThan(0.11)
    expect(motion.visits).toBeGreaterThan(3)
    expect(motion.history.length).toBeLessThanOrEqual(6)
  })
  test('the point control cycles every branch and comes back round', () => {
    for (const { branches } of [...course.switches, ...downtown.switches]) {
      let route: JourneyRoute = branches[0]
      const visited = branches.map(() => (route = nextRoute(branches, route)))
      expect(new Set(visited)).toEqual(new Set(branches))
      expect(route).toBe(branches[0])
    }
  })
  test.each([
    ['skyway', 'tower'], ['subway', 'harbor'], ['river', 'tower'], ['skyway', 'harbor'],
  ])('downtown takes %s at the first point and %s at the second, then stops at the station', (first, second) => {
    const motion = createJourneyMotion(downtown)
    const order: string[] = []
    for (let i = 0; i < 12000 && motion.visits === 0; i++) {
      advanceJourney(motion, downtown, 1 / 60, [first, second], 'bullet')
      if (order[order.length - 1] !== motion.edge) order.push(motion.edge)
    }
    expect(order).toEqual(['south', first, 'north', second, 'south'])
    expect(motion.distance).toBeCloseTo(downtown.stationDistance, 5)
  })
  test('the next point follows the train round the downtown loop', () => {
    expect(defaultRoutes(downtown)).toEqual(['skyway', 'tower'])
    expect(['south', 'skyway', 'north', 'harbor'].map(edge => upcomingSwitch(downtown, edge))).toEqual([0, 1, 1, 0])
    expect(['common', 'city'].map(edge => upcomingSwitch(course, edge))).toEqual([0, 0])
  })
  test('boost departs the station, increases speed, expires, and cannot stack', () => {
    const motion = createJourneyMotion(course)
    boostJourney(motion)
    for (let i = 0; i < 120; i++) { boostJourney(motion); advanceJourney(motion, course, 1 / 60, ['bridge'], 'bullet') }
    expect(motion.dwell).toBe(0)
    expect(motion.speed).toBeGreaterThan(7)
    expect(motion.speed).toBeLessThanOrEqual(4.8 * 1.85)
    expect(motion.boostRemaining).toBeLessThanOrEqual(BOOST_SECONDS)
    for (let i = 0; i < 300; i++) advanceJourney(motion, course, 1 / 60, ['bridge'], 'bullet')
    expect(motion.boostRemaining).toBe(0)
    expect(motion.speed).toBeCloseTo(4.8, 1)
  })
  test('equivalent elapsed time at different frame rates gives equivalent motion', () => {
    const a = createJourneyMotion(course)
    const b = createJourneyMotion(course)
    a.dwell = b.dwell = 0
    for (let i = 0; i < 1200; i++) advanceJourney(a, course, 1 / 60, ['forest'], 'steam')
    for (let i = 0; i < 600; i++) advanceJourney(b, course, 1 / 30, ['forest'], 'steam')
    expect(sampleJourney(a, course).position.distanceTo(sampleJourney(b, course).position)).toBeLessThan(0.1)
  })
})
