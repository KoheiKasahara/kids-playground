import type { AnimalId } from './animals'
import type { Bee, Course, Pounder, RivalStyle, Span } from './courses'
import { FOODS, type FoodKind } from './foods'

// ごちそうレースの すすみかた。かってに はしる 2ひきが、ジャンプ と ストップ だけで コースを すすみ、
// とちゅうの ごちそうを たべながら ゴールを めざす。絵も 音も もたない ので canvas なしで テストできる。
// きょりは コースと おなじ たんい、じかんは びょう、y は うえむき。

export const RUNNER_W = 34
export const RUNNER_H = 40
export const RUN_SPEED = 220
export const GRAVITY = 2000
export const JUMP_SPEED = 720
export const AIR_JUMP_SPEED = 620
const ACCEL = 720
const STOP_DECEL = 1700
const AIR_STOP_DECEL = 650
const AFTER_GOAL_DECEL = 260
/** これくらいの だんさは ジャンプ しなくても のぼれる。 */
const STEP_UP = 8
/** じめんから はなれても すこしの あいだは ジャンプ できる[s]。 */
const COYOTE = .1
/** ちゃくちの すこし まえに おしても ジャンプ する[s]。 */
const JUMP_BUFFER = .15
/** 「よーい」から「どん！」までの じかん[s]。 */
export const READY_TIME = 2.4
const STUN_TIME = .75
const SQUASH_TIME = 1
const INVULN_TIME = 1.5
const FALL_Y = -150
const FALL_TIME = 1
/** さきに ゴールした ほうに はいる てんすう。 */
export const GOAL_BONUS = 30
/** ゴールしてから けっかを だすまで[s]。 */
export const FINISH_DELAY = 1.6
/** あいてが ゴールしてから これだけ たつと おわる[s]。 */
export const RIVAL_GOAL_LIMIT = 30
/** どんなに ながくても ここで おわる[s]。 */
export const TIME_LIMIT = 240
export const FOOD_R = 14
export const BEE_R = 14
/** ごちそうを この わりあい いじょう たべると ★が ひとつ ふえる。 */
export const GOOD_FOOD_RATIO = .8

export type Who = 'player' | 'rival'
export type Phase = 'ready' | 'run' | 'done'
export type Hurt = 'bee' | 'pounder'

export type Runner = {
  who: Who
  animal: AnimalId
  /** ひだりはし。 */
  x: number
  /** あしもと。 */
  y: number
  vx: number
  vy: number
  onGround: boolean
  /** じめんを はなれてからの じかん[s]。 */
  air: number
  airJumps: number
  jumpBuffer: number
  stun: number
  hurt: Hurt | null
  invuln: number
  /** 0より 大きい あいだは あなに おちている。 */
  fall: number
  braking: boolean
  /** はしった きょり（あしの うごきに つかう）。 */
  stride: number
  /** はやさの かけざん（あいては すこし おそい）。 */
  speed: number
  food: number
  eaten: number
  finishedAt: number | null
  place: 1 | 2 | null
  /** たべない ごちそう（ごちそうの id ごと）。あいての すききらい。 */
  skips: readonly boolean[] | null
}

export type Score = { food: number; eaten: number; bonus: number; total: number; place: 1 | 2 | null }
export type Outcome = 'win' | 'lose' | 'draw'
export type RaceResult = { player: Score; rival: Score; outcome: Outcome; stars: number }

export type RaceEvent =
  | { type: 'go' }
  | { type: 'jump'; who: Who; air: boolean }
  | { type: 'land'; who: Who }
  | { type: 'eat'; who: Who; kind: FoodKind; points: number; x: number; y: number }
  | { type: 'bump'; who: Who; cause: Hurt }
  | { type: 'fall'; who: Who }
  | { type: 'respawn'; who: Who }
  | { type: 'goal'; who: Who; place: 1 | 2 }
  | { type: 'timeup' }
  | { type: 'done'; result: RaceResult }

/** コンピューターの はしりかたの きおく。 */
export type Ai = {
  /** たかい ところの ごちそうを とりに いくか（ごちそうの id ごと）。 */
  greedy: boolean[]
  /** まよって たちどまる あな・だんの いち。 */
  hesitant: number[]
  waitUntil: number
  lastX: number
  lastMoveAt: number
}

export type Race = {
  course: Course
  phase: Phase
  /** つくってからの じかん（ぺったん・はちは これで うごく）。 */
  clock: number
  /** 「どん！」からの じかん。 */
  t: number
  player: Runner
  rival: Runner
  /** だれが たべたか（ごちそうの id ごと）。 */
  eatenBy: (Who | null)[]
  /** プレイヤーが ストップを おしているか。 */
  stop: boolean
  ai: Ai
  /** プレイヤーも コンピューターに まかせる（テストと デモ用）。 */
  autoPlayer: Ai | null
  rivalDoneAt: number | null
  endAt: number | null
  result: RaceResult | null
  events: RaceEvent[]
}

export type RaceOptions = {
  player: AnimalId
  rival: AnimalId
  /** あいての きまぐれを きめる たね。 */
  seed?: number
  /** プレイヤーも じどうで はしらせる ときの はしりかた（テストと デモ用）。 */
  autoPlayer?: AutoStyle
}

/** コンピューターに まかせる ときの はしりかた。 */
export type AutoStyle = Pick<RivalStyle, 'speed' | 'greed' | 'hesitate'>

/** おなじ たねなら おなじ ならびに なる かんたんな らんすう。 */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function createRunner(who: Who, animal: AnimalId, course: Course, speed: number, skips: readonly boolean[] | null): Runner {
  return {
    who, animal, x: course.start, y: 0, vx: 0, vy: 0, onGround: true, air: 0, airJumps: 1, jumpBuffer: 0,
    stun: 0, hurt: null, invuln: 0, fall: 0, braking: false, stride: 0, speed,
    food: 0, eaten: 0, finishedAt: null, place: null, skips,
  }
}

/** あなの はじまり と のぼる だんの いち。あいてが まよう ばしょの こうほ。 */
export function obstacleEdges(course: Course): number[] {
  const edges: number[] = []
  course.spans.forEach((span, i) => {
    const next = course.spans[i + 1]
    if (!next) return
    if (next.x0 > span.x1 + .5) edges.push(span.x1)
    else if (next.top > span.top + STEP_UP) edges.push(next.x0)
  })
  return edges
}

export function createAi(course: Course, style: AutoStyle, random: () => number): Ai {
  return {
    greedy: course.foods.map(() => random() < style.greed),
    hesitant: obstacleEdges(course).filter(() => random() < style.hesitate),
    waitUntil: 0,
    lastX: course.start,
    lastMoveAt: 0,
  }
}

export function createRace(course: Course, options: RaceOptions): Race {
  const random = seededRandom(options.seed ?? 1)
  const skips = course.foods.map(() => random() >= course.rival.appetite)
  return {
    course,
    phase: 'ready',
    clock: 0,
    t: 0,
    player: createRunner('player', options.player, course, options.autoPlayer?.speed ?? 1, null),
    rival: createRunner('rival', options.rival, course, course.rival.speed, skips),
    eatenBy: course.foods.map(() => null),
    stop: false,
    ai: createAi(course, course.rival, random),
    autoPlayer: options.autoPlayer ? createAi(course, options.autoPlayer, random) : null,
    rivalDoneAt: null,
    endAt: null,
    result: null,
    events: [],
  }
}

export function drainEvents(race: Race): RaceEvent[] {
  const events = race.events
  race.events = []
  return events
}

/** ジャンプボタン。じめんでは ジャンプ、くうちゅうでは 1かいだけ もう1だん とぶ。 */
export function pressJump(race: Race): void {
  if (race.phase !== 'run') return
  race.player.jumpBuffer = JUMP_BUFFER
}

/** ストップボタン。おしている あいだ とまる。 */
export function setStop(race: Race, stop: boolean): void {
  race.stop = stop
}

// ---------------- ぺったん・はち ----------------

function cycleOf(p: Pounder) {
  return p.up + p.drop + p.down + p.rise
}

/** ぺったんの したの すきまの たかさ（じめんから）。 */
export function pounderGap(p: Pounder, clock: number): number {
  const cycle = cycleOf(p)
  let u = (((clock + p.phase) % cycle) + cycle) % cycle
  if (u < p.up) return p.height
  u -= p.up
  if (u < p.drop) return p.height * (1 - (u / p.drop) ** 2)
  u -= p.drop
  if (u < p.down) return 0
  u -= p.down
  return p.height * (u / p.rise)
}

/** いま どすんと おちている ところか。 */
export function pounderDropping(p: Pounder, clock: number): boolean {
  const cycle = cycleOf(p)
  const u = (((clock + p.phase) % cycle) + cycle) % cycle
  return u >= p.up && u < p.up + p.drop
}

export function beeY(bee: Bee, clock: number): number {
  return bee.y + bee.amp * Math.sin((clock / bee.period) * Math.PI * 2 + bee.phase)
}

// ---------------- じめん ----------------

/** あしの したに ある いちばん たかい じめん（ない ときは -Infinity）。 */
function supportAt(course: Course, left: number, right: number, prevY: number, falling: boolean): number {
  let support = -Infinity
  for (const span of course.spans) {
    if (span.x0 >= right) break
    if (span.x1 > left && span.top <= prevY + STEP_UP) support = Math.max(support, span.top)
  }
  if (falling) {
    for (const cloud of course.clouds) {
      if (cloud.x0 < right && cloud.x1 > left && cloud.top <= prevY + .5) support = Math.max(support, cloud.top)
    }
  }
  return support
}

function emit(race: Race, event: RaceEvent) {
  race.events.push(event)
}

function respawn(race: Race, r: Runner) {
  const spans = race.course.spans
  const next = spans.find(span => span.x0 > r.x - RUNNER_W && span.x1 - span.x0 > RUNNER_W + 24) ?? spans[spans.length - 1]
  r.x = Math.max(next.x0 + 12, Math.min(r.x, next.x1 - RUNNER_W - 12))
  r.y = next.top
  r.vx = RUN_SPEED * r.speed * .5
  r.vy = 0
  r.onGround = true
  r.air = 0
  r.airJumps = 1
  r.fall = 0
  r.stun = 0
  r.hurt = null
  r.invuln = INVULN_TIME
  emit(race, { type: 'respawn', who: r.who })
}

function hit(race: Race, r: Runner, cause: Hurt) {
  r.stun = cause === 'pounder' ? SQUASH_TIME : STUN_TIME
  r.hurt = cause
  r.invuln = INVULN_TIME
  r.jumpBuffer = 0
  emit(race, { type: 'bump', who: r.who, cause })
}

function stepRunner(race: Race, r: Runner, stop: boolean, dt: number) {
  const { course } = race
  if (r.fall > 0) {
    r.fall -= dt
    r.vy -= GRAVITY * dt
    r.y = Math.max(FALL_Y * 3, r.y + r.vy * dt)
    if (r.fall <= 0) respawn(race, r)
    return
  }
  const finished = r.finishedAt !== null || race.phase === 'done'
  r.invuln = Math.max(0, r.invuln - dt)
  if (r.stun > 0) {
    r.stun -= dt
    if (r.stun <= 0) r.hurt = null
  }
  const stunned = r.stun > 0
  r.braking = stop && !finished && !stunned
  const target = finished || stunned || r.braking ? 0 : RUN_SPEED * r.speed
  if (r.vx < target) r.vx = Math.min(target, r.vx + ACCEL * dt)
  else {
    const decel = finished && !r.braking ? AFTER_GOAL_DECEL : r.onGround ? STOP_DECEL : AIR_STOP_DECEL
    r.vx = Math.max(target, r.vx - decel * dt)
  }

  r.jumpBuffer = Math.max(0, r.jumpBuffer - dt)
  if (r.jumpBuffer > 0 && !stunned && !finished) {
    if (r.onGround || r.air < COYOTE) {
      r.vy = JUMP_SPEED
      r.onGround = false
      r.air = COYOTE
      r.jumpBuffer = 0
      emit(race, { type: 'jump', who: r.who, air: false })
    } else if (r.airJumps > 0) {
      r.vy = AIR_JUMP_SPEED
      r.airJumps--
      r.jumpBuffer = 0
      emit(race, { type: 'jump', who: r.who, air: true })
    }
  }

  // よこに すすむ（たかい だんには ぶつかる）。
  const prevX = r.x
  r.x += r.vx * dt
  for (const span of course.spans) {
    if (span.x0 >= r.x + RUNNER_W) break
    if (span.top <= r.y + STEP_UP || span.x1 <= r.x) continue
    if (prevX + RUNNER_W <= span.x0 + 1) {
      r.x = span.x0 - RUNNER_W
      r.vx = Math.min(r.vx, 0)
    } else if (prevX >= span.x1 - 1) {
      r.x = span.x1
      r.vx = Math.max(r.vx, 0)
    }
  }
  if (r.onGround) r.stride += Math.max(0, r.x - prevX)

  // たてに うごく。
  const prevY = r.y
  r.vy -= GRAVITY * dt
  r.y += r.vy * dt
  const support = supportAt(course, r.x + 4, r.x + RUNNER_W - 4, prevY, r.vy <= 0)
  if (r.y <= support) {
    if (!r.onGround && r.vy < -420) emit(race, { type: 'land', who: r.who })
    r.y = support
    r.vy = 0
    r.onGround = true
    r.air = 0
    r.airJumps = 1
  } else {
    r.onGround = false
    r.air += dt
  }

  // ぺったん。
  for (const p of course.pounders) {
    const over = r.x + RUNNER_W > p.x + 3 && r.x < p.x + p.w - 3
    if (!over) continue
    const bottom = p.base + pounderGap(p, race.clock)
    if (bottom >= r.y + RUNNER_H) continue
    const wasUnder = prevX + RUNNER_W > p.x + 3 && prevX < p.x + p.w - 3
    if (wasUnder && (pounderDropping(p, race.clock) || bottom - RUNNER_H < p.base)) {
      // うえから おちてきた。ひだりへ おしだす。
      r.x = p.x + 3 - RUNNER_W - 1
      r.vx = 0
      if (r.invuln <= 0 && race.phase === 'run') hit(race, r, 'pounder')
    } else if (wasUnder) {
      // ジャンプして あたまを ぶつけた。
      r.y = bottom - RUNNER_H
      r.vy = Math.min(r.vy, 0)
    } else if (prevX < p.x) {
      r.x = p.x + 3 - RUNNER_W
      r.vx = Math.min(r.vx, 0)
    } else {
      r.x = p.x + p.w - 3
      r.vx = Math.max(r.vx, 0)
    }
  }

  // はち。
  if (r.invuln <= 0 && race.phase === 'run') {
    for (const bee of course.bees) {
      if (Math.abs(bee.x - (r.x + RUNNER_W / 2)) > RUNNER_W + BEE_R) continue
      const by = beeY(bee, race.clock)
      const cx = Math.max(r.x + 4, Math.min(bee.x, r.x + RUNNER_W - 4))
      const cy = Math.max(r.y + 2, Math.min(by, r.y + RUNNER_H - 4))
      if ((bee.x - cx) ** 2 + (by - cy) ** 2 < BEE_R ** 2) {
        hit(race, r, 'bee')
        r.vx = -110
        r.vy = Math.max(r.vy, 360)
        r.onGround = false
        break
      }
    }
  }

  // ごちそう。
  if (race.phase === 'run') {
    const cx = r.x + RUNNER_W / 2
    const cy = r.y + RUNNER_H / 2
    for (const spot of course.foods) {
      if (spot.x < cx - 60) continue
      if (spot.x > cx + 60) break
      if (race.eatenBy[spot.id] !== null || r.skips?.[spot.id]) continue
      if (Math.abs(spot.x - cx) < RUNNER_W / 2 + FOOD_R - 4 && Math.abs(spot.y - cy) < RUNNER_H / 2 + FOOD_R - 4) {
        race.eatenBy[spot.id] = r.who
        const points = FOODS[spot.kind].points
        r.food += points
        r.eaten++
        emit(race, { type: 'eat', who: r.who, kind: spot.kind, points, x: spot.x, y: spot.y })
      }
    }
  }

  if (r.y < FALL_Y && r.fall <= 0) {
    r.fall = FALL_TIME
    r.stun = 0
    r.hurt = null
    r.braking = false
    emit(race, { type: 'fall', who: r.who })
  }

  if (race.phase === 'run' && r.finishedAt === null && r.x + RUNNER_W / 2 >= course.goal) {
    r.finishedAt = race.t
    const other = r.who === 'player' ? race.rival : race.player
    r.place = other.finishedAt === null ? 1 : 2
    emit(race, { type: 'goal', who: r.who, place: r.place })
  }
}

// ---------------- コンピューターの はしりかた ----------------

/** v0 から vmax まで はやく なりながら d すすむ じかん。 */
function travelTime(d: number, v0: number, vmax: number): number {
  if (d <= 0) return 0
  const v = Math.max(0, Math.min(v0, vmax))
  const accelDist = (vmax * vmax - v * v) / (2 * ACCEL)
  if (d <= accelDist) return (-v + Math.sqrt(v * v + 2 * ACCEL * d)) / ACCEL
  return (vmax - v) / ACCEL + (d - accelDist) / vmax
}

/** じめんから dy の たかさまで ジャンプで あがる じかん（とどかなければ null）。 */
function riseTime(dy: number): number | null {
  const disc = JUMP_SPEED * JUMP_SPEED - 2 * GRAVITY * dy
  if (disc < 0) return null
  return (JUMP_SPEED - Math.sqrt(disc)) / GRAVITY
}

/** いまの いきおいの まま とんだら どこに おりるか。 */
function predictLanding(course: Course, r: Runner): 'ok' | 'pit' | 'wall' {
  let { x, y, vy } = r
  const vx = Math.max(r.vx, 60)
  const dt = 1 / 30
  for (let i = 0; i < 60; i++) {
    const prevY = y
    x += vx * dt
    vy -= GRAVITY * dt
    y += vy * dt
    for (const span of course.spans) {
      if (span.x0 >= x + RUNNER_W) break
      if (span.x1 > x && span.top > y + STEP_UP && span.top > prevY + STEP_UP) return 'wall'
    }
    const support = supportAt(course, x + 4, x + RUNNER_W - 4, prevY, vy <= 0)
    if (y <= support) return 'ok'
    if (y < -40) return 'pit'
  }
  return 'pit'
}

function beeHits(bee: Bee, clock: number, x: number, y: number): boolean {
  const by = beeY(bee, clock)
  const cx = Math.max(x + 4, Math.min(bee.x, x + RUNNER_W - 4))
  const cy = Math.max(y + 2, Math.min(by, y + RUNNER_H - 4))
  return (bee.x - cx) ** 2 + (by - cy) ** 2 < (BEE_R + 4) ** 2
}

/** そのまま すすむと ぺったんに つぶされそうか。 */
function pounderAhead(race: Race, r: Runner, vmax: number): boolean {
  const front = r.x + RUNNER_W
  for (const p of race.course.pounders) {
    const d = p.x + 3 - front
    if (d > 52) break
    if (d < 0) continue
    const enter = travelTime(d, r.vx, vmax)
    const exit = travelTime(d + p.w + RUNNER_W, r.vx, vmax) + .08
    for (let s = enter; s <= exit; s += .04) {
      if (pounderGap(p, race.clock + s) < RUNNER_H + 10) return true
    }
  }
  return false
}

/** はしって とおると あたりそうな はち。 */
function beeAhead(race: Race, r: Runner, vmax: number): { bee: Bee; d: number } | null {
  const front = r.x + RUNNER_W
  for (const bee of race.course.bees) {
    const d = bee.x - BEE_R - front
    if (d > 130 || d < -RUNNER_W - BEE_R * 2) continue
    if (bee.y - bee.amp - BEE_R > r.y + RUNNER_H + 4) continue
    const from = travelTime(Math.max(0, d - 4), r.vx, vmax)
    const to = travelTime(Math.max(0, d) + BEE_R * 2 + RUNNER_W + 8, r.vx, vmax) + .05
    for (let s = from; s <= to; s += 1 / 60) {
      const x = r.x + Math.max(0, travelDistance(s, r.vx, vmax))
      if (beeHits(bee, race.clock + s, x, r.y)) return { bee, d }
    }
  }
  return null
}

/** v0 から vmax まで はやく なりながら t びょう で すすむ きょり。 */
function travelDistance(t: number, v0: number, vmax: number): number {
  const v = Math.max(0, Math.min(v0, vmax))
  const accelTime = (vmax - v) / ACCEL
  if (t <= accelTime) return v * t + ACCEL * t * t / 2
  return v * accelTime + ACCEL * accelTime * accelTime / 2 + vmax * (t - accelTime)
}

/** いま ジャンプ すれば はちの うえを とびこせるか。 */
function jumpClearsBee(race: Race, r: Runner, bee: Bee): boolean {
  if (r.vx < 110) return false
  for (let s = 0; s < .9; s += 1 / 60) {
    const y = r.y + Math.max(0, JUMP_SPEED * s - GRAVITY * s * s / 2)
    if (beeHits(bee, race.clock + s, r.x + r.vx * s, y)) return false
  }
  return true
}

function spanUnder(course: Course, r: Runner): Span | undefined {
  const cx = r.x + RUNNER_W / 2
  let best: Span | undefined
  for (const span of course.spans) {
    if (span.x0 > r.x + RUNNER_W) break
    if (span.x1 >= r.x && span.x0 <= cx + RUNNER_W / 2 && Math.abs(span.top - r.y) < 1) {
      if (!best || span.x1 > best.x1) best = span
    }
  }
  return best
}

function wantsGroundJump(race: Race, r: Runner, ai: Ai): boolean {
  const { course } = race
  const front = r.x + RUNNER_W
  const v = Math.max(r.vx, 40)
  // あなの まえ。
  const cloud = course.clouds.find(c => Math.abs(c.top - r.y) < 1 && c.x0 < front && c.x1 > r.x)
  const span = cloud ? undefined : spanUnder(course, r)
  const floor = cloud ?? span
  if (floor) {
    const edge = floor.x1
    const ahead = edge - front
    const continues = cloud
      ? supportAt(course, edge, edge + RUNNER_W, r.y, true) > -Infinity
      : course.spans.some(s => s.x0 <= edge + .5 && s.x1 > edge + 1)
    if (!continues && ahead < 4 + v * .05 && ahead > -RUNNER_W + 6) return true
  }
  // のぼる だんの まえ。
  for (const s of course.spans) {
    if (s.x0 > front + 80) break
    if (s.x0 < front - 1 || s.top <= r.y + STEP_UP) continue
    const rise = riseTime(Math.min(s.top - r.y + 6, 125))
    const lead = rise === null ? 10 : rise * v + 4
    if (s.x0 - front <= lead) return true
    break
  }
  // たかい ところの ごちそう。
  const cx = r.x + RUNNER_W / 2
  for (const spot of course.foods) {
    if (spot.x < cx) continue
    if (spot.x > cx + 120) break
    if (!ai.greedy[spot.id] || race.eatenBy[spot.id] !== null) continue
    const dy = spot.y - (r.y + RUNNER_H / 2)
    if (dy < 24) continue
    const rise = riseTime(dy)
    if (rise === null) continue
    if (Math.abs(spot.x - cx - rise * v) < 8 && !course.pounders.some(p => p.x - front < 150 && p.x + p.w > r.x)) return true
  }
  return false
}

/** コンピューターが ストップを おすか きめ、ジャンプ したい ときは ジャンプを おす。 */
export function aiControl(race: Race, r: Runner, ai: Ai): boolean {
  if (r.fall > 0 || r.stun > 0 || r.finishedAt !== null) return false
  if (Math.abs(r.x - ai.lastX) > 4) {
    ai.lastX = r.x
    ai.lastMoveAt = race.clock
  } else if (race.clock - ai.lastMoveAt > 5) {
    // どうしても すすめない ときの ための ほけん。つぎの じめんへ はこぶ。
    ai.lastMoveAt = race.clock
    r.x += RUNNER_W * 2
    respawn(race, r)
    return false
  }
  if (race.clock < ai.waitUntil) return true
  const front = r.x + RUNNER_W
  const vmax = RUN_SPEED * r.speed
  if (r.onGround) {
    const edge = ai.hesitant.findIndex(x => x - front < 30 && x - front > 0)
    if (edge >= 0) {
      ai.hesitant.splice(edge, 1)
      ai.waitUntil = race.clock + .5
      return true
    }
    if (pounderAhead(race, r, vmax)) return true
    const threat = beeAhead(race, r, vmax)
    if (threat) {
      if (jumpClearsBee(race, r, threat.bee)) r.jumpBuffer = JUMP_BUFFER
      else if (threat.d < 46) return true
      return false
    }
    if (wantsGroundJump(race, r, ai)) r.jumpBuffer = JUMP_BUFFER
  } else if (r.airJumps > 0 && r.vy < 140 && predictLanding(race.course, r) !== 'ok') {
    r.jumpBuffer = JUMP_BUFFER
  }
  return false
}

// ---------------- すすめる ----------------

function scoreOf(r: Runner): Score {
  const bonus = r.place === 1 ? GOAL_BONUS : 0
  return { food: r.food, eaten: r.eaten, bonus, total: r.food + bonus, place: r.place }
}

export function raceResult(race: Race): RaceResult {
  const player = scoreOf(race.player)
  const rival = scoreOf(race.rival)
  const outcome: Outcome = player.total > rival.total ? 'win' : player.total < rival.total ? 'lose' : 'draw'
  const stars = outcome !== 'win' ? 0
    : 1 + (player.place === 1 ? 1 : 0) + (player.food >= race.course.foodTotal * GOOD_FOOD_RATIO ? 1 : 0)
  return { player, rival, outcome, stars }
}

/** ゴールまでの すすみぐあい（0〜1）。 */
export function progressOf(race: Race, r: Runner): number {
  const { start, goal } = race.course
  return Math.max(0, Math.min(1, (r.x + RUNNER_W / 2 - start) / (goal - start)))
}

export function stepRace(race: Race, dt: number): void {
  race.clock += dt
  if (race.phase === 'ready') {
    if (race.clock >= READY_TIME) {
      race.phase = 'run'
      emit(race, { type: 'go' })
    }
    return
  }
  if (race.phase === 'run') race.t += dt

  const { player, rival } = race
  if (race.phase === 'run') {
    // はなれすぎない ように、あいての はやさを すこし かえる。
    const gap = player.x - rival.x
    rival.speed = race.course.rival.speed * (gap > 420 ? 1.08 : gap < -520 ? .92 : 1)
  }
  const playerStop = race.autoPlayer ? aiControl(race, player, race.autoPlayer) : race.stop
  const rivalStop = race.phase === 'run' ? aiControl(race, rival, race.ai) : false
  stepRunner(race, player, playerStop, dt)
  stepRunner(race, rival, rivalStop, dt)
  if (race.phase !== 'run') return

  if (rival.finishedAt !== null && race.rivalDoneAt === null) race.rivalDoneAt = race.t
  if (race.endAt === null) {
    if (player.finishedAt !== null) race.endAt = race.clock + FINISH_DELAY
    else if ((race.rivalDoneAt !== null && race.t - race.rivalDoneAt >= RIVAL_GOAL_LIMIT) || race.t >= TIME_LIMIT) {
      race.endAt = race.clock
      emit(race, { type: 'timeup' })
    }
  }
  if (race.endAt !== null && race.clock >= race.endAt) {
    race.phase = 'done'
    race.result = raceResult(race)
    emit(race, { type: 'done', result: race.result })
  }
}
