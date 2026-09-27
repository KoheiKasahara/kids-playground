import * as Matter from 'matter-js'
import { KINDS, shapePoints, shapeRadius, type ItemKind, type KindId, type Material, type Vec } from './items'
import type { Placement, PropDef, StageDef } from './stages'

/**
 * ぴたっと じしゃく の せかい。
 * - ばらばらの ものは Matter.js の からだ（ころがる・たおれる・ぶつかる）。
 * - じしゃくに くっついた ものは からだを はずし、くっついた てんを ささえに した ふりこ として うごかす。
 *   くっついた てつ も すこし じしゃくに なり（誘導）、ほかの てつを ひきよせて つながる。
 * - さてつ（すなばの くろい つぶ）は かるい つぶの まとまり として べつに うごかす。
 * 画面（React）は この せかいの すうじだけを よむ。
 */

export const FPS = 60
export const DT = 1 / FPS
const STEP_MS = 1000 / FPS
/** Matter の じゅうりょく（1 で だいたい 1000 単位/秒²）。 */
export const GRAVITY = 1.15
const G = GRAVITY * 1000
const FORCE_1G = 0.001 * GRAVITY

// ---------------- じしゃくの かたち（ローカル: まんなか した が 0、した が +y） ----------------

export const MAGNET_HALF_W = 36
export const MAGNET_H = 82
export const ARM_W = 21
export const TIP_H = 15
export type PoleTip = { x0: number; x1: number; y0: number; y1: number; outer: -1 | 1 }
/** 0 = N（ひだり・あか）、1 = S（みぎ・あお）。 */
export const POLE_TIPS: readonly PoleTip[] = [
  { x0: -MAGNET_HALF_W, x1: -MAGNET_HALF_W + ARM_W, y0: -TIP_H, y1: 0, outer: -1 },
  { x0: MAGNET_HALF_W - ARM_W, x1: MAGNET_HALF_W, y0: -TIP_H, y1: 0, outer: 1 },
]
const POLE_POINTS: readonly Vec[] = [
  { x: -MAGNET_HALF_W + ARM_W / 2, y: -4 },
  { x: MAGNET_HALF_W - ARM_W / 2, y: -4 },
]
const TIP_PERIMETER = TIP_H * 2 + ARM_W

/** この きょりで 1g（おもさと おなじ ちから）に なる。 */
const LIFT_D = 50
const RANGE = 150
const P_CAP = 24
const INDUCED = 0.55
const ATTACH_GAP = 2.5
const ANCHOR_SPACING = 9.5
const MAX_CHILDREN = 2
const MAX_DEPTH = 4
const MAX_SPEED = 15
const FLOOR_RES = 2
const START_GRACE = 2.4
const WALL_T = 5

// ---------------- かた ----------------

export type Magnet = {
  x: number; y: number; vx: number; vy: number; ax: number; ay: number
  tilt: number; tiltV: number
  tx: number; ty: number
  wet: boolean
  mood: 'idle' | 'eager' | 'happy' | 'puzzled'
  moodT: number
  lookX: number; lookY: number
  /** じしゃくの ちからが どれくらい はたらいているか（0〜1、線の あかるさ）。 */
  activity: number
  /** くっついた ものの かず。 */
  load: number
  /** くっついた ときの ぷるっ（絵だけ）。 */
  jolt: number
  /** くっついた ものを ふくめた はば（ひだり・みぎ）。がめんの はしで はみださない ため。 */
  extL: number
  extR: number
}

export type Stuck = {
  /** -1 = N、-2 = S、それ以外は くっついている ものの id。 */
  parent: number
  anchor: Vec
  normal: number
  contact: Vec
  rod0: number
  len: number
  phi: number
  phiV: number
  p1: Vec
  p2: Vec
  acc: Vec
  depth: number
  children: number
  /** ポールに くっついた ときの ふちの いち（ならべる ため）。 */
  s: number
  /** くっついた じこく。 */
  at: number
}

export type SwimState = { cx: number; baseY: number; range: number; speed: number; phase: number; jelly: boolean }

export type Item = {
  id: number
  kind: ItemKind
  variant: number
  /** これを ぜんぶ あつめると クリア。 */
  target: boolean
  star: boolean
  state: 'body' | 'buried' | 'stuck'
  body: Matter.Body | null
  swim: SwimState | null
  x: number; y: number; angle: number
  /** 絵の むき（さかなが ひだりを むいているか）。 */
  flip: boolean
  /** いま かかっている じしゃくの ちから（g）。 */
  pull: number
  lifted: boolean
  stuck: Stuck | null
  snapX: number; snapY: number
  near: number
  shiinAt: number
  clinkAt: number
  home: { x: number; y: number; angle: number }
  wet: boolean
}

export type PropBody = { def: PropDef; cx: number; x0: number; x1: number; top: number; bottom: number; poly: Vec[] | null }

export type Spike = { pole: number; bx: number; by: number; dir: number; count: number; cap: number }

export type IronSand = {
  n: number
  x: Float32Array; y: Float32Array; vx: Float32Array; vy: Float32Array
  /** 0 = すなの うえ、1 = とんでいる、2 = くっついた、3 = くっついた（みえない）。 */
  st: Uint8Array
  spike: Int16Array
  slot: Int16Array
  seed: Float32Array
  spikes: Spike[]
  stuck: number
}

export type WorldEvent =
  | { type: 'stick'; id: number; kind: KindId; x: number; y: number; depth: number; combo: number; star: boolean; remaining: number }
  | { type: 'lift'; id: number; x: number; y: number }
  | { type: 'clink'; x: number; y: number; material: Material; power: number }
  | { type: 'shiin'; id: number; x: number; y: number }
  | { type: 'pop'; id: number; x: number; y: number }
  | { type: 'hooked'; id: number; x: number; y: number }
  | { type: 'splash'; x: number; y: number; power: number }
  | { type: 'grains'; n: number; x: number; y: number }
  | { type: 'clear' }

export type World = {
  stage: StageDef
  w: number
  h: number
  groundY: number
  waterY: number | null
  engine: Matter.Engine
  items: Item[]
  props: PropBody[]
  magnet: Magnet
  floorStatic: Float32Array
  floor: Float32Array
  /** かげを おとす ゆか（いれものの なかは そこ）。 */
  shadowFloor: Float32Array
  sand: IronSand | null
  events: WorldEvent[]
  time: number
  frame: number
  phase: 'play' | 'clear'
  stuckOrder: Item[]
  combo: number
  lastStickAt: number
  bodyItem: Map<number, Item>
  lastClinkAt: number
  pendingClinks: { a: Matter.Body; b: Matter.Body; x: number; y: number }[]
  rng: () => number
  /** じしゃくの てっぺんが これより うえに いかない（うえの ボタンに かくれない）。 */
  topLimit: number
  lastShiinAt: number
}

export type Result = {
  stars: number
  starsGot: number
  starTotal: number
  /** くっついた もの（しゅるいごと）。 */
  stuckKinds: KindId[]
  /** くっつかなかった もの（しゅるいごと）。 */
  otherKinds: KindId[]
}

// ---------------- こまかい けいさん ----------------

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)

export function angleDiff(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return d
}

function smoothFade(d: number, range: number): number {
  const t = clamp((range - d) / (range * 0.3), 0, 1)
  return t * t * (3 - 2 * t)
}

function mulberry(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function toMagnet(m: Magnet, px: number, py: number): Vec {
  const dx = px - m.x, dy = py - m.y
  const c = Math.cos(m.tilt), s = Math.sin(m.tilt)
  return { x: dx * c + dy * s, y: -dx * s + dy * c }
}

export function fromMagnet(m: Magnet, lx: number, ly: number): Vec {
  const c = Math.cos(m.tilt), s = Math.sin(m.tilt)
  return { x: m.x + lx * c - ly * s, y: m.y + lx * s + ly * c }
}

export function fromItem(it: Item, lx: number, ly: number): Vec {
  const c = Math.cos(it.angle), s = Math.sin(it.angle)
  return { x: it.x + lx * c - ly * s, y: it.y + lx * s + ly * c }
}

function toItem(it: Item, px: number, py: number): Vec {
  const dx = px - it.x, dy = py - it.y
  const c = Math.cos(it.angle), s = Math.sin(it.angle)
  return { x: dx * c + dy * s, y: -dx * s + dy * c }
}

/** がめんの 大きさから せかいの 大きさを きめる（たてでも よこでも ものが ちいさく なりすぎない）。 */
export function worldSize(cssW: number, cssH: number): { w: number; h: number; scale: number } {
  const scale = Math.max(0.3, Math.min(cssW / 360, cssH / 430))
  return { w: Math.min(1400, cssW / scale), h: cssH / scale, scale }
}

/** x0〜x1 の あいだで いちばん たかい ゆか（y が ちいさい ほど たかい）。 */
export function floorAt(world: World, x0: number, x1: number): number {
  const f = world.floor
  const i0 = clamp(Math.floor(x0 / FLOOR_RES), 0, f.length - 1)
  const i1 = clamp(Math.ceil(x1 / FLOOR_RES), 0, f.length - 1)
  let y = Infinity
  for (let i = i0; i <= i1; i++) if (f[i] < y) y = f[i]
  return y
}

function staticFloorAt(world: World, x: number): number {
  const f = world.floorStatic
  return f[clamp(Math.round(x / FLOOR_RES), 0, f.length - 1)]
}

/** みずの おもての たかさ（なみ つき）。 */
export function surfaceY(world: World, x: number, time = world.time): number {
  if (world.waterY === null) return -Infinity
  return world.waterY + Math.sin(x * 0.03 + time * 1.6) * 2.4 + Math.sin(x * 0.071 - time * 2.3) * 1.4
}

// ---------------- ポールの ふち ----------------

function tipPoint(tip: PoleTip, s: number): Vec {
  const outerX = tip.outer < 0 ? tip.x0 : tip.x1
  const innerX = tip.outer < 0 ? tip.x1 : tip.x0
  if (s <= TIP_H) return { x: outerX, y: tip.y0 + s }
  if (s <= TIP_H + ARM_W) return { x: outerX - tip.outer * (s - TIP_H), y: tip.y1 }
  return { x: innerX, y: tip.y1 - (s - TIP_H - ARM_W) }
}

function tipParam(tip: PoleTip, p: Vec): number {
  const outerX = tip.outer < 0 ? tip.x0 : tip.x1
  const innerX = tip.outer < 0 ? tip.x1 : tip.x0
  const dOuter = Math.abs(p.x - outerX), dInner = Math.abs(p.x - innerX), dBottom = Math.abs(p.y - tip.y1)
  if (dBottom <= dOuter && dBottom <= dInner) return TIP_H + clamp(Math.abs(p.x - outerX), 0, ARM_W)
  if (dOuter <= dInner) return clamp(p.y - tip.y0, 0, TIP_H)
  return TIP_H + ARM_W + clamp(tip.y1 - p.y, 0, TIP_H)
}

/** ふちの そとむきの むき（かどは まるく つなぐ）。 */
export function tipNormal(tip: PoleTip, s: number, round = 4): number {
  const outer = { x: tip.outer, y: 0 }
  const down = { x: 0, y: 1 }
  const inner = { x: -tip.outer, y: 0 }
  let v: Vec
  if (s < TIP_H - round) v = outer
  else if (s < TIP_H + round) {
    const t = (s - (TIP_H - round)) / (round * 2)
    v = { x: outer.x * (1 - t) + down.x * t, y: outer.y * (1 - t) + down.y * t }
  } else if (s < TIP_H + ARM_W - round) v = down
  else if (s < TIP_H + ARM_W + round) {
    const t = (s - (TIP_H + ARM_W - round)) / (round * 2)
    v = { x: down.x * (1 - t) + inner.x * t, y: down.y * (1 - t) + inner.y * t }
  } else v = inner
  return Math.atan2(v.y, v.x)
}

function closestOnTip(tip: PoleTip, p: Vec): { x: number; y: number; d: number } {
  const cx = clamp(p.x, tip.x0, tip.x1), cy = clamp(p.y, tip.y0, tip.y1)
  if (cx !== p.x || cy !== p.y) return { x: cx, y: cy, d: Math.hypot(p.x - cx, p.y - cy) }
  // なかに めりこんでいる → いちばん ちかい ふちへ（うえの ふちは じしゃくの からだ なので のぞく）。
  const dl = p.x - tip.x0, dr = tip.x1 - p.x, db = tip.y1 - p.y
  const m = Math.min(dl, dr, db)
  if (m === db) return { x: p.x, y: tip.y1, d: 0 }
  if (m === dl) return { x: tip.x0, y: p.y, d: 0 }
  return { x: tip.x1, y: p.y, d: 0 }
}

// ---------------- せかいを つくる ----------------

function rotatedHalfHeight(kind: ItemKind, angle: number): number {
  if (kind.shape.type === 'circle') return kind.shape.r
  const c = Math.cos(angle), s = Math.sin(angle)
  let m = 0
  for (const p of shapePoints(kind.shape)) m = Math.max(m, p.x * s + p.y * c)
  return m
}

function makeBody(kind: ItemKind, x: number, y: number, angle: number): Matter.Body {
  const opts: Matter.IChamferableBodyDefinition = {
    density: kind.density,
    friction: kind.friction,
    frictionStatic: 0.9,
    restitution: kind.restitution,
    frictionAir: 0.012,
    slop: 0.02,
    label: `item:${kind.id}`,
  }
  let body: Matter.Body
  const shape = kind.shape
  if (shape.type === 'rect') body = Matter.Bodies.rectangle(x, y, shape.w, shape.h, { ...opts, chamfer: shape.chamfer ? { radius: shape.chamfer } : undefined })
  else if (shape.type === 'circle') body = Matter.Bodies.circle(x, y, shape.r, opts)
  else body = Matter.Bodies.fromVertices(x, y, [shape.points.map((p) => ({ x: p.x, y: p.y }))], opts)
  // fromVertices は 重心へ ずらすので、かたち側で 重心を (0,0) に しておき いちを あわせる。
  Matter.Body.setPosition(body, { x, y })
  Matter.Body.setAngle(body, angle)
  return body
}

function rockPoly(w: number, h: number, variant: number): Vec[] {
  return variant === 1
    ? [{ x: -w / 2, y: 0 }, { x: -w * 0.36, y: -h * 0.62 }, { x: -w * 0.08, y: -h }, { x: w * 0.22, y: -h * 0.92 }, { x: w * 0.42, y: -h * 0.45 }, { x: w / 2, y: 0 }]
    : [{ x: -w / 2, y: 0 }, { x: -w * 0.3, y: -h * 0.8 }, { x: w * 0.02, y: -h }, { x: w * 0.3, y: -h * 0.78 }, { x: w / 2, y: 0 }]
}

function polyTopAt(poly: Vec[], x: number): number {
  let top = Infinity
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length]
    if ((x < a.x && x < b.x) || (x > a.x && x > b.x) || a.x === b.x) continue
    const t = (x - a.x) / (b.x - a.x)
    top = Math.min(top, a.y + (b.y - a.y) * t)
  }
  return top
}

function groundFor(stage: StageDef, h: number): number {
  if (stage.water) return h - clamp(h * 0.12, 56, 110)
  if (stage.sand) return h - clamp(h * 0.25, 104, 220)
  return h - clamp(h * 0.24, 100, 210)
}

export function createWorld(stage: StageDef, size: { w: number; h: number }, seed = 7): World {
  const w = Math.max(340, size.w), h = Math.max(420, size.h)
  const groundY = groundFor(stage, h)
  const waterY = stage.water ? Math.max(h * 0.2, 112) : null
  const engine = Matter.Engine.create({ gravity: { x: 0, y: GRAVITY, scale: 0.001 }, positionIterations: 10, velocityIterations: 8 })
  const pad = 24
  const spanX = (t: number) => pad + t * (w - pad * 2)
  const statics: Matter.Body[] = []
  const staticOpts = { isStatic: true, friction: 0.7, restitution: 0.1, label: 'static' }
  statics.push(Matter.Bodies.rectangle(w / 2, groundY + 150, w + 600, 300, staticOpts))
  statics.push(Matter.Bodies.rectangle(-30, groundY - h, 60, h * 4, staticOpts))
  statics.push(Matter.Bodies.rectangle(w + 30, groundY - h, 60, h * 4, staticOpts))
  statics.push(Matter.Bodies.rectangle(w / 2, -h - 60, w + 600, 60, staticOpts))

  const n = Math.ceil(w / FLOOR_RES) + 1
  const floorStatic = new Float32Array(n).fill(groundY)
  const shadowFloor = new Float32Array(n).fill(groundY)
  const raise = (x0: number, x1: number, y: number, shadow = y) => {
    for (let i = Math.max(0, Math.floor(x0 / FLOOR_RES)); i <= Math.min(n - 1, Math.ceil(x1 / FLOOR_RES)); i++) {
      floorStatic[i] = Math.min(floorStatic[i], y)
      shadowFloor[i] = Math.min(shadowFloor[i], shadow)
    }
  }

  const props: PropBody[] = stage.props.map((def) => {
    const cx = def.kind === 'frame' ? (def.x < 0.5 ? def.w / 2 : w - def.w / 2) : spanX(def.x)
    const x0 = cx - def.w / 2, x1 = cx + def.w / 2, top = groundY - def.h
    let poly: Vec[] | null = null
    if (def.kind === 'cup' || def.kind === 'bucket' || def.kind === 'chest') {
      const t = def.kind === 'chest' ? 7 : WALL_T
      statics.push(Matter.Bodies.rectangle(x0 + t / 2, groundY - def.h / 2, t, def.h, staticOpts))
      statics.push(Matter.Bodies.rectangle(x1 - t / 2, groundY - def.h / 2, t, def.h, staticOpts))
      statics.push(Matter.Bodies.rectangle(cx, groundY - WALL_T / 2, def.w, WALL_T, staticOpts))
      raise(x0, x1, top, groundY - WALL_T)
      raise(x0, x0 + t, top)
      raise(x1 - t, x1, top)
    } else if (def.kind === 'rock') {
      poly = rockPoly(def.w, def.h, def.variant ?? 0)
      const world = poly.map((p) => ({ x: cx + p.x, y: groundY + p.y + 1 }))
      const centre = Matter.Vertices.centre(world)
      statics.push(Matter.Bodies.fromVertices(centre.x, centre.y, [world], staticOpts))
      for (let x = x0; x <= x1; x += FLOOR_RES) raise(x, x, groundY + polyTopAt(poly, x - cx) + 1)
    } else {
      statics.push(Matter.Bodies.rectangle(cx, groundY - def.h / 2, def.w, def.h, staticOpts))
      raise(x0, x1, top)
    }
    return { def, cx, x0, x1, top, bottom: groundY, poly }
  })
  Matter.Composite.add(engine.world, statics)

  const propById = new Map(props.map((p) => [p.def.id, p]))
  const rng = mulberry(seed)
  const items: Item[] = []
  const bodyItem = new Map<number, Item>()
  stage.items.forEach((pl: Placement, id) => {
    const kind = KINDS[pl.kind]
    const angle = pl.angle ?? 0
    const prop = pl.on ? propById.get(pl.on) : undefined
    const x = prop ? prop.cx + (pl.dx ?? 0) : spanX(pl.x)
    const half = rotatedHalfHeight(kind, angle)
    let y: number
    if (prop && (prop.def.kind === 'cup' || prop.def.kind === 'bucket' || prop.def.kind === 'chest')) y = groundY - WALL_T - half
    else if (prop?.poly) y = groundY + polyTopAt(prop.poly, x - prop.cx) - half
    else if (prop) y = prop.top - half
    else y = groundY - half
    y -= (pl.lift ?? 0) + 0.4
    let swim: SwimState | null = null
    if (pl.buried !== undefined) y = groundY + pl.buried
    if (pl.float && waterY !== null) y = waterY - 2
    if (pl.swim && waterY !== null) {
      const baseY = waterY + 26 + pl.swim.depth * (groundY - waterY - 70)
      swim = { cx: x, baseY, range: pl.swim.range * (w - pad * 2), speed: pl.swim.speed, phase: pl.swim.phase ?? 0, jelly: pl.kind === 'jelly' }
      y = baseY
    }
    const item: Item = {
      id, kind, variant: (pl.variant ?? 0) % kind.variants,
      target: kind.magnetic && kind.id !== 'star', star: kind.id === 'star',
      state: pl.buried !== undefined ? 'buried' : 'body',
      body: null, swim, x, y, angle, flip: false, pull: 0, lifted: false, stuck: null, snapX: 0, snapY: 0,
      near: 0, shiinAt: -99, clinkAt: -99, home: { x, y, angle }, wet: false,
    }
    if (item.state === 'body') {
      item.body = makeBody(kind, x, y, angle)
      bodyItem.set(item.body.id, item)
      Matter.Composite.add(engine.world, item.body)
    }
    items.push(item)
  })

  const world: World = {
    stage, w, h, groundY, waterY, engine, items, props,
    magnet: {
      x: w / 2, y: Math.min(groundY - 150, h * 0.42), vx: 0, vy: 0, ax: 0, ay: 0, tilt: 0, tiltV: 0, tx: w / 2, ty: Math.min(groundY - 150, h * 0.42),
      wet: false, mood: 'idle', moodT: 0, lookX: w / 2, lookY: groundY, activity: 0, load: 0, jolt: 0, extL: MAGNET_HALF_W, extR: MAGNET_HALF_W,
    },
    floorStatic, floor: new Float32Array(floorStatic), shadowFloor,
    sand: stage.ironSand ? makeIronSand(stage, spanX, groundY, rng, w) : null,
    events: [], time: 0, frame: 0, phase: 'play', stuckOrder: [], combo: 0, lastStickAt: -9,
    bodyItem, lastClinkAt: -9, pendingClinks: [], rng, topLimit: 40, lastShiinAt: -9,
  }
  if (waterY !== null) world.magnet.ty = world.magnet.y = waterY + 30

  Matter.Events.on(engine, 'collisionStart', (event) => {
    for (const pair of event.pairs) {
      if (world.pendingClinks.length > 12) break
      const c = pair.collision.supports?.[0] ?? pair.bodyA.position
      world.pendingClinks.push({ a: pair.bodyA, b: pair.bodyB, x: c.x, y: c.y })
    }
  })
  return world
}

function makeIronSand(stage: StageDef, spanX: (t: number) => number, groundY: number, rng: () => number, w: number): IronSand {
  const patches = stage.ironSand ?? []
  const n = patches.reduce((sum, p) => sum + p.count, 0)
  const sand: IronSand = {
    n, x: new Float32Array(n), y: new Float32Array(n), vx: new Float32Array(n), vy: new Float32Array(n),
    st: new Uint8Array(n), spike: new Int16Array(n).fill(-1), slot: new Int16Array(n), seed: new Float32Array(n),
    spikes: [], stuck: 0,
  }
  let i = 0
  for (const patch of patches) {
    for (let k = 0; k < patch.count; k++, i++) {
      // まんなかに おおく、ふちに すくなく。
      const r = (rng() + rng() + rng() - 1.5) / 1.5
      sand.x[i] = clamp(spanX(patch.x) + r * patch.spread * (w - 48), 14, w - 14)
      // すなの うえと、きりくちから みえる すこし した。
      const depth = rng()
      sand.y[i] = groundY - 1.2 + depth * depth * 9
      sand.seed[i] = rng()
    }
  }
  for (let pole = 0; pole < 2; pole++) {
    const tip = POLE_TIPS[pole]
    const count = 11
    for (let k = 0; k < count; k++) {
      const s = 1.5 + (k / (count - 1)) * (TIP_PERIMETER - 3)
      const p = tipPoint(tip, s)
      const bottom = s > TIP_H - 2 && s < TIP_H + ARM_W + 2
      sand.spikes.push({ pole, bx: p.x, by: p.y, dir: tipNormal(tip, s, 9), count: 0, cap: bottom ? 11 : 7 })
    }
  }
  return sand
}

// ---------------- じしゃくの ちから ----------------

/** (px, py) での じしゃくの ちから（g）。out に むきつきで いれ、おおきさを かえす。 */
export function fieldAt(world: World, px: number, py: number, out: Vec): number {
  const m = world.magnet
  let fx = 0, fy = 0
  for (const pp of POLE_POINTS) {
    const p = fromMagnet(m, pp.x, pp.y)
    const dx = p.x - px, dy = p.y - py
    const d = Math.hypot(dx, dy)
    if (d >= RANGE || d < 1e-6) continue
    const dd = Math.max(d, 8)
    const f = (LIFT_D / dd) ** 2 * smoothFade(d, RANGE)
    fx += (dx / d) * f
    fy += (dy / d) * f
  }
  for (const it of world.stuckOrder) {
    if (!it.stuck || it.kind.id === 'fish') continue
    const strength = INDUCED ** it.stuck.depth / it.kind.hot.length
    const range = RANGE * 0.55
    for (const h of it.kind.hot) {
      const p = fromItem(it, h.x, h.y)
      const dx = p.x - px, dy = p.y - py
      const d = Math.hypot(dx, dy)
      if (d >= range || d < 1e-6) continue
      const dd = Math.max(d, 7)
      const f = strength * (LIFT_D / dd) ** 2 * smoothFade(d, range)
      fx += (dx / d) * f
      fy += (dy / d) * f
    }
  }
  let mag = Math.hypot(fx, fy)
  if (mag > P_CAP) {
    fx *= P_CAP / mag
    fy *= P_CAP / mag
    mag = P_CAP
  }
  out.x = fx
  out.y = fy
  return mag
}

// ---------------- そうさ ----------------

export function setMagnetTarget(world: World, x: number, y: number): void {
  world.magnet.tx = x
  world.magnet.ty = y
}

export function drainEvents(world: World): WorldEvent[] {
  const events = world.events
  world.events = []
  return events
}

export function remainingTargets(world: World): number {
  return world.items.filter((it) => it.target && it.state !== 'stuck').length
}

export function worldResult(world: World): Result {
  const starTotal = world.items.filter((it) => it.star).length
  const starsGot = world.items.filter((it) => it.star && it.state === 'stuck').length
  const stuckKinds: KindId[] = []
  const otherKinds: KindId[] = []
  for (const it of world.items) {
    if (it.star) continue
    const list = it.kind.magnetic ? stuckKinds : otherKinds
    if (!list.includes(it.kind.id)) list.push(it.kind.id)
  }
  return { stars: Math.max(1, Math.min(3, starsGot)), starsGot, starTotal, stuckKinds, otherKinds }
}

export function disposeWorld(world: World): void {
  Matter.Events.off(world.engine, 'collisionStart')
  Matter.Composite.clear(world.engine.world, false)
  Matter.Engine.clear(world.engine)
}

// ---------------- 1コマ すすめる ----------------

const tmp: Vec = { x: 0, y: 0 }

export function stepWorld(world: World): void {
  world.time += DT
  world.frame++
  updateMagnet(world)
  updateDynamicFloor(world)
  applyForces(world)
  Matter.Engine.update(world.engine, STEP_MS)
  afterPhysics(world)
  checkAttach(world)
  updateBuried(world)
  updateStuck(world)
  if (world.sand) updateSand(world)
  updateMood(world)
  if (world.phase === 'play' && remainingTargets(world) === 0) {
    world.phase = 'clear'
    world.events.push({ type: 'clear' })
    // やったー！ と ゆらゆら。
    world.magnet.mood = 'happy'
    world.magnet.moodT = 3.2
    world.magnet.tiltV += 5
    world.magnet.jolt = 1
  }
}

function updateMagnet(world: World) {
  const m = world.magnet
  let left = MAGNET_HALF_W, right = MAGNET_HALF_W
  for (const it of world.stuckOrder) {
    const r = shapeRadius(it.kind.shape) * 0.6
    left = Math.max(left, m.x - it.x + r)
    right = Math.max(right, it.x - m.x + r)
  }
  m.extL += (Math.min(left, 80) - m.extL) * 0.08
  m.extR += (Math.min(right, 80) - m.extR) * 0.08
  const minX = m.extL + 4, maxX = world.w - m.extR - 4
  const tx = clamp(m.tx, minX, maxX)
  const ty = clamp(m.ty, world.topLimit + MAGNET_H, world.groundY + 40)
  const wetNow = world.waterY !== null && m.y - 6 > surfaceY(world, m.x)
  if (wetNow !== m.wet) {
    if (Math.abs(m.vy) > 90) world.events.push({ type: 'splash', x: m.x, y: surfaceY(world, m.x), power: clamp(Math.abs(m.vy) / 700, 0.2, 1) })
    m.wet = wetNow
  }
  const heavy = 1 / Math.sqrt(1 + m.load * 0.015)
  const omega = (m.wet ? 8.5 : 16) * heavy
  const zeta = m.wet ? 1.05 : 0.82
  const ax = omega * omega * (tx - m.x) - 2 * zeta * omega * m.vx
  const ay = omega * omega * (ty - m.y) - 2 * zeta * omega * m.vy
  const pvx = m.vx, pvy = m.vy
  m.vx += ax * DT
  m.vy += ay * DT
  const speed = Math.hypot(m.vx, m.vy)
  const cap = m.wet ? 700 : 1600
  if (speed > cap) { m.vx *= cap / speed; m.vy *= cap / speed }
  m.x += m.vx * DT
  m.y += m.vy * DT
  if (m.x < minX) { m.x = minX; m.vx = Math.max(0, m.vx) }
  if (m.x > maxX) { m.x = maxX; m.vx = Math.min(0, m.vx) }
  // ゆかや どうぐには めりこまない（ふわっと もちあがる）。
  const lim = floorAt(world, m.x - MAGNET_HALF_W + 3, m.x + MAGNET_HALF_W - 3) - 0.5
  if (m.y > lim) {
    // ちいさな めりこみは すぐ もどし、たかい ものに のりあげる ときは すこし ずつ もちあげる。
    m.y = Math.max(lim, m.y - 9)
    if (m.vy > 0) m.vy = 0
  }
  m.ax = (m.vx - pvx) / DT
  m.ay = (m.vy - pvy) / DT
  // てで ぶらさげて いるように、うごくと すこし かたむく。おもい ほうへも かたむく。
  let torque = 0
  for (const it of world.stuckOrder) torque += (it.x - m.x) * it.kind.density * 60
  const rest = clamp(m.vx * 0.00045 + torque * 0.0006, -0.32, 0.32)
  m.tiltV += (-(m.tilt - rest) * 70 - m.tiltV * (m.wet ? 14 : 8) + clamp(m.ax, -9000, 9000) * 0.0011) * DT
  m.tilt = clamp(m.tilt + m.tiltV * DT, -0.45, 0.45)
  m.jolt *= 0.86
  if (m.moodT > 0) m.moodT -= DT
}

function updateDynamicFloor(world: World) {
  world.floor.set(world.floorStatic)
  const f = world.floor
  for (const it of world.items) {
    if (it.state !== 'body' || it.kind.magnetic || !it.body || it.swim) continue
    const b = it.body.bounds
    const cx = (b.min.x + b.max.x) / 2
    // ゆかに のっている ものだけ（うかんでいる くらげ・アヒルは のぞく）。
    if (b.max.y < staticFloorAt(world, cx) - 7) continue
    const i0 = Math.max(0, Math.floor(b.min.x / FLOOR_RES)), i1 = Math.min(f.length - 1, Math.ceil(b.max.x / FLOOR_RES))
    for (let i = i0; i <= i1; i++) if (b.min.y < f[i]) f[i] = b.min.y
  }
}

function applyForces(world: World) {
  const m = world.magnet
  let activity = 0
  let look: Item | null = null, lookD = Infinity
  for (const it of world.items) {
    const body = it.body
    if (it.state !== 'body' || !body) continue
    const mass = body.mass
    // みずの ちから（うきぶくろ）と ねばり。
    if (world.waterY !== null) {
      const r = shapeRadius(it.kind.shape)
      const sy = surfaceY(world, body.position.x)
      const sub = clamp((body.position.y + r - sy) / (r * 2), 0, 1)
      if (!it.swim && sub > 0) Matter.Body.applyForce(body, body.position, { x: 0, y: -mass * FORCE_1G * it.kind.buoyancy * sub })
      body.frictionAir = 0.012 + 0.075 * sub
      const wet = sub > 0.5
      if (wet !== it.wet) {
        if (Math.abs(body.velocity.y) > 2.2) world.events.push({ type: 'splash', x: body.position.x, y: sy, power: clamp(Math.abs(body.velocity.y) / 12, 0.1, 0.6) })
        it.wet = wet
      }
    }
    if (it.swim) swimSteer(world, it, body)
    if (!it.kind.magnetic) continue
    let total = 0
    const k = it.kind.pull / it.kind.hot.length
    for (const h of it.kind.hot) {
      const p = fromItem(it, h.x, h.y)
      const mag = fieldAt(world, p.x, p.y, tmp)
      total += mag * it.kind.pull / it.kind.hot.length
      if (mag < 0.02 || it.swim) continue
      Matter.Body.applyForce(body, p, { x: tmp.x * k * mass * FORCE_1G, y: tmp.y * k * mass * FORCE_1G })
    }
    it.pull = total
    // はじまって すぐは つれない（あんないを よんでいる あいだ）。
    if (it.swim && world.time > START_GRACE && total > 1.05) {
      it.swim = null
      world.events.push({ type: 'hooked', id: it.id, x: it.x, y: it.y })
    }
    activity = Math.max(activity, total)
    const d = Math.hypot(it.x - m.x, it.y - m.y)
    if (d < lookD) { lookD = d; look = it }
  }
  for (const it of world.items) if (it.state === 'buried') {
    const d = Math.hypot(it.x - m.x, it.y - m.y)
    if (d < lookD) { lookD = d; look = it }
  }
  m.activity += (clamp(activity / 1.2, 0, 1) - m.activity) * 0.15
  if (look && lookD < 260) {
    m.lookX += (look.x - m.lookX) * 0.2
    m.lookY += (look.y - m.lookY) * 0.2
  } else {
    m.lookX += (m.x + m.vx * 0.3 - m.lookX) * 0.1
    m.lookY += (m.y + 60 - m.lookY) * 0.1
  }
}

function swimSteer(world: World, it: Item, body: Matter.Body) {
  const sw = it.swim!
  const t = world.time * sw.speed * Math.PI * 2
  const tx = sw.cx + Math.sin(t * 0.5 + sw.phase) * sw.range * 0.5
  const ty = sw.baseY + Math.sin(t * 1.3 + sw.phase * 1.7) * (sw.jelly ? 22 : 12)
  const mass = body.mass
  const ax = clamp((tx - body.position.x) * 0.0045 - body.velocity.x * 0.22, -0.5, 0.5)
  const ay = clamp((ty - body.position.y) * 0.0045 - body.velocity.y * 0.25, -0.5, 0.5) - 1
  // じしゃくが ちかいと あばれる（でも まだ にげられる）。
  const wiggle = it.pull > 0.4 ? Math.sin(world.time * 40 + it.id) * 0.25 * it.pull : 0
  Matter.Body.applyForce(body, body.position, { x: ax * mass * FORCE_1G, y: (ay + wiggle) * mass * FORCE_1G })
  if (!sw.jelly) {
    const vx = body.velocity.x
    if (Math.abs(vx) > 0.15) it.flip = vx < 0
    const want = (it.flip ? Math.PI : 0) + clamp(body.velocity.y * 0.25, -0.35, 0.35) * (it.flip ? -1 : 1)
    Matter.Body.setAngle(body, body.angle + angleDiff(want, body.angle) * 0.08)
    Matter.Body.setAngularVelocity(body, 0)
  } else {
    Matter.Body.setAngle(body, body.angle * 0.9)
    Matter.Body.setAngularVelocity(body, 0)
  }
}

function afterPhysics(world: World) {
  for (const it of world.items) {
    const body = it.body
    if (it.state !== 'body' || !body) continue
    const v = body.velocity
    const sp = Math.hypot(v.x, v.y)
    if (sp > MAX_SPEED) Matter.Body.setVelocity(body, { x: (v.x * MAX_SPEED) / sp, y: (v.y * MAX_SPEED) / sp })
    it.x = body.position.x
    it.y = body.position.y
    it.angle = body.angle
    if (it.kind.id === 'fish' && !it.swim) it.flip = Math.cos(it.angle) < 0
    // ほとんど おこらないが、せかいの そとへ でたら もとの ばしょへ もどす。
    if (it.y > world.h + 200 || it.x < -100 || it.x > world.w + 100) {
      Matter.Body.setPosition(body, it.home)
      Matter.Body.setVelocity(body, { x: 0, y: 0 })
      Matter.Body.setAngle(body, it.home.angle)
    }
    if (it.kind.magnetic && !it.lifted && it.pull > 1 && v.y < -1.2) {
      it.lifted = true
      world.events.push({ type: 'lift', id: it.id, x: it.x, y: it.y })
    }
  }
  // ぶつかった おと（つよい ものだけ）。
  for (const c of world.pendingClinks) {
    const a = world.bodyItem.get(c.a.id), b = world.bodyItem.get(c.b.id)
    const it = a ?? b
    if (!it || world.time - world.lastClinkAt < 0.06) continue
    const rv = Math.hypot(c.a.velocity.x - c.b.velocity.x, c.a.velocity.y - c.b.velocity.y)
    if (rv < 2 || world.time - it.clinkAt < 0.15) continue
    it.clinkAt = world.time
    world.lastClinkAt = world.time
    const other = a && b ? (a === it ? b : a) : null
    const material = it.kind.material === 'metal' || other?.kind.material === 'metal' ? 'metal' : it.kind.material
    world.events.push({ type: 'clink', x: c.x, y: c.y, material, power: clamp(rv / 10, 0.1, 1) })
  }
  world.pendingClinks.length = 0
}

// ---------------- くっつく ----------------

type Hit = { d: number; parent: number; hotLocal: Vec; anchorW: Vec; s: number }

function checkAttach(world: World) {
  const m = world.magnet
  for (const it of world.items) {
    if (it.state !== 'body' || !it.kind.magnetic || it.swim || !it.body) continue
    if (it.pull < 0.3) continue
    let best: Hit | null = null
    for (const h of it.kind.hot) {
      const hw = fromItem(it, h.x, h.y)
      const ml = toMagnet(m, hw.x, hw.y)
      for (let pi = 0; pi < POLE_TIPS.length; pi++) {
        const tip = POLE_TIPS[pi]
        const c = closestOnTip(tip, ml)
        const d = c.d - it.kind.hotR
        if (d < ATTACH_GAP && (!best || d < best.d)) best = { d, parent: -1 - pi, hotLocal: h, anchorW: fromMagnet(m, c.x, c.y), s: tipParam(tip, c) }
      }
      for (const other of world.stuckOrder) {
        const st = other.stuck!
        if (other.kind.id === 'fish' || st.depth >= MAX_DEPTH || st.children >= MAX_CHILDREN) continue
        for (const oh of other.kind.hot) {
          const ow = fromItem(other, oh.x, oh.y)
          const dist = Math.hypot(hw.x - ow.x, hw.y - ow.y)
          const d = dist - other.kind.hotR - it.kind.hotR
          if (d < ATTACH_GAP && (!best || d < best.d)) {
            const k = other.kind.hotR / Math.max(dist, 1e-6)
            best = { d, parent: other.id, hotLocal: h, anchorW: { x: ow.x + (hw.x - ow.x) * k, y: ow.y + (hw.y - ow.y) * k }, s: 0 }
          }
        }
      }
    }
    if (best) attach(world, it, best)
  }
}

function attach(world: World, it: Item, hit: Hit) {
  const m = world.magnet
  const body = it.body!
  let parent = hit.parent
  let anchorW = hit.anchorW
  let s = hit.s
  let anchor: Vec = { x: 0, y: 0 }
  let normal = Math.PI / 2
  if (parent < 0) {
    const pole = -1 - parent
    const tip = POLE_TIPS[pole]
    const used = world.stuckOrder.filter((o) => o.stuck!.parent === parent).map((o) => o.stuck!.s)
    let found: number | null = null
    for (let k = 0; k < 40 && found === null; k++) {
      for (const sign of k === 0 ? [1] : [1, -1]) {
        const cand = s + sign * k * 1.25
        if (cand < 0.5 || cand > TIP_PERIMETER - 0.5) continue
        if (used.every((u) => Math.abs(u - cand) >= ANCHOR_SPACING)) { found = cand; break }
      }
    }
    if (found === null) {
      // ポールが いっぱい → いちばん ちかい くっついた ものに つなげる。
      let host: Item | null = null, hd = Infinity
      for (const o of world.stuckOrder) {
        if (o.kind.id === 'fish' || o.stuck!.depth >= MAX_DEPTH || o.stuck!.children >= MAX_CHILDREN) continue
        const d = Math.hypot(o.x - anchorW.x, o.y - anchorW.y)
        if (d < hd) { hd = d; host = o }
      }
      if (host) {
        parent = host.id
        const oh = host.kind.hot.reduce((a, b) => {
          const pa = fromItem(host!, a.x, a.y), pb = fromItem(host!, b.x, b.y)
          return Math.hypot(pa.y - anchorW.y, pa.x - anchorW.x) < Math.hypot(pb.y - anchorW.y, pb.x - anchorW.x) ? a : b
        })
        const ow = fromItem(host, oh.x, oh.y)
        const dir = Math.atan2(it.y - ow.y, it.x - ow.x)
        anchorW = { x: ow.x + Math.cos(dir) * host.kind.hotR, y: ow.y + Math.sin(dir) * host.kind.hotR }
      } else found = s
    }
    if (parent < 0) {
      s = found!
      const p = tipPoint(tip, s)
      anchor = p
      normal = tipNormal(tip, s)
      anchorW = fromMagnet(m, p.x, p.y)
    }
  }
  let depth = 1
  if (parent >= 0) {
    const host = world.items[parent]
    const local = toItem(host, anchorW.x, anchorW.y)
    anchor = local
    // ささえの てつの まんなかから そとむき。
    const oh = host.kind.hot.reduce((a, b) => (Math.hypot(a.x - local.x, a.y - local.y) < Math.hypot(b.x - local.x, b.y - local.y) ? a : b))
    normal = Math.atan2(local.y - oh.y, local.x - oh.x)
    depth = host.stuck!.depth + 1
    host.stuck!.children++
  }
  // もの側の さわる てん（ホットスポットから ささえへ むけて hotR）。
  const toward = toItem(it, anchorW.x, anchorW.y)
  const dl = Math.hypot(toward.x - hit.hotLocal.x, toward.y - hit.hotLocal.y)
  const contact = dl > 1e-6
    ? { x: hit.hotLocal.x + ((toward.x - hit.hotLocal.x) / dl) * it.kind.hotR, y: hit.hotLocal.y + ((toward.y - hit.hotLocal.y) / dl) * it.kind.hotR }
    : { x: hit.hotLocal.x, y: hit.hotLocal.y }
  let rodX = -contact.x, rodY = -contact.y
  let len = Math.hypot(rodX, rodY)
  if (len < 3) {
    // まんなかで くっつく もの（ボール・ナット）は そとむきに すこし はなす。
    rodX = Math.cos(normal - it.angle) * 3
    rodY = Math.sin(normal - it.angle) * 3
    len = 3
  }
  const rod0 = Math.atan2(rodY, rodX)
  const phi = it.angle + rod0
  const v = body.velocity
  const tangX = -Math.sin(phi), tangY = Math.cos(phi)
  const relVx = v.x * FPS - m.vx, relVy = v.y * FPS - m.vy
  const phiV = clamp((relVx * tangX + relVy * tangY) / Math.max(len, 9) * 0.6 + body.angularVelocity * FPS * 0.3, -10, 10)
  Matter.Composite.remove(world.engine.world, body)
  world.bodyItem.delete(body.id)
  it.body = null
  it.state = 'stuck'
  it.swim = null
  const oldX = it.x, oldY = it.y
  it.stuck = {
    parent, anchor, normal, contact, rod0, len, phi, phiV,
    p1: { ...anchorW }, p2: { ...anchorW }, acc: { x: 0, y: 0 }, depth, children: 0, s, at: world.time,
  }
  it.x = anchorW.x + Math.cos(phi) * len
  it.y = anchorW.y + Math.sin(phi) * len
  it.snapX = oldX - it.x
  it.snapY = oldY - it.y
  world.stuckOrder.push(it)
  m.load = world.stuckOrder.length
  m.jolt = Math.min(1, m.jolt + 0.55)
  m.mood = 'happy'
  m.moodT = 0.7
  world.combo = world.time - world.lastStickAt < 0.9 ? world.combo + 1 : 0
  world.lastStickAt = world.time
  world.events.push({
    type: 'stick', id: it.id, kind: it.kind.id, x: anchorW.x, y: anchorW.y, depth, combo: world.combo, star: it.star,
    remaining: remainingTargets(world),
  })
}

function parentFrame(world: World, st: Stuck): { x: number; y: number; angle: number } {
  if (st.parent < 0) return { x: world.magnet.x, y: world.magnet.y, angle: world.magnet.tilt }
  const p = world.items[st.parent]
  return { x: p.x, y: p.y, angle: p.angle }
}

function updateStuck(world: World) {
  for (const it of world.stuckOrder) {
    const st = it.stuck!
    const pf = parentFrame(world, st)
    const c = Math.cos(pf.angle), s = Math.sin(pf.angle)
    const ax = pf.x + st.anchor.x * c - st.anchor.y * s
    const ay = pf.y + st.anchor.x * s + st.anchor.y * c
    const accX = (ax - 2 * st.p1.x + st.p2.x) / (DT * DT)
    const accY = (ay - 2 * st.p1.y + st.p2.y) / (DT * DT)
    st.acc.x = clamp(st.acc.x * 0.55 + accX * 0.45, -25000, 25000)
    st.acc.y = clamp(st.acc.y * 0.55 + accY * 0.45, -25000, 25000)
    st.p2.x = st.p1.x; st.p2.y = st.p1.y
    st.p1.x = ax; st.p1.y = ay
    const wet = world.waterY !== null && ay > surfaceY(world, ax)
    // みずの なかでは かるく なる（つれた さかなは くちで ぶらさがって みえるように すこし おもめ）。
    const g = wet ? G * Math.max(it.kind.id === 'fish' ? 0.45 : 0.12, 1 - it.kind.buoyancy) : G
    const leff = Math.max(st.len, 9)
    const normalW = pf.angle + st.normal
    const tx = -Math.sin(st.phi), ty = Math.cos(st.phi)
    let alpha = ((0 - st.acc.x) * tx + (g - st.acc.y) * ty) / leff
    // じしゃくの ちからで そとむきに はりつこうと する（さかなは くちだけ なので ぶらんと さがる）。
    const stiff = it.kind.id === 'fish' ? 0.04 : it.kind.id === 'steelcan' ? 0.3 : 0.55
    alpha += angleDiff(normalW, st.phi) * (stiff * G / leff)
    alpha -= st.phiV * (wet ? 7 : 2.6)
    // さかなは つられても しばらく ぴちぴち。
    if (it.kind.id === 'fish') alpha += Math.sin(world.time * 17 + it.id * 2) * 26 * Math.max(0, 1 - (world.time - st.at) * 0.06)
    st.phiV += alpha * DT
    st.phi += st.phiV * DT
    const off = angleDiff(st.phi, normalW)
    // じしゃくには めりこまない。てつ どうしは ちいさいので ぐるっと たれさがっても よい。
    const lim = st.parent < 0 ? 1.5 : 2.8
    if (Math.abs(off) > lim) {
      st.phi = normalW + Math.sign(off) * lim
      st.phiV *= -0.3
    }
    foldAgainstFloor(world, it, ax, ay)
    it.angle = st.phi - st.rod0
    it.x = ax + Math.cos(st.phi) * st.len
    it.y = ay + Math.sin(st.phi) * st.len
    it.snapX *= 0.72
    it.snapY *= 0.72
  }
}

/** ぶらさがった ものが つくえに あたったら、よこへ たおれて めりこまない。 */
function foldAgainstFloor(world: World, it: Item, ax: number, ay: number) {
  const st = it.stuck!
  const pts = shapePoints(it.kind.shape)
  const lowest = (phi: number) => {
    const angle = phi - st.rod0
    const cx = ax + Math.cos(phi) * st.len, cy = ay + Math.sin(phi) * st.len
    const c = Math.cos(angle), s = Math.sin(angle)
    let pen = -Infinity
    for (const p of pts) {
      const x = cx + p.x * c - p.y * s
      const y = cy + p.x * s + p.y * c
      pen = Math.max(pen, y - floorAt(world, x - 1, x + 1))
    }
    return pen
  }
  if (lowest(st.phi) <= 0) return
  const dir = Math.cos(st.phi) >= 0 ? -1 : 1
  for (let k = 1; k <= 26; k++) {
    const cand = st.phi + dir * k * 0.06
    if (lowest(cand) <= 0) {
      st.phi = cand
      if (st.phiV * dir < 0) st.phiV *= -0.2
      return
    }
  }
  st.phi += dir * 26 * 0.06
  st.phiV = 0
}

// ---------------- すなに うまった もの ----------------

function updateBuried(world: World) {
  for (const it of world.items) {
    if (it.state !== 'buried') continue
    let total = 0
    for (const h of it.kind.hot) {
      const p = fromItem(it, h.x, h.y)
      total += fieldAt(world, p.x, p.y, tmp) * it.kind.pull / it.kind.hot.length
    }
    it.pull = total
    if (total < 0.9) continue
    // すなから ぽんっ！
    const half = rotatedHalfHeight(it.kind, it.angle)
    it.y = world.groundY - half - 1
    it.state = 'body'
    it.body = makeBody(it.kind, it.x, it.y, it.angle)
    Matter.Body.setVelocity(it.body, { x: (world.magnet.x - it.x) * 0.02, y: -4.5 })
    world.bodyItem.set(it.body.id, it)
    Matter.Composite.add(world.engine.world, it.body)
    world.events.push({ type: 'pop', id: it.id, x: it.x, y: world.groundY })
  }
}

// ---------------- さてつ ----------------

const GRAIN_D = 40

function updateSand(world: World) {
  const sand = world.sand!
  const m = world.magnet
  const poles = POLE_POINTS.map((p) => fromMagnet(m, p.x, p.y))
  const near = m.y > world.groundY - 140
  let got = 0
  for (let i = 0; i < sand.n; i++) {
    const st = sand.st[i]
    if (st >= 2) continue
    if (st === 0) {
      if (!near || Math.abs(sand.x[i] - m.x) > 90) continue
      for (const p of poles) {
        const d = Math.hypot(p.x - sand.x[i], p.y - sand.y[i])
        if (d < GRAIN_D * (0.85 + sand.seed[i] * 0.3)) {
          sand.st[i] = 1
          sand.vx[i] = (world.rng() - 0.5) * 40
          sand.vy[i] = -40 - world.rng() * 40
          break
        }
      }
      continue
    }
    // とんでいる つぶ。
    let bp = poles[0], bd = Infinity
    for (const p of poles) {
      const d = Math.hypot(p.x - sand.x[i], p.y - sand.y[i])
      if (d < bd) { bd = d; bp = p }
    }
    let ax = 0, ay = G
    if (bd < 95) {
      const f = Math.min(30, (36 / Math.max(bd, 5)) ** 2) * G
      ax += ((bp.x - sand.x[i]) / bd) * f
      ay += ((bp.y - sand.y[i]) / bd) * f
    }
    sand.vx[i] = (sand.vx[i] + ax * DT) * 0.97
    sand.vy[i] = (sand.vy[i] + ay * DT) * 0.97
    sand.x[i] += sand.vx[i] * DT
    sand.y[i] += sand.vy[i] * DT
    if (sand.vy[i] > 0 && sand.y[i] >= world.groundY - 0.3) {
      sand.y[i] = world.groundY - world.rng() * 1.2
      sand.vx[i] = sand.vy[i] = 0
      sand.st[i] = 0
      continue
    }
    const ml = toMagnet(m, sand.x[i], sand.y[i])
    for (let pole = 0; pole < 2; pole++) {
      const c = closestOnTip(POLE_TIPS[pole], ml)
      if (c.d > 3.5) continue
      let best = -1, bestD = Infinity
      sand.spikes.forEach((sp, k) => {
        if (sp.pole !== pole || sp.count >= sp.cap) return
        const tipX = sp.bx + Math.cos(sp.dir) * sp.count * 2.1
        const tipY = sp.by + Math.sin(sp.dir) * sp.count * 2.1
        const d = Math.hypot(tipX - ml.x, tipY - ml.y) + sp.count * 1.5
        if (d < bestD) { bestD = d; best = k }
      })
      if (best >= 0) {
        sand.st[i] = 2
        sand.spike[i] = best
        sand.slot[i] = sand.spikes[best].count++
      } else sand.st[i] = 3
      sand.stuck++
      got++
      break
    }
  }
  if (got) world.events.push({ type: 'grains', n: got, x: m.x, y: m.y })
}

// ---------------- かお ----------------

function updateMood(world: World) {
  const m = world.magnet
  for (const it of world.items) {
    if (it.state !== 'body' || it.kind.magnetic) continue
    const d = Math.hypot(it.x - m.x, it.y - (m.y + 6))
    if (d < 58) it.near += DT
    else it.near = Math.max(0, it.near - DT * 2)
    if (it.near > 0.45 && world.time - it.shiinAt > 5 && world.time - world.lastShiinAt > 1.4) {
      it.shiinAt = world.time
      world.lastShiinAt = world.time
      it.near = 0
      world.events.push({ type: 'shiin', id: it.id, x: it.x, y: it.y - 20 })
      if (m.mood !== 'happy' || m.moodT <= 0) { m.mood = 'puzzled'; m.moodT = 1.2 }
    }
  }
  if (m.moodT <= 0) m.mood = m.activity > 0.35 ? 'eager' : 'idle'
}

// ---------------- おてほん（タイトル・テスト用） ----------------

/** いちばん ちかい てつへ じしゃくを はこぶ。 */
export function autoPilot(world: World): void {
  const m = world.magnet
  let best: Item | null = null, bestD = Infinity
  for (const it of world.items) {
    if (!it.kind.magnetic || it.state === 'stuck') continue
    const d = Math.abs(it.x - m.x) + Math.abs(it.y - m.y) * 0.4
    if (d < bestD) { bestD = d; best = it }
  }
  if (!best) {
    setMagnetTarget(world, world.w / 2 + Math.sin(world.time * 0.7) * world.w * 0.25, world.groundY - 190 + Math.sin(world.time * 1.3) * 30)
    return
  }
  const lead = best.body ? best.body.velocity.x * 10 : 0
  const tx = best.x + lead
  const far = Math.abs(tx - m.x) > 50
  const ty = best.state === 'buried' ? world.groundY - 2 : far ? Math.min(best.y - 80, world.groundY - 90) : best.y - 6
  setMagnetTarget(world, tx, ty)
}

/** かげを おとす ゆかの たかさ。 */
export function shadowFloorAt(world: World, x: number): number {
  const f = world.shadowFloor
  return f[clamp(Math.round(x / FLOOR_RES), 0, f.length - 1)]
}

/**
 * がめんを たて↔よこ に まわした ときに、あたらしい 大きさの せかいへ うつす。
 * くっついていた もの と さてつは そのまま じしゃくに くっつけなおす（ほかの ものは さいしょの ばしょ）。
 */
export function carryOver(from: World, to: World): void {
  const m = to.magnet
  from.stuckOrder.forEach((old, k) => {
    const it = to.items[old.id]
    if (!it || it.state === 'stuck' || !it.kind.magnetic) return
    const pole = k % 2
    const tip = POLE_TIPS[pole]
    const s = TIP_H + ARM_W / 2
    const p = tipPoint(tip, s)
    const anchorW = fromMagnet(m, p.x, p.y)
    it.x = anchorW.x
    it.y = anchorW.y + 12
    it.swim = null
    if (!it.body) {
      it.body = makeBody(it.kind, it.x, it.y, it.angle)
      to.bodyItem.set(it.body.id, it)
      Matter.Composite.add(to.engine.world, it.body)
    } else {
      Matter.Body.setPosition(it.body, { x: it.x, y: it.y })
    }
    it.state = 'body'
    attach(to, it, { d: 0, parent: -1 - pole, hotLocal: it.kind.hot[0], anchorW, s })
    it.snapX = it.snapY = 0
  })
  if (from.sand && to.sand && from.sand.n === to.sand.n) {
    to.sand.st.set(from.sand.st.map((st) => (st === 1 ? 0 : st)))
    to.sand.spike.set(from.sand.spike)
    to.sand.slot.set(from.sand.slot)
    from.sand.spikes.forEach((sp, i) => { to.sand!.spikes[i].count = sp.count })
    to.sand.stuck = from.sand.stuck
  }
  if (from.phase === 'clear') to.phase = 'clear'
  to.events.length = 0
  to.combo = 0
  m.jolt = 0
}
