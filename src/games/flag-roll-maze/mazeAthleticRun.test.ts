import RAPIER from '@dimforge/rapier3d-compat'
import { beforeAll, describe, expect, it } from 'vitest'
import { createCannonState, updateCannon, type CannonState } from './mazeCannon'
import type { BumperCooldowns } from './mazeGimmicks'
import {
  CANNON_LAUNCH_SPEED_CAP,
  CANNON_LAUNCH_WINDOW_MS,
  JUMP_PAD_SPEED_CAP,
  JUMP_PAD_SPEED_CAP_MS,
  MAX_BALL_SPEED,
  PHYSICS_TIMESTEP,
} from './mazePhysics'
import {
  checkpointPosition,
  createCheckpointTracker,
  createSpinnerTrapTracker,
  createStallTracker,
  hasFallenOut,
  updateCheckpointTracker,
  updateSpinnerTrapTracker,
  updateStallTracker,
} from './mazeRescue'
import { mazeStageBounds } from './mazeStage'
import { createMazeStageById } from './mazeStages'
import { smoothTilt, type TiltInput } from './tiltInput'
import {
  advanceCars,
  advanceSpinners,
  applyJumpPadLaunches,
  applyTiltToGravity,
  createMazeWorld,
  fireCannon,
  isGoalReached,
  limitBallSpeed,
  nudgeBall,
  pushBallOutOfSpinner,
  resetBall,
  settleBallIntoCannon,
} from './mazeWorld'

type TiltPattern = {
  name: string
  inputAt: (elapsedSeconds: number) => TiltInput
}

type AthleticRunResult = {
  goalAtSeconds: number | null
  jumpPadLaunches: number
  cannonFires: number
  passedCars: boolean
  passedSpinner: boolean
  fellOut: boolean
  maxY: number
  maxSpeed: number
  rescueCount: number
}

const TILT_PATTERNS: readonly TiltPattern[] = [
  {
    name: 'ずっと前へ倒す',
    inputAt: () => ({ x: 0, y: 1 }),
  },
  {
    name: '前へ倒しつつ左右へ振る',
    inputAt: (elapsedSeconds) => ({
      x: Math.sin(elapsedSeconds * 2.1) * 0.05,
      y: 1,
    }),
  },
  {
    name: '前へ倒しつつ逆側へ振る',
    inputAt: (elapsedSeconds) => ({
      x: -Math.sin(elapsedSeconds * 2.1) * 0.05,
      y: 1,
    }),
  },
]

/**
 * 描画や救出UIを除いたtickを固定刻みで再現する。
 * 軌道そのものを固定せず、雑な前進操作でも各ギミックを通って完走できることだけを守る。
 */
function runAthleticCourse(pattern: TiltPattern): AthleticRunResult {
  const stage = createMazeStageById('athletic')
  const bounds = mazeStageBounds(stage)
  const { world, ball, cars, spinners } = createMazeWorld(RAPIER, stage)
  const jumpPadCooldowns: BumperCooldowns = new Map()
  const cannonStates = new Map<string, CannonState>(
    stage.gimmicks.cannons.map((cannon) => [cannon.id, createCannonState()]),
  )
  const farCar = stage.gimmicks.cars.at(-1)
  const finalSpinner = stage.gimmicks.spinners.find(
    (spinner) => spinner.id === 'spinner-athletic-final',
  )

  let speedCapValue = MAX_BALL_SPEED
  let speedCapUntilMs = 0
  let goalAtSeconds: number | null = null
  let jumpPadLaunches = 0
  let cannonFires = 0
  let passedCars = false
  let passedSpinner = false
  let fellOut = false
  let maxY = ball.translation().y
  let maxSpeed = 0
  let rescueCount = 0
  let checkpointTracker = createCheckpointTracker()
  let spinnerTrapTracker = createSpinnerTrapTracker()
  let stallTracker = createStallTracker()
  let respawnGraceRemainingMs = 0
  let respawnSettleRemainingMs = 0
  let currentTilt: TiltInput = { x: 0, y: 0 }

  function rescueToCheckpoint(): void {
    speedCapValue = MAX_BALL_SPEED
    speedCapUntilMs = 0
    cannonStates.clear()
    for (const cannon of stage.gimmicks.cannons) {
      cannonStates.set(cannon.id, createCannonState())
    }
    resetBall(
      ball,
      checkpointPosition(checkpointTracker, stage.checkpoints, stage.start),
    )
    stallTracker = createStallTracker()
    spinnerTrapTracker = createSpinnerTrapTracker()
    respawnGraceRemainingMs = 350
    respawnSettleRemainingMs = 500
    rescueCount += 1
  }

  try {
    for (let step = 1; step <= 40 / PHYSICS_TIMESTEP; step += 1) {
      const elapsedSeconds = step * PHYSICS_TIMESTEP
      const nowMs = elapsedSeconds * 1000
      const settlingAfterRespawn = respawnSettleRemainingMs > 0
      respawnGraceRemainingMs = Math.max(0, respawnGraceRemainingMs - PHYSICS_TIMESTEP * 1000)

      const targetTilt = pattern.inputAt(elapsedSeconds)
      currentTilt = smoothTilt(currentTilt, targetTilt, PHYSICS_TIMESTEP)
      applyTiltToGravity(world, currentTilt)
      // kinematic物はworld.stepの直前に更新し、Rapierへ速度を渡す。
      advanceSpinners(spinners, elapsedSeconds)
      advanceCars(cars, elapsedSeconds)
      world.step()

      const currentSpeedCap = () =>
        nowMs < speedCapUntilMs ? speedCapValue : MAX_BALL_SPEED
      limitBallSpeed(ball, currentSpeedCap())

      const launchedIds = applyJumpPadLaunches(
        ball,
        stage.gimmicks.jumpPads,
        jumpPadCooldowns,
        nowMs,
      )
      if (launchedIds.length > 0) {
        jumpPadLaunches += launchedIds.length
        speedCapValue = JUMP_PAD_SPEED_CAP
        speedCapUntilMs = nowMs + JUMP_PAD_SPEED_CAP_MS
      }
      limitBallSpeed(ball, currentSpeedCap())

      let cannonHolding = false
      for (const cannon of stage.gimmicks.cannons) {
        const result = updateCannon(
          cannonStates.get(cannon.id) ?? createCannonState(),
          ball.translation(),
          cannon,
          nowMs,
        )
        cannonStates.set(cannon.id, result.state)
        if (result.hold) {
          settleBallIntoCannon(ball, cannon)
          cannonHolding = true
        }
        if (result.action === 'fire') {
          fireCannon(ball, cannon)
          cannonFires += 1
          speedCapValue = CANNON_LAUNCH_SPEED_CAP
          speedCapUntilMs = nowMs + CANNON_LAUNCH_WINDOW_MS
          // 速度窓を開いた後で上限を掛け、発射速度を通常値へ削らない。
          limitBallSpeed(ball, currentSpeedCap())
        }
      }

      if (settlingAfterRespawn) {
        ball.setLinvel({ x: 0, y: 0, z: 0 }, true)
        ball.setAngvel({ x: 0, y: 0, z: 0 }, true)
      }
      respawnSettleRemainingMs = Math.max(
        0,
        respawnSettleRemainingMs - PHYSICS_TIMESTEP * 1000,
      )

      let position = ball.translation()
      const velocity = ball.linvel()
      maxY = Math.max(maxY, position.y)
      maxSpeed = Math.max(maxSpeed, Math.hypot(velocity.x, velocity.y, velocity.z))

      if (!cannonHolding) {
        if (hasFallenOut(position, bounds)) {
          fellOut = true
          break
        }
        checkpointTracker = updateCheckpointTracker(
          checkpointTracker,
          position,
          stage.checkpoints,
        )

        if (!settlingAfterRespawn && respawnGraceRemainingMs <= 0) {
          const spinnerTrap = updateSpinnerTrapTracker(
            spinnerTrapTracker,
            position,
            stage.gimmicks.spinners,
            PHYSICS_TIMESTEP * 1000,
          )
          spinnerTrapTracker = spinnerTrap.tracker
          if (spinnerTrap.escapeFrom !== null) {
            pushBallOutOfSpinner(ball, spinnerTrap.escapeFrom)
            limitBallSpeed(ball)
          }

          if (spinnerTrap.rescue) {
            rescueToCheckpoint()
          } else {
            const stall = updateStallTracker(stallTracker, {
              speed: Math.hypot(velocity.x, velocity.y, velocity.z),
              tiltMagnitude: Math.hypot(currentTilt.x, currentTilt.y),
              deltaMs: PHYSICS_TIMESTEP * 1000,
            })
            stallTracker = stall.tracker
            if (stall.rescue) {
              rescueToCheckpoint()
            } else if (stall.nudge) {
              nudgeBall(ball, currentTilt)
            }
          }
        }

        position = ball.translation()
        if (isGoalReached(position, stage.goal)) {
          goalAtSeconds = elapsedSeconds
          break
        }
      }

      if (farCar !== undefined && position.z > farCar.center.z + farCar.halfDepth) {
        passedCars = true
      }
      if (
        finalSpinner !== undefined &&
        position.z > finalSpinner.center.z + finalSpinner.sweepRadius
      ) {
        passedSpinner = true
      }
    }
  } finally {
    world.free()
  }

  return {
    goalAtSeconds,
    jumpPadLaunches,
    cannonFires,
    passedCars,
    passedSpinner,
    fellOut,
    maxY,
    maxSpeed,
    rescueCount,
  }
}

describe('アスレチックの完走', () => {
  beforeAll(async () => {
    await RAPIER.init()
  })

  it.each(TILT_PATTERNS)('$nameでも40秒以内に全ギミックを通ってゴールできる', (pattern) => {
    const stage = createMazeStageById('athletic')
    const result = runAthleticCourse(pattern)

    expect(result.fellOut).toBe(false)
    expect(result.goalAtSeconds).not.toBeNull()
    expect(result.goalAtSeconds).toBeLessThanOrEqual(40)
    expect(result.jumpPadLaunches).toBeGreaterThanOrEqual(1)
    expect(result.cannonFires).toBeGreaterThanOrEqual(1)
    expect(result.passedCars).toBe(true)
    expect(result.passedSpinner).toBe(true)
    // 高台STARTより極端に高く跳ねた場合は、弾道や速度窓の異常として検出する。
    expect(result.maxY).toBeLessThan((stage.start.y ?? 0) + 2)
    expect(result.maxSpeed).toBeLessThanOrEqual(CANNON_LAUNCH_SPEED_CAP + 1e-6)
  })
})
