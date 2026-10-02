import { CubicBezierCurve3, CurvePath, Euler, Quaternion, Vector3 } from 'three'

export type MapId = 'island' | 'downtown'
/** Any named stretch of rail. Each map names its own trunks and branches. */
export type JourneyEdge = string
/** A branch a point can send the train down. */
export type JourneyRoute = string
/** The branch set at each of a map's points, in the order the train meets them. */
export type JourneyRoutes = readonly JourneyRoute[]
export type TrainId = 'bullet' | 'steam' | 'cargo'
export const TRAINS = [
  { id: 'bullet', label: 'しんかんせん', icon: '🚅', color: '#477ed2', description: 'すいすい はしるよ', models: ['train-electric-bullet-a', 'train-electric-bullet-b', 'train-electric-bullet-a'], speed: 4.8 },
  { id: 'steam', label: 'きかんしゃ', icon: '🚂', color: '#ce594b', description: 'けむりが ぽっぽ！', models: ['train-locomotive-a', 'train-locomotive-passenger-a', 'train-locomotive-passenger-a'], speed: 3.8 },
  { id: 'cargo', label: 'かもつれっしゃ', icon: '🚃', color: '#d59329', description: 'にもつを はこぶよ', models: ['train-diesel-a', 'train-carriage-container-red', 'train-carriage-container-green'], speed: 4.2 },
] as const
type Branch = {
  label: string; icon: string; color: string; hint: string
  /** Caption while the train runs along it. */
  where: string
  /** Scene colours: ballast bed, its glow when selected, and the arrows. */
  bed: string; glow: string; arrow: string
  /** Course map stroke when not selected. */
  faded: string
}
export const ROUTES: Record<JourneyRoute, Branch> = {
  bridge: { label: 'はし', icon: '🌉', color: '#287fca', hint: '🌉 あおい みちで はしへ', where: 'おそらの はしへ！', bed: '#4b98c6', glow: '#318dc9', arrow: '#147dd5', faded: '#b6c8d0' },
  forest: { label: 'トンネル', icon: '🌲', color: '#328555', hint: '🌲 みどりの みちで トンネルへ', where: 'もりを はしるよ！', bed: '#73a389', glow: '#519456', arrow: '#147e43', faded: '#bdcdb7' },
  city: { label: 'まち', icon: '🏙️', color: '#c4702c', hint: '🏙️ オレンジの みちで ビルの まちへ', where: 'ビルの まちを はしるよ！', bed: '#a9a69b', glow: '#c07a38', arrow: '#cf7220', faded: '#d8c5ae' },
  skyway: { label: 'こうか', icon: '🏙️', color: '#8a55c2', hint: '🏙️ むらさきの みちで ビルの うえへ', where: 'ビルの あいだを そらたかく！', bed: '#a896bd', glow: '#8a55c2', arrow: '#7a3fc0', faded: '#d3c8de' },
  subway: { label: 'ちかてつ', icon: '🚇', color: '#d0453a', hint: '🚇 あかい みちで ちかてつへ', where: 'ちかてつの えきへ！', bed: '#b39a92', glow: '#cc4a3c', arrow: '#d23a2c', faded: '#e3c3bd' },
  river: { label: 'かわ', icon: '⛴️', color: '#1f8fb0', hint: '⛴️ みずいろの みちで かわぞいへ', where: 'かわぞいを はしるよ！', bed: '#7fb0bd', glow: '#1f8fb0', arrow: '#0f86ab', faded: '#b9d6dd' },
  tower: { label: 'タワー', icon: '🗼', color: '#dd6a1f', hint: '🗼 オレンジの みちで タワーへ', where: 'おおきな タワーが みえるよ！', bed: '#c1a58c', glow: '#d8691f', arrow: '#e0661a', faded: '#e3cdb8' },
  harbor: { label: 'みなと', icon: '🎡', color: '#2f63c4', hint: '🎡 あおい みちで みなとへ', where: 'みなとの かんらんしゃ！', bed: '#8ea3c6', glow: '#2f63c4', arrow: '#2257c8', faded: '#bccadf' },
}
/** The island's single point, kept as its own list for its scenery and tests. */
export const ROUTE_ORDER = ['bridge', 'forest', 'city'] as const

type MapInfo = {
  label: string; icon: string; description: string
  /** Station name, used for its sign and while the train rests there. */
  station: string
  /** Captions on the trunks, where no point has chosen the way yet. */
  trunks: Record<JourneyEdge, string>
  /** How far the chase camera leans off the rails: + inside the loop, - outside. */
  shoulder: number
  sky: string
  /** What the controls call each point, in order. Empty for a map with one. */
  points: readonly string[]
  /** Scene caption while choosing a train, and a tip under the controls. */
  intro: string
  tip: string
}
export const MAPS: Record<MapId, MapInfo> = {
  island: { label: 'しま', icon: '🏝️', description: 'はし・もり・まち', station: 'にじいろえき', trunks: { common: 'しゅっぱつ しんこう！' }, shoulder: 5, sky: '#c3e5e9', points: [''], intro: 'はしも、もりも、まちも。すきな でんしゃで！', tip: 'ポイントを すぎたら つぎの いっしゅう' },
  downtown: { label: 'とかい', icon: '🌆', description: 'ビルと タワー', station: 'ひかりえき', trunks: { south: 'しゅっぱつ しんこう！', north: 'ビルの まちを すすむよ！' }, shoulder: -3.5, sky: '#bfdcf0', points: ['ひとつめ', 'ふたつめ'], intro: 'ビルに タワー、ちかてつも！ すきな でんしゃで！', tip: 'ポイントは ふたつ。ひかっている ほうが つぎだよ' },
}
export const MAP_ORDER = ['island', 'downtown'] as const

/** One big button per point cycles its branches and comes back round. */
export function nextRoute(branches: readonly JourneyRoute[], route: JourneyRoute): JourneyRoute {
  return branches[(branches.indexOf(route) + 1) % branches.length]
}
export const TRACK_Y = 0.3
export const CAR_SPACING = 2.95
export const BOOST_SECONDS = 2.4

type Point = readonly [number, number, number]
// Explicit endpoint tangents keep every route tangent-continuous at the turnout
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

/** A point: the trunk that ends there, its branches, and the trunk they rejoin. */
export type JourneySwitch = { trunk: JourneyEdge; branches: readonly JourneyRoute[]; next: JourneyEdge; lever: readonly [x: number, z: number] }
type Bounds = { min: { x: number; z: number }; max: { x: number; z: number } }

function islandCourse() {
  const east = new Vector3(2.2, 0, 0)
  const south = new Vector3(0, 0, 2.8)
  const common = path([[16, 0, -10], [20, 0, 0], [18, 0, 12], [9, 0, 18], [-7, 0, 18], [-19, 0, 12], [-21, 0, 2], [-17, 0, -3], [-12, 0, -3]], south, east)
  const bridge = path([[-12, 0, -3], [-6, 1.2, -2], [0, 3.5, 2], [7, 5.4, 4], [8, 5.4, 10], [1, 5.4, 11], [-5, 5.4, 6], [-6, 5.4, -2], [-8, 4.5, -12], [-5, 2, -21], [5, 0, -24], [14, 0, -20], [16, 0, -10]], east, south)
  const forest = path([[-12, 0, -3], [-5, 0, -3], [3, 0, -7], [5, 0, -14], [11, 0, -17], [16, 0, -10]], east, south)
  // The town line keeps to the level ground the other two branches leave free:
  // north up the avenue, then east along the outskirts into the junction throat.
  const city = path([[-12, 0, -3], [-6.5, 0, -4.5], [-3.5, 0, -9.5], [-3, 0, -15.5], [2, 0, -20], [8.5, 0, -20.8], [12.6, 0, -19], [14.4, 0, -15.6], [16, 0, -10]], east, south)
  const switches: JourneySwitch[] = [{ trunk: 'common', branches: ROUTE_ORDER, next: 'common', lever: [-12, -0.7] }]
  const bounds: Bounds = { min: { x: -29, z: -29 }, max: { x: 29, z: 29 } }
  return { curves: { common, bridge, forest, city }, switches, station: new Vector3(-4, TRACK_Y, 18), bounds }
}

// Downtown runs clockwise round a core of towers. The first point fans three
// ways across the west side, the second two ways down the east waterfront.
function downtownCourse() {
  const north = new Vector3(0, 0, -2.8)
  const south = new Vector3(0, 0, 2.8)
  const east = new Vector3(2.4, 0, 0)
  const trunkSouth = path([[21, 0, 2], [21.5, 0, 10], [17, 0, 17.5], [9, 0, 19.5], [4, 0, 19.5], [-6, 0, 19.5], [-11, 0, 19.5], [-17, 0, 17], [-21, 0, 10], [-21, 0, 1]], south, north)
  const skyway = path([[-21, 0, 1], [-17.5, 1.1, -4], [-12.5, 3.4, -8.5], [-9.5, 4.2, -13.5], [-6.5, 4.2, -17.5], [-2.5, 1.9, -20.6], [2, 0, -22]], north, east)
  const subway = path([[-21, 0, 1], [-19.5, 0, -6], [-18, 0, -13], [-13.5, 0, -19.5], [-6, 0, -23.2], [2, 0, -22]], north, east)
  const river = path([[-21, 0, 1], [-23.2, 0, -6], [-23.4, 0, -15], [-20, 0, -22.5], [-13, 0, -25.6], [-5, 0, -25.4], [2, 0, -22]], north, east)
  const trunkNorth = path([[2, 0, -22], [7, 0, -22], [12, 0, -22]], east, east)
  const tower = path([[12, 0, -22], [16.5, 0, -19.5], [18.2, 0, -12.5], [18.3, 0, -5], [21, 0, 2]], east, south)
  const harbor = path([[12, 0, -22], [18.5, 0, -25], [24.8, 0, -21.5], [26, 0, -13], [25.4, 0, -4.5], [21, 0, 2]], east, south)
  const switches: JourneySwitch[] = [
    { trunk: 'south', branches: ['skyway', 'subway', 'river'], next: 'north', lever: [-18.8, 3.5] },
    { trunk: 'north', branches: ['tower', 'harbor'], next: 'south', lever: [9.5, -19.6] },
  ]
  const bounds: Bounds = { min: { x: -29, z: -29 }, max: { x: 35, z: 29 } }
  return { curves: { south: trunkSouth, north: trunkNorth, skyway, subway, river, tower, harbor }, switches, station: new Vector3(-1, TRACK_Y, 19.5), bounds }
}

export function createJourneyCourse(id: MapId = 'island') {
  const { curves, switches, station, bounds } = id === 'downtown' ? downtownCourse() : islandCourse()
  const lengths = Object.fromEntries(Object.entries(curves).map(([key, curve]) => [key, curve.getLength()])) as Record<JourneyEdge, number>
  const edges: Record<JourneyEdge, CurvePath<Vector3>> = curves
  const stationEdge = switches[0].trunk
  const trunk = edges[stationEdge]
  let stationDistance = 0
  let nearest = Infinity
  for (let d = 0; d < lengths[stationEdge]; d += 0.1) {
    const distance = trunk.getPointAt(d / lengths[stationEdge]).distanceToSquared(station)
    if (distance < nearest) { nearest = distance; stationDistance = d }
  }
  return { id, curves: edges, lengths, switches, stationEdge, stationDistance, bounds }
}
/** The branch each point starts on. */
export function defaultRoutes(course: JourneyCourse): JourneyRoute[] {
  return course.switches.map(point => point.branches[0])
}
/** Where the rails lead once `edge` runs out, given how each point is set. */
export function followingEdge(course: JourneyCourse, edge: JourneyEdge, routes: JourneyRoutes): JourneyEdge {
  const index = course.switches.findIndex(point => point.trunk === edge)
  if (index >= 0) {
    const point = course.switches[index]
    return point.branches.includes(routes[index]) ? routes[index] : point.branches[0]
  }
  return course.switches.find(point => point.branches.includes(edge))?.next ?? course.stationEdge
}
/** Which point the train meets next while it runs along `edge`. */
export function upcomingSwitch(course: JourneyCourse, edge: JourneyEdge): number {
  const trunk = course.switches.findIndex(point => point.trunk === edge)
  if (trunk >= 0) return trunk
  const branch = course.switches.findIndex(point => point.branches.includes(edge))
  return branch < 0 ? 0 : (branch + 1) % course.switches.length
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
  const last = course.switches[course.switches.length - 1]
  return { edge: course.stationEdge, distance: course.stationDistance, history: [last.branches[0]], speed: 0, totalDistance: 0, boostRemaining: 0, dwell: 1.8, stationPassed: true, visits: 0 }
}

export function boostJourney(motion: JourneyMotion) {
  // A tap also sends a waiting train on its way. Repeated taps never stack speed.
  motion.dwell = 0
  motion.boostRemaining = BOOST_SECONDS
}

export function advanceJourney(motion: JourneyMotion, course: JourneyCourse, dt: number, routes: JourneyRoutes, train: TrainId) {
  if (!Number.isFinite(dt) || dt <= 0) return
  motion.boostRemaining = Math.max(0, motion.boostRemaining - dt)
  if (motion.dwell > 0) {
    motion.dwell = Math.max(0, motion.dwell - dt)
    motion.speed = 0
    return
  }
  const stationAhead = motion.edge === course.stationEdge && !motion.stationPassed
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
    motion.edge = followingEdge(course, motion.edge, routes)
    if (motion.edge === course.stationEdge) motion.stationPassed = false
  }
}

/** Sample the actual travelled route, so trailing cars never switch mid-train. */
export function sampleJourney(motion: JourneyMotion, course: JourneyCourse, behind = 0, routes: JourneyRoutes = defaultRoutes(course)) {
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
    edge = followingEdge(course, edge, routes)
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
