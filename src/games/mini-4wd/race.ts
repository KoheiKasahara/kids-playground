import { DEFAULT_BUILD, getStats, normalizeBuild, trackCurvature } from './data'
import type { Build, Course, Racer, RaceState, TrackZone } from './types'

export type { RaceEvent, Racer, RaceState } from './types'

export const LAP_COUNT = 3
export const COUNTDOWN_SECONDS = 3
export const CHEER_BOOST_SECONDS = 1.5
export const CHEER_COOLDOWN_SECONDS = 2.5
const CHEER_SPEEDUP = 1.22
const SUBSTEP = 1 / 120
/** Distance between lane centres, wide enough for a car with room on both sides. */
export const LANE_GAP = 36
/** Lane centres from the outside in. Every course runs clockwise, so positive offsets face the infield. */
export const LANE_OFFSETS = [-LANE_GAP, 0, LANE_GAP]
const START_LANES = [1, 0, 2]

/**
 * Like a real circuit's lane changer, the outside lane crosses the bridge to the inside
 * while the other two step outward. Three laps give every car one lap in every lane.
 */
export function laneAfterChanges(startLane: number, changes: number): number {
  return (startLane + changes * 2) % LANE_OFFSETS.length
}

const smooth = (t: number) => t * t * (3 - 2 * t)

/**
 * Where a car runs across the track. `bridge` rises from 0 to 1 and back while the car
 * is crossing over the other lanes; `slope` is the sideways offset per pixel travelled.
 */
export function lanePosition(course: Course, startLane: number, distance: number) {
  const lap = Math.floor((distance + 1e-7) / course.length)
  const progress = Math.max(0, distance / course.length - lap)
  const { start, end } = course.laneChange
  if (progress < start || progress >= end) {
    const lane = laneAfterChanges(startLane, lap + (progress >= end ? 1 : 0))
    return { offset: LANE_OFFSETS[lane], bridge: 0, slope: 0 }
  }
  const from = laneAfterChanges(startLane, lap)
  const to = laneAfterChanges(startLane, lap + 1)
  const t = (progress - start) / (end - start)
  const shift = LANE_OFFSETS[to] - LANE_OFFSETS[from]
  return {
    offset: LANE_OFFSETS[from] + shift * smooth(t),
    bridge: from === 0 ? Math.sin(t * Math.PI) : 0,
    slope: shift * 6 * t * (1 - t) / ((end - start) * course.length),
  }
}

/** Centreline progress per pixel driven: inside lanes are shorter through a bend, outside lanes longer. */
function laneScale(course: Course, startLane: number, distance: number): number {
  const { offset } = lanePosition(course, startLane, distance)
  return 1 / Math.max(.35, 1 - trackCurvature(course, distance) * offset)
}

export function createRace(course: Course, build: Build): RaceState {
  const builds = [
    normalizeBuild(build),
    { ...DEFAULT_BUILD, body: 'buggy', motor: 'dash', tires: 'normal', rollers: 'wide', color: 'blue' },
    { ...DEFAULT_BUILD, body: 'wing', motor: 'balance', tires: 'sponge', rollers: 'bearing', color: 'yellow' },
  ]
  return {
    course, phase: 'countdown', countdown: COUNTDOWN_SECONDS, elapsed: 0, lapCount: LAP_COUNT, cheerCooldown: 0, events: [], clock: 0,
    racers: builds.map((car, id) => ({
      id, name: ['きみのマシン', 'アオくん', 'キイちゃん'][id], startLane: START_LANES[id], build: car, stats: getStats(car),
      distance: 0, speed: 0, finishTime: null, wobble: 0, recovery: 0, boost: 0, zoneKey: null,
    })),
  }
}

function strainFor(racer: Racer, zone: TrackZone): number {
  const { speed, grip, stability } = racer.stats
  const control = zone.kind === 'curve' ? grip * .7 + stability * .3 : stability
  return Math.max(0, speed - control + zone.severity - 1.5)
}

function advance(race: RaceState, dt: number) {
  const totalDistance = race.course.length * race.lapCount
  const previousClock = race.clock
  race.clock += dt
  if (race.racers[0].finishTime === null) race.elapsed = race.clock
  race.cheerCooldown = Math.max(0, race.cheerCooldown - dt)
  for (const racer of race.racers) {
    if (racer.finishTime !== null) continue
    const previousDistance = racer.distance
    const lap = Math.floor(previousDistance / race.course.length)
    const progress = previousDistance / race.course.length - lap
    const zoneIndex = race.course.zones.findIndex(zone => progress >= zone.start && progress < zone.end)
    const zone = race.course.zones[zoneIndex]
    const zoneKey = zone ? `${lap}:${zoneIndex}` : null
    if (zoneKey !== racer.zoneKey) {
      racer.zoneKey = zoneKey
      if (zone && strainFor(racer, zone) > .65) {
        racer.recovery = .2 + Math.min(1.7, strainFor(racer, zone)) * .2
        racer.wobble = 1
        race.events.push({ kind: 'bump', racer: racer.id })
      }
    }
    let target = race.course.length * (.077 + racer.stats.speed * .009)
    if (zone) {
      const control = zone.kind === 'curve' ? racer.stats.grip : racer.stats.stability
      target *= 1 - zone.severity * (5 - control) * .045
    }
    if (racer.recovery > 0) target *= .4
    if (racer.boost > 0) target *= CHEER_SPEEDUP
    racer.boost = Math.max(0, racer.boost - dt)
    racer.recovery = Math.max(0, racer.recovery - dt)
    racer.wobble = Math.max(0, racer.wobble - dt * 1.6)
    // Smooth acceleration, with enough traction to always recover and finish.
    racer.speed += (target - racer.speed) * Math.min(1, dt * 4)
    const rate = racer.speed * laneScale(race.course, racer.startLane, previousDistance)
    racer.distance = Math.min(totalDistance, previousDistance + rate * dt)
    const nextLap = Math.floor((racer.distance + 1e-7) / race.course.length)
    if (nextLap > lap && nextLap < race.lapCount) race.events.push({ kind: 'lap', racer: racer.id })
    const { laneChange } = race.course
    const nextProgress = racer.distance / race.course.length - lap
    if (progress < laneChange.start && nextProgress >= laneChange.start) race.events.push({ kind: 'lane', racer: racer.id })
    if (racer.distance >= totalDistance) {
      racer.finishTime = previousClock + (totalDistance - previousDistance) / rate
      racer.speed = 0
      racer.wobble = 0
      racer.boost = 0
      race.events.push({ kind: 'finish', racer: racer.id })
    }
  }
  const player = race.racers[0]
  if (player.finishTime !== null && race.phase === 'racing') {
    race.phase = 'finished'
    race.elapsed = player.finishTime
    // The last substep can finish two cars. A rival crossing after the player
    // still belongs behind them, and the clock keeps running for cars still on track.
  }
}

/** Once the player is home the rivals keep driving to the line; the result does not wait for them. */
export function isRaceSettled(race: RaceState): boolean {
  return race.phase === 'finished' && race.racers.every(racer => racer.finishTime !== null)
}

/** Advances at most 100 ms, so returning from a background tab cannot skip a race. */
export function stepRace(race: RaceState, dt: number): void {
  race.events = []
  if (isRaceSettled(race) || !Number.isFinite(dt) || dt <= 0) return
  let remaining = Math.min(.1, dt)
  if (race.phase === 'countdown') {
    const consumed = Math.min(race.countdown, remaining)
    race.countdown = Math.max(0, race.countdown - consumed)
    remaining -= consumed
    if (race.countdown > 1e-7) return
    race.countdown = 0
    race.phase = 'racing'
    race.events.push({ kind: 'go', racer: 0 })
  }
  while (remaining > 1e-9 && !isRaceSettled(race)) {
    const step = Math.min(SUBSTEP, remaining)
    advance(race, step)
    remaining -= step
  }
}

/** A cheer speeds up the player's car and shakes off a bump, then needs to charge again. */
export function cheerRace(race: RaceState): boolean {
  const player = race.racers[0]
  if (race.phase !== 'racing' || player.finishTime !== null || race.cheerCooldown > 0) return false
  player.boost = CHEER_BOOST_SECONDS
  player.recovery = 0
  race.cheerCooldown = CHEER_COOLDOWN_SECONDS
  return true
}

export function getRank(race: RaceState): number {
  const player = race.racers[0]
  return 1 + race.racers.slice(1).filter(racer => {
    if (player.finishTime !== null) return racer.finishTime !== null && racer.finishTime < player.finishTime
    return racer.finishTime !== null || racer.distance > player.distance
  }).length
}
