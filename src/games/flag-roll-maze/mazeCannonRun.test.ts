import RAPIER from '@dimforge/rapier3d-compat'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  CANNON_LAUNCH_SPEED_CAP,
  CANNON_LAUNCH_WINDOW_MS,
  MAX_BALL_SPEED,
  PHYSICS_TIMESTEP,
} from './mazePhysics'
import { createCannonState, updateCannon, type CannonState } from './mazeCannon'
import { hasFallenOut } from './mazeRescue'
import { mazeStageBounds } from './mazeStage'
import { createMazeStageById } from './mazeStages'
import {
  applyTiltToGravity,
  createMazeWorld,
  fireCannon,
  isGoalReached,
  limitBallSpeed,
  settleBallIntoCannon,
} from './mazeWorld'
import { smoothTilt, type TiltInput } from './tiltInput'

type CannonStageRun = {
  goalAtSeconds: number | null
  firedIds: string[]
  leftBoard: boolean
  maxSpeed: number
}

type SteeringPattern = {
  name: string
  inputAt: (elapsedSeconds: number, target: { x: number; z: number }, position: { x: number; z: number }) => TiltInput
}

const STEERING_PATTERNS: readonly SteeringPattern[] = [
  {
    name: '次の大砲を目指す',
    inputAt: (_elapsedSeconds, target, position) => {
      const dx = target.x - position.x
      const dz = target.z - position.z
      const distance = Math.hypot(dx, dz)
      return distance === 0
        ? { x: 0, y: 0 }
        : { x: (dx / distance) * 0.35, y: (dz / distance) * 0.35 }
    },
  },
  {
    name: '前へ倒し続ける',
    inputAt: () => ({ x: 0, y: 0.35 }),
  },
  {
    name: '前へ倒しながら少し左右に振る',
    inputAt: (elapsedSeconds) => ({
      x: Math.sin(elapsedSeconds * 1.8) * 0.07,
      y: 0.35,
    }),
  },
]

function runCannonStage(pattern: SteeringPattern): CannonStageRun {
  const stage = createMazeStageById('cannon')
  const bounds = mazeStageBounds(stage)
  const { world, ball } = createMazeWorld(RAPIER, stage)
  const cannonStates = new Map<string, CannonState>(
    stage.gimmicks.cannons.map((cannon) => [cannon.id, createCannonState()]),
  )

  let currentTilt: TiltInput = { x: 0, y: 0 }
  let firedIds: string[] = []
  let launchSpeedCapUntilMs = 0
  let goalAtSeconds: number | null = null
  let leftBoard = false
  let maxSpeed = 0

  try {
    for (let step = 1; step <= 30 / PHYSICS_TIMESTEP; step += 1) {
      const nowMs = step * PHYSICS_TIMESTEP * 1000
      const target = stage.gimmicks.cannons[firedIds.length]?.center ?? stage.goal
      const position = ball.translation()
      const targetTilt = pattern.inputAt(
        step * PHYSICS_TIMESTEP,
        target,
        position,
      )
      currentTilt = smoothTilt(currentTilt, targetTilt, PHYSICS_TIMESTEP)
      applyTiltToGravity(world, currentTilt)
      world.step()

      limitBallSpeed(ball, nowMs < launchSpeedCapUntilMs ? CANNON_LAUNCH_SPEED_CAP : MAX_BALL_SPEED)

      for (const cannon of stage.gimmicks.cannons) {
        const result = updateCannon(
          cannonStates.get(cannon.id) ?? createCannonState(),
          ball.translation(),
          cannon,
          nowMs,
        )
        cannonStates.set(cannon.id, result.state)
        if (result.hold) settleBallIntoCannon(ball, cannon)
        if (result.action === 'fire') {
          fireCannon(ball, cannon)
          launchSpeedCapUntilMs = nowMs + CANNON_LAUNCH_WINDOW_MS
          firedIds = [...firedIds, cannon.id]
          limitBallSpeed(ball, CANNON_LAUNCH_SPEED_CAP)
        }
      }

      const next = ball.translation()
      const velocity = ball.linvel()
      maxSpeed = Math.max(maxSpeed, Math.hypot(velocity.x, velocity.y, velocity.z))
      if (hasFallenOut(next, bounds)) {
        leftBoard = true
        break
      }
      if (isGoalReached(next, stage.goal)) {
        goalAtSeconds = step * PHYSICS_TIMESTEP
        break
      }
    }
  } finally {
    world.free()
  }

  return { goalAtSeconds, firedIds, leftBoard, maxSpeed }
}

describe('大砲ステージの完走', () => {
  beforeAll(async () => {
    await RAPIER.init()
  })

  it.each(STEERING_PATTERNS)('$nameでも8基を順に通ってゴールできる', (pattern) => {
    const result = runCannonStage(pattern)

    expect(result.leftBoard).toBe(false)
    expect(result.firedIds).toEqual([
      'cannon-intro-1',
      'cannon-intro-2',
      'cannon-middle-1',
      'cannon-middle-2',
      'cannon-final-1',
      'cannon-final-2',
      'cannon-final-3',
      'cannon-final-4',
    ])
    expect(result.goalAtSeconds).not.toBeNull()
    expect(result.goalAtSeconds).toBeLessThanOrEqual(30)
    expect(result.maxSpeed).toBeLessThanOrEqual(CANNON_LAUNCH_SPEED_CAP + 1e-6)
  })
})
