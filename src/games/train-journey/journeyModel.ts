import { CubicBezierCurve3, CurvePath, Euler, Quaternion, Vector3 } from 'three'

export type JourneyRoute = 'bridge' | 'forest'
export type JourneyEdge = 'common' | JourneyRoute
export type TrainId = 'bullet' | 'steam' | 'cargo'
export const TRAINS = [
  { id: 'bullet', label: 'しんかんせん', icon: '🚅', color: '#477ed2', description: 'すいすい はしるよ', models: ['train-electric-bullet-a', 'train-electric-bullet-b', 'train-electric-bullet-a'], speed: 4.8 },
  { id: 'steam', label: 'きかんしゃ', icon: '🚂', color: '#ce594b', description: 'けむりが ぽっぽ！', models: ['train-locomotive-a', 'train-locomotive-passenger-a', 'train-locomotive-passenger-a'], speed: 3.8 },
  { id: 'cargo', label: 'かもつれっしゃ', icon: '🚃', color: '#d59329', description: 'にもつを はこぶよ', models: ['train-diesel-a', 'train-carriage-container-red', 'train-carriage-container-green'], speed: 4.2 },
] as const
export const ROUTES = {
  bridge: { label: 'はし', icon: '🌉', color: '#287fca' },
  forest: { label: 'トンネル', icon: '🌲', color: '#328555' },
} as const
export const TRACK_Y = 0.3
export const CAR_SPACING = 2.95
export const BOOST_SECONDS = 2.4

type Point = readonly [number, number, number]
// Explicit endpoint tangents keep both routes tangent-continuous at the turnout
// and merge. The same curves drive the rails, vehicles, and route preview.
function path(points: readonly Point[], start: Vector3, end: Vector3): CurvePath<Vector3> {
  const p = points.map(([x, y, z]) => new Vector3(x, y + TRACK_Y, z))
  const curve = new CurvePath<Vector3>()
  const tangents = p.map((point, i) => {
    if (i === 0) return start.clone()
    if (i === p.length - 1) return end.clone()
    const tangent = p[i + 1].clone().sub(p[i - 1]).normalize().multiplyScalar(Math.min(point.distanceTo(p[i - 1]), point.distanceTo(p[i + 1])) * 0.32)
    // Flatten height extrema: descending ramps must never dip under the ground.
    if ((point.y <= p[i - 1].y && point.y <= p[i + 1].y) || (point.y >= p[i - 1].y && point.y >= p[i + 1].y)) tangent.y = 0
    return tangent
  })
  for (let i = 0; i < p.length - 1; i++) {
    curve.add(new CubicBezierCurve3(p[i], p[i].clone().add(tangents[i]), p[i + 1].clone().sub(tangents[i + 1]), p[i + 1]))
  }
  curve.arcLengthDivisions = 1800
  curve.updateArcLengths()
  return curve
}

export function createJourneyCourse() {
  const east = new Vector3(2.2, 0, 0)
  const south = new Vector3(0, 0, 2.8)
  const common = path([[16, 0, -10], [20, 0, 0], [18, 0, 12], [9, 0, 18], [-7, 0, 18], [-19, 0, 12], [-21, 0, 2], [-17, 0, -3], [-12, 0, -3]], south, east)
  const bridge = path([[-12, 0, -3], [-6, 1.2, -2], [0, 3.5, 2], [7, 5.4, 4], [8, 5.4, 10], [1, 5.4, 11], [-5, 5.4, 6], [-6, 5.4, -2], [-8, 4.5, -12], [-5, 2, -21], [5, 0, -24], [14, 0, -20], [16, 0, -10]], east, south)
  const forest = path([[-12, 0, -3], [-5, 0, -3], [3, 0, -7], [5, 0, -14], [11, 0, -17], [16, 0, -10]], east, south)
  const curves = { common, bridge, forest }
  const lengths = Object.fromEntries(Object.entries(curves).map(([key, curve]) => [key, curve.getLength()])) as Record<JourneyEdge, number>
  let stationDistance = 0
  let nearest = Infinity
  for (let d = 0; d < lengths.common; d += 0.1) {
    const distance = common.getPointAt(d / lengths.common).distanceToSquared(new Vector3(-4, TRACK_Y, 18))
    if (distance < nearest) { nearest = distance; stationDistance = d }
  }
  return { curves, lengths, stationDistance }
}
export type JourneyCourse = ReturnType<typeof createJourneyCourse>
export type JourneyMotion = {
  edge: JourneyEdge
  distance: number
  history: JourneyEdge[]
  speed: number
  totalDistance: number
  boostRemaining: number
  dwell: number
  stationPassed: boolean
  visits: number
}

export function createJourneyMotion(course: JourneyCourse): JourneyMotion {
  return { edge: 'common', distance: course.stationDistance, history: ['bridge'], speed: 0, totalDistance: 0, boostRemaining: 0, dwell: 1.8, stationPassed: true, visits: 0 }
}

export function boostJourney(motion: JourneyMotion) {
  // A tap also sends a waiting train on its way. Repeated taps never stack speed.
  motion.dwell = 0
  motion.boostRemaining = BOOST_SECONDS
}

export function advanceJourney(motion: JourneyMotion, course: JourneyCourse, dt: number, route: JourneyRoute, train: TrainId) {
  if (!Number.isFinite(dt) || dt <= 0) return
  motion.boostRemaining = Math.max(0, motion.boostRemaining - dt)
  if (motion.dwell > 0) {
    motion.dwell = Math.max(0, motion.dwell - dt)
    motion.speed = 0
    return
  }
  const stationAhead = motion.edge === 'common' && !motion.stationPassed
  const toStation = course.stationDistance - motion.distance
  const baseSpeed = TRAINS.find(t => t.id === train)!.speed
  const targetSpeed = stationAhead && toStation < 7
    ? Math.max(0.65, Math.min(baseSpeed, Math.sqrt(Math.max(0, toStation) * 3)))
    : baseSpeed * (motion.boostRemaining > 0 ? 1.85 : 1)
  motion.speed += (targetSpeed - motion.speed) * (1 - Math.exp(-dt * 2.6))
  let travel = motion.speed * dt
  if (stationAhead && travel >= toStation) {
    travel = Math.max(0, toStation)
    motion.dwell = 2.8
    motion.speed = 0
    motion.stationPassed = true
    motion.visits++
    motion.boostRemaining = 0
  }
  motion.distance += travel
  motion.totalDistance += travel
  while (motion.distance >= course.lengths[motion.edge]) {
    motion.distance -= course.lengths[motion.edge]
    motion.history.push(motion.edge)
    // Six edges retain much more than the full train length, with bounded memory.
    if (motion.history.length > 6) motion.history.shift()
    motion.edge = motion.edge === 'common' ? route : 'common'
    if (motion.edge === 'common') motion.stationPassed = false
  }
}

/** Sample the actual travelled route, so trailing cars never switch mid-train. */
export function sampleJourney(motion: JourneyMotion, course: JourneyCourse, behind = 0, nextRoute: JourneyRoute = 'bridge') {
  let edge = motion.edge
  let distance = motion.distance - behind
  let previous = motion.history.length - 1
  while (distance < 0 && previous >= 0) {
    edge = motion.history[previous--]
    distance += course.lengths[edge]
  }
  // Front bogies can already be across a junction while the car center is not.
  while (distance > course.lengths[edge]) {
    distance -= course.lengths[edge]
    edge = edge === 'common' ? nextRoute : 'common'
  }
  const u = Math.max(0, Math.min(1, distance / course.lengths[edge]))
  return { position: course.curves[edge].getPointAt(u), tangent: course.curves[edge].getTangentAt(u), edge }
}

/** Yaw then pitch, preserving world-up even on a northbound slope. */
export function railOrientation(tangent: Vector3): Quaternion {
  return new Quaternion().setFromEuler(new Euler(-Math.atan2(tangent.y, Math.hypot(tangent.x, tangent.z)), Math.atan2(tangent.x, tangent.z), 0, 'YXZ'))
}

export function routePreview(course: JourneyCourse, edge: JourneyEdge): string {
  return course.curves[edge].getSpacedPoints(110).map(p => `${p.x.toFixed(2)},${p.z.toFixed(2)}`).join(' ')
}
