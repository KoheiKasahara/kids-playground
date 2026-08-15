import {
  BOOST_ACCELERATION,
  BOOST_MAX_SPEED,
  CANNON_HOLD_MS,
  CANNON_MUZZLE_OFFSET,
  CANNON_RECAPTURE_COOLDOWN_MS,
  FLOAT_GRAVITY_SCALE,
  MAX_SPEED,
} from './adventurePhysics'
import type { AreaBoostLane, AreaCannon, AreaFloatZone, AreaJumpPad, AreaZone } from './types'

export type GimmickPoint = { x: number; y: number }
export type GimmickVector = { x: number; y: number }

export type RotatedRect = {
  x: number
  y: number
  width: number
  height: number
  angle: number
}

export type ZoneWorldGeometry = {
  zone: AreaZone
  x: number
  y: number
  angle: number
}

export type ZoneEffectResult = {
  velocity: GimmickVector
  counterGravityForce: GimmickVector
  boostIds: readonly string[]
}

export type AdventureGimmickEvent = {
  kind: 'cannon-capture' | 'cannon-fire' | 'jump' | 'boost'
  id: string
}

/** 点を矩形の中心基準へ戻して逆回転し、回転後の矩形内にあるかを判定する。 */
export function isPointInRotatedRect(point: GimmickPoint, rect: RotatedRect): boolean {
  const dx = point.x - rect.x
  const dy = point.y - rect.y
  const cosine = Math.cos(rect.angle)
  const sine = Math.sin(rect.angle)
  const localX = dx * cosine + dy * sine
  const localY = -dx * sine + dy * cosine
  return Math.abs(localX) <= rect.width / 2 && Math.abs(localY) <= rect.height / 2
}

export function getCannonHoldMs(cannon: Pick<AreaCannon, 'holdMs'>): number {
  return cannon.holdMs ?? CANNON_HOLD_MS
}

/** 装填室の中心からangle方向へ、センサー半径の外に出た砲口座標を求める。 */
export function getCannonMuzzlePosition(
  cannon: Pick<AreaCannon, 'x' | 'y' | 'angle'>,
  muzzleOffset = CANNON_MUZZLE_OFFSET,
): GimmickPoint {
  return {
    x: cannon.x + Math.cos(cannon.angle) * muzzleOffset,
    y: cannon.y + Math.sin(cannon.angle) * muzzleOffset,
  }
}

/** 方向と速度から射出速度を作り、必ずMAX_SPEED以下へクランプする。 */
export function getLaunchVelocity(angle: number, power: number): GimmickVector {
  const clampedPower = Math.min(MAX_SPEED, Math.max(0, power))
  return {
    x: Math.cos(angle) * clampedPower,
    y: Math.sin(angle) * clampedPower,
  }
}

export function getCannonLaunchVelocity(cannon: Pick<AreaCannon, 'angle' | 'power'>): GimmickVector {
  return getLaunchVelocity(cannon.angle, cannon.power)
}

export function getJumpLaunchVelocity(jump: Pick<AreaJumpPad, 'launchAngle' | 'power'>): GimmickVector {
  return getLaunchVelocity(jump.launchAngle, jump.power)
}

/** 溜め中または射出直後は同じ大砲を再捕獲できない。 */
export function canRecaptureCannon(
  cannonActive: boolean,
  lastFiredAtMs: number | null,
  nowMs: number,
  cooldownMs = CANNON_RECAPTURE_COOLDOWN_MS,
): boolean {
  if (cannonActive) return false
  return lastFiredAtMs === null || nowMs - lastFiredAtMs >= cooldownMs
}

/** 加速方向へ速度を加算し、速度ベクトルの大きさをレーン上限へ収める。 */
export function getBoostedVelocity(
  velocity: GimmickVector,
  lane: Pick<AreaBoostLane, 'angle' | 'force' | 'maxSpeed'>,
): GimmickVector {
  const force = lane.force ?? BOOST_ACCELERATION
  const maxSpeed = Math.min(MAX_SPEED, Math.max(0, lane.maxSpeed ?? BOOST_MAX_SPEED))
  const next = {
    x: velocity.x + Math.cos(lane.angle) * force,
    y: velocity.y + Math.sin(lane.angle) * force,
  }
  const speed = Math.hypot(next.x, next.y)
  if (speed <= maxSpeed || speed === 0) return next
  const factor = maxSpeed / speed
  return { x: next.x * factor, y: next.y * factor }
}

/** Matterの重力力のうち、ゾーン内で残さない割合だけを上向きに打ち消す。 */
export function getFloatCounterGravityForce(
  mass: number,
  gravityY: number,
  gravityEngineScale: number,
  gravityScale: number = FLOAT_GRAVITY_SCALE,
): GimmickVector {
  const remainingGravity = Math.min(1, Math.max(0, gravityScale))
  return {
    x: 0,
    y: -mass * gravityY * gravityEngineScale * (1 - remainingGravity),
  }
}

/** 実機とヘッドレス測定が同じ順番でboost/floatを適用するための純粋な計算。 */
export function calculateZoneEffects(
  point: GimmickPoint,
  velocity: GimmickVector,
  mass: number,
  gravityY: number,
  gravityEngineScale: number,
  zones: readonly ZoneWorldGeometry[],
): ZoneEffectResult {
  let nextVelocity = { ...velocity }
  let counterGravityForce = { x: 0, y: 0 }
  const boostIds: string[] = []

  for (const entry of zones) {
    if (entry.zone.kind === 'cannon') continue
    const zone = entry.zone as AreaBoostLane | AreaFloatZone
    if (!isPointInRotatedRect(point, {
      x: entry.x,
      y: entry.y,
      width: zone.width,
      height: zone.height,
      angle: entry.angle,
    })) {
      continue
    }

    if (zone.kind === 'boost') {
      nextVelocity = getBoostedVelocity(nextVelocity, zone)
      boostIds.push(zone.id)
    } else {
      const force = getFloatCounterGravityForce(mass, gravityY, gravityEngineScale, zone.gravityScale)
      counterGravityForce = {
        x: counterGravityForce.x + force.x,
        y: counterGravityForce.y + force.y,
      }
    }
  }

  return { velocity: nextVelocity, counterGravityForce, boostIds }
}
