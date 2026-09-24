/**
 * パターゴルフのカメラの置き場所。Three.js にもブラウザにも依存しない計算だけを置く。
 *
 * - ねらう: ボールのうしろ上から、カップの ほう（ねらいが 大きく それたら ねらいの ほう）を見る
 * - おいかける: 転がるボールを、進む向きのうしろから追う
 * - ぜんたい: ホール全体がちょうど入る高さから見下ろす
 */
import type { Vec2 } from './golfCourses'
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
