import RAPIER from '@dimforge/rapier3d-compat'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  PHYSICS_TIMESTEP,
  INSPECTION_INTERVAL_MS,
} from './dominoPhysics'
import {
  FLAG_ROWS,
  createDominoPlacements,
  type DominoPlacement,
} from './dominoLayout'
import {
  applyShepherdImpulse,
  applyStartImpulse,
  createDominoWorld,
  flagFaceUpY,
  tiltOf,
  type DominoBodyEntry,
  type DominoWorld,
} from './dominoWorld'
import {
  createShepherdMemory,
  planShepherdNudges,
} from './dominoShepherd'
import { evaluateCompletion, isFallen } from './dominoCompletion'

const SIMULATION_STEPS = 900

type FallenBreakdown = {
  lineFallenCount: number
  triggerFallen: boolean
  flagFallenByRow: number[]
}

type TriggerDisplacement = {
  dx: number
  dz: number
  distance: number
}

type ChainSimulationResult = {
  flagFallenCount: number
  flagFaceUpCount: number
  sleepingCount: number
  shepherdNudgeCount: number
  stepsTo95PercentFlags: number | null
  stepsToAllFlags: number | null
  stepsToCompletion: number | null
  breakdown: FallenBreakdown
  triggerDisplacement: TriggerDisplacement | null
}

function isEntryFallen(entry: DominoBodyEntry): boolean {
  return isFallen({
    tilt: tiltOf(entry.body),
    sleeping: entry.body.isSleeping(),
  })
}

function summarizeWorld(dominoWorld: DominoWorld): FallenBreakdown {
  const flagFallenByRow = Array.from({ length: FLAG_ROWS }, () => 0)
  let lineFallenCount = 0
  let triggerFallen = false

  for (const entry of dominoWorld.bodies) {
    if (!isEntryFallen(entry)) continue
    if (entry.placement.kind === 'line') lineFallenCount += 1
    if (entry.placement.kind === 'trigger') triggerFallen = true
    if (entry.placement.kind === 'flag' && entry.placement.row !== undefined) {
      flagFallenByRow[entry.placement.row] += 1
    }
  }

  return { lineFallenCount, triggerFallen, flagFallenByRow }
}

function formatRows(flagFallenByRow: number[]): string {
  return flagFallenByRow
    .map((count, row) => `row ${row}: ${count}/16`)
    .join(', ')
}

function runPhysicalExperiment(
  placements: DominoPlacement[],
  startIds: string[],
): FallenBreakdown {
  const dominoWorld = createDominoWorld(RAPIER, placements)
  try {
    for (const id of startIds) {
      const entry = dominoWorld.bodiesById.get(id)
      if (entry) applyStartImpulse(entry.body)
    }
    for (let step = 0; step < SIMULATION_STEPS; step += 1) {
      dominoWorld.world.step()
    }
    return summarizeWorld(dominoWorld)
  } finally {
    dominoWorld.world.free()
  }
}

function runChainSimulation(
  withShepherd: boolean,
  placements: DominoPlacement[] = createDominoPlacements(),
): ChainSimulationResult {
  const dominoWorld = createDominoWorld(RAPIER, placements)
  const first = dominoWorld.bodiesById.get('line-0')
  if (!first) throw new Error('line-0が生成されていません')
  applyStartImpulse(first.body)

  let shepherdMemory = createShepherdMemory()
  let nextInspectionMs = 0
  let shepherdNudgeCount = 0
  let stepsTo95PercentFlags: number | null = null
  let stepsToAllFlags: number | null = null
  let stepsToCompletion: number | null = null

  try {
    for (let step = 1; step <= SIMULATION_STEPS; step += 1) {
      dominoWorld.world.step()
      const elapsedMs = step * PHYSICS_TIMESTEP * 1000

      if (withShepherd && elapsedMs >= nextInspectionMs) {
        const shepherd = planShepherdNudges(
          dominoWorld.bodies.map((entry) => ({
            id: entry.placement.id,
            chainIndex: entry.chainIndex,
            fallen: isFallen({
              tilt: tiltOf(entry.body),
              sleeping: entry.body.isSleeping(),
            }),
            sleeping: entry.body.isSleeping(),
          })),
          shepherdMemory,
          elapsedMs,
        )
        shepherdMemory = shepherd.memory
        shepherdNudgeCount += shepherd.plan.nudges.length
        for (const nudge of shepherd.plan.nudges) {
          const entry = dominoWorld.bodiesById.get(nudge.id)
          if (entry) applyShepherdImpulse(entry.body, nudge.strength)
        }
        nextInspectionMs += INSPECTION_INTERVAL_MS
      }

      const flags = dominoWorld.bodies.filter((entry) => entry.placement.kind === 'flag')
      const fallenFlags = flags.filter((entry) =>
        isFallen({ tilt: tiltOf(entry.body), sleeping: entry.body.isSleeping() }),
      ).length
      if (
        stepsTo95PercentFlags === null &&
        fallenFlags / flags.length >= 0.95
      ) {
        stepsTo95PercentFlags = step
      }
      if (stepsToAllFlags === null && fallenFlags === flags.length) {
        stepsToAllFlags = step
      }

      if (stepsToCompletion === null) {
        const completion = evaluateCompletion(
          dominoWorld.bodies.map((entry) => ({
            tilt: tiltOf(entry.body),
            sleeping: entry.body.isSleeping(),
          })),
          elapsedMs,
        )
        if (completion.complete) stepsToCompletion = step
      }
    }

    const flags = dominoWorld.bodies.filter((entry) => entry.placement.kind === 'flag')
    const breakdown = summarizeWorld(dominoWorld)
    const flagFallenCount = flags.filter((entry) =>
      isFallen({ tilt: tiltOf(entry.body), sleeping: entry.body.isSleeping() }),
    ).length
    const flagFaceUpCount = flags.filter((entry) => flagFaceUpY(entry.body) > 0.7).length
    const triggerEntry = dominoWorld.bodiesById.get('trigger-bar')
    const triggerPlacement = placements.find((placement) => placement.kind === 'trigger')
    const triggerTranslation = triggerEntry?.body.translation()
    const triggerDisplacement =
      triggerPlacement && triggerTranslation
        ? {
            dx: triggerTranslation.x - triggerPlacement.x,
            dz: triggerTranslation.z - triggerPlacement.z,
            distance: Math.hypot(
              triggerTranslation.x - triggerPlacement.x,
              triggerTranslation.z - triggerPlacement.z,
            ),
          }
        : null

    return {
      flagFallenCount,
      flagFaceUpCount,
      sleepingCount: dominoWorld.bodies.filter((entry) => entry.body.isSleeping()).length,
      shepherdNudgeCount,
      stepsTo95PercentFlags,
      stepsToAllFlags,
      stepsToCompletion,
      breakdown,
      triggerDisplacement,
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

/** 配置誤差があっても連鎖が保てるかを、再現可能な乱数で確認する。 */
function createPerturbedPlacements(seed: number): DominoPlacement[] {
  const random = createSeededRandom(seed)
  const offset = () => (random() * 2 - 1) * 0.005

  return createDominoPlacements().map((placement) => ({
    ...placement,
    x: placement.x + offset(),
    z: placement.z + offset(),
  }))
}

describe('domino chain headless physics', () => {
  beforeAll(async () => {
    await RAPIER.init()
  })

  it('shepherd補助ありで国旗の98%以上が倒れ、-Z面が上を向く', { timeout: 15_000 }, () => {
    const result = runChainSimulation(true)

    console.log(
      `[domino-chain] shepherd bar displacement: ` +
        `dx=${result.triggerDisplacement?.dx.toFixed(3) ?? 'n/a'}, ` +
        `dz=${result.triggerDisplacement?.dz.toFixed(3) ?? 'n/a'}, ` +
        `distance=${result.triggerDisplacement?.distance.toFixed(3) ?? 'n/a'}`,
    )

    console.log(
      `[domino-chain] shepherdあり: ${result.flagFallenCount}/160 flags, ` +
        `${result.flagFaceUpCount}/160 faces up, ` +
        `nudges=${result.shepherdNudgeCount}, ` +
        `95%到達=${result.stepsTo95PercentFlags ?? '未到達'} steps, ` +
        `all=${result.stepsToAllFlags ?? '未到達'} steps, ` +
        `complete=${result.stepsToCompletion ?? '未到達'} steps`,
    )
    expect(
      result.flagFallenCount / 160,
      `行内訳: ${formatRows(result.breakdown.flagFallenByRow)}`,
    ).toBeGreaterThanOrEqual(0.98)
    expect(result.flagFaceUpCount / 160).toBeGreaterThanOrEqual(0.95)
    expect(result.sleepingCount).toBe(173)
    expect(result.shepherdNudgeCount).toBeLessThan(10)
    expect(result.stepsTo95PercentFlags).not.toBeNull()
  })

  it('shepherd補助なしの純粋な物理の倒伏率を記録する', { timeout: 15_000 }, () => {
    const result = runChainSimulation(false)
    const fallenRatio = result.flagFallenCount / 160

    console.log(
      `[domino-chain] no shepherd bar displacement: ` +
        `dx=${result.triggerDisplacement?.dx.toFixed(3) ?? 'n/a'}, ` +
        `dz=${result.triggerDisplacement?.dz.toFixed(3) ?? 'n/a'}, ` +
        `distance=${result.triggerDisplacement?.distance.toFixed(3) ?? 'n/a'}`,
    )

    console.log(
      `[domino-chain] shepherdなし: ${result.flagFallenCount}/160 flags ` +
        `(${(fallenRatio * 100).toFixed(1)}%), ${SIMULATION_STEPS} steps, ` +
        `all=${result.stepsToAllFlags ?? '未到達'} steps, ` +
        `complete=${result.stepsToCompletion ?? '未到達'} steps`,
    )
    console.log(
      `[domino-chain] shepherdなし内訳: line=${result.breakdown.lineFallenCount}/12, ` +
        `trigger=${result.breakdown.triggerFallen ? 'fallen' : 'standing'}, ` +
        formatRows(result.breakdown.flagFallenByRow),
    )
    expect(
      fallenRatio,
      `行内訳: ${formatRows(result.breakdown.flagFallenByRow)}`,
    ).toBeGreaterThanOrEqual(0.9)
  })

  it('補助なしの入口と直線を切り分ける', { timeout: 15_000 }, () => {
    const placements = createDominoPlacements()
    const flagPlacements = placements.filter((placement) => placement.kind === 'flag')
    const rowZeroIds = flagPlacements
      .filter((placement) => placement.row === 0)
      .map((placement) => placement.id)
    const directFlagResult = runPhysicalExperiment(flagPlacements, rowZeroIds)

    const linePlacements = placements.filter((placement) => placement.kind === 'line')
    const lineResult = runPhysicalExperiment(linePlacements, ['line-0'])

    console.log(
      `[domino-chain] 実験A（row 0へ直接入力）: ` +
        formatRows(directFlagResult.flagFallenByRow),
    )
    console.log(
      `[domino-chain] 実験B（直線のみ）: ` +
        `line=${lineResult.lineFallenCount}/12`,
    )
    expect(directFlagResult.flagFallenByRow).toHaveLength(FLAG_ROWS)
    expect(lineResult.lineFallenCount).toBeGreaterThanOrEqual(0)
  })

  it('固定シードの微小な配置誤差でも補助なし連鎖を維持する', { timeout: 30_000 }, () => {
    const seeds = [101, 202, 303, 404, 505]

    for (const seed of seeds) {
      const result = runChainSimulation(false, createPerturbedPlacements(seed))
      const fallenRatio = result.flagFallenCount / 160

      console.log(
        `[domino-chain] perturbation seed=${seed}: ` +
          `${result.flagFallenCount}/160 (${(fallenRatio * 100).toFixed(1)}%), ` +
          formatRows(result.breakdown.flagFallenByRow),
      )
      expect(
        fallenRatio,
        `seed=${seed}: ${formatRows(result.breakdown.flagFallenByRow)}`,
      ).toBeGreaterThanOrEqual(0.9)
    }
  })
})
