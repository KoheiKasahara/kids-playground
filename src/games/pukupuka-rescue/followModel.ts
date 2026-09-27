import { BUOYANCY_RATIO, type FloaterState } from './floatModel'
import type { Rect, WaterBodyDefinition } from './types'
import { findWaterBodyAt, surfaceYAt, waterSurfaceY, type WaterField } from './waterModel'

// 助けた仲間が隊長（アヒル）のうしろを1列でついてくる「隊列」の計算だけを持つモジュール。
//
// 方針:
// - 隊長が通った道すじ(trail)を記録し、仲間はその道すじの上を、決まった間隔だけ後ろの位置へ向かう。
//   カルガモの親子と同じで、隊長が向きを変えると仲間は来た道をそのまま進んで隊長とすれ違い、
//   折り返し地点でくるっと向きを変えて、また後ろへ並び直す（＝自然に入れ替わる）。
// - すれ違うときは相手の頭の上をぴょんと飛びこえ、重なって見分けがつかなくならないようにする。
// - ふだん（水に浮いている・台にいる間）の道すじは横方向の長さだけで測り、高さはその場の水面や
//   台から毎回決める。水位が上下しても、仲間は隊長と同じ水面に浮いたまま並ぶ。
// - くじらのジャンプやすべりだいのように、隊長が決まった軌道を動いた区間は exact として
//   高さも含めてなぞる。仲間も同じ軌道で順番にジャンプ・すべりおりる。
// - 仲間は当たり判定を持たない運動学的な表示用の位置で、壁に引っかかって置いていかれることがない。

export type TrailPoint = {
  readonly x: number
  readonly y: number
  /** 軌道を高さまでなぞる区間か（ジャンプ中・すべりだい）。 */
  readonly exact: boolean
}

export type FollowEnvironment = {
  readonly solids: readonly Rect[]
  readonly waterBodies: readonly WaterBodyDefinition[]
  readonly water: WaterField
}

export type FollowerSlot = {
  readonly state: FloaterState
  readonly radius: number
}

/** 道すじを記録する最小間隔。ぷかぷかの小さな揺れでは点を増やさない。 */
export const TRAIL_STEP = 0.6
/** 隊列の となりどうしのすきま。 */
export const FOLLOW_GAP = 0.8
/** 目標位置へ寄っていく速さ(1/秒)。大きいほどぴったりついてくる。 */
const FOLLOW_RATE = 16
/** 1秒あたりに動ける最大距離。仲間になった瞬間に遠くから瞬間移動しないようにする。 */
const FOLLOW_MAX_SPEED = 95
/** 向きを変える最小の移動量（1ステップあたり）。 */
const FACING_STEP = 0.04

function segmentLength(a: { x: number; y: number }, b: { x: number; y: number }, exact: boolean): number {
  return exact ? Math.hypot(b.x - a.x, b.y - a.y) : Math.abs(b.x - a.x)
}

/** 仲間 index 番目（0始まり）が隊長から道すじにそって離れる距離。 */
export function slotDistances(leaderRadius: number, radii: readonly number[]): number[] {
  const distances: number[] = []
  let previous = leaderRadius
  let total = 0
  for (const radius of radii) {
    total += previous + radius + FOLLOW_GAP
    distances.push(total)
    previous = radius
  }
  return distances
}

/**
 * ステージ開始時の道すじ。隊長のうしろ（backDirection側）へ、水域の中だけで横にのばしておく。
 * 動き出す前に仲間になっても、隊長に重ならず後ろへ並べる。
 */
export function createInitialTrail(
  leader: { x: number; y: number },
  backDirection: number,
  minX: number,
  maxX: number,
  length: number,
): readonly TrailPoint[] {
  const trail: TrailPoint[] = [{ x: leader.x, y: leader.y, exact: false }]
  const direction = Math.sign(backDirection) || -1
  const limit = direction < 0 ? minX : maxX
  const reach = Math.min(length, Math.abs(limit - leader.x))
  for (let distance = TRAIL_STEP * 4; distance <= reach; distance += TRAIL_STEP * 4) {
    trail.push({ x: leader.x + direction * distance, y: leader.y, exact: false })
  }
  return trail
}

/**
 * 隊長の今の位置を道すじへ記録する。新しい点ほど先頭。
 * keepLength より後ろの古い点は捨て、長いプレイでも配列が伸び続けないようにする。
 */
export function recordTrail(
  trail: readonly TrailPoint[],
  leader: { x: number; y: number },
  exact: boolean,
  keepLength: number,
): readonly TrailPoint[] {
  const head = trail[0]
  if (!head) return [{ x: leader.x, y: leader.y, exact }]
  if (segmentLength(head, leader, exact || head.exact) < TRAIL_STEP) {
    // 同じ場所で水位だけ変わったときは、先頭の高さだけ今の隊長にそろえる（天井・床の判定の基準）。
    if (!exact && !head.exact && head.y !== leader.y) return [{ ...head, y: leader.y }, ...trail.slice(1)]
    return trail
  }
  const next: TrailPoint[] = [{ x: leader.x, y: leader.y, exact }]
  let total = 0
  let previous: TrailPoint = next[0]
  for (const point of trail) {
    next.push(point)
    total += segmentLength(previous, point, previous.exact || point.exact)
    previous = point
    if (total > keepLength) break
  }
  return next
}

/** 隊長から道すじにそって distance だけ後ろの点。道すじが短いときはいちばん古い点で止める。 */
export function sampleTrail(
  leader: { x: number; y: number },
  leaderExact: boolean,
  trail: readonly TrailPoint[],
  distance: number,
): TrailPoint {
  let remaining = distance
  let previous: TrailPoint = { x: leader.x, y: leader.y, exact: leaderExact }
  for (const point of trail) {
    const exact = previous.exact || point.exact
    const length = segmentLength(previous, point, exact)
    if (length > 0 && length >= remaining) {
      const t = remaining / length
      return {
        x: previous.x + (point.x - previous.x) * t,
        y: previous.y + (point.y - previous.y) * t,
        exact,
      }
    }
    remaining -= length
    previous = point
  }
  return previous
}

/**
 * x の位置で、半径 radius の仲間が落ち着く高さ。fromY（隊長がそこを通ったときの高さ）より下にある
 * いちばん高い床か、それより上にある水面に浮く。fromY より上にある天井はこえない。
 */
export function restingY(
  environment: FollowEnvironment,
  x: number,
  fromY: number,
  radius: number,
): number {
  let ground = Infinity
  let ceiling = -Infinity
  for (const solid of environment.solids) {
    if (x < solid.x || x > solid.x + solid.width) continue
    if (solid.y + solid.height <= fromY) ceiling = Math.max(ceiling, solid.y + solid.height)
    else ground = Math.min(ground, solid.y)
  }
  let y = Number.isFinite(ground) ? ground - radius : fromY
  const body = findWaterBodyAt(environment.waterBodies, x, fromY)
  const bodyState = body ? environment.water[body.id] : undefined
  if (body && bodyState) {
    const surface = waterSurfaceY(body, bodyState)
    // 水に浮いたときのつり合いの高さ（floatModelの浮力と同じ沈み込み割合）。
    const floatY = surface - radius * (1 - 2 / BUOYANCY_RATIO)
    if (surface < body.floorY - 0.5 && floatY < y) y = floatY
  }
  if (Number.isFinite(ceiling)) y = Math.max(y, ceiling + radius)
  return y
}

/**
 * 仲間を1ステップぶん隊列の位置へ動かす。followers は仲間になった順。
 * 先に並んだ仲間（と隊長）に重なる目標は、その頭の上をこえる弧の上へ持ち上げる。
 */
export function stepFollowers(
  leader: FloaterState,
  leaderRadius: number,
  leaderExact: boolean,
  trail: readonly TrailPoint[],
  followers: readonly FollowerSlot[],
  environment: FollowEnvironment,
  deltaSeconds: number,
): FloaterState[] {
  const distances = slotDistances(leaderRadius, followers.map((follower) => follower.radius))
  const placed: { x: number; y: number; radius: number }[] = [{ x: leader.x, y: leader.y, radius: leaderRadius }]
  const blend = 1 - Math.exp(-FOLLOW_RATE * deltaSeconds)
  const maxStep = FOLLOW_MAX_SPEED * deltaSeconds

  return followers.map(({ state, radius }, index) => {
    const sample = sampleTrail(leader, leaderExact, trail, distances[index])
    let targetX = sample.x
    let targetY = sample.exact ? sample.y : restingY(environment, sample.x, sample.y, radius)
    if (sample.exact && !leaderExact) {
      // 隊長はもう着水したのに、自分の位置がまだジャンプ・すべりだいの軌道の途中なら、
      // 宙にとどまらず、隊長の後ろ（同じ水域の中）へおりて並ぶ。
      const body = findWaterBodyAt(environment.waterBodies, leader.x, leader.y)
      targetX = leader.x - (leader.facing ?? 1) * distances[index]
      if (body) targetX = Math.max(body.left + radius, Math.min(body.right - radius, targetX))
      targetY = restingY(environment, targetX, leader.y, radius)
    }
    for (const other of placed) {
      const reach = radius + other.radius
      const dx = targetX - other.x
      if (dx * dx + (targetY - other.y) ** 2 < reach * reach) {
        targetY = Math.min(targetY, other.y - Math.sqrt(Math.max(0, reach * reach - dx * dx)))
      }
    }

    let moveX = (targetX - state.x) * blend
    let moveY = (targetY - state.y) * blend
    const moveLength = Math.hypot(moveX, moveY)
    if (moveLength > maxStep) {
      moveX *= maxStep / moveLength
      moveY *= maxStep / moveLength
    }
    const x = state.x + moveX
    const y = state.y + moveY
    placed.push({ x, y, radius })

    const surfaceY = surfaceYAt(environment.waterBodies, environment.water, x, y)
    const submergedRatio =
      surfaceY === undefined ? 0 : Math.max(0, Math.min(1, (y + radius - surfaceY) / (radius * 2)))
    // 動いている間は進む向き、止まったら隊長の方を向く（カルガモの子が親を見るように）。
    const towardLeader = Math.abs(leader.x - x) > 1 ? (Math.sign(leader.x - x) as -1 | 1) : leader.facing ?? 1
    const facing: -1 | 1 = moveX > FACING_STEP ? 1 : moveX < -FACING_STEP ? -1 : towardLeader
    return {
      id: state.id,
      x,
      y,
      vx: moveX / deltaSeconds,
      vy: moveY / deltaSeconds,
      submergedRatio,
      facing,
    }
  })
}
