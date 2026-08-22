import RAPIER from '@dimforge/rapier3d-compat'
import { beforeAll, describe, expect, it } from 'vitest'
import { BIG_HARD_TIMEOUT_MS, FALLEN_TILT_RAD, evaluateCompletion } from './dominoCompletion'
import { createBigCourse } from './dominoCourse'
import {
  BIG_FLAG_LAYOUT,
  type FlagLayoutSpec,
} from './dominoLayout'
import {
  INSPECTION_INTERVAL_MS,
  PHYSICS_TIMESTEP,
  SETTLE_SLEEP_ANGULAR_SPEED_SQUARED_MAX,
  SETTLE_SLEEP_LINEAR_SPEED_SQUARED_MAX,
  SETTLE_SLEEP_TILT_RAD,
} from './dominoPhysics'
import {
  createShepherdMemory,
  planShepherdNudges,
} from './dominoShepherd'
import {
  applyShepherdImpulse,
  applyStartImpulse,
  createDominoWorld,
  isTiltAtLeast,
  tiltOf,
  type DominoBodyEntry,
  type DominoWorld,
} from './dominoWorld'

type ShepherdKind = 'line' | 'branch' | 'flag'
type BranchSubtype = 'arm' | 'spur' | 'connector' | 'feeder' | 'curve' | 'other'

type BigChainResult = {
  flagCount: number
  flagFallenCount: number
  columnFirstSteps: (number | null)[]
  shepherdNudgeCount: number
  shepherdKindCounts: Record<ShepherdKind, number>
  shepherdFlagDistanceCounts: Record<string, number>
  shepherdBranchSubtypeCounts: Record<BranchSubtype, number>
  maxAwakeBodies: number
  stepDurations: number[]
  stepsToAllFlags: number | null
  stepsToCompletion: number | null
  elapsedMs: number
}

// 実測の最大237回に対し、補助が無制限に増える回帰を検出する固定上限。
const BIG_SHEPHERD_MAX_TOTAL_NUDGES = 300
// 列ごとの初倒伏は数ステップ単位で十分V字を判定できるため、全1,600枚の走査を間引く。
const FLAG_SCAN_STEP_INTERVAL = 4
// 性能ログのawake数は全ステップではなく、測定負荷を抑えるため4ステップごとに記録する。
const AWAKE_SAMPLE_STEP_INTERVAL = 4

function entryIsFallen(entry: DominoBodyEntry): boolean {
  return isTiltAtLeast(entry.body, FALLEN_TILT_RAD)
}

function settleActiveDominoes(dominoWorld: DominoWorld): void {
  const ballHandle = dominoWorld.ball?.body.handle
  dominoWorld.world.forEachActiveRigidBody((body) => {
    if (body.handle === ballHandle || !body.isDynamic()) return

    const linearVelocity = body.linvel()
    const angularVelocity = body.angvel()
    const linearSpeedSquared =
      linearVelocity.x * linearVelocity.x +
      linearVelocity.y * linearVelocity.y +
      linearVelocity.z * linearVelocity.z
    const angularSpeedSquared =
      angularVelocity.x * angularVelocity.x +
      angularVelocity.y * angularVelocity.y +
      angularVelocity.z * angularVelocity.z
    if (
      isTiltAtLeast(body, SETTLE_SLEEP_TILT_RAD) &&
      linearSpeedSquared < SETTLE_SLEEP_LINEAR_SPEED_SQUARED_MAX &&
      angularSpeedSquared < SETTLE_SLEEP_ANGULAR_SPEED_SQUARED_MAX
    ) {
      body.sleep()
    }
  })
}

function createShepherdInputs(dominoWorld: DominoWorld) {
  return dominoWorld.bodies.map((entry) => ({
    id: entry.placement.id,
    chainIndex: entry.chainIndex,
    fallen: entryIsFallen(entry),
    sleeping: entry.body.isSleeping(),
  }))
}

function branchSubtypeFor(id: string): BranchSubtype {
  if (id.includes('-arm-')) return 'arm'
  if (id.includes('-spur-')) return 'spur'
  if (id.includes('-connector-')) return 'connector'
  if (id.includes('-feeder-')) return 'feeder'
  if (id.includes('-curve-')) return 'curve'
  return 'other'
}

function recordShepherdNudge(
  entry: DominoBodyEntry,
  layout: FlagLayoutSpec,
  kindCounts: Record<ShepherdKind, number>,
  flagDistanceCounts: Record<string, number>,
  branchSubtypeCounts: Record<BranchSubtype, number>,
): void {
  const kind = entry.placement.kind
  if (kind === 'line' || kind === 'branch' || kind === 'flag') {
    kindCounts[kind] += 1
  }
  if (kind === 'flag') {
    const col = entry.placement.col
    if (col !== undefined) {
      // 左右対称性を確認しやすいよう、旗の中心からの距離ごとに補助回数を集計する。
      const distance = Math.abs(col - (layout.cols - 1) / 2).toFixed(1)
      flagDistanceCounts[distance] = (flagDistanceCounts[distance] ?? 0) + 1
    }
  }
  if (kind === 'branch') {
    const subtype = branchSubtypeFor(entry.placement.id)
    branchSubtypeCounts[subtype] += 1
  }
}

function countAwakeDominoes(dominoWorld: DominoWorld): number {
  let awakeCount = 0
  dominoWorld.world.forEachActiveRigidBody((body) => {
    if (body.isDynamic() && !body.isSleeping()) awakeCount += 1
  })
  return awakeCount
}

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)
  return sorted[Math.max(0, index)]!
}

function stepDurationSummary(values: number[]): {
  p50: number
  p90: number
  p99: number
  max: number
} {
  let maximum = 0
  for (const value of values) maximum = Math.max(maximum, value)
  return {
    p50: percentile(values, 0.5),
    p90: percentile(values, 0.9),
    p99: percentile(values, 0.99),
    max: maximum,
  }
}

function logBigChainResult(label: string, layout: FlagLayoutSpec, result: BigChainResult): void {
  const duration = stepDurationSummary(result.stepDurations)
  const fallSteps = result.stepsToAllFlags ?? result.stepsToCompletion
  const sortedFlagDistanceCounts = Object.fromEntries(
    Object.entries(result.shepherdFlagDistanceCounts).sort(
      ([left], [right]) => Number(left) - Number(right),
    ),
  )
  console.log(
    `[domino-big-chain-performance] label=${label} layout=${layout.cols}x${layout.rows} ` +
      `awakeMax=${result.maxAwakeBodies} ` +
      `stepMs=p50:${duration.p50.toFixed(4)},p90:${duration.p90.toFixed(4)},` +
      `p99:${duration.p99.toFixed(4)},max:${duration.max.toFixed(4)} ` +
      `fallSteps=${fallSteps ?? '未到達'} fallSeconds=${fallSteps === null ? '未到達' : (fallSteps * PHYSICS_TIMESTEP).toFixed(3)}`,
  )
  console.log(
    `[domino-big-chain-shepherd] label=${label} total=${result.shepherdNudgeCount} ` +
      `kind=${JSON.stringify(result.shepherdKindCounts)} ` +
      `flagDistance=${JSON.stringify(sortedFlagDistanceCounts)} ` +
      `branch=${JSON.stringify(result.shepherdBranchSubtypeCounts)}`,
  )
}

function runBigChainSimulation(
  layout: FlagLayoutSpec = BIG_FLAG_LAYOUT,
  maximumSteps = 2_200,
): BigChainResult {
  const course = createBigCourse('jp', layout)
  const dominoWorld = createDominoWorld(RAPIER, course.placements, {
    groundSize: course.groundSize,
    solverIterations: course.solverIterations,
    ballSection: course.ballSection,
  })
  const first = dominoWorld.bodiesById.get(course.startId)
  if (!first) throw new Error('ビッグコースのstartIdが見つかりません')
  applyStartImpulse(first.body, first.placement.chainYaw)

  const flags = dominoWorld.bodies.filter((entry) => entry.placement.kind === 'flag')
  const columnFirstSteps: (number | null)[] = Array.from(
    { length: layout.cols },
    () => null,
  )
  let shepherdMemory = createShepherdMemory()
  let nextInspectionMs = 0
  let shepherdNudgeCount = 0
  const shepherdKindCounts: Record<ShepherdKind, number> = {
    line: 0,
    branch: 0,
    flag: 0,
  }
  const shepherdFlagDistanceCounts: Record<string, number> = {}
  const shepherdBranchSubtypeCounts: Record<BranchSubtype, number> = {
    arm: 0,
    spur: 0,
    connector: 0,
    feeder: 0,
    curve: 0,
    other: 0,
  }
  let maxAwakeBodies = 0
  const stepDurations: number[] = []
  let stepsToAllFlags: number | null = null
  let stepsToCompletion: number | null = null
  const startedAt = performance.now()

  try {
    for (let step = 1; step <= maximumSteps; step += 1) {
      const stepStartedAt = performance.now()
      dominoWorld.world.step()
      stepDurations.push(performance.now() - stepStartedAt)
      if (step === 1 || step % AWAKE_SAMPLE_STEP_INTERVAL === 0) {
        maxAwakeBodies = Math.max(maxAwakeBodies, countAwakeDominoes(dominoWorld))
      }
      const elapsedMs = step * PHYSICS_TIMESTEP * 1_000

      if (elapsedMs >= nextInspectionMs) {
        settleActiveDominoes(dominoWorld)
        const states = dominoWorld.bodies.map((entry) => ({
          tilt: tiltOf(entry.body),
          sleeping: entry.body.isSleeping(),
        }))
        const completion = evaluateCompletion(states, elapsedMs, course.hardTimeoutMs)
        if (completion.complete && stepsToCompletion === null) {
          stepsToCompletion = step
        }

        const shepherd = planShepherdNudges(
          createShepherdInputs(dominoWorld),
          shepherdMemory,
          elapsedMs,
        )
        shepherdMemory = shepherd.memory
        shepherdNudgeCount += shepherd.plan.nudges.length
        for (const nudge of shepherd.plan.nudges) {
          const entry = dominoWorld.bodiesById.get(nudge.id)
          if (entry) {
            recordShepherdNudge(
              entry,
              layout,
              shepherdKindCounts,
              shepherdFlagDistanceCounts,
              shepherdBranchSubtypeCounts,
            )
            applyShepherdImpulse(entry.body, nudge.strength, entry.placement.chainYaw)
          }
        }
        nextInspectionMs += INSPECTION_INTERVAL_MS
      }

      if (step % FLAG_SCAN_STEP_INTERVAL === 0 || step === maximumSteps) {
        let fallenFlagCount = 0
        for (const entry of flags) {
          if (!entryIsFallen(entry)) continue
          fallenFlagCount += 1
          const col = entry.placement.col
          if (col !== undefined && columnFirstSteps[col] === null) {
            columnFirstSteps[col] = step
          }
        }
        if (fallenFlagCount === flags.length && stepsToAllFlags === null) {
          stepsToAllFlags = step
        }
        if (
          stepsToCompletion !== null &&
          fallenFlagCount / flags.length >= 0.95 &&
          columnFirstSteps.every((stepAtColumn) => stepAtColumn !== null)
        ) {
          break
        }
      }
    }

    let flagFallenCount = 0
    for (const entry of flags) {
      if (entryIsFallen(entry)) flagFallenCount += 1
    }
    return {
      flagCount: flags.length,
      flagFallenCount,
      columnFirstSteps,
      shepherdNudgeCount,
      shepherdKindCounts,
      shepherdFlagDistanceCounts,
      shepherdBranchSubtypeCounts,
      maxAwakeBodies,
      stepDurations,
      stepsToAllFlags,
      stepsToCompletion,
      elapsedMs: performance.now() - startedAt,
    }
  } finally {
    dominoWorld.world.free()
  }
}

function expectChainShape(result: BigChainResult, layout: FlagLayoutSpec): void {
  const fallenRatio = result.flagFallenCount / result.flagCount
  expect(fallenRatio).toBeGreaterThanOrEqual(0.95)
  expect(result.columnFirstSteps.every((step) => step !== null)).toBe(true)

  const centerColumns = [Math.floor((layout.cols - 1) / 2), Math.ceil((layout.cols - 1) / 2)]
  const outerColumns = [0, layout.cols - 1]
  const centerAverage =
    centerColumns.reduce((sum, col) => sum + result.columnFirstSteps[col]!, 0) /
    centerColumns.length
  const outerAverage =
    outerColumns.reduce((sum, col) => sum + result.columnFirstSteps[col]!, 0) /
    outerColumns.length
  // 中央から外周へ伝わる時間差が残っていることを、列の平均到達時刻で確認する。
  expect(centerAverage).toBeLessThan(outerAverage)

  const distanceBuckets = new Map<number, number[]>()
  const center = (layout.cols - 1) / 2
  for (let col = 0; col < layout.cols; col += 1) {
    const distance = Math.abs(col - center)
    const values = distanceBuckets.get(distance) ?? []
    values.push(result.columnFirstSteps[col]!)
    distanceBuckets.set(distance, values)
  }
  let previousAverage = -Infinity
  for (const distance of [...distanceBuckets.keys()].sort((a, b) => a - b)) {
    const values = distanceBuckets.get(distance)!
    const average = values.reduce((sum, value) => sum + value, 0) / values.length
    // 物理の揺らぎは許容しつつ、隣接する距離で大きく逆転しないことを確認する。
    expect(average).toBeGreaterThanOrEqual(previousAverage - 80)
    previousAverage = average
  }
  expect(result.shepherdNudgeCount).toBeLessThanOrEqual(BIG_SHEPHERD_MAX_TOTAL_NUDGES)
  expect(result.stepsToCompletion).not.toBeNull()
  expect(result.stepsToCompletion!).toBeLessThanOrEqual(
    Math.ceil(BIG_HARD_TIMEOUT_MS / (PHYSICS_TIMESTEP * 1_000)),
  )
}

describe('big domino chain headless physics', () => {
  beforeAll(async () => {
    await RAPIER.init()
  })

  it('50×32の連鎖が中央から外周へ伝わり95%以上倒れる', { timeout: 120_000 }, () => {
    const result = runBigChainSimulation()
    logBigChainResult('big', BIG_FLAG_LAYOUT, result)
    console.log(
      `[domino-big-chain] flags=${result.flagFallenCount}/${result.flagCount}, ` +
        `columns=${result.columnFirstSteps.join(',')}, ` +
        `nudges=${result.shepherdNudgeCount}, ` +
        `complete=${result.stepsToCompletion ?? '未到達'} steps, ` +
        `elapsed=${result.elapsedMs.toFixed(1)}ms`,
    )
    expectChainShape(result, BIG_FLAG_LAYOUT)
  })

  it.each([
    { cols: 32, rows: 24, chainGroupWeight: 2 },
    { cols: 40, rows: 30, chainGroupWeight: 2 },
  ])('サイズ比較 $cols×$rows でも同じ連鎖が成立する', { timeout: 120_000 }, (layout) => {
    const result = runBigChainSimulation(layout, 2_200)
    logBigChainResult(`${layout.cols}x${layout.rows}`, layout, result)
    console.log(
      `[domino-big-chain-size] layout=${layout.cols}x${layout.rows}, ` +
        `flags=${result.flagFallenCount}/${result.flagCount}, ` +
        `nudges=${result.shepherdNudgeCount}, ` +
        `complete=${result.stepsToCompletion ?? '未到達'} steps, ` +
        `elapsed=${result.elapsedMs.toFixed(1)}ms`,
    )
    expectChainShape(result, layout)
  })
})
