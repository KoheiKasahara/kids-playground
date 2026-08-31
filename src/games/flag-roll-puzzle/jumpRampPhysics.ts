import { MAX_SPEED } from './puzzlePhysics'
import { isJumpRampPart, type PartTypeId } from './partTypes'

type Velocity = Readonly<{ x: number; y: number }>

/** 同じジャンプ台へ乗り続けたときに、毎フレーム加速しないための待ち時間。 */
export const JUMP_RAMP_HIT_COOLDOWN_MS = 260

const MIN_EXIT_HORIZONTAL_SPEED = 4.5
const MAX_EXIT_HORIZONTAL_SPEED = 9
const MIN_EXIT_UPWARD_SPEED = 7.4
const MAX_EXIT_UPWARD_SPEED = 9.6
const DOWNWARD_SPEED_TO_BOOST = 0.28

function directionFor(typeId: PartTypeId): 1 | -1 | null {
  if (!isJumpRampPart(typeId)) return null
  return typeId === 'jumpRampRight' ? 1 : -1
}

function cappedVelocity(velocity: Velocity): Velocity {
  const speed = Math.hypot(velocity.x, velocity.y)
  if (speed <= MAX_SPEED) return velocity
  const factor = MAX_SPEED / speed
  return { x: velocity.x * factor, y: velocity.y * factor }
}

/**
 * 接触方向ではなく、ジャンプ台固有の向きへ球を発射する。
 * 通常の板と違い、低速・真上からの落下・逆方向からの接触でも
 * 最低限の横速度と上向き速度を保証する一方、速度上限で暴走は防ぐ。
 */
export function jumpRampVelocity(typeId: PartTypeId, velocity: Velocity): Velocity | null {
  const direction = directionFor(typeId)
  if (direction === null) return null

  // 入射の横成分は発射方向へ揃え、反対方向から来た場合も台の向きを優先する。
  // 0に近い接触でも最低速度を保証して「坂を転がるだけ」になるのを防ぐ。
  const horizontalMagnitude = Math.min(
    MAX_EXIT_HORIZONTAL_SPEED,
    Math.max(MIN_EXIT_HORIZONTAL_SPEED, Math.abs(velocity.x) * 0.9),
  )

  // 上昇中か下降中かに関わらず、上向き速度を必ず作る。下降速度が強い場合だけ
  // 少し強めるが、入射速度そのものを発射速度として引き継がない。
  const downwardSpeed = Math.max(0, velocity.y)
  const upwardMagnitude = Math.min(
    MAX_EXIT_UPWARD_SPEED,
    Math.max(MIN_EXIT_UPWARD_SPEED, MIN_EXIT_UPWARD_SPEED + downwardSpeed * DOWNWARD_SPEED_TO_BOOST),
  )

  return cappedVelocity({
    x: direction * horizontalMagnitude,
    y: -upwardMagnitude,
  })
}
