import { MAX_SPEED } from './puzzlePhysics'
import { isJumpRampPart, type PartTypeId } from './partTypes'

type Velocity = Readonly<{ x: number; y: number }>

/** 同じジャンプ台へ乗り続けたときに、毎フレーム加速しないための待ち時間。 */
export const JUMP_RAMP_HIT_COOLDOWN_MS = 260

const MIN_ENTRY_HORIZONTAL_SPEED = 1.1
const MIN_EXIT_HORIZONTAL_SPEED = 3.2
const MAX_EXIT_HORIZONTAL_SPEED = 9
const BASE_UPWARD_BOOST = 2.6
const SPEED_TO_BOOST = 0.42
const MIN_EXIT_UPWARD_SPEED = 5.4

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
 * 正しい向きから斜面へ進入した球だけを、入力の横速度を保ちながら少し上へ持ち上げる。
 * 速度に応じて強さが変わるので、キャノンのような固定発射にはしない。
 */
export function jumpRampVelocity(typeId: PartTypeId, velocity: Velocity): Velocity | null {
  const direction = directionFor(typeId)
  if (direction === null || velocity.x * direction < MIN_ENTRY_HORIZONTAL_SPEED) return null
  // すでに十分に上昇している球は、ジャンプ台との擦れでさらに加速させない。
  if (velocity.y < -2) return null

  const speed = Math.hypot(velocity.x, velocity.y)
  const horizontal = direction * Math.min(MAX_EXIT_HORIZONTAL_SPEED, Math.max(MIN_EXIT_HORIZONTAL_SPEED, Math.abs(velocity.x) * 0.9))
  const upward = Math.min(
    velocity.y - (BASE_UPWARD_BOOST + speed * SPEED_TO_BOOST),
    -MIN_EXIT_UPWARD_SPEED,
  )
  return cappedVelocity({ x: horizontal, y: upward })
}
