// どうぶつえんの うごき（DOM を つかわない 純粋な けいさん）。
// どうぶつは かってに あるき、えさが おかれると すきな どうぶつだけが たべに いく。
// よるに なると ねむり、あさに おきる。たべたあとは ときどき うんちを する。

import {
  GRID, MAX_ANIMALS, MAX_FOODS, MAX_OBJECTS, OBJECTS, SPECIES, foodName, objectDef, speciesDef,
  type FoodKind, type ObjectKind, type SpeciesId,
} from './data'
import { rng } from './pixel'
import type { Pose } from './models'

export type Placed = { id: number; kind: ObjectKind; x: number; z: number; seed: number }

export type Bubble = 'food' | 'heart' | 'question' | 'zzz' | 'note' | 'angry'

export type Animal = {
  id: number
  species: SpeciesId
  x: number
  z: number
  /** むき（ラジアン。0 で +X）。 */
  facing: number
  state: 'idle' | 'walk' | 'toFood' | 'eat' | 'sleep' | 'act' | 'react'
  pose: Pose
  /** アニメの じかん。 */
  anim: number
  timer: number
  path: [number, number][]
  food: number | null
  /** おなかの すきぐあい（0 = いっぱい、1 = ぺこぺこ）。 */
  hunger: number
  /** きげん（0〜1）。 */
  mood: number
  bubble: Bubble | null
  bubbleTime: number
  /** ぴょんと はねる たかさ。 */
  hop: number
  poopIn: number
  seed: number
}

export type Food = { id: number; kind: FoodKind; x: number; z: number; left: number; age: number; eater: number | null; drop: number }
export type Poop = { id: number; x: number; z: number; age: number }
export type Visitor = { id: number; s: number; dir: 1 | -1; speed: number; state: 'walk' | 'watch' | 'leave'; timer: number; walked: number; seed: number; alpha: number; anim: number; happy: number }

export type ZooEvent =
  | { type: 'eat'; animal: Animal; food: FoodKind }
  | { type: 'ate'; animal: Animal }
  | { type: 'act'; animal: Animal }
  | { type: 'react'; animal: Animal }
  | { type: 'poop'; x: number; z: number }
  | { type: 'friends'; x: number; z: number }
  | { type: 'morning' }
  | { type: 'night' }

export type World = {
  animals: Animal[]
  objects: Placed[]
  foods: Food[]
  poops: Poop[]
  visitors: Visitor[]
  /** けいか じかん（びょう）。 */
  time: number
  /** 1日の なかの いま（0〜1）。 */
  clock: number
  nextId: number
  rand: () => number
  events: ZooEvent[]
  night: boolean
}

/** 1日の ながさ（びょう）。 */
export const DAY_SECONDS = 300
const MAX_POOPS = 8

export type Check = { ok: true } | { ok: false; reason: string }

export function createWorld(seed = 1): World {
  return { animals: [], objects: [], foods: [], poops: [], visitors: [], time: 0, clock: .22, nextId: 1, rand: rng(seed), events: [], night: false }
}

export function isNightClock(clock: number) {
  return clock >= .7 && clock < .96
}

/** 1日の どのへんか（空の いろや ボタンの 絵に つかう）。 */
export function dayPhase(clock: number): 'morning' | 'day' | 'evening' | 'night' {
  if (clock < .18 || clock >= .96) return 'morning'
  if (clock < .56) return 'day'
  if (clock < .7) return 'evening'
  return 'night'
}

// ---------------- マスの しらべもの ----------------

export function inside(x: number, z: number) {
  return x >= 0 && z >= 0 && x < GRID && z < GRID
}

export function objectAt(world: World, tx: number, tz: number): Placed | undefined {
  return world.objects.find(o => {
    const s = objectDef(o.kind).size
    return tx >= o.x && tx < o.x + s && tz >= o.z && tz < o.z + s
  })
}

export function isWater(world: World, tx: number, tz: number) {
  return objectAt(world, tx, tz)?.kind === 'pond'
}

export function walkable(world: World, tx: number, tz: number, swims: boolean) {
  if (!inside(tx, tz)) return false
  const o = objectAt(world, tx, tz)
  if (!o) return true
  if (o.kind === 'pond') return swims
  return !objectDef(o.kind).blocks
}

export function countSpecies(world: World, id: SpeciesId) {
  return world.animals.filter(a => a.species === id).length
}

export function countKind(world: World, kind: ObjectKind) {
  return world.objects.filter(o => o.kind === kind).length
}

export function counter(id: SpeciesId) {
  return id === 'monkey' || id === 'rabbit' || id === 'penguin' ? 'ひき' : 'とう'
}

// ---------------- おく・けす ----------------

export function checkAnimal(world: World, id: SpeciesId, tx: number, tz: number): Check {
  const def = speciesDef(id)
  if (countSpecies(world, id) >= def.limit) return { ok: false, reason: `${def.name}は ${def.limit}${counter(id)} までだよ` }
  if (world.animals.length >= MAX_ANIMALS) return { ok: false, reason: `どうぶつは ぜんぶで ${MAX_ANIMALS}とう までだよ` }
  if (def.needsPond && countKind(world, 'pond') === 0) return { ok: false, reason: `${def.name}には いけが ひつようだよ。さきに いけを つくってね` }
  if (!inside(tx, tz)) return { ok: false, reason: 'かこいの なかに おいてね' }
  if (!walkable(world, tx, tz, !!def.swims)) {
    return isWater(world, tx, tz) ? { ok: false, reason: `${def.name}は いけの なかに おけないよ` } : { ok: false, reason: 'そこは ものが あって おけないよ' }
  }
  return { ok: true }
}

export function addAnimal(world: World, id: SpeciesId, tx: number, tz: number, restore?: Partial<Animal>): Animal {
  const a: Animal = {
    id: world.nextId++, species: id, x: tx + .5, z: tz + .5, facing: world.rand() * Math.PI * 2,
    state: 'idle', pose: 'idle', anim: world.rand(), timer: 1 + world.rand() * 2, path: [], food: null,
    hunger: .45, mood: .6, bubble: 'heart', bubbleTime: 1.6, hop: .6, poopIn: -1, seed: Math.floor(world.rand() * 1e6),
    ...restore,
  }
  world.animals.push(a)
  return a
}

export function checkObject(world: World, kind: ObjectKind, tx: number, tz: number): Check {
  const def = objectDef(kind)
  if (countKind(world, kind) >= def.limit) return { ok: false, reason: `${def.name}は ${def.limit}こ までだよ` }
  if (world.objects.length >= MAX_OBJECTS) return { ok: false, reason: `ものは ぜんぶで ${MAX_OBJECTS}こ までだよ` }
  for (let x = tx; x < tx + def.size; x++) for (let z = tz; z < tz + def.size; z++) {
    if (!inside(x, z)) return { ok: false, reason: def.size > 1 ? 'かこいから はみだしちゃうよ' : 'かこいの なかに おいてね' }
    if (objectAt(world, x, z)) return { ok: false, reason: 'ここには もう なにか あるよ' }
    if (world.animals.some(a => Math.floor(a.x) === x && Math.floor(a.z) === z)) return { ok: false, reason: 'どうぶつが いるよ。すこし まってね' }
  }
  return { ok: true }
}

export function addObject(world: World, kind: ObjectKind, tx: number, tz: number, seed?: number): Placed {
  const o: Placed = { id: world.nextId++, kind, x: tx, z: tz, seed: seed ?? Math.floor(world.rand() * 1e6) }
  world.objects.push(o)
  // えさや うんちが したに なったら どける。
  const s = objectDef(kind).size
  const covered = (x: number, z: number) => x >= tx && x < tx + s && z >= tz && z < tz + s
  world.poops = world.poops.filter(p => !covered(Math.floor(p.x), Math.floor(p.z)))
  if (kind !== 'pond') world.foods = world.foods.filter(f => !covered(Math.floor(f.x), Math.floor(f.z)))
  return o
}

export function removeObject(world: World, o: Placed) {
  world.objects = world.objects.filter(p => p !== o)
  if (o.kind === 'pond') {
    // いけが なくなったら、いけに いた どうぶつを りくへ。
    for (const a of world.animals) if (!walkable(world, Math.floor(a.x), Math.floor(a.z), false)) moveToLand(world, a)
  }
}

/** tx,tz の ものか どうぶつを かたづける。 */
export function removeAt(world: World, x: number, z: number): { kind: 'animal'; species: SpeciesId } | { kind: 'object'; object: ObjectKind } | null {
  const animal = animalAt(world, x, z)
  if (animal) {
    world.animals = world.animals.filter(a => a !== animal)
    releaseFood(world, animal)
    return { kind: 'animal', species: animal.species }
  }
  const o = objectAt(world, Math.floor(x), Math.floor(z))
  if (!o) return null
  removeObject(world, o)
  return { kind: 'object', object: o.kind }
}

function moveToLand(world: World, a: Animal) {
  const start: [number, number] = [Math.floor(a.x), Math.floor(a.z)]
  let best: [number, number] | null = null, bd = Infinity
  for (let x = 0; x < GRID; x++) for (let z = 0; z < GRID; z++) {
    if (!walkable(world, x, z, false)) continue
    const d = Math.hypot(x - start[0], z - start[1])
    if (d < bd) { bd = d; best = [x, z] }
  }
  if (best) { a.x = best[0] + .5; a.z = best[1] + .5; a.path = []; a.state = 'idle' }
}

/** その ばしょに いる どうぶつ（まえに いる ものを ゆうせん）。 */
export function animalAt(world: World, x: number, z: number): Animal | undefined {
  let best: Animal | undefined, bd = Infinity
  for (const a of world.animals) {
    const r = speciesDef(a.species).radius + .15
    const d = Math.hypot(a.x - x, a.z - z)
    if (d < r && d < bd) { bd = d; best = a }
  }
  return best
}

export function poopAt(world: World, x: number, z: number) {
  return world.poops.find(p => Math.hypot(p.x - x, p.z - z) < .4)
}

export function cleanPoop(world: World, poop: Poop) {
  world.poops = world.poops.filter(p => p !== poop)
}

// ---------------- えさ ----------------

export function checkFood(world: World, kind: FoodKind, x: number, z: number): Check {
  const tx = Math.floor(x), tz = Math.floor(z)
  if (!inside(tx, tz)) return { ok: false, reason: 'かこいの なかに なげてね' }
  const o = objectAt(world, tx, tz)
  if (o && objectDef(o.kind).blocks) return { ok: false, reason: 'そこには おけないよ' }
  if (o?.kind === 'pond' && kind !== 'fish') return { ok: false, reason: 'いけに なげられるのは さかなだけだよ' }
  const eaters = world.animals.filter(a => speciesDef(a.species).eats.includes(kind))
  if (!eaters.length) {
    const who = SPECIES.filter(s => s.eats.includes(kind)).map(s => s.name).slice(0, 3).join('・')
    return { ok: false, reason: `${foodName(kind)}を たべる どうぶつが いないよ（${who} など）` }
  }
  if (eaters.every(a => a.state === 'sleep')) return { ok: false, reason: 'よるは みんな ねているよ。あさまで まってね' }
  if (world.foods.length >= MAX_FOODS) return { ok: false, reason: 'えさが いっぱいだよ。たべおわるまで まってね' }
  return { ok: true }
}

export function dropFood(world: World, kind: FoodKind, x: number, z: number): Food {
  const food: Food = { id: world.nextId++, kind, x, z, left: 1, age: 0, eater: null, drop: 1 }
  world.foods.push(food)
  // すきな どうぶつが きづいて ふりむく。きらいな どうぶつは「？」。
  for (const a of world.animals) {
    if (a.state === 'sleep') continue
    const likes = speciesDef(a.species).eats.includes(kind)
    if (!likes && Math.hypot(a.x - x, a.z - z) < 3) setBubble(a, 'question', 1.6)
  }
  return food
}

function releaseFood(world: World, a: Animal) {
  for (const f of world.foods) if (f.eater === a.id) f.eater = null
  a.food = null
}

// ---------------- さわる ----------------

export function pokeAnimal(world: World, a: Animal) {
  if (a.state === 'sleep') {
    setBubble(a, 'zzz', 1.5)
    a.hop = .25
    return
  }
  releaseFood(world, a)
  a.state = 'react'
  a.timer = 1.1
  a.hop = 1
  a.path = []
  a.pose = 'act'
  a.anim = 0
  a.mood = Math.min(1, a.mood + .04)
  setBubble(a, 'note', 1.4)
  world.events.push({ type: 'react', animal: a })
}

function setBubble(a: Animal, b: Bubble, time: number) {
  a.bubble = b
  a.bubbleTime = time
}

// ---------------- みちさがし ----------------

function findPath(world: World, a: Animal, tx: number, tz: number): [number, number][] | null {
  const swims = !!speciesDef(a.species).swims
  const sx = Math.floor(a.x), sz = Math.floor(a.z)
  if (!walkable(world, tx, tz, swims)) return null
  const prev = new Int16Array(GRID * GRID).fill(-1)
  const start = sx * GRID + sz
  if (!inside(sx, sz)) return null
  prev[start] = start
  const queue = [start]
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
  while (queue.length) {
    const cur = queue.shift()!
    const cx = Math.floor(cur / GRID), cz = cur % GRID
    if (cx === tx && cz === tz) break
    for (const [dx, dz] of dirs) {
      const nx = cx + dx, nz = cz + dz
      if (!walkable(world, nx, nz, swims)) continue
      // ななめは かどを かすらない ときだけ。
      if (dx && dz && (!walkable(world, cx + dx, cz, swims) || !walkable(world, cx, cz + dz, swims))) continue
      const k = nx * GRID + nz
      if (prev[k] >= 0) continue
      prev[k] = cur
      queue.push(k)
    }
  }
  const goal = tx * GRID + tz
  if (prev[goal] < 0) return null
  const path: [number, number][] = []
  for (let k = goal; k !== start; k = prev[k]) path.push([Math.floor(k / GRID) + .5, (k % GRID) + .5])
  return path.reverse()
}

function wander(world: World, a: Animal) {
  const def = speciesDef(a.species)
  // すきな ものの そばへ いきやすい。
  const liked = world.objects.filter(o => def.likes.includes(o.kind))
  for (let tries = 0; tries < 12; tries++) {
    let tx: number, tz: number
    if (liked.length && world.rand() < .45) {
      const o = liked[Math.floor(world.rand() * liked.length)]
      const s = objectDef(o.kind).size
      tx = o.x + Math.floor(world.rand() * (s + 2)) - 1
      tz = o.z + Math.floor(world.rand() * (s + 2)) - 1
      if (o.kind === 'pond' && def.swims) { tx = o.x + Math.floor(world.rand() * s); tz = o.z + Math.floor(world.rand() * s) }
    } else {
      tx = Math.floor(a.x + (world.rand() - .5) * 8)
      tz = Math.floor(a.z + (world.rand() - .5) * 8)
    }
    const path = findPath(world, a, tx, tz)
    if (path && path.length) {
      a.path = path
      const last = path[path.length - 1]
      // マスの まんなか ばかりに ならないよう すこし ずらす。
      path[path.length - 1] = [last[0] + (world.rand() - .5) * .5, last[1] + (world.rand() - .5) * .5]
      a.state = 'walk'
      return
    }
  }
  a.timer = 1 + world.rand() * 2
}

function follow(a: Animal, dt: number, speed: number) {
  const next = a.path[0]
  if (!next) return true
  const dx = next[0] - a.x, dz = next[1] - a.z
  const d = Math.hypot(dx, dz)
  const step = speed * dt
  if (d <= step) {
    a.x = next[0]; a.z = next[1]
    a.path.shift()
    return a.path.length === 0
  }
  a.x += dx / d * step
  a.z += dz / d * step
  turnTo(a, Math.atan2(-dz, dx), dt)
  return false
}

function turnTo(a: Animal, target: number, dt: number) {
  let d = target - a.facing
  d = Math.atan2(Math.sin(d), Math.cos(d))
  a.facing += d * Math.min(1, dt * 10)
}

// ---------------- 1コマ すすめる ----------------

export function stepWorld(world: World, dt: number) {
  world.time += dt
  const wasNight = world.night
  world.clock = (world.clock + dt / DAY_SECONDS) % 1
  world.night = isNightClock(world.clock)
  if (world.night && !wasNight) world.events.push({ type: 'night' })
  if (!world.night && wasNight) world.events.push({ type: 'morning' })

  for (const f of world.foods) {
    f.age += dt
    f.drop = Math.max(0, f.drop - dt * 2.5)
  }
  // ながく だれも たべない えさは きえる。
  world.foods = world.foods.filter(f => f.left > 0 && (f.age < 40 || f.eater !== null))
  for (const p of world.poops) p.age += dt

  claimFoods(world)
  for (const a of world.animals) stepAnimal(world, a, dt)
  separate(world)
  stepVisitors(world, dt)
}

function claimFoods(world: World) {
  for (const f of world.foods) {
    if (f.eater !== null || f.drop > .2) continue
    let best: Animal | null = null, bd = Infinity
    for (const a of world.animals) {
      if (a.food !== null || a.state === 'sleep' || a.state === 'eat' || a.state === 'react') continue
      if (!speciesDef(a.species).eats.includes(f.kind)) continue
      // おなかが すいている どうぶつほど さきに くる。
      const d = Math.hypot(a.x - f.x, a.z - f.z) * (1.4 - a.hunger)
      if (d < bd) { bd = d; best = a }
    }
    if (!best) continue
    const path = findPath(world, best, Math.floor(f.x), Math.floor(f.z))
    if (!path) continue
    path.push([f.x, f.z])
    best.path = path
    best.food = f.id
    best.state = 'toFood'
    f.eater = best.id
    setBubble(best, 'food', 1.2)
  }
}

function stepAnimal(world: World, a: Animal, dt: number) {
  const def = speciesDef(a.species)
  a.anim += dt
  a.hop = Math.max(0, a.hop - dt * 2.2)
  a.hunger = Math.min(1, a.hunger + dt / 170)
  if (a.bubbleTime > 0) {
    a.bubbleTime -= dt
    if (a.bubbleTime <= 0) a.bubble = null
  }
  // おなかが すいたら ふきだしで おしえる。
  if (!a.bubble && a.hunger > .7 && a.state !== 'sleep' && a.state !== 'eat' && world.rand() < dt * .25) setBubble(a, 'food', 2.4)
  if (a.state === 'sleep' && !a.bubble && world.rand() < dt * .4) setBubble(a, 'zzz', 2)

  // きげん：すきな もの・なかま・おなかで きまる。
  let target = .5
  if (world.objects.some(o => def.likes.includes(o.kind))) target += .25
  if (world.animals.some(b => b !== a && b.species === a.species)) target += .1
  target -= Math.max(0, a.hunger - .55) * .9
  target -= Math.min(.2, world.poops.length * .025)
  a.mood += (Math.max(0, Math.min(1, target)) - a.mood) * Math.min(1, dt * .04)

  if (a.poopIn > 0) {
    a.poopIn -= dt
    if (a.poopIn <= 0 && world.poops.length < MAX_POOPS && walkable(world, Math.floor(a.x), Math.floor(a.z), false)) {
      const back = def.radius * .8
      const px = a.x - Math.cos(a.facing) * back, pz = a.z + Math.sin(a.facing) * back
      if (inside(Math.floor(px), Math.floor(pz))) {
        world.poops.push({ id: world.nextId++, x: px, z: pz, age: 0 })
        world.events.push({ type: 'poop', x: px, z: pz })
      }
    }
  }

  const swimming = def.swims && isWater(world, Math.floor(a.x), Math.floor(a.z))
  const moving = a.state === 'walk' || a.state === 'toFood'
  a.pose = a.state === 'eat' ? 'eat' : a.state === 'sleep' ? 'sleep' : a.state === 'act' || a.state === 'react' ? 'act'
    : swimming && a.species === 'penguin' ? 'swim' : moving ? 'walk' : 'idle'

  switch (a.state) {
    case 'idle': {
      a.timer -= dt
      if (a.timer > 0) break
      if (world.night) {
        a.state = 'sleep'
        a.timer = 0
        setBubble(a, 'zzz', 2)
        break
      }
      const r = world.rand()
      if (r < .16) {
        a.state = 'act'
        a.timer = 1.6
        a.anim = 0
        world.events.push({ type: 'act', animal: a })
      } else if (r < .72) wander(world, a)
      else {
        a.timer = 1.5 + world.rand() * 3
        // なかまが そばに いたら なかよし。
        const friend = world.animals.find(b => b !== a && b.species === a.species && Math.hypot(b.x - a.x, b.z - a.z) < 1.3)
        if (friend && world.rand() < .5) {
          setBubble(a, 'heart', 1.6)
          world.events.push({ type: 'friends', x: (a.x + friend.x) / 2, z: (a.z + friend.z) / 2 })
          turnTo(a, Math.atan2(-(friend.z - a.z), friend.x - a.x), 1)
        }
      }
      break
    }
    case 'walk':
      if (follow(a, dt, def.speed * (a.hunger > .8 ? .7 : 1))) { a.state = 'idle'; a.timer = 1 + world.rand() * 3 }
      if (world.night && world.rand() < dt * .5) { a.path = []; a.state = 'idle'; a.timer = 0 }
      break
    case 'toFood': {
      const food = world.foods.find(f => f.id === a.food)
      if (!food) { a.state = 'idle'; a.food = null; a.path = []; a.timer = .5; break }
      const near = Math.hypot(food.x - a.x, food.z - a.z) < .3 + def.radius * .6
      if (near || follow(a, dt, def.speed * 1.5)) {
        a.path = []
        a.state = 'eat'
        a.timer = 2.6
        a.anim = 0
        turnTo(a, Math.atan2(-(food.z - a.z), food.x - a.x), 1)
        world.events.push({ type: 'eat', animal: a, food: food.kind })
      }
      break
    }
    case 'eat': {
      const food = world.foods.find(f => f.id === a.food)
      a.timer -= dt
      if (food) food.left = Math.max(.01, a.timer / 2.6)
      if (a.timer <= 0) {
        if (food) world.foods = world.foods.filter(f => f !== food)
        a.food = null
        a.hunger = Math.max(0, a.hunger - .6)
        a.mood = Math.min(1, a.mood + .3)
        a.state = 'idle'
        a.timer = 1.2
        setBubble(a, 'heart', 2)
        if (world.rand() < .55) a.poopIn = 6 + world.rand() * 10
        world.events.push({ type: 'ate', animal: a })
      }
      break
    }
    case 'sleep':
      if (!world.night && world.rand() < dt * .6) {
        a.state = 'idle'
        a.timer = .5 + world.rand()
        a.bubble = null
      }
      break
    case 'act':
    case 'react':
      a.timer -= dt
      if (a.timer <= 0) { a.state = 'idle'; a.timer = 1 + world.rand() * 2 }
      break
  }
}

/** どうぶつどうしが かさならない ように すこし おしあう。 */
function separate(world: World) {
  const list = world.animals
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j]
    const min = (speciesDef(a.species).radius + speciesDef(b.species).radius) * .55
    const dx = b.x - a.x, dz = b.z - a.z
    const d = Math.hypot(dx, dz)
    if (d >= min || d === 0) continue
    const push = (min - d) * .08
    const nx = dx / d, nz = dz / d
    nudge(world, a, -nx * push, -nz * push)
    nudge(world, b, nx * push, nz * push)
  }
}

function nudge(world: World, a: Animal, dx: number, dz: number) {
  if (a.state === 'eat' || a.state === 'sleep') return
  const x = a.x + dx, z = a.z + dz
  if (walkable(world, Math.floor(x), Math.floor(z), !!speciesDef(a.species).swims)) { a.x = x; a.z = z }
}

// ---------------- おきゃくさん ----------------

/** かこいの そとの みち（1しゅう）の ながさ。 */
export const RING = 4 * (GRID + 1)

/** みちの うえの 位置 s → 座標。 */
export function ringPoint(s: number): [number, number] {
  const L = GRID + 1
  s = ((s % RING) + RING) % RING
  const side = Math.floor(s / L), k = s - side * L
  const lo = -.5, hi = GRID + .5
  if (side === 0) return [lo + k, hi]
  if (side === 1) return [hi, hi - k]
  if (side === 2) return [hi - k, lo]
  return [lo, lo + k]
}

/** どうぶつえんの ひょうか（★1〜5）。 */
export function zooRating(world: World) {
  if (!world.animals.length) return world.objects.length ? 1 : 0
  const kinds = new Set(world.animals.map(a => a.species)).size
  const mood = world.animals.reduce((s, a) => s + a.mood, 0) / world.animals.length
  const decor = Math.min(2.5, world.objects.length * .15)
  const score = kinds * .9 + world.animals.length * .25 + mood * 3.5 + decor - world.poops.length * .45
  return Math.max(1, Math.min(5, 1 + Math.floor(score / 2.2)))
}

function stepVisitors(world: World, dt: number) {
  const stars = zooRating(world)
  const wanted = world.night ? 0 : Math.min(10, stars * 2)
  const active = world.visitors.filter(v => v.state !== 'leave').length
  if (active < wanted && world.rand() < dt * .35) {
    world.visitors.push({
      id: world.nextId++, s: GRID / 2 + .5, dir: world.rand() < .5 ? 1 : -1, speed: .45 + world.rand() * .25,
      state: 'walk', timer: 0, walked: 0, seed: Math.floor(world.rand() * 1e6), alpha: 0, anim: world.rand(), happy: 0,
    })
  }
  for (const v of world.visitors) {
    v.anim += dt
    v.happy = Math.max(0, v.happy - dt)
    if (v.state === 'leave') { v.alpha -= dt * 1.5; v.s += v.dir * v.speed * dt; continue }
    v.alpha = Math.min(1, v.alpha + dt * 1.5)
    if (v.state === 'watch') {
      v.timer -= dt
      if (v.timer <= 0) v.state = 'walk'
      continue
    }
    v.s += v.dir * v.speed * dt
    v.walked += v.speed * dt
    if (world.rand() < dt * .2) {
      const [x, z] = ringPoint(v.s)
      const near = world.animals.some(a => Math.hypot(a.x - x, a.z - z) < 3)
      if (near) { v.state = 'watch'; v.timer = 2 + world.rand() * 3; v.happy = 1.6 }
    }
    if (v.walked > RING * .9 || world.night) v.state = 'leave'
  }
  world.visitors = world.visitors.filter(v => v.alpha > 0 || v.state !== 'leave')
}

/** ほかの モジュールで つかう かんたんな ながめ。 */
export function drainEvents(world: World) {
  const list = world.events
  world.events = []
  return list
}

export { OBJECTS, SPECIES }
