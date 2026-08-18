import RAPIER from '@dimforge/rapier3d-compat'
import { beforeAll, describe, expect, it } from 'vitest'
import { createDominoCourse } from './dominoCourse'
import { applyStartImpulse, createDominoWorld, tiltOf } from './dominoWorld'
import { isFallen } from './dominoCompletion'
import type { DominoPlacement } from './dominoLayout'
import { BALL_RADIUS, BALL_RAIL_WIDTH, getBallRailPieces } from './dominoBall'

const MAX_STEPS = 2_600

type BallRun = {
  ballStartStep: number | null
  triggerTippedStep: number | null
  exitStep: number | null
  receiverStep: number | null
  anyMotionStep: number | null
  triggerMaxTilt: number
  railOutCount: number
  maxSpeed: number
  receiverFallen: boolean
  approachFallenIds: string[]
}

function runBallSection(placements?: DominoPlacement[]): BallRun {
  const course = createDominoCourse('long', 'jp')
  const section = course.ballSection
  if (!section) throw new Error('ロングコースにボール区間がありません')
  const dominoWorld = createDominoWorld(RAPIER, placements ?? course.placements, {
    groundSize: course.groundSize,
    ballSection: section,
  })
  const first = dominoWorld.bodiesById.get(course.startId)
  const receiver = dominoWorld.bodiesById.get(section.receiverDominoId)
  const trigger = dominoWorld.bodiesById.get(section.triggerDominoId)
  const ball = dominoWorld.ball
  if (!first || !receiver || !trigger || !ball) throw new Error('ボール区間の物理要素がありません')
  applyStartImpulse(first.body, first.placement.chainYaw)

  let ballStartStep: number | null = null
  let triggerTippedStep: number | null = null
  let exitStep: number | null = null
  let receiverStep: number | null = null
  let maxSpeed = 0
  let anyMotionStep: number | null = null
  let triggerMaxTilt = 0
  let railOutCount = 0
  let wasOutsideRail = false
  const railPieces = getBallRailPieces(section)
  try {
    for (let step = 1; step <= MAX_STEPS; step += 1) {
      dominoWorld.world.step()
      const velocity = ball.body.linvel()
      const speed = Math.hypot(velocity.x, velocity.y, velocity.z)
      maxSpeed = Math.max(maxSpeed, speed)
      if (anyMotionStep === null && speed > 0.08) anyMotionStep = step
      triggerMaxTilt = Math.max(triggerMaxTilt, tiltOf(trigger.body))
      if (triggerTippedStep === null && tiltOf(trigger.body) > 0.12) triggerTippedStep = step
      if (ballStartStep === null && triggerTippedStep !== null && speed > 0.08) {
        ballStartStep = step
      }
      const position = ball.body.translation()
      if (ballStartStep !== null && exitStep === null) {
        const insideRail = railPieces.some((piece) => {
          const relativeX = position.x - piece.center.x
          const relativeZ = position.z - piece.center.z
          const forward = relativeX * Math.sin(piece.yaw) + relativeZ * Math.cos(piece.yaw)
          const lateral = relativeX * Math.cos(piece.yaw) - relativeZ * Math.sin(piece.yaw)
          return (
            Math.abs(forward) <= piece.length / 2 + BALL_RADIUS &&
            Math.abs(lateral) <= BALL_RAIL_WIDTH / 2 + BALL_RADIUS
          )
        })
        if (!insideRail && !wasOutsideRail) railOutCount += 1
        wasOutsideRail = !insideRail
      }
      if (
        exitStep === null &&
        Math.hypot(position.x - section.exitPoint.x, position.z - section.exitPoint.z) < 0.72
      ) {
        exitStep = step
      }
      if (
        receiverStep === null &&
        isFallen({ tilt: tiltOf(receiver.body), sleeping: receiver.body.isSleeping() })
      ) receiverStep = step
    }
    return {
      ballStartStep,
      triggerTippedStep,
      exitStep,
      receiverStep,
      anyMotionStep,
      triggerMaxTilt,
      railOutCount,
      maxSpeed,
      receiverFallen: isFallen({ tilt: tiltOf(receiver.body), sleeping: receiver.body.isSleeping() }),
      approachFallenIds: dominoWorld.bodies
        .filter((entry) => entry.placement.kind === 'approach')
        .filter((entry) => isFallen({ tilt: tiltOf(entry.body), sleeping: entry.body.isSleeping() }))
        .map((entry) => entry.placement.id),
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

describe('domino ball section headless physics', () => {
  beforeAll(async () => {
    await RAPIER.init()
  })

  it('前段ドミノの接触で球が坂を下り、後段の先頭ドミノを倒す', () => {
    const result = runBallSection()
    console.log(
        `[domino-ball] motion=${result.anyMotionStep}, trigger=${result.triggerTippedStep}, start=${result.ballStartStep}, exit=${result.exitStep}, ` +
        `receiver=${result.receiverStep}, maxSpeed=${result.maxSpeed.toFixed(3)}, ` +
        `triggerTilt=${(result.triggerMaxTilt * 180 / Math.PI).toFixed(1)}, ` +
        `railOut=${result.railOutCount}, ` +
        `approach=${result.approachFallenIds.join(',')}`,
    )
    expect(result.ballStartStep).not.toBeNull()
    expect(result.triggerTippedStep).not.toBeNull()
    expect(result.ballStartStep!).toBeGreaterThanOrEqual(result.triggerTippedStep!)
    expect(result.exitStep).not.toBeNull()
    expect(result.receiverStep).not.toBeNull()
    expect(result.receiverFallen).toBe(true)
    expect(result.railOutCount).toBe(0)
  })

  it('20シードで補助なしにレールを完走し、後段ドミノを始動する', { timeout: 30_000 }, () => {
    const seeds = [
      101, 202, 303, 404, 505, 606, 707, 808, 909, 1001,
      1102, 1203, 1304, 1405, 1506, 1607, 1708, 1809, 1910, 2001,
    ]
    for (const seed of seeds) {
      const result = runBallSection(createPerturbedPlacements(seed))
      console.log(
        `[domino-ball] seed=${seed}: start=${result.ballStartStep}, ` +
          `exit=${result.exitStep}, receiver=${result.receiverStep}, ` +
          `speed=${result.maxSpeed.toFixed(3)}, railOut=${result.railOutCount}`,
      )
      expect(result.ballStartStep, `seed=${seed}`).not.toBeNull()
      expect(result.exitStep, `seed=${seed}`).not.toBeNull()
      expect(result.receiverStep, `seed=${seed}`).not.toBeNull()
      expect(result.receiverFallen, `seed=${seed}`).toBe(true)
      expect(result.railOutCount, `seed=${seed}`).toBe(0)
    }
  })
})

export { runBallSection }
