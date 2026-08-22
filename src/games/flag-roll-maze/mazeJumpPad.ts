import {
  BALL_RADIUS,
  JUMP_PAD_ALREADY_RISING,
  JUMP_PAD_FORWARD_SPEED,
  JUMP_PAD_MARGIN,
  JUMP_PAD_MAX_SIDE_SPEED,
  JUMP_PAD_SIDE_RETENTION,
  JUMP_PAD_UP_SPEED,
  type PhysicsVector,
} from './mazePhysics'
import type { JumpPadGimmick } from './mazeGimmicks'

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * ジャンプ床の範囲へ入ったボールの発射速度を返す。速度を直接返して呼び出し側でsetLinvelするのは、
 * flag-pinball/jumppadToy.tsと同じく、applyImpulseではdtで効き方が変わってしまうため。
 */
export function jumpPadLaunch(
  ballPosition: PhysicsVector,
  ballVelocity: PhysicsVector,
  pad: JumpPadGimmick,
  options: { ballRadius?: number } = {},
): PhysicsVector | null {
  const ballRadius = options.ballRadius ?? BALL_RADIUS
  if (
    Math.abs(ballPosition.x - pad.center.x) >
      pad.halfWidth + ballRadius + JUMP_PAD_MARGIN ||
    Math.abs(ballPosition.z - pad.center.z) >
      pad.halfDepth + ballRadius + JUMP_PAD_MARGIN ||
    ballPosition.y > pad.top + ballRadius * 2.2
  ) {
    return null
  }
  // flag-pinball/jumppadToy.tsのALREADY_RISING_THRESHOLDと同じ知見で、
  // 上昇中のボールへ二重に発射速度を加えて跳びすぎることを防ぐ。
  if (ballVelocity.y >= JUMP_PAD_ALREADY_RISING) return null

  // 横速度を3割だけ残して±1.2へ収め、幼児が斜め入力しても進行方向へ戻れるよう補正する。
  const x = clamp(
    ballVelocity.x * JUMP_PAD_SIDE_RETENTION,
    -JUMP_PAD_MAX_SIDE_SPEED,
    JUMP_PAD_MAX_SIDE_SPEED,
  )
  return { x, y: JUMP_PAD_UP_SPEED, z: JUMP_PAD_FORWARD_SPEED }
}
