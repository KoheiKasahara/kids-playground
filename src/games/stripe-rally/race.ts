import { circuitLength, pose, racingLine, roadLimit } from './circuit'

export const LAPS = 2
export const STEP = 1 / 30
export const RECHARGE = 4
export const BOOST_TIME = 1.35

// Entry and exit as fractions of the painted circuit; side points to the outside.
const corners = [
  { entry: 0.10, exit: 0.30, side: 1 },
  { entry: 0.30, exit: 0.38, side: -1 },
  { entry: 0.38, exit: 0.55, side: 1 },
  { entry: 0.55, exit: 0.64, side: -1 },
  { entry: 0.64, exit: 0.79, side: 1 },
  { entry: 0.79, exit: 0.85, side: -1 },
  { entry: 0.85, exit: 0.94, side: 1 },
]

export function grid(random = Math.random) {
  const offsets = [0, -35, 32]
  const rivalDistances = [0.024, 0.052]
  const headings = [0, ...rivalDistances].map(laps => pose(laps).angle)
  // Draw once per car, lap and corner so replaying a simulation tick is pure.
  const plans = offsets.map(() => Array.from({ length: LAPS }, () => corners.map(() => ({
    wide: 22 * random() ** 2,
    pace: (random() - 0.5) * 0.40,
  }))))
  return { distance: 0, elapsed: 0, cooldown: 0, rivalDistances, offsets, headings, plans }
}
export type Race = ReturnType<typeof grid>

export function position(race: Race) {
  return 1 + race.rivalDistances.filter(distance => distance > race.distance).length
}

function cornering(distance: number, plan: Race['plans'][number]) {
  const lap = Math.floor(distance)
  const progress = distance - lap
  const index = corners.findIndex(c => progress >= c.entry && progress < c.exit)
  if (index < 0 || lap >= LAPS) return { offset: 0, pace: 1 }
  const { entry, exit, side } = corners[index]
  const phase = (progress - entry) / (exit - entry)
  const weight = Math.sin(Math.PI * phase) ** 2
  const { wide, pace } = plan[lap][index]
  // A wider arc costs distance. Blend the pace change in and out at the ends.
  return { offset: side * wide * weight, pace: 1 + (pace - wide * 0.003) * weight }
}

function steer(distances: number[], speeds: number[], previous: number[], targets: number[], dt: number) {
  // Keep the current lateral order while alongside. Farther apart, all cars
  // can take the same apex. Scale the clearance up before their bumpers meet.
  const order = previous.map((_, i) => i).sort((a, b) => previous[a] - previous[b] || a - b)
  const gaps = order.map(a => order.map(b => {
    const laps = distances[a] - distances[b]
    const separation = laps - Math.round(laps)
    const closingSpeed = Math.max(0, -Math.sign(separation) * (speeds[a] - speeds[b]))
    const predictedGap = (Math.abs(separation) - closingSpeed * 0.47) * circuitLength
    return 36 * Math.max(0, Math.min(1, (100 - predictedGap) / 24))
  }))
  // Reserve space on the right first, then place cars from left to right.
  // This also leaves the middle car room when three cars run abreast.
  const limits = order.map(() => roadLimit)
  for (let i = order.length - 2; i >= 0; i--) {
    for (let j = i + 1; j < order.length; j++) {
      const clearance = gaps[i][j]
      if (clearance === 0) continue
      limits[i] = Math.min(limits[i], limits[j] - clearance)
      const missing = clearance - (targets[order[j]] - targets[order[i]])
      if (missing > 0) targets[order[i]] -= missing / 2
    }
  }
  order.forEach((car, i) => {
    let lower = -roadLimit
    for (let j = 0; j < i; j++) {
      if (gaps[j][i] > 0) lower = Math.max(lower, targets[order[j]] + gaps[j][i])
    }
    targets[car] = Math.max(lower, Math.min(limits[i], targets[car]))
  })
  return previous.map((offset, index) => {
    const speed = Math.max(-120, Math.min(120, (targets[index] - offset) * 6))
    return offset + speed * dt
  })
}

export function advance(race: Race): Race {
  if (race.distance >= LAPS) return race
  const boosted = race.cooldown > RECHARGE - BOOST_TIME
  const previous = [race.distance, ...race.rivalDistances]
  const turns = previous.map((laps, i) => cornering(laps, race.plans[i]))
  const cruise = [boosted ? 1.62 / 15 : 1 / 15, 1 / 14.85, 1 / 14.75]
  const speeds = turns.map((turn, i) => cruise[i] * turn.pace)
  const dt = Math.min(STEP, (LAPS - race.distance) / speeds[0])
  const distances = previous.map((laps, i) => laps + dt * speeds[i])
  distances[0] = Math.min(LAPS, distances[0])
  const targets = distances.map((laps, i) => Math.max(-roadLimit, Math.min(roadLimit,
    racingLine(laps + speeds[i] * 0.16) + turns[i].offset)))
  const offsets = steer(distances, speeds, race.offsets, targets, dt)
  const headings = distances.map((laps, i) => {
    const from = pose(previous[i], race.offsets[i])
    const to = pose(laps, offsets[i])
    return Math.atan2(to.y - from.y, to.x - from.x)
  })
  return { ...race, distance: distances[0], rivalDistances: distances.slice(1), elapsed: race.elapsed + dt,
    cooldown: Math.max(0, race.cooldown - dt), offsets, headings }
}
