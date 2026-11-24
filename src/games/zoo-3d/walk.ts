// 歩くモードの人（カメラ）の動き。Three.js に依存しない純粋なロジック。
// - 前後のボタン・キーで歩き、左右で向きを変える。地面をタップすると、そこへ自動で歩く。
// - 柵・獣舎・木・看板にはぶつかって、すべるように横へよける（柵の中には入れない）。
// - ふれあい広場（walkIn）だけは入口から中へ入れる。
// - エリアのふちの門をくぐると、隣のエリアへ移る。

import { headingTo, wrapAngle } from './behavior'
import { distance, houseCircle, onPath, segmentHitsCircle, signPosition, type Area, type AreaExit, type Circle, type Enclosure, type Vec2 } from './zooMap'

/** 子どもの目の高さ（m）。 */
export const EYE_HEIGHT = 1.3
export const WALK_SPEED = 2.6
/** 向きを変える速さ（ラジアン/s）。 */
export const TURN_SPEED = 1.8
/** 人の体の半径（m）。 */
export const BODY = 0.3
/** 柵の外側の、近づける限界（柵からの距離）。 */
const FENCE_GAP = 0.25
/** 入口（ふれあい広場）の半分の幅（m）。 */
export const GATE_HALF = 0.9
/** 歩くモードは視野を広げ、足もとの柵も見えるようにする（度）。 */
export const WALK_FOV_EXTRA = 10
/** 見上げ・見下ろしの限界（ラジアン）。 */
export const PITCH_LIMIT = 0.5

export type AutoWalk = {
  x: number
  z: number
  /** 着いたら見る点（動物・展示場）。 */
  look?: Vec2
  /** 障害物をよける回り方（左右）。決めたら着くまで変えない。 */
  side?: number
  stuck: number
  /** 途中で通る点（ふれあい広場の入口）。 */
  via?: Vec2[]
}

export type VisitorState = {
  x: number
  z: number
  /** 向き（ラジアン、+z が 0）。 */
  yaw: number
  /** 見上げる角度（ラジアン、正で上）。 */
  pitch: number
  speed: number
  /** 歩いた距離（頭のゆれに使う）。 */
  walked: number
  auto?: AutoWalk
}

export type WalkInput = {
  /** 前へ 1、後ろへ -1。 */
  forward: number
  /** 左へ 1、右へ -1。 */
  turn: number
}

export function createVisitor(area: Area, from?: AreaExit): VisitorState {
  // 来たエリアへの門の内側に、エリアの中を向いて立つ。なければ手前の入口から
  const gate = from ?? area.exits[0]
  const inward = wrapAngle(gate.heading + Math.PI)
  return {
    x: gate.at.x + Math.sin(inward) * 2.4,
    z: gate.at.z + Math.cos(inward) * 2.4,
    yaw: inward,
    pitch: -0.12,
    speed: 0,
    walked: 0,
  }
}

const blockerCache = new WeakMap<Area, Circle[]>()

/** 人がぶつかる、動かない物（柵の中に入れない展示場・獣舎・木・看板・広場の花だん）。 */
export function visitorBlockers(area: Area): Circle[] {
  const cached = blockerCache.get(area)
  if (cached) return cached
  const list: Circle[] = []
  for (const e of area.enclosures) {
    if (!e.walkIn) list.push({ x: e.center.x, z: e.center.z, r: e.radius + FENCE_GAP })
    const house = houseCircle(e)
    if (house) list.push(house)
    const sign = signPosition(e)
    list.push({ x: sign.x, z: sign.z, r: 0.2 })
    if (e.walkIn) {
      // 入口の柱
      for (const s of [-1, 1]) {
        const a = e.front + s * GATE_HALF / e.radius
        list.push({ x: e.center.x + Math.sin(a) * e.radius, z: e.center.z + Math.cos(a) * e.radius, r: 0.15 })
      }
    }
  }
  for (const t of area.trees) list.push({ x: t.x, z: t.z, r: t.kind === 'bush' ? 0.65 * t.size : 0.3 * t.size })
  list.push({ x: area.plaza.x, z: area.plaza.z, r: 1.25 })
  blockerCache.set(area, list)
  return list
}

/** 入口の範囲（角度）にいるか。 */
function inGate(e: Enclosure, p: Vec2): boolean {
  const a = Math.atan2(p.x - e.center.x, p.z - e.center.z)
  return Math.abs(wrapAngle(a - e.front)) * e.radius < GATE_HALF - BODY * 0.5
}

/** 門のまわり（エリアのふちの外へ少し出られる範囲）か。 */
function nearExit(area: Area, p: Vec2): AreaExit | undefined {
  return area.exits.find(x => Math.abs(p.x - x.at.x) < 1.6 && distance(p, x.at) < 3.5)
}

/**
 * 動いた先の位置を、柵・物・ほかの体（ふれあい広場の動物）にぶつからない位置へ直す。
 * prev は動く前の位置（ふれあい広場の柵の内と外を見分けるのに使う）。
 */
export function resolveVisitor(area: Area, prev: Vec2, next: Vec2, bodies: readonly Circle[] = []): Vec2 {
  let { x, z } = next
  const blockers = visitorBlockers(area)
  // 毎フレーム呼ぶので、配列を作らずに押し出す
  const pushOut = (list: readonly Circle[]) => {
    for (const c of list) {
      const dx = x - c.x
      const dz = z - c.z
      const min = c.r + BODY
      if (dx > min || dx < -min || dz > min || dz < -min) continue
      const d = Math.hypot(dx, dz)
      if (d < min) {
        const nx = d > 1e-6 ? dx / d : 1
        const nz = d > 1e-6 ? dz / d : 0
        x = c.x + nx * min
        z = c.z + nz * min
      }
    }
  }
  for (let iter = 0; iter < 3; iter++) {
    pushOut(blockers)
    pushOut(bodies)
    // ふれあい広場の柵: 入口以外では、内から外・外から内へ通れない
    for (const e of area.enclosures) {
      if (!e.walkIn) continue
      const wasInside = distance(prev, e.center) < e.radius
      const d = Math.hypot(x - e.center.x, z - e.center.z)
      if (inGate(e, { x, z })) continue
      const nx = d > 1e-6 ? (x - e.center.x) / d : 1
      const nz = d > 1e-6 ? (z - e.center.z) / d : 0
      if (wasInside && d > e.radius - BODY) {
        x = e.center.x + nx * (e.radius - BODY)
        z = e.center.z + nz * (e.radius - BODY)
      } else if (!wasInside && d < e.radius + BODY) {
        x = e.center.x + nx * (e.radius + BODY)
        z = e.center.z + nz * (e.radius + BODY)
      }
    }
  }
  // エリアのふち（門のところだけ、少し外へ出られる）
  const r = Math.hypot(x, z)
  const limit = nearExit(area, { x, z }) ? area.radius + 0.8 : area.radius - 0.8
  if (r > limit) {
    x = x / r * limit
    z = z / r * limit
  }
  // 2つの物のすきまに押しこまれて、まだ重なるなら、動かない（すり抜けるよりよい）
  const hits = (p: Vec2, list: readonly Circle[]) => list.some(c => distance(p, c) < c.r + BODY - 0.03)
  const overlaps = (p: Vec2) => hits(p, blockers) || hits(p, bodies)
  if (overlaps({ x, z }) && !overlaps(prev)) return { x: prev.x, z: prev.z }
  return { x, z }
}

/** 門をくぐったか（エリアのふちを越えて外へ出た）。 */
export function exitReached(area: Area, p: Vec2): AreaExit | undefined {
  const exit = nearExit(area, p)
  if (!exit) return undefined
  return Math.hypot(p.x, p.z) > area.radius - 0.1 ? exit : undefined
}

/** 中にいる、ふれあい広場（walkIn の展示場）。 */
export function walkInAt(area: Area, p: Vec2): Enclosure | undefined {
  return area.enclosures.find(e => e.walkIn && distance(p, e.center) < e.radius)
}

/** 歩いて行ける場所か（柵の中・物の中・エリアの外ではない）。 */
export function walkable(area: Area, p: Vec2): boolean {
  if (Math.hypot(p.x, p.z) > area.radius - 0.8) return false
  return !visitorBlockers(area).some(c => distance(p, c) < c.r + BODY)
}

/**
 * 展示場を見る立ち位置。柵の外で、見たい点（動物）が正面に来る、人の近くの場所を選ぶ。
 * ふれあい広場は中へ入り、動物の近くに立つ。
 */
export function viewSpot(area: Area, e: Enclosure, from: Vec2, look?: Vec2): Vec2 {
  if (e.walkIn && look) {
    const toward = headingTo(look, from.x === look.x && from.z === look.z ? e.center : from)
    for (const gap of [1.6, 2.2, 1.2, 2.8]) {
      const p = { x: look.x + Math.sin(toward) * gap, z: look.z + Math.cos(toward) * gap }
      if (distance(p, e.center) < e.radius - BODY - 0.2 && walkable(area, p)) return p
    }
  }
  const target = look ?? e.center
  const lookAngle = Math.atan2(target.x - e.center.x, target.z - e.center.z)
  const fromAngle = Math.atan2(from.x - e.center.x, from.z - e.center.z)
  let best: Vec2 | undefined
  let bestScore = Infinity
  for (let k = 0; k < 24; k++) {
    const a = e.front + (k * Math.PI * 2) / 24
    const p = { x: e.center.x + Math.sin(a) * (e.radius + 1.0), z: e.center.z + Math.cos(a) * (e.radius + 1.0) }
    if (!walkable(area, p)) continue
    // 人から近く、見たい動物がいる側で、園路の上が見やすい
    const score = distance(p, from) * 0.35 + Math.abs(wrapAngle(a - lookAngle)) * 3 + Math.abs(wrapAngle(a - fromAngle)) * 1.2 +
      (onPath(area, p, 0.4) ? 0 : 1.5)
    if (score < bestScore) {
      bestScore = score
      best = p
    }
  }
  return best ?? { x: e.center.x + Math.sin(e.front) * (e.radius + 1.0), z: e.center.z + Math.cos(e.front) * (e.radius + 1.0) }
}

/** 自動で歩く行き先を決める（ふれあい広場の柵をまたぐときは、入口を通る）。 */
export function planAutoWalk(area: Area, v: Vec2, target: Vec2, look?: Vec2): AutoWalk {
  const via: Vec2[] = []
  for (const e of area.enclosures) {
    if (!e.walkIn) continue
    const vIn = distance(v, e.center) < e.radius
    const tIn = distance(target, e.center) < e.radius
    if (vIn === tIn) continue
    const outside = { x: e.center.x + Math.sin(e.front) * (e.radius + 1.0), z: e.center.z + Math.cos(e.front) * (e.radius + 1.0) }
    const inside = { x: e.center.x + Math.sin(e.front) * (e.radius - 1.0), z: e.center.z + Math.cos(e.front) * (e.radius - 1.0) }
    via.push(...(vIn ? [inside, outside] : [outside, inside]))
  }
  return { x: target.x, z: target.z, look, stuck: 0, via }
}

/** 人を1フレーム進める。門をくぐったら、その門を返す。 */
export function stepVisitor(area: Area, v: VisitorState, input: WalkInput, dt: number, bodies: readonly Circle[] = []): AreaExit | undefined {
  const manual = input.forward !== 0 || input.turn !== 0
  if (manual) v.auto = undefined
  let want = 0
  if (manual) {
    v.yaw = wrapAngle(v.yaw + input.turn * TURN_SPEED * dt)
    want = input.forward * WALK_SPEED * (input.forward < 0 ? 0.6 : 1)
  } else if (v.auto) {
    want = steerAuto(area, v, dt, bodies)
  }
  // 加速・減速はなめらかに（急に止まると酔いやすい）
  const accel = want === 0 ? 6 : 4
  v.speed += Math.max(-accel * dt, Math.min(accel * dt, want - v.speed))
  if (Math.abs(v.speed) < 0.01 && want === 0) v.speed = 0
  if (v.speed !== 0) {
    const prev = { x: v.x, z: v.z }
    const next = { x: v.x + Math.sin(v.yaw) * v.speed * dt, z: v.z + Math.cos(v.yaw) * v.speed * dt }
    const p = resolveVisitor(area, prev, next, bodies)
    const moved = distance(prev, p)
    v.walked += moved
    if (v.auto && moved < Math.abs(v.speed) * dt * 0.25) v.auto.stuck += dt
    v.x = p.x
    v.z = p.z
  }
  if (v.auto && v.auto.stuck > 1.2) v.auto = undefined
  return exitReached(area, v)
}

/** 自動で歩くときの、向きの調整と目標の速さ。 */
function steerAuto(area: Area, v: VisitorState, dt: number, bodies: readonly Circle[]): number {
  const auto = v.auto!
  const next = auto.via?.[0] ?? auto
  const dist = distance(v, next)
  if (auto.via?.length && dist < 0.6) {
    auto.via.shift()
    return v.speed
  }
  if (!auto.via?.length && dist < 0.25) {
    // 着いたら、見たい物の方を向く
    if (auto.look) {
      const face = headingTo(v, auto.look)
      const err = wrapAngle(face - v.yaw)
      v.yaw = wrapAngle(v.yaw + Math.sign(err) * Math.min(Math.abs(err), TURN_SPEED * 1.4 * dt))
      if (Math.abs(err) > 0.03) return 0
    }
    v.auto = undefined
    return 0
  }
  let dir = headingTo(v, next)
  // 行く手をふさぐ物があれば、その接線の向きへ回りこむ
  const ahead = Math.min(dist, 2.6)
  const probe = { x: v.x + Math.sin(dir) * ahead, z: v.z + Math.cos(dir) * ahead }
  // ふれあい広場の柵も、外から外へ歩くときは回りこむ（中へ入るときは入口を通る via がある）
  const fences = area.enclosures
    .filter(e => e.walkIn && distance(v, e.center) > e.radius && distance(next, e.center) > e.radius)
    .map(e => ({ x: e.center.x, z: e.center.z, r: e.radius }))
  const walls = [...visitorBlockers(area), ...bodies, ...fences]
  const hit = walls
    .filter(c => distance(next, c) > c.r + BODY && segmentHitsCircle(v, probe, c, BODY + 0.05))
    .sort((a, b) => distance(v, a) - distance(v, b))[0]
  if (hit) {
    const toCenter = headingTo(v, hit)
    const d = Math.max(distance(v, hit), hit.r + BODY + 0.01)
    const spread = Math.asin(Math.min(1, (hit.r + BODY + 0.15) / d)) + 0.08
    if (auto.side === undefined) auto.side = wrapAngle(dir - toCenter) >= 0 ? 1 : -1
    dir = toCenter + auto.side * spread
  }
  const err = wrapAngle(dir - v.yaw)
  v.yaw = wrapAngle(v.yaw + Math.sign(err) * Math.min(Math.abs(err), TURN_SPEED * 1.6 * dt))
  // 大きく向きを変えるあいだは、ゆっくり歩く
  const slow = Math.max(0.2, 1 - Math.abs(err) / 1.4)
  const brake = auto.via?.length ? 1 : Math.min(1, 0.35 + dist / 2)
  return WALK_SPEED * slow * brake
}

/** 見ている向きにある、近くの展示場（えさを投げ入れられる・説明を出す）。 */
export function facingEnclosure(area: Area, v: VisitorState, range = 7): Enclosure | undefined {
  let best: Enclosure | undefined
  let bestScore = Infinity
  for (const e of area.enclosures) {
    const inside = e.walkIn && distance(v, e.center) < e.radius
    const gap = inside ? 0 : distance(v, e.center) - e.radius
    if (gap > range) continue
    const off = inside ? 0 : Math.abs(wrapAngle(headingTo(v, e.center) - v.yaw))
    // 正面から大きくそれた展示場は対象にしない（横の柵に気づかないことはあってよい）
    const spread = Math.atan2(e.radius, Math.max(0.1, distance(v, e.center)))
    if (!inside && off > spread + 0.55) continue
    const score = gap + off * 2
    if (score < bestScore) {
      bestScore = score
      best = e
    }
  }
  return best
}
