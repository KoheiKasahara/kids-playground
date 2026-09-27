import { aheadOf, islandAt, openLanes, sampleTrack, zoneAt } from './courses'
import type { Course, ItemId, Racer, RaceEvent, RaceInput, RaceState } from './types'

/** Lateral reach within which driving over an item box collects it. */
export const BOX_REACH = 36
const KART_RADIUS = 16
const FIXED_STEP = 1 / 60
const TOP_SPEED = 242
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const wrappedGap = (gap: number, length: number) => ((gap + length / 2) % length + length) % length - length / 2

function emit(state: RaceState, kind: RaceEvent['kind'], racer: number) {
  state.events.push({ id: state.nextId++, kind, racer })
}

function random(state: RaceState) {
  let value = state.seed | 0
  value ^= value << 13
  value ^= value >>> 17
  value ^= value << 5
  state.seed = value >>> 0
  return state.seed / 4294967296
}

export function createRace(course: Course, assist = true): RaceState {
  const names = ['きみ', 'ミント', 'ソラ', 'モモ']
  // Match the four kart body palettes so the course map identifies the same racers.
  const colors = ['#e67468', '#76aacf', '#c1a1d7', '#dfb85c']
  return {
    course, racers: names.map((name, id) => ({ id, name, color: colors[id], distance: id * 70,
      lane: id === 0 ? 0 : (id % 2 === 0 ? 55 : -55), speed: 0, item: null,
      boost: 0, jump: 0, star: 0, stun: 0, protection: 0, drift: 0, rough: false, finished: false, finishTime: null })),
    hazards: [], projectiles: [], elapsed: 0, countdown: 3, phase: 'countdown', lapCount: 2,
    assist, events: [], nextId: 1, seed: 982451653 + course.id.charCodeAt(0),
  }
}

export function getRank(state: RaceState, racerId = 0): number {
  const racers = [...state.racers].sort((a, b) => {
    if (a.finished && b.finished) return (a.finishTime ?? 0) - (b.finishTime ?? 0) || a.id - b.id
    if (a.finished !== b.finished) return a.finished ? -1 : 1
    return b.distance - a.distance || a.id - b.id
  })
  return racers.findIndex(racer => racer.id === racerId) + 1
}

export function activateItem(state: RaceState, racerId = 0): void {
  const racer = state.racers.find(candidate => candidate.id === racerId)
  if (state.phase !== 'racing' || !racer || racer.finished || !racer.item) return
  const item = racer.item
  racer.item = null
  emit(state, item, racer.id)
  if (item === 'boost') racer.boost = 1.8
  if (item === 'jump') racer.jump = 1.25
  if (item === 'star') {
    racer.star = 3.2
    racer.stun = 0
    racer.protection = Math.max(racer.protection, 3.2)
  }
  if (item === 'puddle') state.hazards.push({ id: state.nextId++, owner: racer.id,
    distance: racer.distance - 46, lane: racer.lane, life: 13 })
  if (item === 'bomb') {
    // Absolute race progress selects the racer ahead, including across the lap seam.
    const ahead = state.racers.filter(candidate => candidate.id !== racer.id && !candidate.finished && candidate.distance > racer.distance)
      .sort((a, b) => a.distance - b.distance)
    state.projectiles.push({ id: state.nextId++, owner: racer.id, target: ahead[0]?.id ?? -1,
      distance: racer.distance + 28, lane: racer.lane, life: 5 })
  }
}

// Public game action; the alias keeps existing callers compatible without implying a React hook internally.
export { activateItem as useItem }

function hit(state: RaceState, racer: Racer) {
  if (racer.finished || racer.star > 0 || racer.jump > 0 || racer.protection > 0) return
  racer.stun = 0.3
  racer.speed = Math.max(65, racer.speed * 0.38)
  racer.protection = 2
  emit(state, 'hit', racer.id)
}

function awardItem(state: RaceState, racer: Racer) {
  const items: ItemId[] = getRank(state, racer.id) >= 3
    ? ['boost', 'boost', 'jump', 'star', 'star', 'bomb', 'puddle']
    : ['boost', 'jump', 'star', 'bomb', 'puddle']
  racer.item = items[Math.floor(random(state) * items.length)]
  emit(state, 'pickup', racer.id)
}

/** Where a CPU racer wants to be: around islands, onto boxes and panels, away from rough patches. */
function rivalLane(state: RaceState, racer: Racer): number {
  const course = state.course
  const look = racer.distance + 150
  const track = sampleTrack(course, look)
  // Wander a little, and lean toward the inside of the next bend.
  let lane = Math.sin(racer.distance / 450 + racer.id * 2.1) * track.width * 0.3
    + clamp(track.curve * 1500, -1, 1) * track.width * (0.2 + racer.id * 0.08)
  if (!racer.item) {
    const box = course.boxes.map(candidate => ({ candidate, gap: aheadOf(course, racer.distance, candidate.distance) }))
      .filter(({ gap }) => gap > 20 && gap < 230)
      .sort((a, b) => Math.abs(a.candidate.lane - lane) - Math.abs(b.candidate.lane - lane))[0]
    if (box) lane = box.candidate.lane
  }
  for (const zone of course.zones) {
    const gap = aheadOf(course, racer.distance, zone.start)
    const inside = aheadOf(course, racer.distance, zone.end) > 0 && gap <= 0
    if (!inside && (gap < 0 || gap > 240)) continue
    // Rivals 1 and 3 hunt dash panels; everyone steers around rough ground.
    if (zone.kind === 'dash' && racer.id % 2 === 1 && Math.abs(zone.lane - lane) < 70) lane = zone.lane
    if (zone.kind === 'rough' && Math.abs(lane - zone.lane) < zone.half + 14) {
      const [low, high] = openLanes(course, zone.start, lane)
      const left = zone.lane - zone.half - 18, right = zone.lane + zone.half + 18
      lane = (left > low + 12 && (lane < zone.lane || right > high - 12)) ? left : right
    }
    if (zone.kind === 'island') {
      const side = Math.abs(lane - zone.lane) > 4 ? Math.sign(lane - zone.lane) : racer.id % 2 === 0 ? 1 : -1
      const [low, high] = openLanes(course, (zone.start + zone.end) / 2, zone.lane + side)
      lane = clamp(lane, low + 20, high - 20)
    }
  }
  const obstacle = state.hazards.find(hazard => hazard.owner !== racer.id
    && wrappedGap(hazard.distance - racer.distance, course.length) > 0
    && wrappedGap(hazard.distance - racer.distance, course.length) < 170)
  if (obstacle && Math.abs(obstacle.lane - lane) < 50) lane = obstacle.lane + (obstacle.lane >= lane ? -58 : 58)
  const player = state.racers[0]
  if (Math.abs(wrappedGap(racer.distance - player.distance, course.length)) < 90) {
    // Give the child a clear view of their kart during passes; rivals yield to either side.
    const side = player.lane > 18 ? -1 : player.lane < -18 ? 1 : racer.id % 2 === 0 ? 1 : -1
    lane = player.lane + side * 86
  }
  const [low, high] = openLanes(course, racer.distance, racer.lane)
  return clamp(lane, low + 20, high - 20)
}

function driveRacer(state: RaceState, racer: Racer, input: RaceInput, dt: number) {
  if (racer.finished) return
  const course = state.course
  const previousDistance = racer.distance
  for (const timer of ['boost', 'jump', 'star', 'stun', 'protection'] as const) racer[timer] = Math.max(0, racer[timer] - dt)
  const track = sampleTrack(course, racer.distance)
  let steer = clamp(input.steer, -1, 1)
  if (racer.id !== 0) {
    steer = clamp((rivalLane(state, racer) - racer.lane) / 68 + track.curve * 22, -0.8, 0.8)
    if (racer.item && random(state) < dt * 0.45) activateItem(state, racer.id)
  }
  const protectedRoad = racer.id !== 0 || state.assist
  const airborne = racer.jump > 0
  const outside = Math.abs(racer.lane) > track.width - 4
  racer.rough = !airborne && !outside && !!zoneAt(course, racer.distance, racer.lane, 'rough')
  if (!airborne && racer.boost < 0.5 && zoneAt(course, racer.distance, racer.lane, 'dash')) {
    racer.boost = 0.9
    emit(state, 'dash', racer.id)
  }
  const catchUp = racer.id === 0 ? 0 : clamp((state.racers[0].distance - racer.distance) / 90, -20, 16)
  let targetSpeed = racer.id === 0 ? TOP_SPEED : 225 + racer.id * 3 + catchUp
  if (racer.boost > 0) targetSpeed += 96
  if (racer.star > 0) targetSpeed += 45
  if (airborne) targetSpeed += 15
  if (outside && racer.star <= 0 && !airborne) targetSpeed *= 0.48
  else if (racer.rough && racer.star <= 0) targetSpeed *= racer.boost > 0 ? 0.8 : 0.6
  if (racer.stun > 0) targetSpeed = 80
  racer.speed += clamp(targetSpeed - racer.speed, -650 * dt, 790 * dt)

  let lateralSpeed = steer * 157 * clamp(racer.speed / TOP_SPEED, 0.45, 1.25) - track.curve * racer.speed * 20
  if (protectedRoad) {
    // Guide toward the middle of whichever open path the kart is in, so islands and
    // narrow sections are as forgiving as the plain road edges.
    const [low, high] = openLanes(course, racer.distance, racer.lane, KART_RADIUS)
    const middle = (low + high) / 2, half = (high - low) / 2
    const offset = racer.lane - middle
    const safeEdge = Math.max(4, half - 18)
    const guidance = clamp((Math.abs(offset) - half * 0.42) / Math.max(1, safeEdge - half * 0.42), 0, 1)
    if (Math.sign(lateralSpeed) === Math.sign(offset)) lateralSpeed *= 1 - guidance * guidance
    lateralSpeed -= Math.sign(offset) * guidance * guidance * 125 + offset * 0.12
    // Enabling assistance while already on the grass guides the kart back without teleporting.
    const boundary = Math.max(safeEdge, Math.abs(offset))
    racer.lane = middle + clamp(offset + lateralSpeed * dt, -boundary, boundary)
  } else racer.lane = clamp(racer.lane + lateralSpeed * dt, -track.width * 3, track.width * 3)
  const drift = racer.speed > 155 && racer.stun <= 0 ? clamp(track.curve * 48, -1, 1) : 0
  racer.drift += (drift - racer.drift) * (1 - Math.exp(-dt * 7))
  // The inside of a bend is shorter: hugging it gains ground, swinging wide loses a little.
  const line = clamp(track.curve * racer.lane * 0.035, -0.09, 0.09)
  racer.distance += racer.speed * dt * (1 + line)
  // Islands are solid for everyone: their pointed ends deflect a kart into one of the two paths.
  const island = islandAt(course, racer.distance)
  if (island && island.half > 0 && Math.abs(racer.lane - island.lane) < island.half + KART_RADIUS) {
    const previousSide = racer.lane === island.lane ? (racer.id % 2 === 0 ? 1 : -1) : Math.sign(racer.lane - island.lane)
    racer.lane = island.lane + previousSide * (island.half + KART_RADIUS)
    racer.speed = Math.max(Math.min(racer.speed, 170), racer.speed - 180 * dt)
  }

  if (!racer.item && Math.abs(racer.lane) <= track.width) {
    for (const box of course.boxes) {
      if (Math.abs(racer.lane - box.lane) > BOX_REACH) continue
      if (Math.floor((previousDistance - box.distance) / course.length) < Math.floor((racer.distance - box.distance) / course.length)) {
        awardItem(state, racer)
        break
      }
    }
  }
  const finishDistance = course.length * state.lapCount
  if (racer.distance >= finishDistance) {
    racer.finished = true
    racer.finishTime = state.elapsed - (racer.distance - finishDistance) / Math.max(1, racer.speed)
    racer.distance = finishDistance
    emit(state, 'finish', racer.id)
  } else if (Math.floor(previousDistance / course.length) < Math.floor(racer.distance / course.length) && previousDistance >= 0) emit(state, 'lap', racer.id)
}

function stepPhysics(state: RaceState, input: RaceInput, dt: number) {
  state.elapsed += dt
  for (const racer of state.racers) driveRacer(state, racer, input, dt)
  for (const hazard of state.hazards) {
    hazard.life -= dt
    for (const racer of state.racers) {
      if (racer.id !== hazard.owner && Math.abs(wrappedGap(racer.distance - hazard.distance, state.course.length)) < 27
        && Math.abs(racer.lane - hazard.lane) < 34 && racer.jump <= 0) {
        hit(state, racer)
        hazard.life = 0
        break
      }
    }
  }
  for (const projectile of state.projectiles) {
    projectile.life -= dt
    const target = state.racers.find(racer => racer.id === projectile.target && !racer.finished)
    let projectileSpeed = 490
    if (target) {
      projectile.lane += (target.lane - projectile.lane) * (1 - Math.exp(-dt * 14))
      const gap = wrappedGap(target.distance - projectile.distance, state.course.length)
      // Match a nearby rival's pace while turning across the road, instead of overshooting them.
      if (gap > -80 && gap < 100) projectileSpeed = target.speed + clamp((gap - 18) * 6, -target.speed * 0.65, 250)
    }
    projectile.distance += projectileSpeed * dt
    for (const racer of state.racers) {
      if (racer.id !== projectile.owner && !racer.finished
        && Math.abs(wrappedGap(racer.distance - projectile.distance, state.course.length)) < 28
        && Math.abs(racer.lane - projectile.lane) < 35) {
        hit(state, racer)
        projectile.life = 0
        break
      }
    }
  }
  state.hazards = state.hazards.filter(hazard => hazard.life > 0)
  state.projectiles = state.projectiles.filter(projectile => projectile.life > 0)
  if (state.racers[0].finished) state.phase = 'finished'
}

/** Input is a per-frame steer value and an item-use pulse. Large frame stalls are capped. */
export function stepRace(state: RaceState, input: RaceInput, dt: number): void {
  state.events = []
  if (state.phase === 'finished' || !Number.isFinite(dt) || dt <= 0) return
  let remaining = Math.min(dt, 0.1)
  if (state.phase === 'countdown') {
    const countdownTime = Math.min(state.countdown, remaining)
    state.countdown = Math.max(0, state.countdown - countdownTime)
    remaining -= countdownTime
    if (state.countdown > 0.000001) return
    state.countdown = 0
    state.phase = 'racing'
  }
  if (input.useItem) activateItem(state)
  const safeInput = { ...input, steer: Number.isFinite(input.steer) ? input.steer : 0 }
  while (remaining > 0.000001 && state.phase === 'racing') {
    const step = Math.min(FIXED_STEP, remaining)
    stepPhysics(state, safeInput, step)
    remaining -= step
  }
}
