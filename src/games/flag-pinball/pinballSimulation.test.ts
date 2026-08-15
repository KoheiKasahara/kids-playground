import { describe, expect, it } from 'vitest'
import { ALL_FLAGS_LAUNCH_INTERVAL_MS, launchDelaysMs } from './boardLayout'
import { PINBALL_FLAG_IDS } from './data/pinballFlags'
import { SAFETY_TIMEOUT_MS, STEP_MS } from './pinballPhysics'
import { simulatePinballRun } from './pinballSimulation'

const TRIAL_COUNT = 32
const SEED_BASE = 0x1f2e3d4c
const SEED_STEP = 7919

describe('pinball fixed-step play-time simulation', () => {
  it('32個のシード付き試行で、全3球が通常の得点確定まで到達する', () => {
    const results = Array.from({ length: TRIAL_COUNT }, (_, index) =>
      simulatePinballRun(SEED_BASE + index * SEED_STEP),
    )
    const seconds = results.map((result) => result.durationSeconds).sort((a, b) => a - b)
    const median = (seconds[TRIAL_COUNT / 2 - 1] + seconds[TRIAL_COUNT / 2]) / 2
    const min = seconds[0]
    const max = seconds[seconds.length - 1]
    const mean = seconds.reduce((sum, value) => sum + value, 0) / seconds.length

    // このログは調整時の実測値を残すためのもの。アサーションは緩い境界だけにする。
    console.info(
      `pinball simulation (${TRIAL_COUNT} trials): min=${min.toFixed(3)}s median=${median.toFixed(3)}s mean=${mean.toFixed(3)}s max=${max.toFixed(3)}s`,
    )

    expect(results.every((result) => result.completed)).toBe(true)
    expect(results.every((result) => !result.usedSafetyTimeout)).toBe(true)
    expect(results.every((result) => result.steps * STEP_MS === result.durationMs)).toBe(true)
    expect(min).toBeGreaterThanOrEqual(4)
    expect(median).toBeGreaterThanOrEqual(9.5)
    expect(median).toBeLessThan(15)
    expect(max).toBeLessThan(SAFETY_TIMEOUT_MS / 1000)
  })
})

describe('pinball 全射出モードのシミュレーション', () => {
  it('40球・800ms間隔でも全球が得点確定し、安全タイマーに頼らない', () => {
    const ballCount = PINBALL_FLAG_IDS.length
    const result = simulatePinballRun(0x2468ace0, {
      ballCount,
      launchDelaysMs: launchDelaysMs('allFlags', ballCount),
      mode: 'allFlags',
    })

    expect(result.completed).toBe(true)
    expect(result.usedSafetyTimeout).toBe(false)
    expect(result.scoreSteps).toHaveLength(ballCount)
    // 射出間隔どおりに時間差で射出されるため、常に何球かは同時に盤面上にいる
    // （1球だけが順番に進んでいくわけではない）ことを確認する。
    expect(result.maxConcurrentBalls).toBeGreaterThan(1)
    expect(result.maxConcurrentBalls).toBeLessThanOrEqual(ballCount)
    expect(ALL_FLAGS_LAUNCH_INTERVAL_MS).toBeGreaterThan(0)
  })
})
