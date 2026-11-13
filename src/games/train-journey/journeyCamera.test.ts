import { describe, expect, test } from 'vitest'
import { advanceJourney, createJourneyCourse, createJourneyMotion, defaultRoutes, MAP_ORDER } from './journeyModel'
import { tracksideCameraPose } from './journeyCamera'

describe('landscape routes and trackside cameras', () => {
  for (const id of MAP_ORDER) {
    const course = createJourneyCourse(id)
    test(`${id}: every branch reconnects smoothly and returns to the station`, () => {
      for (const point of course.switches) for (const branch of point.branches) {
        const incoming = course.curves[point.trunk]
        const curve = course.curves[branch]
        const outgoing = course.curves[point.next]
        expect(incoming.getPointAt(1).distanceTo(curve.getPointAt(0))).toBeLessThan(0.001)
        expect(curve.getPointAt(1).distanceTo(outgoing.getPointAt(0))).toBeLessThan(0.001)
        expect(incoming.getTangentAt(1).dot(curve.getTangentAt(0))).toBeGreaterThan(0.999)
        expect(curve.getTangentAt(1).dot(outgoing.getTangentAt(0))).toBeGreaterThan(0.999)
        const routes = defaultRoutes(course)
        routes[course.switches.indexOf(point)] = branch
        const motion = createJourneyMotion(course)
        for (let i = 0; i < 12000 && motion.visits === 0; i++) advanceJourney(motion, course, 0.05, routes, 'bullet')
        expect(motion.visits).toBe(1)
      }
    })
    test(`${id}: tripods stay fixed within each shot and change along every route`, () => {
      for (const [edge, length] of Object.entries(course.lengths)) {
        const a = tracksideCameraPose(course, { edge, distance: 0 }, 0.6)
        const b = tracksideCameraPose(course, { edge, distance: 1 }, 0.6)
        expect(a.id).toBe(b.id)
        expect(a.position.equals(b.position)).toBe(true)
        const end = tracksideCameraPose(course, { edge, distance: length }, 0.6)
        expect(end.position.toArray().every(Number.isFinite)).toBe(true)
        if (length > 18) expect(end.id).not.toBe(a.id)
      }
    })
  }
})
