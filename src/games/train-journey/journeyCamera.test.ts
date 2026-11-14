import { Vector3 } from 'three'
import { describe, expect, test } from 'vitest'
import { advanceJourney, createJourneyCourse, createJourneyMotion, defaultRoutes, MAP_ORDER, sampleJourney } from './journeyModel'
import { createTracksideSearch, nextTracksideShot, SHOT_LEAD, SHOT_TRAIL, tracksideShotExpired } from './journeyCamera'

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
    test(`${id}: each trackside shot holds while the train approaches, passes and leaves`, () => {
      for (const branch of course.switches[0].branches) {
        const routes = defaultRoutes(course)
        routes[0] = branch
        const motion = createJourneyMotion(course)
        let shot = nextTracksideShot(course, motion, routes, 0.6)
        const holds: number[] = []
        let held = 0
        let closest = Infinity
        for (let i = 0; i < 12000 && motion.visits === 0; i++) {
          advanceJourney(motion, course, 0.05, routes, 'bullet')
          held += 0.05
          const lead = sampleJourney(motion, course).position
          closest = Math.min(closest, Math.hypot(lead.x - shot.anchor.x, lead.z - shot.anchor.z))
          if (!tracksideShotExpired(shot, course, motion, routes)) continue
          // The train really ran past the rail point the tripod faces.
          expect(closest).toBeLessThan(1.5)
          expect(motion.totalDistance - shot.anchorTotal).toBeGreaterThanOrEqual(SHOT_TRAIL - 0.5)
          holds.push(held)
          shot = nextTracksideShot(course, motion, routes, 0.6)
          expect(shot.position.toArray().every(Number.isFinite)).toBe(true)
          expect(shot.position.y).toBeGreaterThan(shot.anchor.y + 4)
          held = 0
          closest = Infinity
        }
        expect(motion.visits).toBe(1)
        expect(holds.length).toBeGreaterThan(2)
        // Edge boundaries no longer cut: every full shot lasts several seconds.
        expect(Math.min(...holds)).toBeGreaterThan(4)
      }
    })
    test(`${id}: a switched route cuts away from a tripod on the abandoned branch`, () => {
      const point = course.switches[0]
      const routes = defaultRoutes(course)
      const motion = createJourneyMotion(course)
      for (let i = 0; i < 12000; i++) {
        advanceJourney(motion, course, 0.05, routes, 'bullet')
        const shot = nextTracksideShot(course, motion, routes, 0.6)
        const rail = sampleJourney(motion, course, -SHOT_LEAD, routes)
        if (motion.edge !== point.trunk || rail.edge !== routes[0] || rail.distance < 8) continue
        const other = { ...routes, 0: point.branches.find(branch => branch !== routes[0])! }
        expect(tracksideShotExpired(shot, course, motion, routes)).toBe(false)
        expect(tracksideShotExpired(shot, course, motion, other)).toBe(true)
        return
      }
      throw new Error('train never approached the first switch')
    })
    test(`${id}: a tripod hidden by scenery moves to a clear spot`, () => {
      const motion = createJourneyMotion(course)
      const routes = defaultRoutes(course)
      const usual = nextTracksideShot(course, motion, routes, 0.6, [], () => false)
      // A wall on the usual side hides the rails; only the far side sees them.
      const ahead = usual.anchorTotal - motion.totalDistance
      const rail = sampleJourney(motion, course, -ahead, routes)
      const side = new Vector3(rail.tangent.z, 0, -rail.tangent.x).normalize()
      const onUsualSide = (point: Vector3) => point.clone().sub(rail.position).dot(side) > 2
      const moved = nextTracksideShot(course, motion, routes, 0.6, [], from => onUsualSide(from))
      expect(onUsualSide(usual.position)).toBe(true)
      expect(onUsualSide(moved.position)).toBe(false)
      expect(moved.anchor.equals(usual.anchor)).toBe(true)
    })
    test(`${id}: the search stops on time with the clearest tripod so far`, () => {
      const motion = createJourneyMotion(course)
      const routes = defaultRoutes(course)
      let rays = 0
      const shot = nextTracksideShot(course, motion, routes, 0.6, [], () => { rays++; return true }, () => rays >= 3)
      expect(rays).toBe(3)
      expect(shot.position.toArray().every(Number.isFinite)).toBe(true)
    })
    test(`${id}: a tripod planned while the train passes is ready at the cut`, () => {
      const motion = createJourneyMotion(course)
      const routes = defaultRoutes(course)
      const shot = nextTracksideShot(course, motion, routes, 0.6)
      while (motion.totalDistance <= shot.anchorTotal) advanceJourney(motion, course, 0.05, routes, 'bullet')
      const lead = shot.anchorTotal + SHOT_TRAIL + SHOT_LEAD - motion.totalDistance
      let rays = 0
      const search = createTracksideSearch(course, motion, routes, 0.6, [], () => ++rays % 2 === 1, lead)
      let steps = 0
      while (!tracksideShotExpired(shot, course, motion, routes)) {
        if (!search.step()) steps++
        advanceJourney(motion, course, 0.05, routes, 'bullet')
      }
      expect(steps).toBeGreaterThan(1)
      const planned = search.result()
      expect(planned.anchorTotal - motion.totalDistance).toBeGreaterThan(SHOT_LEAD - 6 - 1)
      expect(tracksideShotExpired(planned, course, motion, routes)).toBe(false)
      expect(sampleJourney(motion, course, motion.totalDistance - planned.anchorTotal, routes).position.distanceTo(planned.anchor)).toBeLessThan(0.01)
    })
    test(`${id}: tripods skip tunnels`, () => {
      const motion = createJourneyMotion(course)
      const routes = defaultRoutes(course)
      for (let i = 0; i < 2000; i++) {
        advanceJourney(motion, course, 0.05, routes, 'bullet')
        const avoid = [{ edge: motion.edge, start: motion.distance, end: motion.distance + 60 }]
        const shot = nextTracksideShot(course, motion, routes, 0.6, avoid)
        const ahead = shot.anchorTotal - motion.totalDistance
        const rail = sampleJourney(motion, course, -ahead, routes)
        if (rail.edge === motion.edge) expect(rail.distance < avoid[0].start - 6 || rail.distance > avoid[0].end + 6).toBe(true)
      }
    })
  }
})
