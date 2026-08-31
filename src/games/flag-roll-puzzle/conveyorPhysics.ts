import { isConveyorPart, type PartTypeId } from './partTypes'

export type ConveyorDirection = {
  readonly x: -1 | 0 | 1
  readonly y: -1 | 0 | 1
}

/** ベルトが一度に作る補正は穏やかにし、乗っている間だけ目標速度へ近づける。 */
export const CONVEYOR_TARGET_SPEED = 4.2
export const CONVEYOR_ACCELERATION_PER_STEP = 0.24
export const CONVEYOR_MAX_SPEED = 5.5

const DIRECTIONS: Readonly<Record<'conveyorRight' | 'conveyorDown' | 'conveyorLeft' | 'conveyorUp', ConveyorDirection>> = {
  conveyorRight: { x: 1, y: 0 },
  conveyorDown: { x: 0, y: 1 },
  conveyorLeft: { x: -1, y: 0 },
  conveyorUp: { x: 0, y: -1 },
}

export function conveyorDirection(typeId: PartTypeId): ConveyorDirection | null {
  return isConveyorPart(typeId) ? DIRECTIONS[typeId] : null
}

/**
 * 接触中の1物理stepに1回だけ呼ぶ速度補正。
 * 進行方向の成分だけを目標値へ近づけ、横方向や他の物理挙動は残す。
 * 目標値へ到達した後は補正しないため、接触時間に比例した無限加速にならない。
 */
export function conveyorVelocity(
  velocity: { readonly x: number; readonly y: number },
  direction: ConveyorDirection,
): { x: number; y: number } {
  const along = velocity.x * direction.x + velocity.y * direction.y
  const targetSpeed = Math.min(CONVEYOR_TARGET_SPEED, CONVEYOR_MAX_SPEED)
  if (along >= targetSpeed) return { x: velocity.x, y: velocity.y }

  const nextAlong = Math.min(targetSpeed, along + CONVEYOR_ACCELERATION_PER_STEP)
  const correction = nextAlong - along
  return {
    x: velocity.x + direction.x * correction,
    y: velocity.y + direction.y * correction,
  }
}
