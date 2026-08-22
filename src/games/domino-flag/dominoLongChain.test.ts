import RAPIER from '@dimforge/rapier3d-compat'
import { beforeAll, describe, expect, it } from 'vitest'
import { createDominoCourse } from './dominoCourse'
import { evaluateCompletion, isFallen } from './dominoCompletion'
import { PHYSICS_TIMESTEP, INSPECTION_INTERVAL_MS } from './dominoPhysics'
import {
  applyShepherdImpulse,
  applyStartImpulse,
  createDominoWorld,
  tiltOf,
  type DominoBodyEntry,
} from './dominoWorld'
import { createShepherdMemory, planShepherdNudges } from './dominoShepherd'
import type { DominoPlacement } from './dominoLayout'
import {
  advanceSeesawState,
  createSeesawRuntimeState,
  seesawPlankRotation,
} from './dominoSeesaw'

// ボール区間・シーソー区間を挟んだ後も、国旗160枚がsleepへ収束するところまで確認する。
const SIMULATION_STEPS = 8_500
const FLAG_COUNT = 160
const POSITION_JITTER = 0.005
const YAW_JITTER_RAD = (0.5 * Math.PI) / 180

type LongChainResult = {
  approachCount: number
  approachFallenCount: number
  flagFallenCount: number
  shepherdNudgeCount: number
  sleepingCount: number
  sleepingCountAtCompletion: number | null
  dominoCount: number
  stepsToAllApproach: number | null
  stepsToAllFlags: number | null
  stepsToCompletion: number | null
  flagFallenIds: string[]
}

function isEntryFallen(entry: DominoBodyEntry): boolean {
  return isFallen({
    tilt: tiltOf(entry.body),
    sleeping: entry.body.isSleeping(),
  })
}

function runLongChainSimulation(
  withShepherd: boolean,
  placements: DominoPlacement[],
): LongChainResult {
  const course = createDominoCourse('long', 'jp')
  const dominoWorld = createDominoWorld(RAPIER, placements, {
    groundSize: course.groundSize,
    ballSection: course.ballSection,
    secondBallSection: course.seesawBallSection,
    seesawSection: course.seesawSection,
  })
  const first = dominoWorld.bodiesById.get(course.startId)
  if (!first) throw new Error('approach-0が見つかりません')
  applyStartImpulse(first.body, first.placement.chainYaw)

  const approaches = dominoWorld.bodies.filter(
    (entry) => entry.placement.kind === 'approach',
  )
  const flags = dominoWorld.bodies.filter((entry) => entry.placement.kind === 'flag')
  let shepherdMemory = createShepherdMemory()
  let nextInspectionMs = 0
  let shepherdNudgeCount = 0
  let stepsToAllApproach: number | null = null
  let stepsToAllFlags: number | null = null
  let stepsToCompletion: number | null = null
  let sleepingCountAtCompletion: number | null = null
  let seesawState = createSeesawRuntimeState()

  try {
    for (let step = 1; step <= SIMULATION_STEPS; step += 1) {
      if (dominoWorld.seesaw !== null && dominoWorld.secondBall !== null && !seesawState.settled) {
        seesawState = advanceSeesawState(
          seesawState,
          dominoWorld.seesaw.section,
          dominoWorld.secondBall.body.translation(),
          PHYSICS_TIMESTEP,
        )
        dominoWorld.seesaw.body.setNextKinematicRotation(
          seesawPlankRotation(dominoWorld.seesaw.section.yaw, seesawState.tiltRad),
        )
        if (seesawState.justSettled) {
          // kinematicのままだと接触したドミノがsleepできず起き続けるため、実機と同じく固定物へ切り替える。
          dominoWorld.seesaw.body.setBodyType(RAPIER.RigidBodyType.Fixed, true)
        }
      }
      dominoWorld.world.step()
      const elapsedMs = step * PHYSICS_TIMESTEP * 1000

      if (withShepherd && elapsedMs >= nextInspectionMs) {
        const receiverDominoId = course.ballSection?.receiverDominoId ?? null
        const seesawReceiverDominoId = course.seesawBallSection?.receiverDominoId ?? null
        const shepherd = planShepherdNudges(
          dominoWorld.bodies.map((entry) => ({
            id: entry.placement.id,
            chainIndex: entry.chainIndex,
            fallen: isEntryFallen(entry),
            sleeping: entry.body.isSleeping(),
            nudgeDisabled:
              entry.placement.id === receiverDominoId ||
              entry.placement.id === seesawReceiverDominoId,
          })),
          shepherdMemory,
          elapsedMs,
        )
        shepherdMemory = shepherd.memory
        shepherdNudgeCount += shepherd.plan.nudges.length
        for (const nudge of shepherd.plan.nudges) {
          const entry = dominoWorld.bodiesById.get(nudge.id)
          if (entry) {
            applyShepherdImpulse(entry.body, nudge.strength, entry.placement.chainYaw)
          }
        }
        nextInspectionMs += INSPECTION_INTERVAL_MS
      }

      if (
        stepsToAllApproach === null &&
        approaches.every(isEntryFallen)
      ) {
        stepsToAllApproach = step
      }
      if (stepsToAllFlags === null && flags.every(isEntryFallen)) {
        stepsToAllFlags = step
      }

      if (stepsToCompletion === null) {
        const completion = evaluateCompletion(
          dominoWorld.bodies.map((entry) => ({
            tilt: tiltOf(entry.body),
            sleeping: entry.body.isSleeping(),
          })),
          elapsedMs,
          course.hardTimeoutMs,
        )
        if (completion.complete) {
          stepsToCompletion = step
          sleepingCountAtCompletion = dominoWorld.bodies.filter((entry) => entry.body.isSleeping()).length
        }
      }
    }

    return {
      approachCount: approaches.length,
      approachFallenCount: approaches.filter(isEntryFallen).length,
      flagFallenCount: flags.filter(isEntryFallen).length,
      shepherdNudgeCount,
      sleepingCount: dominoWorld.bodies.filter((entry) => entry.body.isSleeping()).length,
      sleepingCountAtCompletion,
      dominoCount: dominoWorld.bodies.length,
      stepsToAllApproach,
      stepsToAllFlags,
      stepsToCompletion,
      flagFallenIds: flags.filter(isEntryFallen).map((entry) => entry.placement.id),
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

/** 実機での設置誤差と向きのずれを再現する決定論的な揺らぎ。 */
function createPerturbedPlacements(seed: number): DominoPlacement[] {
  const random = createSeededRandom(seed)
  const offset = (range: number) => (random() * 2 - 1) * range
  return createDominoCourse('long', 'jp').placements.map((placement) => {
    const yawOffset = offset(YAW_JITTER_RAD)
    return {
      ...placement,
      x: placement.x + offset(POSITION_JITTER),
      z: placement.z + offset(POSITION_JITTER),
      // approachはyawとchainYawを同じ量だけずらし、姿勢と連鎖方向の関係を保つ。
      yaw:
        placement.yaw === undefined ? undefined : placement.yaw + yawOffset,
      chainYaw:
        placement.chainYaw === undefined
          ? undefined
          : placement.chainYaw + yawOffset,
    }
  })
}

function logResult(label: string, result: LongChainResult): void {
  console.log(
    `[domino-long-chain] ${label}: ` +
      `approach=${result.approachFallenCount}/${result.approachCount} ` +
      `(${((result.approachFallenCount / result.approachCount) * 100).toFixed(1)}%), ` +
      `flags=${result.flagFallenCount}/${FLAG_COUNT} ` +
      `(${((result.flagFallenCount / FLAG_COUNT) * 100).toFixed(1)}%), ` +
      `nudges=${result.shepherdNudgeCount}, ` +
      `approachAll=${result.stepsToAllApproach ?? '未到達'} steps, ` +
      `flagsAll=${result.stepsToAllFlags ?? '未到達'} steps, ` +
      `complete=${result.stepsToCompletion ?? '未到達'} steps`,
  )
}

describe('long domino chain headless physics', () => {
  beforeAll(async () => {
    await RAPIER.init()
  })

  it('shepherdなしで道中と国旗160個が倒れ、完成判定に到達する', { timeout: 60_000 }, () => {
    const result = runLongChainSimulation(false, createDominoCourse('long', 'jp').placements)
    logResult('shepherdなし', result)

    expect(result.approachFallenCount).toBe(result.approachCount)
    expect(result.flagFallenCount).toBe(FLAG_COUNT)
    expect(result.stepsToAllApproach).not.toBeNull()
    expect(result.stepsToAllFlags).not.toBeNull()
    expect(result.stepsToCompletion).not.toBeNull()
    expect(result.sleepingCountAtCompletion).toBe(result.dominoCount)
  })

  it('shepherdありでも完走し、介入は小さい', { timeout: 60_000 }, () => {
    const result = runLongChainSimulation(true, createDominoCourse('long', 'jp').placements)
    logResult('shepherdあり', result)

    expect(result.approachFallenCount).toBe(result.approachCount)
    expect(result.flagFallenCount).toBe(FLAG_COUNT)
    expect(result.stepsToCompletion).not.toBeNull()
    expect(result.shepherdNudgeCount).toBeLessThan(10)
    expect(result.sleepingCountAtCompletion).toBe(result.dominoCount)
  })

  it('10シードの微小揺らぎをshepherdなしで自然完走する', { timeout: 120_000 }, () => {
    const seeds = [101, 202, 303, 404, 505, 606, 707, 808, 909, 1001]
    let completedCount = 0

    for (const seed of seeds) {
      const result = runLongChainSimulation(false, createPerturbedPlacements(seed))
      logResult(`shepherdなし perturbation seed=${seed}`, result)
      if (result.flagFallenCount !== FLAG_COUNT) {
        console.log(
          `[domino-long-chain] seed=${seed} missing=${Array.from({ length: FLAG_COUNT }, (_, index) => {
            const row = Math.floor(index / 16)
            const col = index % 16
            return `flag-${row}-${col}`
          }).filter((id) => !result.flagFallenIds.includes(id)).join(',')}`,
        )
      }
      if (result.stepsToCompletion !== null) completedCount += 1

      expect(result.approachFallenCount, `seed=${seed}`).toBe(result.approachCount)
      expect(result.flagFallenCount, `seed=${seed}`).toBe(FLAG_COUNT)
      expect(result.stepsToCompletion, `seed=${seed}`).not.toBeNull()
      expect(result.sleepingCountAtCompletion, `seed=${seed}`).toBe(result.dominoCount)
    }

    console.log(`[domino-long-chain] shepherdなし自然完走率=${completedCount}/${seeds.length}`)
    expect(completedCount).toBe(seeds.length)
  })
})
