import { MAX_SPEED } from './puzzlePhysics'
import { isJumpRampPart, type PartTypeId } from './partTypes'

type Velocity = Readonly<{ x: number; y: number }>

/** 同じジャンプ台へ乗り続けたときに、毎フレーム加速しないための待ち時間。 */
export const JUMP_RAMP_HIT_COOLDOWN_MS = 260

// ほぼ止まった球でも「乗れば飛ぶ」ことを優先する。0にはしないことで、
// 真上から落ちただけの球を左右どちらにも勝手に発射しない。
const MIN_ENTRY_HORIZONTAL_SPEED = 0.12
const MIN_EXIT_HORIZONTAL_SPEED = 4.5
const MAX_EXIT_HORIZONTAL_SPEED = 9
const BASE_UPWARD_BOOST = 7.4
const SPEED_TO_BOOST = 0.28
const MIN_EXIT_UPWARD_SPEED = 7.4
const MAX_EXIT_UPWARD_SPEED = 9.6

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
 * 正しい向きから斜面へ進入した球を、最低速度を保証して上前方へ発射する。
 * 通常の板と違い、低速でも明確に空中へ出る一方、速度上限で暴走は防ぐ。
 */
export function jumpRampVelocity(typeId: PartTypeId, velocity: Velocity): Velocity | null {
  const direction = directionFor(typeId)
  if (direction === null || velocity.x * direction < MIN_ENTRY_HORIZONTAL_SPEED) return null
  // すでに十分に上昇している球は、ジャンプ台との擦れでさらに加速させない。
  if (velocity.y < -2) return null

  const speed = Math.hypot(velocity.x, velocity.y)
  const horizontal = direction * Math.min(MAX_EXIT_HORIZONTAL_SPEED, Math.max(MIN_EXIT_HORIZONTAL_SPEED, Math.abs(velocity.x) * 0.9))
  const upwardBoost = Math.min(MAX_EXIT_UPWARD_SPEED, BASE_UPWARD_BOOST + speed * SPEED_TO_BOOST)
  const upward = Math.min(velocity.y - upwardBoost, -MIN_EXIT_UPWARD_SPEED)
  return cappedVelocity({ x: horizontal, y: upward })
}
