import { DEFAULT_BUILD, getStats, normalizeBuild } from './data'
import type { Build, Course, Racer, RaceState, TrackZone } from './types'

export type { RaceEvent, Racer, RaceState } from './types'

export const LAP_COUNT = 3
export const COUNTDOWN_SECONDS = 3
const SUBSTEP = 1 / 120

export function createRace(course: Course, build: Build): RaceState {
  const builds = [
    normalizeBuild(build),
    { ...DEFAULT_BUILD, body: 'buggy', motor: 'dash', tires: 'normal', rollers: 'wide', color: 'blue' },
    { ...DEFAULT_BUILD, body: 'wing', motor: 'balance', tires: 'sponge', rollers: 'bearing', color: 'yellow' },
  ]
  return {
    course, phase: 'countdown', countdown: COUNTDOWN_SECONDS, elapsed: 0, lapCount: LAP_COUNT, events: [],
    racers: builds.map((car, id) => ({
      id, name: ['きみのマシン', 'アオくん', 'キイちゃん'][id], build: car, stats: getStats(car),
      distance: 0, speed: 0, finishTime: null, wobble: 0, recovery: 0, zoneKey: null,
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
  const previousElapsed = race.elapsed
  race.elapsed += dt
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
    racer.recovery = Math.max(0, racer.recovery - dt)
    racer.wobble = Math.max(0, racer.wobble - dt * 1.6)
    // Smooth acceleration, with enough traction to always recover and finish.
    racer.speed += (target - racer.speed) * Math.min(1, dt * 4)
    racer.distance = Math.min(totalDistance, previousDistance + racer.speed * dt)
    const nextLap = Math.floor((racer.distance + 1e-7) / race.course.length)
    if (nextLap > lap && nextLap < race.lapCount) race.events.push({ kind: 'lap', racer: racer.id })
    if (racer.distance >= totalDistance) {
      racer.finishTime = previousElapsed + (totalDistance - previousDistance) / racer.speed
      racer.speed = 0
      racer.wobble = 0
      race.events.push({ kind: 'finish', racer: racer.id })
    }
  }
  const player = race.racers[0]
  if (player.finishTime !== null) {
    race.phase = 'finished'
    race.elapsed = player.finishTime
    // The last substep can finish two cars. A rival crossing after the player
    // still belongs behind them, and cannot acquire a later result after freeze.
  }
}

/** Advances at most 100 ms, so returning from a background tab cannot skip a race. */
export function stepRace(race: RaceState, dt: number): void {
  race.events = []
  if (race.phase === 'finished' || !Number.isFinite(dt) || dt <= 0) return
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
  while (remaining > 1e-9 && race.phase === 'racing') {
    const step = Math.min(SUBSTEP, remaining)
    advance(race, step)
    remaining -= step
  }
}

export function getRank(race: RaceState): number {
  const player = race.racers[0]
  return 1 + race.racers.slice(1).filter(racer => {
    if (player.finishTime !== null) return racer.finishTime !== null && racer.finishTime < player.finishTime
    return racer.finishTime !== null || racer.distance > player.distance
  }).length
}
