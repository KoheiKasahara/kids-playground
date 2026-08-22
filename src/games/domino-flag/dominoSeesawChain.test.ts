import RAPIER from '@dimforge/rapier3d-compat'
import { beforeAll, describe, expect, it } from 'vitest'
import { createDominoCourse } from './dominoCourse'
import { applyStartImpulse, createDominoWorld, tiltOf } from './dominoWorld'
import { isFallen } from './dominoCompletion'
import type { DominoPlacement } from './dominoLayout'
import {
  SEESAW_MAX_TILT_RAD,
  advanceSeesawState,
  createSeesawRuntimeState,
  seesawPlankRotation,
} from './dominoSeesaw'
import { PHYSICS_TIMESTEP } from './dominoPhysics'

const MAX_STEPS = 5_000

type SeesawRun = {
  triggerTippedStep: number | null
  ballMovedStep: number | null
  seesawTippedStep: number | null
  strikeStep: number | null
  maxTiltRad: number
  maxBallSpeed: number
}

function runSeesawSection(placements?: DominoPlacement[]): SeesawRun {
  const course = createDominoCourse('long', 'jp')
  const seesawSection = course.seesawSection
  const seesawBallSection = course.seesawBallSection
  if (!seesawSection || !seesawBallSection) {
    throw new Error('ロングコースにシーソー区間がありません')
  }
  const dominoWorld = createDominoWorld(RAPIER, placements ?? course.placements, {
    groundSize: course.groundSize,
    ballSection: course.ballSection,
    secondBallSection: seesawBallSection,
    seesawSection,
  })
  const trigger = dominoWorld.bodiesById.get(seesawBallSection.triggerDominoId)
  const strike = dominoWorld.bodiesById.get(seesawSection.strikeDominoId)
  const ball = dominoWorld.secondBall
  const seesaw = dominoWorld.seesaw
  // トリガーを直接弱く押すだけだと、実際の連鎖が持つ勢い(前段からの衝突による角速度)を
  // 再現できずゆっくり倒れてしまい、球へ届かない。既存Phase 6のレシーバー(道中が
  // 再開する地点)から連鎖させ、トリガーが実際の連鎖と同じ勢いで倒れる状態を再現する。
  const warmupStart = dominoWorld.bodiesById.get(course.ballSection!.receiverDominoId)
  if (!trigger || !strike || !ball || !seesaw || !warmupStart) {
    throw new Error('シーソー区間の物理要素がありません')
  }
  applyStartImpulse(warmupStart.body, warmupStart.placement.chainYaw)

  let triggerTippedStep: number | null = null
  let ballMovedStep: number | null = null
  let seesawTippedStep: number | null = null
  let strikeStep: number | null = null
  let maxTiltRad = 0
  let maxBallSpeed = 0
  let seesawState = createSeesawRuntimeState()

  try {
    for (let step = 1; step <= MAX_STEPS; step += 1) {
      if (!seesawState.settled) {
        const ballPosition = ball.body.translation()
        seesawState = advanceSeesawState(seesawState, seesawSection, ballPosition, PHYSICS_TIMESTEP)
        seesaw.body.setNextKinematicRotation(
          seesawPlankRotation(seesawSection.yaw, seesawState.tiltRad),
        )
        if (seesawState.justSettled) {
          // kinematicのままだと接触したドミノがsleepできず起き続けるため、実機と同じく固定物へ切り替える。
          seesaw.body.setBodyType(RAPIER.RigidBodyType.Fixed, true)
        }
      }

      dominoWorld.world.step()

      if (triggerTippedStep === null && tiltOf(trigger.body) > 0.12) triggerTippedStep = step
      const velocity = ball.body.linvel()
      const speed = Math.hypot(velocity.x, velocity.y, velocity.z)
      maxBallSpeed = Math.max(maxBallSpeed, speed)
      if (ballMovedStep === null && speed > 0.08) ballMovedStep = step
      maxTiltRad = Math.max(maxTiltRad, Math.abs(seesawState.tiltRad))
      if (seesawTippedStep === null && Math.abs(seesawState.tiltRad) >= SEESAW_MAX_TILT_RAD * 0.9) {
        seesawTippedStep = step
      }
      if (
        strikeStep === null &&
        isFallen({ tilt: tiltOf(strike.body), sleeping: strike.body.isSleeping() })
      ) {
        strikeStep = step
      }
    }
    return {
      triggerTippedStep,
      ballMovedStep,
      seesawTippedStep,
      strikeStep,
      maxTiltRad,
      maxBallSpeed,
    }
  } finally {
    dominoWorld.world.free()
  }
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return state / 0x1_0000_0000
  }
}

function createPerturbedPlacements(seed: number): DominoPlacement[] {
  const random = createSeededRandom(seed)
  const offset = (range: number) => (random() * 2 - 1) * range
  return createDominoCourse('long', 'jp').placements.map((placement) => {
    const yawOffset = offset((1.5 * Math.PI) / 180)
    return {
      ...placement,
      x: placement.x + offset(0.02),
      z: placement.z + offset(0.02),
      yaw: placement.yaw === undefined ? undefined : placement.yaw + yawOffset,
      chainYaw: placement.chainYaw === undefined ? undefined : placement.chainYaw + yawOffset,
    }
  })
}

describe('domino seesaw section headless physics', () => {
  beforeAll(async () => {
    await RAPIER.init()
  })

  it('トリガーが球を押し出し、シーソーが傾いて後段ドミノを倒す', () => {
    const result = runSeesawSection()
    console.log(
      `[domino-seesaw] trigger=${result.triggerTippedStep}, ballMoved=${result.ballMovedStep}, ` +
        `seesawTipped=${result.seesawTippedStep}, strike=${result.strikeStep}, ` +
        `maxTilt=${((result.maxTiltRad * 180) / Math.PI).toFixed(1)}deg, ` +
        `maxBallSpeed=${result.maxBallSpeed.toFixed(3)}`,
    )
    expect(result.triggerTippedStep).not.toBeNull()
    expect(result.ballMovedStep).not.toBeNull()
    expect(result.ballMovedStep!).toBeGreaterThanOrEqual(result.triggerTippedStep!)
    expect(result.seesawTippedStep).not.toBeNull()
    expect(result.strikeStep).not.toBeNull()
    expect(result.strikeStep!).toBeGreaterThanOrEqual(result.seesawTippedStep!)
  })

  it('12シードで補助なしにシーソーが作動し、後段ドミノを始動する', { timeout: 30_000 }, () => {
    const seeds = [11, 22, 33, 44, 55, 66, 77, 88, 99, 111, 222, 333]
    for (const seed of seeds) {
      const result = runSeesawSection(createPerturbedPlacements(seed))
      console.log(
        `[domino-seesaw] seed=${seed}: seesawTipped=${result.seesawTippedStep}, ` +
          `strike=${result.strikeStep}, maxTilt=${((result.maxTiltRad * 180) / Math.PI).toFixed(1)}deg`,
      )
      expect(result.seesawTippedStep, `seed=${seed}`).not.toBeNull()
      expect(result.strikeStep, `seed=${seed}`).not.toBeNull()
    }
  })
})
