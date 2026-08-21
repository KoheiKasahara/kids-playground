import type { TiltInput } from './tiltInput'

/**
 * 盤面を傾ける代わりに、重力ベクトルの向きを変えて転がす。
 * こうすると床コライダーを毎フレーム動かさずに済み、
 * Phase 2でジャイロ入力へ差し替えても物理側は一切変わらない。
 */

/** 幼児が追いかけられる速さで転がるよう、実スケールより弱い重力にする。 */
export const GRAVITY_MAGNITUDE = 12

/**
 * 最大入力でも盤面は18°までしか傾けない。
 * 転がり球の加速度は約 (5/7)·g·sinθ なので、最大でも 2.7 前後に収まる。
 */
export const MAX_TILT_RAD = (18 * Math.PI) / 180

/** 見た目の盤面はこの割合だけ傾け、操作の手応えを出しつつ酔いにくくする。 */
export const VISUAL_TILT_RATIO = 0.62

/** 接触が薄いコライダーを抜けないよう、表示より細かい120Hzで積分する。 */
export const PHYSICS_TIMESTEP = 1 / 120

/** 低速端末で物理計算が雪だるま式に増えないよう、1フレーム4回までにする。 */
export const MAX_PHYSICS_SUBSTEPS = 4

/** タブ復帰時の巨大な時間跳躍を物理へ渡さない。 */
export const MAX_FRAME_DELTA_MS = 100

/** 通路幅に対して十分小さく、かつ壁の隙間へ入り込まない大きさ。 */
export const BALL_RADIUS = 0.42

/** 密度ではなく質量を直接与え、盤面サイズを変えても手触りを固定する。 */
export const BALL_MASS = 1

/** 転がり続けても加速し切らないよう、わずかな減衰を掛ける。 */
export const BALL_LINEAR_DAMPING = 0.42
export const BALL_ANGULAR_DAMPING = 0.55

/** 滑るのではなく転がるように、床と球の摩擦は高めにする。 */
export const BALL_FRICTION = 0.7
export const FLOOR_FRICTION = 0.85
export const WALL_FRICTION = 0.25

/** 壁で跳ね返って迷子にならないよう、反発はほぼ殺す。 */
export const BALL_RESTITUTION = 0.08
export const WALL_RESTITUTION = 0.02

/** これ以上速くならない上限。壁抜けと「速すぎて操作できない」を同時に防ぐ。 */
export const MAX_BALL_SPEED = 5.4

/** 床の厚みと壁の高さ。壁は球の直径より高くして乗り越えられないようにする。 */
export const FLOOR_THICKNESS = 0.6
export const WALL_HEIGHT = 1.1

/** ゴール中心からこの距離まで近づいたらクリアにする。 */
export const GOAL_RADIUS = 0.55

/** 盤面より十分下。ここまで落ちたら場外とみなしてスタートへ戻す。 */
export const FALL_OUT_Y = -6

export type PhysicsVector = { x: number; y: number; z: number }

/**
 * 傾き入力を重力ベクトルへ変換する。
 *
 * 入力の大きさ m（0〜1）を傾き角 θ = m · MAX_TILT_RAD とし、
 * 「盤面を (x, y) 方向へ θ だけ傾けた」のと等価な重力を返す。
 * 大きさは常に GRAVITY_MAGNITUDE のままなので、傾けても総重力は変わらない。
 */
export function gravityFromTilt(
  tilt: TiltInput,
  magnitude = GRAVITY_MAGNITUDE,
  maxTiltRad = MAX_TILT_RAD,
): PhysicsVector {
  const length = Math.hypot(tilt.x, tilt.y)
  if (length === 0 || !Number.isFinite(length)) {
    return { x: 0, y: -magnitude, z: 0 }
  }
  const clamped = Math.min(1, length)
  const angle = clamped * maxTiltRad
  const sin = Math.sin(angle)
  return {
    x: (tilt.x / length) * sin * magnitude,
    y: -Math.cos(angle) * magnitude,
    z: (tilt.y / length) * sin * magnitude,
  }
}

/**
 * 見た目の盤面を傾けるための回転軸と角度。
 * 重力と同じ方向・同じ向きだが、角度だけ VISUAL_TILT_RATIO で控えめにする。
 *
 * 盤面の下り坂の向きは「法線が倒れる向き」と同じになる
 * （高さ y = -(nx·x + nz·z)/ny を最急降下すると向きは (nx, nz)）。
 * したがって入力方向へ転がすには、法線を入力と同じ向きへ倒す必要がある。
 */
export function visualTiltRotation(
  tilt: TiltInput,
  ratio = VISUAL_TILT_RATIO,
  maxTiltRad = MAX_TILT_RAD,
): { axis: PhysicsVector; angle: number } {
  const length = Math.hypot(tilt.x, tilt.y)
  if (length === 0 || !Number.isFinite(length)) {
    return { axis: { x: 1, y: 0, z: 0 }, angle: 0 }
  }
  const ux = tilt.x / length
  const uz = tilt.y / length
  // 上向き(0,1,0)が (ux, uz) 側へ倒れる回転軸。傾けた先が下り坂になる。
  return {
    axis: { x: uz, y: 0, z: -ux },
    angle: Math.min(1, length) * maxTiltRad * ratio,
  }
}

/** 速度上限を超えた分だけ方向を保って縮める。超えていなければ null を返す。 */
export function clampSpeed(
  velocity: PhysicsVector,
  maxSpeed = MAX_BALL_SPEED,
): PhysicsVector | null {
  const speed = Math.hypot(velocity.x, velocity.y, velocity.z)
  if (speed <= maxSpeed || speed === 0) return null
  const ratio = maxSpeed / speed
  return { x: velocity.x * ratio, y: velocity.y * ratio, z: velocity.z * ratio }
}
