import {
  CANNON_CAPTURE_MAX_Y,
  CANNON_CAPTURE_TIMEOUT_MS,
  CANNON_COOLDOWN_MS,
  CANNON_HOLD_MS,
  type PhysicsVector,
} from './mazePhysics'
import type { CannonGimmick } from './mazeGimmicks'

export type CannonState =
  | { phase: 'ready' }
  | { phase: 'capturing'; startedAtMs: number }
  | { phase: 'cooldown'; readyAtMs: number }

export function createCannonState(): CannonState {
  return { phase: 'ready' }
}

/** 大砲の砲室中心を、物理側と描画側で同じ位置として扱う。 */
export function cannonChamberPosition(cannon: CannonGimmick): PhysicsVector {
  return {
    x: cannon.center.x,
    y: cannon.muzzleY,
    z: cannon.center.z,
  }
}

/** 仰角と +z 基準の水平方向から、毎回同じ発射速度を直接求める。 */
export function cannonLaunchVelocity(cannon: CannonGimmick): PhysicsVector {
  const horizontalSpeed = cannon.speed * Math.cos(cannon.elevationRad)
  return {
    x: horizontalSpeed * Math.sin(cannon.headingRad),
    y: cannon.speed * Math.sin(cannon.elevationRad),
    z: horizontalSpeed * Math.cos(cannon.headingRad),
  }
}

/**
 * 行き止まりへ入ったボールを短時間だけ砲室へ収めてから確実に発射する。
 * 捕捉半径・個別のクールダウン・速度を直接指定する考え方は
 * flag-pinball/launcherToy.ts の知見を、迷路用の状態機械として移したもの。
 */
export function updateCannon(
  state: CannonState,
  ballPosition: PhysicsVector,
  cannon: CannonGimmick,
  nowMs: number,
): { state: CannonState; action: 'capture' | 'fire' | null; hold: boolean } {
  if (state.phase === 'ready') {
    const distance = Math.hypot(
      ballPosition.x - cannon.center.x,
      ballPosition.z - cannon.center.z,
    )
    if (distance <= cannon.captureRadius && ballPosition.y <= CANNON_CAPTURE_MAX_Y) {
      return {
        state: { phase: 'capturing', startedAtMs: nowMs },
        action: 'capture',
        hold: true,
      }
    }
    return { state, action: null, hold: false }
  }

  if (state.phase === 'capturing') {
    const elapsedMs = Math.max(0, nowMs - state.startedAtMs)
    if (elapsedMs >= CANNON_HOLD_MS || elapsedMs >= CANNON_CAPTURE_TIMEOUT_MS) {
      // CANNON_CAPTURE_TIMEOUT_MS は、万一砲室へ収まり切らなくても必ず発射して詰ませない保険。
      return {
        state: { phase: 'cooldown', readyAtMs: nowMs + CANNON_COOLDOWN_MS },
        action: 'fire',
        hold: false,
      }
    }
    return { state, action: null, hold: true }
  }

  if (nowMs >= state.readyAtMs) {
    return { state: createCannonState(), action: null, hold: false }
  }
  return { state, action: null, hold: false }
}
