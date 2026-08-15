import { describe, expect, it } from 'vitest'
import { simulateAdventureRun } from './adventureSimulation'

const TRIAL_COUNT = 24
const SEED_BASE = 0x1f2e3d4c
const SEED_STEP = 7919

describe('adventure fixed-step play-time simulation', () => {
  it('複数シードでゴールへ到達し、テンポと開始揺らぎを回帰検証する', () => {
    const results = Array.from({ length: TRIAL_COUNT }, (_, index) =>
      simulateAdventureRun(SEED_BASE + index * SEED_STEP),
    )
    const seconds = results.map((result) => result.totalSeconds).sort((a, b) => a - b)
    const median = (seconds[TRIAL_COUNT / 2 - 1] + seconds[TRIAL_COUNT / 2]) / 2
    const min = seconds[0]
    const max = seconds[seconds.length - 1]
    const mean = seconds.reduce((sum, value) => sum + value, 0) / seconds.length
    const dwellMeanByArea = Object.fromEntries(
      ['sky', 'forest', 'cave', 'river', 'cloud', 'goal'].map((areaId) => [
        areaId,
        results.reduce((sum, result) => sum + result.dwellSecondsByArea[areaId], 0) / results.length,
      ]),
    )
    const dwellMeanByVisitedRunArea = Object.fromEntries(
      ['sky', 'forest', 'cave', 'river', 'cloud', 'goal'].map((areaId) => {
        const visitedResults = results.filter((result) => result.visitedAreaIds.includes(areaId))
        return [
          areaId,
          visitedResults.reduce((sum, result) => sum + result.dwellSecondsByArea[areaId], 0) / visitedResults.length,
        ]
      }),
    )
    const stallNudgeTotalsByArea = results.reduce<Record<string, number>>((totals, result) => {
      for (const [areaId, count] of Object.entries(result.stallNudgeCountByArea)) {
        totals[areaId] = (totals[areaId] ?? 0) + count
      }
      return totals
    }, {})
    const routeCounts = results.reduce<Record<string, number>>((counts, result) => {
      const route = result.visitedAreaIds.join('>')
      counts[route] = (counts[route] ?? 0) + 1
      return counts
    }, {})
    const caveRuns = results.filter((result) => result.visitedAreaIds.includes('cave')).length
    const riverRuns = results.filter((result) => result.visitedAreaIds.includes('river')).length
    const repeatedResults = Array.from({ length: TRIAL_COUNT }, (_, index) =>
      simulateAdventureRun(SEED_BASE + index * SEED_STEP),
    )
    const totalTimeSignatures = new Set(results.map((result) => result.totalSeconds))

    console.info(
      `adventure simulation (${TRIAL_COUNT} trials): min=${min.toFixed(3)}s median=${median.toFixed(3)}s ` +
        `mean=${mean.toFixed(3)}s max=${max.toFixed(3)}s ` +
        `dwellAll=${JSON.stringify(dwellMeanByArea)} ` +
        `dwellVisited=${JSON.stringify(dwellMeanByVisitedRunArea)}`,
    )
    console.info(`adventure routes: ${JSON.stringify(routeCounts)}`)
    console.info(
      `adventure safety: maxStallNudge=${Math.max(...results.map((result) => result.stallNudgeCount))} ` +
        `nudgeByArea=${JSON.stringify(stallNudgeTotalsByArea)} ` +
        `maxAreaTimeout=${Math.max(...results.map((result) => result.areaTimeoutCount))} ` +
        `maxRescue=${Math.max(...results.map((result) => result.rescueCount))} ` +
        `maxGoalRescueDrop=${Math.max(...results.map((result) => result.goalRescueDropCount))}`,
    )
    console.info(`adventure variance: distinctTotals=${totalTimeSignatures.size}/${TRIAL_COUNT}`)

    expect(results.every((result) => result.completed)).toBe(true)
    expect(results.every((result) => result.cupIn)).toBe(true)
    expect(results.every((result) => /^sky>forest>(cave|river)>cloud>goal$/.test(result.visitedAreaIds.join('>')))).toBe(true)
    expect(caveRuns).toBeGreaterThanOrEqual(4)
    expect(riverRuns).toBeGreaterThanOrEqual(4)
    expect(repeatedResults.map((result) => result.visitedAreaIds)).toEqual(results.map((result) => result.visitedAreaIds))
    expect(results.every((result) => result.stallNudgeCount === 0)).toBe(true)
    expect(results.every((result) => result.goalRescueDropCount === 0)).toBe(true)
    expect(results.every((result) => result.rescueCount === 0)).toBe(true)
    expect(results.every((result) => result.areaTimeoutCount === 0)).toBe(true)
    expect(min).toBeGreaterThanOrEqual(20)
    expect(median).toBeLessThanOrEqual(32)
    expect(max).toBeLessThanOrEqual(40)

    // 軌道の座標ではなく、シードでプレイ時間が変わる性質だけを固定する。
    expect(totalTimeSignatures.size).toBeGreaterThan(1)
  })
})
