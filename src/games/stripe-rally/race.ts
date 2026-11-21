import { circuitLength, pose } from './circuit'

export const LAPS = 2
export const STEP = 1 / 30
export const RECHARGE = 4
export const BOOST_TIME = 1.35

export function grid() {
  const offsets = [0, -35, 32]
  const headings = [0, ...rivals(0)].map(laps => pose(laps).angle)
  return { distance: 0, elapsed: 0, cooldown: 0, offsets, headings }
}
export type Race = ReturnType<typeof grid>

// Distances are in laps, including the two rivals' staggered grid positions.
export function rivals(elapsed: number) {
  return [0.024 + elapsed / 14.3, 0.052 + elapsed / 13.9]
}

export function position(race: Race) {
  return 1 + rivals(race.elapsed).filter(distance => distance > race.distance).length
}

const roadLimit = 36
const clampOffset = (value: number) => Math.max(-roadLimit, Math.min(roadLimit, value))

function racingLine(laps: number, index: number) {
  const look = [0.018, 0.021, 0.016][index]
  const entry = pose(laps - look).angle
  const exit = pose(laps + look).angle
  const approach = pose(laps + 3 * look).angle
  // Cut toward the apex; approach the next corner from the outside.
  return clampOffset(32 * Math.sin(exit - entry) - 22 * Math.sin(approach - exit))
}

function steer(distances: number[], previous: number[], dt: number) {
  const targets = distances.map(racingLine)
  // Keep the current lateral order while alongside. Farther apart, all cars
  // can take the same apex. Scale the clearance up before their bumpers meet.
  const order = previous.map((_, i) => i).sort((a, b) => previous[a] - previous[b] || a - b)
  const gaps = order.map(a => order.map(b => {
    const laps = distances[a] - distances[b]
    const gap = Math.abs(laps - Math.round(laps)) * circuitLength
    return gap < 240 ? 36 * Math.min(1, (240 - gap) / 110) : 0
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
    const speed = Math.max(-85, Math.min(85, (targets[index] - offset) * 3))
    return offset + speed * dt
  })
}

export function advance(race: Race): Race {
  if (race.distance >= LAPS) return race
  const boosted = race.cooldown > RECHARGE - BOOST_TIME
  const speed = (boosted ? 1.62 : 1) / 15
  const dt = Math.min(STEP, (LAPS - race.distance) / speed)
  const distance = Math.min(LAPS, race.distance + dt * speed)
  const elapsed = race.elapsed + dt
  const distances = [distance, ...rivals(elapsed)]
  const previous = [race.distance, ...rivals(race.elapsed)]
  const offsets = steer(distances, race.offsets, dt)
  const headings = distances.map((laps, i) => {
    const from = pose(previous[i], race.offsets[i])
    const to = pose(laps, offsets[i])
    return Math.atan2(to.y - from.y, to.x - from.x)
  })
  return { distance, elapsed, cooldown: Math.max(0, race.cooldown - dt), offsets, headings }
}
