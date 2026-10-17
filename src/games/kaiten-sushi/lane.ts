// かいてんレーンの うごき（え を かかない けいさん だけ）。
// おすしは ベルトに のって まわり、たべたい ネタの おきゃくさんの まえに きたら とられる。
// しんかんせんは ちゅうもんした おきゃくさんへ ちょくせつ とどける。おさら 5まいで ガチャけんが 1まい。

import { ANIMALS, PLATES_PER_GACHA, animalDef, type AnimalId, type NetaId, type PlateId } from './data'
import { CUSTOMER_BOTTOM, DROP_S, LANE_LENGTH, SEATS, TRAIN_DISH_X, TRAIN_DISH_Y, TRAIN_W, lanePoint, mod } from './layout'
import { isSparkly, isSpicy, type Recipe } from './recipe'
import { rng } from './pixel'

/** ベルトに のせられる おさらの かず。こえたら いちばん ふるい おさらを さげる。 */
export const LANE_CAPACITY = 7
/** おさらどうしの あいだ（これより ちかくには おかない）。 */
export const MIN_GAP = 45
export const SPEEDS = { slow: 14, normal: 24, fast: 40 } as const
export type SpeedId = keyof typeof SPEEDS

const GRAB_TIME = .45
const BITE_TIME = .5
const BITES = 3
const TRAIN_SPEED = 120

export type Point = { x: number; y: number }
export type Reaction = 'yummy' | 'spicy' | 'sparkle'

export type LanePlate = {
  id: number
  recipe: Recipe
  /** ベルトの きじゅんでの いち（じっさいの いちは s0 + offset）。 */
  s0: number
  /** おかれた じかん（ぽとんと おちる えんしゅつ）。 */
  born: number
  /** おきゃくさんが とった あと。 */
  grab?: { seat: number; t: number; from: Point }
}

export type CustomerPhase = 'idle' | 'waitTrain' | 'grab' | 'eat' | 'react'

export type Customer = {
  seat: number
  animal: AnimalId
  wish: NetaId | null
  wishIn: number
  lastWish: NetaId | null
  phase: CustomerPhase
  t: number
  eating: Recipe | null
  bites: number
  reaction: Reaction | null
  stack: PlateId[]
}

export type Train = {
  phase: 'idle' | 'go' | 'stop' | 'back'
  x: number
  t: number
  recipe: Recipe | null
  seat: number
}

export type Effect = { kind: 'heart' | 'sparkle' | 'puff'; x: number; y: number; vx: number; vy: number; t: number; life: number; delay: number }

export type LaneEvent =
  | { type: 'placed'; id: number }
  | { type: 'removed'; recipe: Recipe }
  | { type: 'wish'; seat: number; neta: NetaId }
  | { type: 'grab'; seat: number; recipe: Recipe }
  | { type: 'bite'; seat: number }
  | { type: 'eaten'; seat: number; recipe: Recipe; reaction: Reaction; ticket: boolean }
  | { type: 'train'; phase: 'go' | 'arrive' }

export type LaneWorld = {
  time: number
  offset: number
  speed: number
  plates: LanePlate[]
  queue: Recipe[]
  express: { recipe: Recipe; seat: number }[]
  customers: Customer[]
  train: Train
  effects: Effect[]
  /** これまでに たべた おさらの かず。 */
  eaten: number
  /** まだ まわしていない ガチャけん。 */
  tickets: number
  /** たいしょうが にぎっている のこり じかん。 */
  chef: number
  chefCooldown: number
  nextId: number
  random: () => number
  events: LaneEvent[]
}

export type LaneInit = { seed?: number; recipes?: readonly Recipe[]; eaten?: number; tickets?: number; speed?: number }

export function createLane(init: LaneInit = {}): LaneWorld {
  const random = rng(init.seed ?? 1)
  const recipes = (init.recipes ?? []).slice(0, LANE_CAPACITY)
  const world: LaneWorld = {
    time: 0,
    offset: 0,
    speed: init.speed ?? SPEEDS.normal,
    plates: recipes.map((recipe, i) => ({ id: i + 1, recipe, s0: DROP_S + 40 + (i * LANE_LENGTH) / Math.max(1, recipes.length), born: -FRESH_TIME })),
    queue: [],
    express: [],
    customers: SEATS.map((_x, seat) => ({
      seat,
      animal: ANIMALS[seat % ANIMALS.length].id,
      wish: null,
      wishIn: 2 + seat * 1.6 + random() * 2,
      lastWish: null,
      phase: 'idle',
      t: 0,
      eating: null,
      bites: 0,
      reaction: null,
      stack: [],
    })),
    train: { phase: 'idle', x: -TRAIN_W, t: 0, recipe: null, seat: 0 },
    effects: [],
    eaten: init.eaten ?? 0,
    tickets: init.tickets ?? 0,
    chef: 0,
    chefCooldown: 0,
    nextId: recipes.length + 1,
    random,
    events: [],
  }
  return world
}

/** ベルトの うえ（とられていない）の おさら。 */
export function lanePlates(world: LaneWorld): LanePlate[] {
  return world.plates.filter(p => !p.grab)
}

export function plateS(world: LaneWorld, plate: LanePlate): number {
  return mod(plate.s0 + world.offset, LANE_LENGTH)
}

/** たいしょうに おすしを わたす（じゅんばんに ベルトへ）。 */
export function addRecipe(world: LaneWorld, recipe: Recipe): void {
  world.queue.push(recipe)
}

/** しんかんせんで とどけられる おきゃくさん（その ネタを まっている ひと）。 */
export function expressSeat(world: LaneWorld, neta: NetaId): number | null {
  const reserved = new Set(world.express.map(e => e.seat))
  if (world.train.recipe) reserved.add(world.train.seat)
  const c = world.customers.find(c => c.wish === neta && c.phase === 'idle' && !reserved.has(c.seat))
  return c ? c.seat : null
}

export function sendExpress(world: LaneWorld, recipe: Recipe, seat: number): void {
  const c = world.customers[seat]
  if (!c) return
  c.phase = 'waitTrain'
  c.t = 0
  world.express.push({ recipe, seat })
}

/** いちばん たいしょうに ちかくて、まわりの おさらと はなれている ばしょ。 */
function findSpot(world: LaneWorld): number {
  const ss = lanePlates(world).map(p => plateS(world, p)).sort((a, b) => a - b)
  if (ss.length === 0) return DROP_S
  let best = DROP_S, bestD = Infinity
  for (let i = 0; i < ss.length; i++) {
    const a = ss[i], b = i + 1 < ss.length ? ss[i + 1] : ss[0] + LANE_LENGTH
    const lo = a + MIN_GAP, hi = b - MIN_GAP
    if (hi < lo) continue
    // DROP_S（と その となりの しゅう）に いちばん ちかい てん。
    for (const target of [DROP_S, DROP_S + LANE_LENGTH, DROP_S - LANE_LENGTH]) {
      const p = Math.max(lo, Math.min(hi, target))
      const d = Math.abs(p - target)
      if (d < bestD) { bestD = d; best = p }
    }
  }
  return mod(best, LANE_LENGTH)
}

function placeNext(world: LaneWorld) {
  const recipe = world.queue.shift()
  if (!recipe) return
  // いっぱいなら いちばん ふるい おさらを さげる。
  let onLane = lanePlates(world)
  while (onLane.length >= LANE_CAPACITY) {
    const oldest = onLane[0]
    const p = lanePoint(plateS(world, oldest))
    puff(world, p.x, p.y - 10)
    world.plates = world.plates.filter(x => x !== oldest)
    world.events.push({ type: 'removed', recipe: oldest.recipe })
    onLane = lanePlates(world)
  }
  const s = findSpot(world)
  const plate: LanePlate = { id: world.nextId++, recipe, s0: s - world.offset, born: world.time }
  world.plates.push(plate)
  world.chef = .8
  world.chefCooldown = .55
  const p = lanePoint(s)
  for (let i = 0; i < 4; i++) world.effects.push({ kind: 'sparkle', x: p.x + (i - 1.5) * 9, y: p.y - 18 - (i % 2) * 6, vx: 0, vy: -6, t: 0, life: .6, delay: i * .06 })
  world.events.push({ type: 'placed', id: plate.id })
}

function puff(world: LaneWorld, x: number, y: number) {
  world.effects.push({ kind: 'puff', x, y, vx: 0, vy: -4, t: 0, life: .5, delay: 0 })
}

/** ながして すぐの おすしは、ひとまわり ながめられるように ねがいごとに しない。 */
export const FRESH_TIME = 25

/** ねがいごとを きめる。ときどき ベルトに ある（しばらく まわっている）ネタを たべたくなる。 */
function chooseWish(world: LaneWorld, c: Customer): NetaId {
  const taken = new Set(world.customers.map(x => x.wish).filter(Boolean))
  const onLane = lanePlates(world)
    .filter(p => world.time - p.born >= FRESH_TIME)
    .map(p => p.recipe.neta)
    .filter(n => !taken.has(n) && n !== c.lastWish)
  if (onLane.length > 0 && world.random() < .25) return onLane[Math.floor(world.random() * onLane.length)]
  const likes = animalDef(c.animal).likes.filter(n => n !== c.lastWish)
  return likes[Math.floor(world.random() * likes.length)] ?? animalDef(c.animal).likes[0]
}

export function seatPoint(seat: number): Point {
  return { x: SEATS[seat], y: CUSTOMER_BOTTOM + 2 }
}

/** とられた おさらの いま の いち（ぴょんと はねて おきゃくさんへ）。 */
export function grabPoint(plate: LanePlate): Point & { t: number } {
  const g = plate.grab!
  const to = seatPoint(g.seat)
  const t = Math.min(1, g.t / GRAB_TIME)
  return { x: g.from.x + (to.x - g.from.x) * t, y: g.from.y + (to.y - g.from.y) * t - Math.sin(t * Math.PI) * 14, t }
}

/** ベルトの おさらの いま の いち。 */
export function platePoint(world: LaneWorld, plate: LanePlate): Point {
  if (plate.grab) return grabPoint(plate)
  const p = lanePoint(plateS(world, plate))
  return { x: p.x, y: p.y }
}

/** ほしい ネタが ちかづいて きて わくわく している。 */
export function isExcited(world: LaneWorld, c: Customer): boolean {
  if (c.phase === 'waitTrain') return true
  if (c.phase !== 'idle' || !c.wish) return false
  const sx = SEATS[c.seat]
  return lanePlates(world).some(p => {
    if (p.recipe.neta !== c.wish) return false
    const pt = lanePoint(plateS(world, p))
    return pt.far && pt.x > sx - 2 && pt.x < sx + 70
  })
}

function startEating(c: Customer, recipe: Recipe) {
  c.phase = 'eat'
  c.t = 0
  c.eating = recipe
  c.bites = 0
}

function finishEating(world: LaneWorld, c: Customer) {
  const recipe = c.eating!
  const reaction: Reaction = isSpicy(recipe) ? 'spicy' : isSparkly(recipe) ? 'sparkle' : 'yummy'
  c.phase = 'react'
  c.t = 0
  c.reaction = reaction
  c.stack.push(recipe.plate)
  c.lastWish = c.wish
  c.wish = null
  c.wishIn = 7 + world.random() * 6
  world.eaten++
  const ticket = world.eaten % PLATES_PER_GACHA === 0
  if (ticket) world.tickets++
  const x = SEATS[c.seat]
  for (let i = 0; i < 3; i++) world.effects.push({ kind: 'heart', x: x - 8 + i * 8, y: CUSTOMER_BOTTOM - 36, vx: (i - 1) * 3, vy: -16, t: 0, life: 1.3, delay: i * .18 })
  if (reaction === 'sparkle') {
    for (let i = 0; i < 6; i++) world.effects.push({ kind: 'sparkle', x: x - 14 + (i % 3) * 14, y: CUSTOMER_BOTTOM - 30 - Math.floor(i / 3) * 12, vx: 0, vy: -5, t: 0, life: .8, delay: i * .08 })
  }
  world.events.push({ type: 'eaten', seat: c.seat, recipe, reaction, ticket })
}

/** おきゃくさんが ネタを うけとれるか（しんかんせんを まっている ひとは とらない）。 */
function canGrab(c: Customer, neta: NetaId) {
  return c.phase === 'idle' && c.wish === neta
}

function stepCustomers(world: LaneWorld, dt: number) {
  for (const c of world.customers) {
    c.t += dt
    if (c.phase === 'idle' && !c.wish) {
      c.wishIn -= dt
      if (c.wishIn <= 0) {
        c.wish = chooseWish(world, c)
        world.events.push({ type: 'wish', seat: c.seat, neta: c.wish })
      }
    } else if (c.phase === 'eat') {
      if (c.t >= BITE_TIME * (c.bites + 1)) {
        c.bites++
        world.events.push({ type: 'bite', seat: c.seat })
        if (c.bites >= BITES) finishEating(world, c)
      }
    } else if (c.phase === 'react') {
      if (c.t >= (c.reaction === 'spicy' ? 2.6 : 1.8)) {
        c.phase = 'idle'
        c.reaction = null
        c.eating = null
      }
    }
  }
}

function stepGrabs(world: LaneWorld, prevOffset: number) {
  // ベルトの おさらが せきの まえを とおったら、ほしい ひとが とる。
  for (const plate of world.plates) {
    if (plate.grab) continue
    const before = lanePoint(plate.s0 + prevOffset)
    const now = lanePoint(plate.s0 + world.offset)
    if (!now.far) continue
    for (const c of world.customers) {
      const sx = SEATS[c.seat]
      // おくの レーンは みぎ → ひだり。せきの まえを よこぎったら。
      if (!(before.x >= sx && now.x < sx) && Math.abs(now.x - sx) > .01) continue
      if (!canGrab(c, plate.recipe.neta)) continue
      plate.grab = { seat: c.seat, t: 0, from: { x: now.x, y: now.y } }
      c.phase = 'grab'
      c.t = 0
      world.events.push({ type: 'grab', seat: c.seat, recipe: plate.recipe })
      break
    }
  }
}

function stepTrain(world: LaneWorld, dt: number) {
  const tr = world.train
  if (tr.phase === 'idle') {
    const next = world.express.shift()
    if (!next) return
    tr.phase = 'go'
    tr.recipe = next.recipe
    tr.seat = next.seat
    tr.x = -TRAIN_W
    tr.t = 0
    world.events.push({ type: 'train', phase: 'go' })
    return
  }
  tr.t += dt
  if (tr.phase === 'go') {
    const stopX = SEATS[tr.seat] - TRAIN_DISH_X
    tr.x = Math.min(stopX, tr.x + TRAIN_SPEED * dt)
    if (tr.x >= stopX) {
      tr.phase = 'stop'
      tr.t = 0
      world.events.push({ type: 'train', phase: 'arrive' })
    }
  } else if (tr.phase === 'stop') {
    if (tr.t >= .35 && tr.recipe) {
      const c = world.customers[tr.seat]
      const from = { x: tr.x + TRAIN_DISH_X, y: TRAIN_DISH_Y }
      world.plates.push({ id: world.nextId++, recipe: tr.recipe, s0: 0, born: world.time, grab: { seat: tr.seat, t: 0, from } })
      c.phase = 'grab'
      c.t = 0
      world.events.push({ type: 'grab', seat: tr.seat, recipe: tr.recipe })
      tr.recipe = null
    }
    if (tr.t >= .8) {
      tr.phase = 'back'
      tr.t = 0
    }
  } else if (tr.phase === 'back') {
    tr.x -= TRAIN_SPEED * 1.2 * dt
    if (tr.x <= -TRAIN_W - 4) {
      tr.phase = 'idle'
      tr.x = -TRAIN_W
    }
  }
}

/** dt びょう すすめる。 */
export function stepLane(world: LaneWorld, dt: number): void {
  dt = Math.max(0, Math.min(.1, dt))
  world.time += dt
  const prevOffset = world.offset
  world.offset = mod(world.offset + world.speed * dt, LANE_LENGTH * 1000)
  world.chef = Math.max(0, world.chef - dt)
  world.chefCooldown -= dt
  if (world.queue.length > 0 && world.chefCooldown <= 0) placeNext(world)

  stepGrabs(world, prevOffset)
  for (const plate of [...world.plates]) {
    if (!plate.grab) continue
    plate.grab.t += dt
    if (plate.grab.t >= GRAB_TIME) {
      world.plates = world.plates.filter(p => p !== plate)
      startEating(world.customers[plate.grab.seat], plate.recipe)
    }
  }
  stepCustomers(world, dt)
  stepTrain(world, dt)
  for (const e of world.effects) {
    if (e.delay > 0) { e.delay -= dt; continue }
    e.t += dt
    e.x += e.vx * dt
    e.y += e.vy * dt
  }
  world.effects = world.effects.filter(e => e.t < e.life)
}

export function drainEvents(world: LaneWorld): LaneEvent[] {
  const events = world.events
  world.events = []
  return events
}

/** タップした ところに ある おさら（てまえの ものを ゆうせん）。 */
export function plateAt(world: LaneWorld, x: number, y: number): LanePlate | null {
  let best: LanePlate | null = null, bestY = -Infinity
  for (const plate of lanePlates(world)) {
    const p = platePoint(world, plate)
    if (x < p.x - 24 || x > p.x + 24 || y < p.y - 30 || y > p.y + 10) continue
    if (p.y > bestY) { best = plate; bestY = p.y }
  }
  return best
}

/** ガチャけんを 1まい つかう。 */
export function spendTicket(world: LaneWorld): boolean {
  if (world.tickets <= 0) return false
  world.tickets--
  return true
}

/** ベルトに のっている レシピ（ほぞん用。とられた ものは ふくめない）。 */
export function laneRecipes(world: LaneWorld): Recipe[] {
  return [...lanePlates(world).map(p => p.recipe), ...world.queue].slice(-LANE_CAPACITY)
}

