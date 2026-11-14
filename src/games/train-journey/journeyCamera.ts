import { Vector3 } from 'three'
import { sampleJourney, type JourneyCourse, type JourneyEdge, type JourneyMotion, type JourneyRoutes } from './journeyModel'

/** A trackside shot waits for the train at a spot ahead on its route. */
export type TracksideShot = {
  id: string
  position: Vector3
  /** Rail point the tripod faces, and the train's total distance there. */
  anchor: Vector3
  anchorTotal: number
}

type Gap = { edge: JourneyEdge, start: number, end: number }

/** Track the train covers before it reaches the tripod. */
export const SHOT_LEAD = 21
/** Track the lead runs past the tripod before the next cut: the whole train
 * passes by and is seen leaving, so each shot lasts several seconds. */
export const SHOT_TRAIL = 10
const SHOT_REACH = 48

/** True when scenery hides `to` from `from`. */
export type SightBlocked = (from: Vector3, to: Vector3) => boolean

// Tried in order: the usual side first, then the far side, then closer and
// higher tripods. The first with a clear view of the passing train wins.
const TRIPODS = [[1, 1, 0.55], [-1, 1, 0.55], [1, 0.7, 0.9], [-1, 0.7, 0.9], [1, 0.55, 1.5], [-1, 0.55, 1.5], [1, 0.4, 2.6]] as const
// In dense scenery the tripod may also wait a little nearer or farther.
const LEADS = [0, 6, -6, 12] as const

/** A tripod search that can run a few candidates per frame. Rail points are
 * fixed when it starts, so later steps do not depend on the moving train.
 * `lead` is how far ahead of the train the tripod waits. */
export function createTracksideSearch(course: JourneyCourse, motion: JourneyMotion, routes: JourneyRoutes, aspect: number, avoid: readonly Gap[] = [], blocked?: SightBlocked, lead = SHOT_LEAD) {
  const inGap = (rail: ReturnType<typeof sampleJourney>) => avoid.some(gap => gap.edge === rail.edge && rail.distance > gap.start - 6 && rail.distance < gap.end + 6)
  // Tunnels are skipped so the tripod never waits beside a portal or inside a hill.
  for (let step = 0; step < 12 && inGap(sampleJourney(motion, course, -lead, routes)); step++) lead += 4
  const reach = 12 * Math.max(1, 0.85 / Math.max(0.1, aspect))
  const total = motion.totalDistance
  const candidates: { position: Vector3, lead: number, watched: Vector3[] }[] = []
  for (const shift of blocked ? LEADS : [0]) {
    const here = lead + shift
    const rail = sampleJourney(motion, course, -here, routes)
    if (shift !== 0 && inGap(rail)) continue
    const flat = new Vector3(rail.tangent.x, 0, rail.tangent.z)
    if (flat.lengthSq() < 1e-6) flat.set(1, 0, 0)
    flat.normalize()
    const side = new Vector3(flat.z, 0, -flat.x)
    // Where the train will be while it approaches, passes and leaves.
    const watched = blocked ? [here - 12, here - 4, here + 6].map(ahead => { const point = sampleJourney(motion, course, -ahead, routes).position; point.y += 0.8; return point }) : []
    for (const [toward, scale, rise] of TRIPODS) {
      // Diagonal ahead of the anchor: the approaching train is seen nose-first,
      // then side-on as it passes, then going away. Raised enough to see over
      // station roofs and lineside trees.
      const position = rail.position.clone().addScaledVector(side, reach * scale * toward).addScaledVector(flat, reach * scale * 0.35)
      position.y += reach * scale * rise
      candidates.push({ position, lead: here, watched })
    }
  }
  let next = 0
  let best = { index: 0, hidden: Infinity }
  const done = () => best.hidden === 0 || next >= candidates.length
  return {
    /** Test one candidate; true once the search is finished. */
    step() {
      if (done()) return true
      const candidate = candidates[next]
      const hidden = blocked ? candidate.watched.filter(point => blocked(candidate.position, point)).length : 0
      if (hidden < best.hidden) best = { index: next, hidden }
      next++
      return done()
    },
    /** The clearest tripod tested so far (the usual one if none was tested). */
    result(): TracksideShot {
      const chosen = candidates[best.index]
      const anchor = sampleJourney(motion, course, motion.totalDistance - total - chosen.lead, routes)
      return { id: `${anchor.edge}-${Math.round(anchor.distance)}`, position: chosen.position, anchor: anchor.position, anchorTotal: total + chosen.lead }
    },
  }
}

/** Pick a new tripod ahead of the train on its current route, avoiding
 * tripods whose view of the passing train is hidden by scenery. The search
 * stops at `outOfTime`, keeping the clearest tripod found so far. */
export function nextTracksideShot(course: JourneyCourse, motion: JourneyMotion, routes: JourneyRoutes, aspect: number, avoid: readonly Gap[] = [], blocked?: SightBlocked, outOfTime: () => boolean = () => false): TracksideShot {
  const search = createTracksideSearch(course, motion, routes, aspect, avoid, blocked)
  while (!search.step() && !outOfTime()) { /* keep testing */ }
  return search.result()
}

/** Keep a shot until the train has passed and gone, the route was switched
 * away from the tripod, or the train is out of sight. */
export function tracksideShotExpired(shot: TracksideShot, course: JourneyCourse, motion: JourneyMotion, routes: JourneyRoutes) {
  const ahead = shot.anchorTotal - motion.totalDistance
  if (ahead < -SHOT_TRAIL || ahead > SHOT_LEAD * 2) return true
  if (ahead > 1 && sampleJourney(motion, course, -ahead, routes).position.distanceTo(shot.anchor) > 1.5) return true
  return sampleJourney(motion, course).position.distanceTo(shot.position) > SHOT_REACH
}
