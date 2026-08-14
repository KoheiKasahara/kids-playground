import { describe, expect, it } from 'vitest'
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
