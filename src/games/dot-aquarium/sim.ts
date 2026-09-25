// すいそうの なかの うごき。画面を さわらない 純粋な けいさん だけにして テストしやすく する。
// ざひょうは ドット（よこ W・たて H）。z は おくゆき（0 おく 〜 1 てまえ）。

import {
  DECOR, FOODS, MAX_CREATURES, MAX_DECOR, SPECIES, decorDef, foodDef, hiki, speciesDef,
  type DecorKind, type FoodKind, type SpeciesId,
} from './data'
import { rng } from './pixel'

/** みずめんの たかさ（うえは くうき と ふた）。 */
export const SURFACE = 14
/** すなの あつみ。 */
export const SAND = 36
/** 1にちの ながさ（びょう）。 */
export const DAY_SECONDS = 360

export type CreatureState = 'swim' | 'rest' | 'eat' | 'flee' | 'hide' | 'puff' | 'breathe' | 'wave'

export type Creature = {
  id: number
  species: SpeciesId
  x: number; y: number; z: number
  vx: number; vy: number
  /** むいている ほう（1 みぎ / -1 ひだり）。 */
  face: 1 | -1
  /** ふりむきの アニメ（0 → 1 で おわり）。 */
  turn: number
  tx: number; ty: number; tz: number
  /** つぎの めあてを きめるまでの まち じかん。 */
  wait: number
  hunger: number
  mood: number
  state: CreatureState
  timer: number
  /** およぎの アニメの すすみ。 */
  phase: number
  /** ハリセンボンの ふくらみ（0〜1）。 */
  puff: number
  /** チンアナゴの でている りょう（0〜1）。 */
  emerge: number
  /** チンアナゴの あな。 */
  homeX: number
  /** むれの なかでの ばしょ。 */
  offset: [number, number, number]
  /** おなかいっぱいを つたえたか。 */
  full: boolean
  /** すきな ものの ちかくで やすむ。 */
  near: number | null
  seed: number
  /** ねむっている。 */
  sleep: boolean
}

export type Decor = {
  id: number
  kind: DecorKind
  x: number
  z: number
  seed: number
  /** シャコガイの ひらき・たからばこの ふた（0〜1）。 */
  open: number
  /** ひらいている のこり じかん。 */
  hold: number
  timer: number
  pearl: boolean
}

export type Food = {
  id: number
  kind: FoodKind
  x: number; y: number; z: number
  vx: number
  settled: boolean
  age: number
  wob: number
}

export type Moss = { id: number; x: number; y: number; r: number; a: number; seed: number }

export type WorldEvent =
  | { type: 'eat'; c: Creature; food: FoodKind; x: number; y: number }
  | { type: 'full'; c: Creature }
  | { type: 'happy'; c: Creature }
  | { type: 'puff'; c: Creature }
  | { type: 'hide'; c: Creature }
  | { type: 'breathe'; c: Creature }
  | { type: 'wave'; c: Creature }
  | { type: 'pearl'; d: Decor }
  | { type: 'clam'; d: Decor }
  | { type: 'chest'; d: Decor }
  | { type: 'settle'; food: Food }
  | { type: 'moss' }
  | { type: 'night' }
  | { type: 'morning' }

export type World = {
  W: number
  H: number
  creatures: Creature[]
  decor: Decor[]
  foods: Food[]
  moss: Moss[]
  clock: number
  night: boolean
  time: number
  pearls: number
  /** のこった えさの よごれ（コケが はえやすく なる）。 */
  dirt: number
  mossTimer: number
  nextId: number
  rand: () => number
  events: WorldEvent[]
}

export function createWorld(seed = 1, W = 400, H = 225): World {
  return {
    W, H, creatures: [], decor: [], foods: [], moss: [], clock: .2, night: false, time: 0, pearls: 0, dirt: 0,
    mossTimer: 50, nextId: 1, rand: rng(seed), events: [],
  }
}

// ---------------- かたち ----------------

export function sandTop(world: World) {
  return world.H - SAND
}

/** おくゆき z の ところの すなの ひょうめん。 */
export function floorY(world: World, z: number) {
  return sandTop(world) + 4 + Math.max(0, Math.min(1, z)) * (SAND - 10)
}

/** タップした たかさ から おくゆきを きめる（すなより うえなら まんなか）。 */
export function depthAt(world: World, y: number) {
  const top = sandTop(world) + 4
  if (y < top - 2) return .5
  return Math.max(0, Math.min(1, (y - top) / (SAND - 10)))
}

function clamp(v: number, a: number, b: number) {
  return v < a ? a : v > b ? b : v
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

/** いきものの からだの おおきさ（ふくらんだ ハリセンボンは おおきい）。 */
export function bodySize(c: Creature) {
  const def = speciesDef(c.species)
  if (c.species === 'puffer') return { w: lerp(def.w, 24, c.puff), h: lerp(def.h, 22, c.puff) }
  return { w: def.w, h: def.h }
}

/** およげる はんい。 */
function bounds(world: World, c: Creature) {
  const { w, h } = bodySize(c)
  return {
    x0: w / 2 + 2, x1: world.W - w / 2 - 2,
    y0: SURFACE + h / 2 + 3, y1: floorY(world, c.z) - h / 2 - 1,
  }
}

// ---------------- かぞえる ----------------

export function countSpecies(world: World, id: SpeciesId) {
  return world.creatures.filter(c => c.species === id).length
}

export function countDecor(world: World, kind: DecorKind) {
  return world.decor.filter(d => d.kind === kind).length
}

export type Check = { ok: true } | { ok: false; reason: string }

export function checkCreature(world: World, id: SpeciesId, x: number, y: number): Check {
  const def = speciesDef(id)
  if (countSpecies(world, id) >= def.limit) return { ok: false, reason: `${def.name}は ${hiki(def.limit)} までだよ` }
  if (world.creatures.length >= MAX_CREATURES) return { ok: false, reason: `いきものは ぜんぶで ${hiki(MAX_CREATURES)} までだよ` }
  if (x < 0 || x > world.W || y > world.H) return { ok: false, reason: 'すいそうの なかを タップしてね' }
  if (y < SURFACE - 2) return { ok: false, reason: 'みずの なかを タップしてね' }
  if (id === 'eel') {
    const z = depthAt(world, y)
    const near = world.creatures.some(c => c.species === 'eel' && Math.abs(c.homeX - x) < 9 && Math.abs(c.z - z) < .35)
    if (near) return { ok: false, reason: 'となりの チンアナゴと ちかすぎるよ' }
    if (x < 6 || x > world.W - 6) return { ok: false, reason: 'もうすこし まんなかに してね' }
  }
  return { ok: true }
}

export function checkDecor(world: World, kind: DecorKind, x: number, y: number): Check {
  const def = decorDef(kind)
  if (countDecor(world, kind) >= def.limit) return { ok: false, reason: `${def.name}は ${def.limit}こ までだよ` }
  if (world.decor.length >= MAX_DECOR) return { ok: false, reason: `ものは ぜんぶで ${MAX_DECOR}こ までだよ` }
  if (x < 0 || x > world.W || y < 0 || y > world.H) return { ok: false, reason: 'すいそうの なかを タップしてね' }
  const cx = clamp(x, def.w / 2 + 1, world.W - def.w / 2 - 1)
  const z = depthAt(world, y)
  const thin = (k: DecorKind) => k === 'kelp' || k === 'bubbler'
  for (const d of world.decor) {
    const od = decorDef(d.kind)
    const k = thin(kind) || thin(d.kind) ? .22 : .36
    if (Math.abs(d.z - z) < .4 && Math.abs(d.x - cx) < (def.w + od.w) * k) return { ok: false, reason: `${od.name}と ちかすぎるよ。すこし はなしてね` }
  }
  return { ok: true }
}

export function checkFood(world: World, kind: FoodKind): Check {
  const name = foodDef(kind).name
  if (!world.creatures.some(c => speciesDef(c.species).eats.includes(kind))) return { ok: false, reason: `${name}を たべる いきものが いないよ` }
  if (world.foods.length > 36) return { ok: false, reason: 'えさが いっぱい。たべおわるまで まってね' }
  return { ok: true }
}

// ---------------- いれる・だす ----------------

export function addCreature(world: World, id: SpeciesId, x: number, y: number, extra: Partial<Creature> = {}): Creature {
  const def = speciesDef(id)
  const r = world.rand
  const z = def.zone === 'floor' || def.zone === 'sand' ? depthAt(world, y) : clamp(.2 + r() * .7, 0, 1)
  const c: Creature = {
    id: world.nextId++, species: id, x, y, z, vx: 0, vy: 0, face: r() < .5 ? 1 : -1, turn: 1,
    tx: x, ty: y, tz: z, wait: .5 + r(), hunger: .35, mood: .6, state: 'swim', timer: 0, phase: r() * 10, puff: 0,
    emerge: id === 'eel' ? 0 : 1, homeX: x, offset: [r() * 2 - 1, r() * 2 - 1, r() * 2 - 1], full: false, near: null,
    seed: (r() * 65535) | 0, sleep: false,
    ...extra,
  }
  const b = bounds(world, c)
  c.x = clamp(c.x, b.x0, b.x1)
  c.homeX = id === 'eel' ? clamp(c.homeX, 6, world.W - 6) : c.x
  if (def.zone === 'floor') c.y = b.y1
  else if (def.zone === 'sand') c.y = floorY(world, c.z)
  else c.y = clamp(c.y, b.y0, b.y1)
  c.tx = c.x; c.ty = c.y; c.tz = c.z
  world.creatures.push(c)
  return c
}

export function addDecor(world: World, kind: DecorKind, x: number, y: number, seed?: number): Decor {
  const def = decorDef(kind)
  const d: Decor = {
    id: world.nextId++, kind, x: clamp(x, def.w / 2 + 1, world.W - def.w / 2 - 1), z: depthAt(world, y),
    seed: seed ?? ((world.rand() * 65535) | 0), open: 0, hold: 0, timer: 8 + world.rand() * 20, pearl: false,
  }
  world.decor.push(d)
  return d
}

export function removeCreature(world: World, c: Creature) {
  world.creatures = world.creatures.filter(x => x !== c)
}

export function removeDecor(world: World, d: Decor) {
  world.decor = world.decor.filter(x => x !== d)
  for (const c of world.creatures) if (c.near === d.id) c.near = null
}

export function dropFood(world: World, kind: FoodKind, x: number) {
  const def = foodDef(kind)
  const r = world.rand
  const made: Food[] = []
  for (let i = 0; i < def.count; i++) {
    const spread = kind === 'flake' ? 12 : kind === 'pellet' ? 7 : 0
    const f: Food = {
      id: world.nextId++, kind, x: clamp(x + (r() * 2 - 1) * spread, 4, world.W - 4), y: SURFACE + 1 + r() * 2, z: .25 + r() * .6,
      vx: (r() * 2 - 1) * 3, settled: false, age: -r() * .4, wob: r() * 6,
    }
    world.foods.push(f)
    made.push(f)
  }
  return made
}

// ---------------- さがす ----------------

/** いきものの あたりの はこ（ゆびでも おしやすく すこし ひろい）。 */
export function creatureBox(world: World, c: Creature) {
  if (c.species === 'eel') {
    const base = floorY(world, c.z)
    const top = base - speciesDef('eel').h * Math.max(.25, c.emerge)
    return { x0: c.homeX - 7, x1: c.homeX + 7, y0: top - 4, y1: base + 2 }
  }
  const { w, h } = bodySize(c)
  const pad = 4
  return { x0: c.x - w / 2 - pad, x1: c.x + w / 2 + pad, y0: c.y - h / 2 - pad, y1: c.y + h / 2 + pad }
}

export function creatureAt(world: World, x: number, y: number): Creature | null {
  let best: Creature | null = null
  let bestD = Infinity
  for (const c of world.creatures) {
    const b = creatureBox(world, c)
    if (x < b.x0 || x > b.x1 || y < b.y0 || y > b.y1) continue
    // ちいさい ものを さきに（サメの まえの ネオンも つかめる）。
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2
    const d = Math.hypot(x - cx, y - cy) + (b.x1 - b.x0) * .2 - c.z * 4
    if (d < bestD) { bestD = d; best = c }
  }
  return best
}

export function decorBox(world: World, d: Decor) {
  const def = decorDef(d.kind)
  const base = floorY(world, d.z)
  return { x0: d.x - def.w / 2 - 2, x1: d.x + def.w / 2 + 2, y0: base - def.h - 2, y1: base + 3 }
}

export function decorAt(world: World, x: number, y: number): Decor | null {
  let best: Decor | null = null
  for (const d of world.decor) {
    const b = decorBox(world, d)
    if (x < b.x0 || x > b.x1 || y < b.y0 || y > b.y1) continue
    if (!best || d.z > best.z) best = d
  }
  return best
}

// ---------------- さわる ----------------

/** いきものを タップ。 */
export function poke(world: World, c: Creature) {
  c.sleep = false
  switch (c.species) {
    case 'puffer':
      c.state = 'puff'; c.timer = 3.2
      world.events.push({ type: 'puff', c })
      break
    case 'eel':
      c.state = 'hide'; c.timer = 3
      world.events.push({ type: 'hide', c })
      break
    case 'crab':
      c.state = 'wave'; c.timer = 1.4
      world.events.push({ type: 'wave', c })
      break
    default:
      c.vy -= 14
      c.vx += c.face * 10
      c.mood = Math.min(1, c.mood + .05)
      world.events.push({ type: 'happy', c })
  }
}

/** ガラスを コンコン。ちかくの いきものが びっくりする。 */
export function startle(world: World, x: number, y: number) {
  let n = 0
  for (const c of world.creatures) {
    const cx = c.species === 'eel' ? c.homeX : c.x
    const cy = c.species === 'eel' ? floorY(world, c.z) - 10 : c.y
    const d = Math.hypot(cx - x, cy - y)
    if (c.species === 'eel') {
      if (Math.abs(cx - x) < 46) { c.state = 'hide'; c.timer = 2.5 + world.rand(); n++ }
      continue
    }
    if (d > 64 || c.species === 'jelly') continue
    c.sleep = false
    if (c.species === 'puffer') { c.state = 'puff'; c.timer = 2.5; world.events.push({ type: 'puff', c }); n++; continue }
    const k = (64 - d) / 64
    const dx = (cx - x) / (d || 1), dy = (cy - y) / (d || 1)
    c.vx += dx * 40 * k * (c.species === 'shark' || c.species === 'turtle' ? .3 : 1)
    c.vy += dy * 30 * k * (c.species === 'shark' || c.species === 'turtle' ? .3 : 1)
    c.state = 'flee'; c.timer = .7
    const b = bounds(world, c)
    c.tx = clamp(c.x + dx * 50, b.x0, b.x1)
    c.ty = clamp(c.y + dy * 36, b.y0, b.y1)
    c.wait = 0
    n++
  }
  return n
}

/** シャコガイ・たからばこを タップ。 */
export function touchDecor(world: World, d: Decor): 'pearl' | 'closed' | 'chest' | null {
  if (d.kind === 'clam') {
    if (d.open > .5 && d.pearl) {
      d.pearl = false
      world.pearls++
      world.events.push({ type: 'pearl', d })
      return 'pearl'
    }
    return 'closed'
  }
  if (d.kind === 'chest' && d.open < .3) {
    openChest(world, d)
    return 'chest'
  }
  return null
}

function openChest(world: World, d: Decor) {
  d.hold = 1.6
  d.timer = 16 + world.rand() * 14
  world.events.push({ type: 'chest', d })
}

/** コケを ふく。ふけた かず。 */
export function wipe(world: World, x: number, y: number, radius = 14) {
  let n = 0
  for (const m of world.moss) {
    if (Math.hypot(m.x - x, m.y - y) > m.r + radius) continue
    m.a -= .4
    n++
  }
  world.moss = world.moss.filter(m => m.a > .08)
  return n
}

// ---------------- じかん ----------------

export type Phase = 'morning' | 'day' | 'evening' | 'night'

export function dayPhase(clock: number): Phase {
  if (clock < .06) return 'morning'
  if (clock < .62) return 'day'
  if (clock < .7) return 'evening'
  return 'night'
}

/** あかるさ（0 よる 〜 1 ひる）。 */
export function daylight(clock: number) {
  if (clock < .06) return lerp(.3, 1, clock / .06)
  if (clock < .62) return 1
  if (clock < .7) return lerp(1, .2, (clock - .62) / .08)
  if (clock < .95) return .2
  return lerp(.2, .3, (clock - .95) / .05)
}

/** つぎの あさ / よる へ。 */
export function skipTime(world: World) {
  world.clock = world.night ? .999 : .699
  stepWorld(world, .5)
}

// ---------------- ひょうか ----------------

export function mossLevel(world: World) {
  return world.moss.reduce((s, m) => s + m.a, 0)
}

/** にんきの ほし（0〜5）。 */
export function rating(world: World) {
  if (!world.creatures.length) return 0
  const kinds = new Set(world.creatures.map(c => c.species)).size
  const decorKinds = new Set(world.decor.map(d => d.kind)).size
  const mood = world.creatures.reduce((s, c) => s + c.mood, 0) / world.creatures.length
  const score = 1 + Math.min(2, kinds / 3) + Math.min(1, decorKinds / 5) + (mood > .72 ? 1 : mood > .55 ? .5 : 0) - Math.min(1.5, mossLevel(world) * .3)
  return clamp(Math.round(score), 1, 5)
}

// ---------------- うごき ----------------

export function drainEvents(world: World) {
  const e = world.events
  world.events = []
  return e
}

function nearest<T extends { x: number; y: number }>(list: readonly T[], x: number, y: number, ok: (t: T) => boolean) {
  let best: T | null = null, bd = Infinity
  for (const t of list) {
    if (!ok(t)) continue
    const d = Math.hypot(t.x - x, t.y - y)
    if (d < bd) { bd = d; best = t }
  }
  return best
}

/** くちの いち。 */
export function mouth(c: Creature) {
  const { w } = bodySize(c)
  return { x: c.x + c.face * w * .42, y: c.y + (c.species === 'turtle' ? 1 : 0) }
}

function pickTarget(world: World, c: Creature) {
  const def = speciesDef(c.species)
  const r = world.rand
  c.tz = clamp(c.z + (r() * 2 - 1) * .35, 0, 1)
  const b = bounds(world, { ...c, z: c.tz })
  c.near = null
  // すきな ものの ちかくへ。
  const liked = world.decor.filter(d => def.likes.includes(d.kind))
  if (liked.length && r() < (c.species === 'clown' || c.species === 'seahorse' ? .65 : .4)) {
    const d = liked[Math.floor(r() * liked.length)]
    const dd = decorDef(d.kind)
    const top = floorY(world, d.z) - dd.h
    c.near = d.id
    c.tz = clamp(d.z + (c.species === 'clown' && d.kind === 'anemone' ? -.02 : (r() - .5) * .2), 0, 1)
    if (c.species === 'clown' && d.kind === 'anemone') { c.tx = d.x + (r() - .5) * 8; c.ty = top + 5 }
    else if (c.species === 'seahorse' && d.kind === 'kelp') { c.tx = d.x + (r() < .5 ? -4 : 4); c.ty = top + dd.h * (.3 + r() * .4) }
    else { c.tx = d.x + (r() - .5) * dd.w * 1.2; c.ty = top - 4 - r() * 22 }
    c.tx = clamp(c.tx, b.x0, b.x1)
    c.ty = clamp(c.ty, b.y0, bounds(world, { ...c, z: c.tz }).y1)
    return
  }
  // ぶくぶくで あそぶ。
  const bub = world.decor.filter(d => d.kind === 'bubbler')
  if (bub.length && def.small && r() < .12) {
    const d = bub[Math.floor(r() * bub.length)]
    c.tx = clamp(d.x + (r() - .5) * 4, b.x0, b.x1)
    c.ty = b.y0 + 4 + r() * 20
    c.tz = d.z
    return
  }
  const band = c.sleep ? [.6, 1] : def.zone === 'high' ? [0, .45] : def.zone === 'mid' ? [.18, .8] : def.zone === 'low' ? [.5, 1] : [0, 1]
  if (c.species === 'shark') {
    // サメは はしから はしへ ゆったり。
    c.tx = c.x < world.W / 2 ? lerp(world.W * .7, b.x1, r()) : lerp(b.x0, world.W * .3, r())
  } else {
    const reach = c.sleep ? 40 : 170
    c.tx = clamp(c.x + (r() * 2 - 1) * reach, b.x0, b.x1)
  }
  c.ty = lerp(b.y0, b.y1, lerp(band[0], band[1], r()))
}

function steer(c: Creature, tx: number, ty: number, speed: number, dt: number, accel = 1.6) {
  const dx = tx - c.x, dy = ty - c.y
  const d = Math.hypot(dx, dy)
  const slow = Math.min(1, d / 18)
  const want = d > .5 ? speed * slow : 0
  const ax = d > .01 ? (dx / d) * want : 0, ay = d > .01 ? (dy / d) * want * .8 : 0
  const k = Math.min(1, dt * accel)
  c.vx += (ax - c.vx) * k
  c.vy += (ay - c.vy) * k
  return d
}

function faceTo(c: Creature, vx: number) {
  if (Math.abs(vx) < 1.2) return
  const f = vx > 0 ? 1 : -1
  if (f !== c.face) { c.face = f; c.turn = 0 }
}

function eats(c: Creature, f: Food) {
  return speciesDef(c.species).eats.includes(f.kind)
}

function eatFood(world: World, c: Creature, f: Food) {
  world.foods = world.foods.filter(x => x !== f)
  c.hunger = Math.max(0, c.hunger - foodDef(f.kind).fill)
  c.state = 'eat'
  c.timer = .45
  c.mood = Math.min(1, c.mood + .04)
  world.events.push({ type: 'eat', c, food: f.kind, x: f.x, y: f.y })
  if (c.hunger < .12 && !c.full) {
    c.full = true
    world.events.push({ type: 'full', c })
  }
}

function stepEel(world: World, c: Creature, dt: number) {
  const base = floorY(world, c.z)
  let want = world.night ? .35 : 1
  if (c.state === 'hide') {
    want = 0
    c.timer -= dt
    if (c.timer <= 0) c.state = 'swim'
  }
  // おおきな いきものが ちかいと ひっこむ。
  for (const o of world.creatures) {
    if ((o.species === 'shark' || o.species === 'turtle') && Math.abs(o.x - c.homeX) < 30 && o.y > base - 50) want = 0
  }
  c.emerge += clamp(want - c.emerge, -dt * 3, dt * .7)
  c.x = c.homeX
  c.y = base - speciesDef('eel').h * c.emerge * .5
  // ながれてくる フレークを ぱくっ。
  if (c.emerge > .5 && c.hunger > .12) {
    const head = base - speciesDef('eel').h * c.emerge
    for (const f of world.foods) {
      if (!eats(c, f)) continue
      if (Math.abs(f.x - c.homeX) < 14 && f.y > head - 12 && f.y < head + 8) { eatFood(world, c, f); break }
    }
  }
  if (c.state === 'eat') { c.timer -= dt; if (c.timer <= 0) c.state = 'swim' }
}

function stepJelly(world: World, c: Creature, dt: number) {
  const b = bounds(world, c)
  // ぷかっ と おしあげて、ゆっくり しずむ。
  const cycle = 2.6
  const before = c.phase % cycle
  const after = (c.phase + dt) % cycle
  if (after < before) c.vy -= 12 + world.rand() * 4
  c.vy += 3.2 * dt
  c.vy *= 1 - dt * .9
  c.wait -= dt
  if (c.wait <= 0) { c.tx = lerp(b.x0, b.x1, world.rand()); c.wait = 6 + world.rand() * 6 }
  c.vx += ((c.tx - c.x) * .03 - c.vx) * Math.min(1, dt * .6)
  if (c.y < b.y0 + 8) c.vy = Math.max(c.vy, 2)
  if (c.y > b.y1 - 6) c.vy = Math.min(c.vy, -6)
  // フレークを からだで キャッチ。
  if (c.hunger > .12) {
    for (const f of world.foods) {
      if (f.kind === 'flake' && Math.abs(f.x - c.x) < 8 && Math.abs(f.y - c.y) < 10) { eatFood(world, c, f); break }
    }
  }
  if (c.state === 'eat') { c.timer -= dt; if (c.timer <= 0) c.state = 'swim' }
}

function stepSwimmer(world: World, c: Creature, dt: number, shark: Creature | undefined, leader: Creature | undefined) {
  const def = speciesDef(c.species)
  const b = bounds(world, c)
  const speed = def.speed * (c.sleep ? .35 : 1)

  // こわい サメ。
  let scared = false
  if (shark && shark !== c && c.state !== 'hide') {
    const d = Math.hypot(shark.x - c.x, shark.y - c.y)
    if (d < 46) {
      if (def.small) {
        scared = true
        c.state = 'flee'; c.timer = .6
        c.tx = clamp(c.x + (c.x - shark.x) / (d || 1) * 60, b.x0, b.x1)
        c.ty = clamp(c.y + (c.y - shark.y) / (d || 1) * 40, b.y0, b.y1)
      } else if (c.species === 'puffer' && c.state !== 'puff') {
        c.state = 'puff'; c.timer = 2.5
        world.events.push({ type: 'puff', c })
      }
    }
  }

  // ごはん。
  let food: Food | null = null
  if (c.hunger > .2 && c.state !== 'flee' && c.state !== 'puff') {
    const floorOnly = def.zone === 'floor'
    food = nearest(world.foods, c.x, c.y, f => eats(c, f) && (!floorOnly || f.settled || f.y > b.y1 - 16))
  }

  if (c.state === 'puff') {
    c.timer -= dt
    c.puff = Math.min(1, c.puff + dt * 5)
    c.vx *= 1 - Math.min(1, dt * 3)
    c.vy = c.vy * (1 - Math.min(1, dt * 3)) - 2 * dt
    if (c.timer <= 0) c.state = 'swim'
  } else {
    c.puff = Math.max(0, c.puff - dt * 1.2)
  }

  if (c.state === 'eat' || c.state === 'wave') {
    c.timer -= dt
    c.vx *= 1 - Math.min(1, dt * 4)
    c.vy *= 1 - Math.min(1, dt * 4)
    if (c.timer <= 0) c.state = 'swim'
  } else if (c.state === 'flee') {
    c.timer -= dt
    steer(c, c.tx, c.ty, speed * 2.4, dt, 3)
    if (c.timer <= 0) { c.state = 'swim'; c.wait = 0 }
  } else if (c.state === 'breathe') {
    // ウミガメが いきつぎ。
    const d = steer(c, c.tx, b.y0, speed * 1.3, dt)
    if (d < 4) { world.events.push({ type: 'breathe', c }); c.state = 'swim'; c.wait = 0 }
  } else if (c.state !== 'puff') {
    if (food) {
      c.near = null
      // えさの ほうを むいた まま、くちを えさに あわせる（むきが ぱたぱた かわらない）。
      const want: 1 | -1 = Math.abs(food.x - c.x) < 3 ? c.face : food.x > c.x ? 1 : -1
      if (want !== c.face) { c.face = want; c.turn = 0 }
      const m = mouth(c)
      const dx = food.x - m.x, dy = food.y - m.y
      steer(c, c.x + dx, c.y + dy, speed * 1.7, dt, 2.4)
      c.tz = food.z
      // おおきな からだでも すなの うえの えさに くちが とどく。
      if (Math.hypot(dx, Math.max(0, Math.abs(dy) - bodySize(c).h * .45)) < 4 + def.w * .12) eatFood(world, c, food)
    } else if (leader && leader !== c) {
      // むれに ついていく。
      const tx = leader.x - leader.face * (7 + (c.offset[0] + 1) * 9), ty = leader.y + c.offset[1] * 9
      const d = Math.hypot(tx - c.x, ty - c.y)
      steer(c, tx, ty, speed * (d > 30 ? 1.5 : 1.05), dt, 2.2)
      c.tz = clamp(leader.z + c.offset[2] * .15, 0, 1)
    } else {
      const d = steer(c, c.tx, c.ty, speed * (c.species === 'shark' ? 1 : .8), dt, c.species === 'shark' ? .7 : 1.6)
      c.timer += dt
      if (d < 5) {
        // ついたら すこし ゆらゆら やすむ。
        c.wait -= dt
        c.vy += Math.sin(c.phase * 2) * dt * 2
      }
      if ((d < 5 && c.wait <= 0) || c.timer > 14) {
        c.timer = 0
        if (c.species === 'turtle' && !c.sleep && world.rand() < .15) { c.state = 'breathe'; c.tx = c.x + c.face * 40 }
        else {
          pickTarget(world, c)
          c.wait = c.near !== null ? 2.5 + world.rand() * 5 : c.species === 'shark' ? .3 : c.sleep ? 3 + world.rand() * 4 : .3 + world.rand() * 2.2
        }
      }
    }
  }

  // おくゆきも ゆっくり。
  c.z += clamp(c.tz - c.z, -dt * .25, dt * .25)

  c.x += c.vx * dt
  c.y += c.vy * dt
  if (c.x < b.x0) { c.x = b.x0; c.vx = Math.abs(c.vx) * .3 }
  if (c.x > b.x1) { c.x = b.x1; c.vx = -Math.abs(c.vx) * .3 }
  const b2 = bounds(world, c)
  if (c.y < b2.y0) { c.y = b2.y0; c.vy = Math.abs(c.vy) * .3 }
  if (c.y > b2.y1) { c.y = b2.y1; c.vy = -Math.abs(c.vy) * .3 }
  if (!food && c.state !== 'eat' && c.state !== 'puff') faceTo(c, c.vx)
  return scared
}

function stepCrab(world: World, c: Creature, dt: number) {
  const def = speciesDef('crab')
  const b = bounds(world, c)
  let food: Food | null = null
  if (c.hunger > .2) food = nearest(world.foods, c.x, c.y, f => eats(c, f) && (f.settled || f.y > b.y1 - 14))
  if (c.state === 'eat' || c.state === 'wave') {
    c.timer -= dt
    c.vx = 0
    if (c.timer <= 0) c.state = 'swim'
  } else if (food) {
    const dx = food.x - c.x
    c.vx += (Math.sign(dx) * def.speed * 1.4 - c.vx) * Math.min(1, dt * 4)
    c.tz = food.z
    if (Math.abs(dx) < 6 && Math.abs(c.z - food.z) < .2) eatFood(world, c, food)
  } else {
    c.wait -= dt
    if (c.wait <= 0) {
      if (Math.abs(c.tx - c.x) < 3) {
        c.wait = 1 + world.rand() * 3
        const liked = world.decor.filter(d => def.likes.includes(d.kind))
        if (liked.length && world.rand() < .45) {
          const d = liked[Math.floor(world.rand() * liked.length)]
          c.tx = d.x + (world.rand() - .5) * decorDef(d.kind).w
          c.tz = clamp(d.z + .12, 0, 1)
        } else {
          c.tx = clamp(c.x + (world.rand() * 2 - 1) * 90, b.x0, b.x1)
          c.tz = clamp(c.z + (world.rand() * 2 - 1) * .3, 0, 1)
        }
      }
      const dx = c.tx - c.x
      c.vx += ((Math.abs(dx) < 2 ? 0 : Math.sign(dx) * def.speed * (c.sleep ? .3 : 1)) - c.vx) * Math.min(1, dt * 5)
    } else {
      c.vx *= 1 - Math.min(1, dt * 6)
    }
  }
  c.z += clamp(c.tz - c.z, -dt * .3, dt * .3)
  c.x = clamp(c.x + c.vx * dt, b.x0, b.x1)
  c.y = bounds(world, c).y1
  c.vy = 0
}

function moodTarget(world: World, c: Creature, scared: boolean) {
  const def = speciesDef(c.species)
  const liked = new Set(world.decor.filter(d => def.likes.includes(d.kind)).map(d => d.kind)).size
  let m = .45 + liked * .15
  if (c.hunger < .5) m += .15
  else if (c.hunger > .8) m -= .25
  m -= Math.min(.3, mossLevel(world) * .05)
  if (scared) m -= .25
  return clamp(m, 0, 1)
}

function stepFood(world: World, f: Food, dt: number) {
  f.age += dt
  if (f.age < 0) return
  if (f.settled) return
  const def = foodDef(f.kind)
  // フレークは すこし うかんでから ひらひら。
  const sink = f.kind === 'flake' && f.age < 1.2 ? def.sink * .25 : def.sink
  f.y += sink * dt
  f.x += (f.vx + (f.kind === 'shrimp' ? 0 : Math.sin(f.age * 2.4 + f.wob) * 4)) * dt
  f.vx *= 1 - Math.min(1, dt * .5)
  f.x = clamp(f.x, 3, world.W - 3)
  const floor = floorY(world, f.z)
  if (f.y >= floor - 1) {
    f.y = floor - 1
    f.settled = true
    f.age = 0
    world.events.push({ type: 'settle', food: f })
  }
}

export function stepWorld(world: World, dt: number) {
  world.time += dt
  const wasNight = world.night
  world.clock = (world.clock + dt / DAY_SECONDS) % 1
  world.night = world.clock >= .7
  if (world.night !== wasNight) world.events.push({ type: world.night ? 'night' : 'morning' })

  // えさ。
  for (const f of world.foods) stepFood(world, f, dt)
  const before = world.foods.length
  world.foods = world.foods.filter(f => !(f.settled && f.age > 30))
  world.dirt = Math.min(3, world.dirt + (before - world.foods.length) * .15)
  world.dirt = Math.max(0, world.dirt - dt * .004)

  const shark = world.creatures.find(c => c.species === 'shark')
  const neons = world.creatures.filter(c => c.species === 'neon')
  const leader = neons.length > 1 ? neons[0] : undefined

  for (const c of world.creatures) {
    const def = speciesDef(c.species)
    c.phase += dt * (c.state === 'flee' ? 2.2 : c.sleep ? .5 : 1)
    c.turn = Math.min(1, c.turn + dt * 5)
    c.hunger = Math.min(1, c.hunger + dt / (world.night ? 300 : 150))
    if (c.hunger > .4) c.full = false
    const sleepy = world.night && c.species !== 'jelly' && c.species !== 'shark'
    if (sleepy !== c.sleep && c.state === 'swim') { c.sleep = sleepy; c.wait = 0; c.timer = 99 }
    let scared = false
    if (c.species === 'eel') stepEel(world, c, dt)
    else if (c.species === 'jelly') {
      stepJelly(world, c, dt)
      c.x += c.vx * dt
      c.y += c.vy * dt
      const b = bounds(world, c)
      c.x = clamp(c.x, b.x0, b.x1)
      c.y = clamp(c.y, b.y0, b.y1)
    } else if (c.species === 'crab') stepCrab(world, c, dt)
    else scared = stepSwimmer(world, c, dt, shark, def.school && c !== leader && c.state !== 'flee' ? leader : undefined)
    const target = moodTarget(world, c, scared)
    c.mood += (target - c.mood) * Math.min(1, dt * .06)
    if (!c.sleep && c.mood > .78 && c.state === 'swim' && world.rand() < dt / 40) world.events.push({ type: 'happy', c })
  }

  // シャコガイ・たからばこ。
  for (const d of world.decor) {
    if (d.kind === 'clam') {
      if (d.hold > 0) {
        d.hold -= dt
        d.open = Math.min(1, d.open + dt * 1.5)
        if (d.hold <= 0) d.timer = 30 + world.rand() * 25
      } else {
        d.open = Math.max(0, d.open - dt * 1.2)
        d.timer -= dt
        if (d.timer <= 0) {
          d.hold = 8
          d.pearl = world.rand() < .75
          world.events.push({ type: 'clam', d })
        }
      }
    } else if (d.kind === 'chest') {
      if (d.hold > 0) { d.hold -= dt; d.open = Math.min(1, d.open + dt * 5) }
      else {
        d.open = Math.max(0, d.open - dt * 1.5)
        d.timer -= dt
        if (d.timer <= 0) openChest(world, d)
      }
    }
  }

  // ガラスの コケ。
  for (const m of world.moss) m.a = Math.min(1, m.a + dt / 25)
  world.mossTimer -= dt * (1 + world.dirt)
  if (world.mossTimer <= 0) {
    world.mossTimer = 45 + world.rand() * 35
    if (world.moss.length < 8 && world.creatures.length) {
      const r = world.rand
      world.moss.push({ id: world.nextId++, x: 10 + r() * (world.W - 20), y: SURFACE + 12 + r() * (world.H - SURFACE - 26), r: 6 + r() * 7, a: .05, seed: (r() * 9999) | 0 })
      world.events.push({ type: 'moss' })
    }
  }
}

/** がめんの おおきさが かわったら、ならびを のばしたり ちぢめたり。 */
export function resizeWorld(world: World, W: number, H: number) {
  if (W === world.W && H === world.H) return
  const sx = W / world.W
  const oldTop = world.H - SAND, newTop = H - SAND
  const sy = (newTop - SURFACE) / Math.max(1, oldTop - SURFACE)
  world.W = W
  world.H = H
  for (const c of world.creatures) {
    c.x *= sx; c.tx *= sx; c.homeX *= sx
    c.y = SURFACE + (c.y - SURFACE) * sy
    c.ty = SURFACE + (c.ty - SURFACE) * sy
  }
  for (const d of world.decor) d.x *= sx
  for (const f of world.foods) { f.x *= sx; f.y = SURFACE + (f.y - SURFACE) * sy }
  for (const m of world.moss) { m.x *= sx; m.y = SURFACE + (m.y - SURFACE) * sy }
}

export { SPECIES, DECOR, FOODS }
