import { describe, expect, it } from 'vitest'
import { simulateAdventureRun } from './adventureSimulation'
import { AREAS } from './data/areas'

const TRIAL_COUNT = 24
const SEED_BASE = 0x1f2e3d4c
const SEED_STEP = 7919
const AREA_IDS = ['sky', 'forest', 'cave', 'river', 'cloud', 'goal'] as const

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
    const pinHits = results.map((result) => result.pinHitCount).sort((a, b) => a - b)
    const airborneSeconds = results.map((result) => result.maxAirborneSeconds).sort((a, b) => a - b)
    const contactlessDrops = results.map((result) => result.maxContactlessDropPx).sort((a, b) => a - b)
    const pinHitMedian = (pinHits[TRIAL_COUNT / 2 - 1] + pinHits[TRIAL_COUNT / 2]) / 2
    const maxAirborne = airborneSeconds[airborneSeconds.length - 1]
    const maxContactlessDrop = contactlessDrops[contactlessDrops.length - 1]
    const dwellMeanByArea = Object.fromEntries(
      AREA_IDS.map((areaId) => [
        areaId,
        results.reduce((sum, result) => sum + result.dwellSecondsByArea[areaId], 0) / results.length,
      ]),
    )
    const dwellMeanByVisitedRunArea = Object.fromEntries(
      AREA_IDS.map((areaId) => {
        const visitedResults = results.filter((result) => result.visitedAreaIds.includes(areaId))
        return [
          areaId,
          visitedResults.reduce((sum, result) => sum + result.dwellSecondsByArea[areaId], 0) / visitedResults.length,
        ]
      }),
    )
    const pinMeanByVisitedRunArea = Object.fromEntries(
      AREA_IDS.map((areaId) => {
        const visitedResults = results.filter((result) => result.visitedAreaIds.includes(areaId))
        return [
          areaId,
          visitedResults.reduce((sum, result) => sum + result.pinHitCountByArea[areaId], 0) / visitedResults.length,
        ]
      }),
    )
    const maxContactlessDropByArea = Object.fromEntries(
      AREA_IDS.map((areaId) => [
        areaId,
        Math.max(...results.map((result) => result.maxContactlessDropPxByArea[areaId])),
      ]),
    )
    const pinIds = AREAS.flatMap((area) =>
      area.objects
        .filter((object) => object.kind === 'pin')
        .map((pin) => `pin:${area.id}:${pin.id}`),
    )
    const zeroHitPinIds = pinIds.filter(
      (pinId) => !results.some((result) => (result.pinHitCountById[pinId] ?? 0) > 0),
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
    const caveRouteResults = results.filter((result) => result.visitedAreaIds.includes('cave'))
    const riverRouteResults = results.filter((result) => result.visitedAreaIds.includes('river'))
    const cavePinMean = caveRouteResults.reduce((sum, result) => sum + result.pinHitCountByArea.cave, 0) / caveRuns
    const riverPinMean = riverRouteResults.reduce((sum, result) => sum + result.pinHitCountByArea.river, 0) / riverRuns
    const caveCannonFireTotal = caveRouteResults.reduce((sum, result) => sum + result.cannonFireCount, 0)
    const riverJumpTotal = riverRouteResults.reduce((sum, result) => sum + result.jumpCount, 0)
    const riverBoostSeconds = riverRouteResults.reduce((sum, result) => sum + result.boostSeconds, 0)
    const caveBoostSeconds = caveRouteResults.reduce((sum, result) => sum + result.boostSeconds, 0)
    const caveMaxSpeed = Math.max(...caveRouteResults.map((result) => result.maxSpeedByArea.cave))
    const riverMaxSpeed = Math.max(...riverRouteResults.map((result) => result.maxSpeedByArea.river))
    const caveRouteMean = results
      .filter((result) => result.visitedAreaIds.includes('cave'))
      .reduce((sum, result) => sum + result.totalSeconds, 0) / caveRuns
    const riverRouteMean = results
      .filter((result) => result.visitedAreaIds.includes('river'))
      .reduce((sum, result) => sum + result.totalSeconds, 0) / riverRuns
    const routeMeanDifference = Math.abs(caveRouteMean - riverRouteMean)
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
    console.info(
      `adventure density: pinMedian=${pinHitMedian.toFixed(1)} maxDrop=${maxContactlessDrop.toFixed(1)}px ` +
        `maxAirborne=${maxAirborne.toFixed(3)}s pinMeanVisited=${JSON.stringify(pinMeanByVisitedRunArea)}`,
    )
    console.info(
      `adventure dropByArea=${JSON.stringify(maxContactlessDropByArea)} ` +
        `zeroHitPins=${JSON.stringify(zeroHitPinIds)}`,
    )
    console.info(`adventure routes: ${JSON.stringify(routeCounts)}`)
    console.info(
      `adventure route means: cave=${caveRouteMean.toFixed(3)}s river=${riverRouteMean.toFixed(3)}s ` +
        `difference=${routeMeanDifference.toFixed(3)}s`,
    )
    console.info(
      `adventure gimmicks: cave cannon=${caveCannonFireTotal}/${caveRuns} pinMean=${cavePinMean.toFixed(3)} ` +
        `river jump=${riverJumpTotal}/${riverRuns} pinMean=${riverPinMean.toFixed(3)} ` +
        `boostSeconds river=${riverBoostSeconds.toFixed(3)} cave=${caveBoostSeconds.toFixed(3)} ` +
        `maxSpeed river=${riverMaxSpeed.toFixed(3)} cave=${caveMaxSpeed.toFixed(3)}`,
    )
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
    expect(caveRuns).toBeGreaterThanOrEqual(8)
    expect(riverRuns).toBeGreaterThanOrEqual(8)
    expect(caveRouteResults.every((result) => result.cannonFireCount >= 1)).toBe(true)
    expect(riverRouteResults.every((result) => result.jumpCount >= 1)).toBe(true)
    expect(riverRouteResults.every((result) => result.boostSeconds > 0)).toBe(true)
    expect(caveRouteResults.every((result) => result.boostSeconds === 0)).toBe(true)
    expect(riverMaxSpeed).toBeGreaterThan(caveMaxSpeed)
    expect(cavePinMean).toBeGreaterThanOrEqual(riverPinMean + 0.5)
    expect(routeMeanDifference).toBeLessThanOrEqual(4)
    expect(repeatedResults.map((result) => result.visitedAreaIds)).toEqual(results.map((result) => result.visitedAreaIds))
    expect(results.every((result) => result.stallNudgeCount === 0)).toBe(true)
    expect(results.every((result) => result.goalRescueDropCount === 0)).toBe(true)
    expect(results.every((result) => result.rescueCount === 0)).toBe(true)
    expect(results.every((result) => result.areaTimeoutCount === 0)).toBe(true)
    expect(min).toBeGreaterThanOrEqual(26)
    expect(median).toBeGreaterThanOrEqual(30)
    expect(median).toBeLessThanOrEqual(46)
    expect(max).toBeLessThanOrEqual(55)
    expect(maxContactlessDrop).toBeLessThanOrEqual(350)
    expect(maxAirborne).toBeLessThanOrEqual(1.9)
    expect(pinHitMedian).toBeGreaterThanOrEqual(8)
    for (const areaId of AREA_IDS.filter((candidate) => candidate !== 'goal')) {
      expect(pinMeanByVisitedRunArea[areaId], `${areaId} pin mean`).toBeGreaterThanOrEqual(1)
    }
    for (const areaId of AREA_IDS) {
      expect(dwellMeanByVisitedRunArea[areaId], `${areaId} dwell mean`).toBeGreaterThanOrEqual(4)
      expect(dwellMeanByVisitedRunArea[areaId], `${areaId} dwell mean`).toBeLessThanOrEqual(8)
    }

    // 軌道の座標ではなく、シードでプレイ時間が変わる性質だけを固定する。
    expect(totalTimeSignatures.size).toBeGreaterThan(1)
  })
})
