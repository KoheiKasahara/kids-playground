import RAPIER from '@dimforge/rapier3d-compat'
import { beforeAll, describe, expect, it } from 'vitest'
import { PHYSICS_TIMESTEP, INSPECTION_INTERVAL_MS } from './dominoPhysics'
import {
  FLAG_COLS,
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
import { createShepherdMemory, planShepherdNudges } from './dominoShepherd'
import { evaluateCompletion, isFallen } from './dominoCompletion'

const SIMULATION_STEPS = 1500

type FallenBreakdown = {
  lineFallenCount: number
  lineFallenIds: string[]
  branchFallenCount: number
  flagFallenByRow: number[]
}

type ChainSimulationResult = {
  flagFallenCount: number
  flagFaceUpCount: number
  sleepingCount: number
  dominoCount: number
  shepherdNudgeCount: number
  stepsTo95PercentFlags: number | null
  stepsToAllFlags: number | null
  stepsToCompletion: number | null
  columnFirstSteps: (number | null)[]
  breakdown: FallenBreakdown
}

function isEntryFallen(entry: DominoBodyEntry): boolean {
  return isFallen({
    tilt: tiltOf(entry.body),
    sleeping: entry.body.isSleeping(),
  })
}

function summarizeWorld(dominoWorld: DominoWorld): FallenBreakdown {
  const flagFallenByRow = Array.from({ length: FLAG_ROWS }, () => 0)
  const lineFallenIds: string[] = []
  let lineFallenCount = 0
  let branchFallenCount = 0

  for (const entry of dominoWorld.bodies) {
    if (!isEntryFallen(entry)) continue
    if (entry.placement.kind === 'line') {
      lineFallenCount += 1
      lineFallenIds.push(entry.placement.id)
    }
    if (entry.placement.kind === 'branch') branchFallenCount += 1
    if (entry.placement.kind === 'flag' && entry.placement.row !== undefined) {
      flagFallenByRow[entry.placement.row] += 1
    }
  }

  return { lineFallenCount, lineFallenIds, branchFallenCount, flagFallenByRow }
}

function formatRows(flagFallenByRow: number[]): string {
  return flagFallenByRow
    .map((count, row) => `row ${row}: ${count}/16`)
    .join(', ')
}

function formatColumns(columnFirstSteps: (number | null)[]): string {
  return columnFirstSteps
    .map((step, col) => `col ${col}: ${step ?? '未到達'}`)
    .join(', ')
}

function runChainSimulation(
  withShepherd: boolean,
  placements: DominoPlacement[] = createDominoPlacements(),
): ChainSimulationResult {
  const dominoWorld = createDominoWorld(RAPIER, placements)
  const first = dominoWorld.bodiesById.get('line-0')
  if (!first) throw new Error('line-0が見つかりません')
  applyStartImpulse(first.body)

  const flags = dominoWorld.bodies.filter((entry) => entry.placement.kind === 'flag')
  const columnFirstSteps: (number | null)[] = Array.from(
    { length: FLAG_COLS },
    () => null,
  )
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
            fallen: isEntryFallen(entry),
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

      for (const entry of flags) {
        const col = entry.placement.col
        if (col !== undefined && columnFirstSteps[col] === null && isEntryFallen(entry)) {
          columnFirstSteps[col] = step
        }
      }

      const fallenFlags = flags.filter(isEntryFallen).length
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

    const flagFallenCount = flags.filter(isEntryFallen).length
    const flagFaceUpCount = flags.filter((entry) => flagFaceUpY(entry.body) > 0.7).length

    return {
      flagFallenCount,
      flagFaceUpCount,
      sleepingCount: dominoWorld.bodies.filter((entry) => entry.body.isSleeping()).length,
      dominoCount: dominoWorld.bodies.length,
      shepherdNudgeCount,
      stepsTo95PercentFlags,
      stepsToAllFlags,
      stepsToCompletion,
      columnFirstSteps,
      breakdown: summarizeWorld(dominoWorld),
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

/** 決定論的な微小誤差を全配置へ加えて、実機に近い配置揺らぎを再現する。 */
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

  it('shepherd補助ありで国旗160個が倒れ、-Z面を上にして完成する', { timeout: 25_000 }, () => {
    const result = runChainSimulation(true)

    console.log(
      `[domino-chain] shepherdあり: ${result.flagFallenCount}/160 flags, ` +
        `${result.flagFaceUpCount}/160 faces up, ` +
        `nudges=${result.shepherdNudgeCount}, ` +
        `95%到達=${result.stepsTo95PercentFlags ?? '未到達'} steps, ` +
        `all=${result.stepsToAllFlags ?? '未到達'} steps, ` +
        `complete=${result.stepsToCompletion ?? '未到達'} steps`,
    )
    expect(result.flagFallenCount).toBe(160)
    expect(result.flagFaceUpCount / 160).toBeGreaterThanOrEqual(0.95)
    expect(result.sleepingCount).toBe(result.dominoCount)
    expect(result.shepherdNudgeCount).toBeLessThan(10)
    expect(result.stepsTo95PercentFlags).not.toBeNull()
    expect(result.stepsToCompletion).not.toBeNull()
  })

  it('shepherd補助なしの自然倒伏率がPhase 1相当以上になる', { timeout: 25_000 }, () => {
    const result = runChainSimulation(false)
    const fallenRatio = result.flagFallenCount / 160

    console.log(
      `[domino-chain] shepherdなし: ${result.flagFallenCount}/160 flags ` +
        `(${(fallenRatio * 100).toFixed(1)}%), ` +
        `all=${result.stepsToAllFlags ?? '未到達'} steps, ` +
        `line=${result.breakdown.lineFallenCount}/12, ` +
        `ids=${result.breakdown.lineFallenIds.join(',')}, ` +
        `branch=${result.breakdown.branchFallenCount}, ` +
        formatRows(result.breakdown.flagFallenByRow),
    )
    expect(fallenRatio).toBeGreaterThanOrEqual(0.9)
  })

  it('列ごとの初倒伏が中央から外側へなだらかに広がる', { timeout: 25_000 }, () => {
    const result = runChainSimulation(false)
    const steps = result.columnFirstSteps
    const center = steps.slice(6, 10).map((step) => step!)
    const outside = [...steps.slice(0, 6), ...steps.slice(10)].map((step) => step!)
    const left = [steps[6]!, steps[5]!, steps[4]!, steps[3]!, steps[2]!, steps[1]!, steps[0]!]
    const right = [steps[9]!, steps[10]!, steps[11]!, steps[12]!, steps[13]!, steps[14]!, steps[15]!]

    console.log(`[domino-chain] 列別初倒伏: ${formatColumns(steps)}`)
    expect(steps.every((step) => step !== null)).toBe(true)
    expect(Math.max(...center) - Math.min(...center)).toBeLessThanOrEqual(4)
    expect(Math.max(...center)).toBeLessThanOrEqual(Math.min(...outside) + 4)

    for (let index = 1; index < left.length; index += 1) {
      expect(left[index]!).toBeGreaterThanOrEqual(left[index - 1]! - 35)
    }
    for (let index = 1; index < right.length; index += 1) {
      expect(right[index]!).toBeGreaterThanOrEqual(right[index - 1]! - 35)
    }

    const fastest = Math.min(...steps.map((step) => step!))
    const secondFastest = [...steps.map((step) => step!)].sort((a, b) => a - b)[2]!
    expect(secondFastest - fastest).toBeLessThan(50)
    for (let col = 0; col < FLAG_COLS / 2; col += 1) {
      expect(Math.abs(steps[col]! - steps[FLAG_COLS - 1 - col]!)).toBeLessThan(70)
    }
  })

  it('10個の決定論的配置揺らぎを補助ありで完走する', { timeout: 30_000 }, () => {
    const seeds = [101, 202, 303, 404, 505, 606, 707, 808, 909, 1001]
    const nudgeCounts: number[] = []
    let completedCount = 0

    for (const seed of seeds) {
      const result = runChainSimulation(true, createPerturbedPlacements(seed))
      nudgeCounts.push(result.shepherdNudgeCount)
      if (result.stepsToCompletion !== null) completedCount += 1
      console.log(
        `[domino-chain] perturbation seed=${seed}: ` +
          `${result.flagFallenCount}/160, faces=${result.flagFaceUpCount}/160, ` +
          `nudges=${result.shepherdNudgeCount}, ` +
          `complete=${result.stepsToCompletion ?? '未到達'} steps, ` +
          formatColumns(result.columnFirstSteps),
      )
      expect(result.flagFallenCount, `seed=${seed}`).toBe(160)
      expect(result.flagFaceUpCount / 160, `seed=${seed}`).toBeGreaterThanOrEqual(0.95)
      expect(result.shepherdNudgeCount, `seed=${seed}`).toBeLessThan(10)
      expect(result.sleepingCount, `seed=${seed}`).toBe(result.dominoCount)
      expect(result.stepsToCompletion, `seed=${seed}`).not.toBeNull()
    }

    const averageNudges = nudgeCounts.reduce((sum, count) => sum + count, 0) / seeds.length
    console.log(
      `[domino-chain] shepherd完走率=${completedCount}/${seeds.length}, ` +
        `平均介入数=${averageNudges.toFixed(2)}`,
    )
    expect(completedCount).toBe(seeds.length)
    expect(averageNudges).toBeLessThan(10)
  })
})
