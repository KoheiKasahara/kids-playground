/**
 * パターゴルフのカメラの置き場所。Three.js にもブラウザにも依存しない計算だけを置く。
 *
 * - ねらう: ボールのうしろ上から、カップの ほう（ねらいが 大きく それたら ねらいの ほう）を見る。
 *   コの字の みちなど カップが 見とおせないときは、みちすじに そって 先の点を 見る
 * - おいかける: 転がるボールを、進む向きのうしろから追う
 * - ぜんたい: ホール全体がちょうど入る高さから見下ろす
 */
import type { Vec2 } from './golfCourses'
import type { WallBox } from './golfGeometry'
import type { Vec3 } from './golfPhysics'

export type CameraPose = { position: Vec3; target: Vec3 }
export type Bounds = { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }
export const CAMERA_FOV = 50

function normalize(direction: Vec2): Vec2 {
  const length = Math.hypot(direction.x, direction.z)
  return length > 1e-6 ? { x: direction.x / length, z: direction.z / length } : { x: 0, z: -1 }
}

/** 縦長の画面では左右が見切れやすいので、少しうしろへ下げて広く見せる。 */
function portraitScale(aspect: number): number {
  return Math.min(1.7, Math.max(1, 1.05 / Math.max(0.3, aspect)))
}

/** ねらう向きと カメラの向きの ずれの上限。これより ずれると 矢じるしが 画面の はしへ 出てしまう。 */
export const MAX_VIEW_OFFSET = (55 * Math.PI) / 180

/**
 * ねらうときの カメラの向き。基本は カップの ほうを 見る。
 * ねらいが カップから 大きく それているときだけ、矢じるしが 見える所まで ねらいの ほうへ 回す。
 */
export function viewHeading(ball: Vec2, cup: Vec2, aim: Vec2, maxOffset = MAX_VIEW_OFFSET): Vec2 {
  const a = normalize(aim)
  const toCup = { x: cup.x - ball.x, z: cup.z - ball.z }
  if (Math.hypot(toCup.x, toCup.z) < 0.3) return a
  const c = normalize(toCup)
  const offset = Math.atan2(a.z * c.x - a.x * c.z, a.x * c.x + a.z * c.z)
  if (Math.abs(offset) <= maxOffset) return c
  const turn = offset - Math.sign(offset) * maxOffset
  return { x: c.x * Math.cos(turn) - c.z * Math.sin(turn), z: c.z * Math.cos(turn) + c.x * Math.sin(turn) }
}

/** みとおしを しらべる かべと ゆか。 */
export type SightGeometry = { walls: readonly WallBox[]; heightAt: (x: number, z: number) => number | null }

/** かべに ぶつからず、ゆかの きれめ（たに・がけ）も こえずに まっすぐ 見とおせるか。いけの 上は 見とおせる。 */
export function canSee(from: Vec3, to: Vec2, geometry: SightGeometry, margin = 0.06): boolean {
  const dx = to.x - from.x
  const dz = to.z - from.z
  const length = Math.hypot(dx, dz)
  if (length < 0.05) return true
  for (const wall of geometry.walls) {
    // ボールより ひくい かべ（下の だんの かべ）は じゃまに ならない。
    if (wall.y + wall.hy < from.y) continue
    // かべの 向きに あわせた 座標で、線分が ふくらませた 箱に かかるかを しらべる。
    const cos = Math.cos(wall.yaw)
    const sin = Math.sin(wall.yaw)
    const local = (x: number, z: number) => ({ u: (x - wall.x) * cos - (z - wall.z) * sin, v: (x - wall.x) * sin + (z - wall.z) * cos })
    const a = local(from.x, from.z)
    const b = local(to.x, to.z)
    let enter = 0
    let exit = 1
    for (const [start, end, half] of [[a.u, b.u, wall.hx + margin], [a.v, b.v, wall.hz + margin]] as const) {
      const delta = end - start
      if (Math.abs(delta) < 1e-9) {
        if (Math.abs(start) > half) { enter = 2; break }
        continue
      }
      const t0 = (-half - start) / delta
      const t1 = (half - start) / delta
      enter = Math.max(enter, Math.min(t0, t1))
      exit = Math.min(exit, Math.max(t0, t1))
    }
    if (enter <= exit) return false
  }
  for (let travel = 0.2; travel < length - 0.1; travel += 0.2) {
    if (geometry.heightAt(from.x + (dx / length) * travel, from.z + (dz / length) * travel) === null) return false
  }
  return true
}

/**
 * ねらうときに カメラが 見る 点。カップが 見とおせれば カップ。
 * コの字の みちなどで 見とおせないときは、みちすじの 先の点のうち 見とおせる いちばん先の点を 見る。
 */
export function lookTarget(ball: Vec3, cup: Vec2, route: readonly Vec2[], geometry: SightGeometry): Vec2 {
  if (canSee(ball, cup, geometry)) return cup
  let segment = 0
  let nearest = Infinity
  for (let index = 0; index < route.length - 1; index++) {
    const distance = segmentDistance(ball, route[index]!, route[index + 1]!)
    if (distance <= nearest + 1e-6) { nearest = distance; segment = index }
  }
  for (let index = route.length - 1; index > segment; index--) {
    const point = route[index]!
    if (!canSee(ball, point, geometry)) continue
    // まがりかどの すぐ そばでは、かどの 点より その先の みちの 向きを 見る。
    const after = route[index + 1]
    if (after && Math.hypot(point.x - ball.x, point.z - ball.z) < 1) return { x: ball.x + after.x - point.x, z: ball.z + after.z - point.z }
    return point
  }
  const next = route[segment + 1] ?? cup
  const from = route[segment] ?? ball
  // すぐ先の点も 見えなければ、いまの みちの 向きを 見る。
  return Math.hypot(next.x - from.x, next.z - from.z) > 0.05 ? { x: ball.x + next.x - from.x, z: ball.z + next.z - from.z } : next
}

function segmentDistance(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)))
  return Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t))
}

export function aimPose(ball: Vec3, direction: Vec2, aspect: number): CameraPose {
  const d = normalize(direction)
  const scale = portraitScale(aspect)
  return {
    position: { x: ball.x - d.x * 3.9 * scale, y: ball.y + 3.1 * scale, z: ball.z - d.z * 3.9 * scale },
    target: { x: ball.x + d.x * 2.6, y: ball.y, z: ball.z + d.z * 2.6 },
  }
}

export function followPose(ball: Vec3, heading: Vec2, aspect: number): CameraPose {
  const d = normalize(heading)
  const scale = portraitScale(aspect)
  return {
    position: { x: ball.x - d.x * 4.6 * scale, y: ball.y + 3.8 * scale, z: ball.z - d.z * 4.6 * scale },
    target: { x: ball.x + d.x * 1.2, y: ball.y, z: ball.z + d.z * 1.2 },
  }
}

/** カメラから見た点の位置（-1〜1）。奥行きが手前なら null。 */
export function projectPoint(pose: CameraPose, point: Vec3, aspect: number, fov = CAMERA_FOV): { x: number; y: number } | null {
  const f = { x: pose.target.x - pose.position.x, y: pose.target.y - pose.position.y, z: pose.target.z - pose.position.z }
  const fl = Math.hypot(f.x, f.y, f.z)
  f.x /= fl; f.y /= fl; f.z /= fl
  // right = forward × up(0,1,0)、up' = right × forward
  const rl = Math.hypot(f.z, f.x) || 1
  const r = { x: -f.z / rl, y: 0, z: f.x / rl }
  const u = { x: r.y * f.z - r.z * f.y, y: r.z * f.x - r.x * f.z, z: r.x * f.y - r.y * f.x }
  const v = { x: point.x - pose.position.x, y: point.y - pose.position.y, z: point.z - pose.position.z }
  const depth = v.x * f.x + v.y * f.y + v.z * f.z
  if (depth < 0.1) return null
  const tan = Math.tan((fov * Math.PI) / 360)
  return { x: (v.x * r.x + v.y * r.y + v.z * r.z) / (depth * tan * aspect), y: (v.x * u.x + v.y * u.y + v.z * u.z) / (depth * tan) }
}

/** ティーの側から見下ろし、ホールの箱の8すみがすべて画面に入るところまで下がる。 */
export function overviewPose(bounds: Bounds, aspect: number, fov = CAMERA_FOV, margin = 0.9): CameraPose {
  const target = { x: (bounds.minX + bounds.maxX) / 2, y: bounds.minY, z: (bounds.minZ + bounds.maxZ) / 2 }
  const elevation = (58 * Math.PI) / 180
  const corners: Vec3[] = []
  for (const x of [bounds.minX, bounds.maxX]) for (const y of [bounds.minY, bounds.maxY]) for (const z of [bounds.minZ, bounds.maxZ]) corners.push({ x, y, z })
  let low = 1
  let high = 200
  const fits = (distance: number) => {
    const pose = { target, position: { x: target.x, y: target.y + Math.sin(elevation) * distance, z: target.z + Math.cos(elevation) * distance } }
    return corners.every(corner => {
      const p = projectPoint(pose, corner, aspect, fov)
      return p !== null && Math.abs(p.x) <= margin && Math.abs(p.y) <= margin
    })
  }
  for (let i = 0; i < 40; i++) {
    const middle = (low + high) / 2
    if (fits(middle)) high = middle
    else low = middle
  }
  return { target, position: { x: target.x, y: target.y + Math.sin(elevation) * high, z: target.z + Math.cos(elevation) * high } }
}

export function lerpPose(from: CameraPose, to: CameraPose, t: number): CameraPose {
  const k = Math.min(1, Math.max(0, t))
  const mix = (a: Vec3, b: Vec3) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k })
  return { position: mix(from.position, to.position), target: mix(from.target, to.target) }
}
