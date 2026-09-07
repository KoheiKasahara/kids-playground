import { describe, expect, it } from 'vitest'
import { simulateAdventureRun } from './adventureSimulation'
import { MAX_SPEED } from './adventurePhysics'

const SEED_BASE = 0x1f2e3d4c
const SEED_STEP = 7919

describe('adventure flow simulation', () => {
  it('両ルートで仕掛けが作動し、救済なしでテンポよくカップへ入る', () => {
    const results = Array.from({ length: 32 }, (_, i) => simulateAdventureRun(SEED_BASE + i * SEED_STEP))
    const mean = results.reduce((sum, run) => sum + run.totalSeconds, 0) / results.length
    // 旧ピン格子は同じ32シードで平均48.67秒。滑走とジャンプの時間は残す。
    expect(mean).toBeGreaterThan(15)
    expect(mean).toBeLessThan(30)
    for (const run of results) {
      expect(run.completed).toBe(true)
      expect(run.cupIn).toBe(true)
      expect(run.rescueCount).toBe(0)
      expect(run.areaTimeoutCount).toBe(0)
      expect(run.goalRescueDropCount).toBe(0)
      expect(run.stallNudgeCount).toBe(0)
      expect(run.totalSeconds).toBeLessThan(40)
      expect(Math.max(...Object.values(run.maxSpeedByArea))).toBeLessThanOrEqual(MAX_SPEED + 0.001)
      expect(run.lifterFireCountById['forest-mushroom-spring']).toBeGreaterThan(0)
      expect(run.lifterFireCountById['cloud-fluffy-lift']).toBeGreaterThan(0)
      // 同じバネへの帰還を繰り返して時間を稼がない。
      expect(run.lifterFireCountById['forest-mushroom-spring']).toBeLessThanOrEqual(2)
      expect(run.lifterFireCountById['cloud-fluffy-lift']).toBeLessThanOrEqual(2)
    }
    const cave = results.filter((run) => run.visitedAreaIds.includes('cave'))
    const river = results.filter((run) => run.visitedAreaIds.includes('river'))
    expect(cave.length).toBeGreaterThanOrEqual(8)
    expect(river.length).toBeGreaterThanOrEqual(8)
    for (const run of cave) {
      expect(run.cannonFireCountById['cave-cannon-center-approach']).toBe(1)
      expect(run.jumpCount).toBe(0)
    }
    for (const run of river) {
      expect(run.jumpCountById['river-jump-end']).toBe(1)
      expect(run.boostSeconds).toBeGreaterThan(0)
      expect(run.cannonFireCount).toBe(0)
    }
    expect(
      results.filter((run) => run.spinnerHitCountById['sky-propeller'] > 0).length / results.length,
    ).toBeGreaterThanOrEqual(0.8)
    // 固定ステップの決定性を残しながら、開始時の揺らぎで分岐する。
    expect(simulateAdventureRun(SEED_BASE)).toEqual(results[0])
    expect(new Set(results.map((run) => run.totalSeconds)).size).toBeGreaterThan(8)
  })
})
