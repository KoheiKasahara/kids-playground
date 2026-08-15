import { describe, expect, it } from 'vitest'
import { ALL_FLAGS_LAUNCH_INTERVAL_MS, launchDelaysMs } from './boardLayout'
import { PINBALL_FLAG_IDS } from './data/pinballFlags'
import { STEP_MS } from './pinballPhysics'
import { simulatePinballRun } from './pinballSimulation'

const TRIAL_COUNT = 32
const SEED_BASE = 0x1f2e3d4c
const SEED_STEP = 7919
const RAPID_TAP_TRIAL_COUNT = 12
const RAPID_TAP_INTERVAL_MS = 100

describe('pinball fixed-step play-time simulation', () => {
  it('おもちゃをタップしない32個のシード付き試行が、従来と同程度の時間で完了する', () => {
    const results = Array.from({ length: TRIAL_COUNT }, (_, index) =>
      simulatePinballRun(SEED_BASE + index * SEED_STEP, { toyTapIntervalMs: null }),
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
    // おもちゃのBodyは含めるがタップはしないため、従来の測定値から少しずれる。
    // 物理エンジンや受動的な接触のわずかな差で壊れないよう、実測値より広く取る。
    expect(min).toBeGreaterThanOrEqual(3)
    expect(median).toBeGreaterThanOrEqual(7)
    expect(median).toBeLessThan(20)
    expect(max).toBeLessThan(35)
  })

  it('おもちゃを100ms間隔で連打しても、安全タイマーなしで全試行が完了する', () => {
    const results = Array.from({ length: RAPID_TAP_TRIAL_COUNT }, (_, index) =>
      simulatePinballRun(SEED_BASE + index * SEED_STEP, {
        toyTapIntervalMs: RAPID_TAP_INTERVAL_MS,
      }),
    )
    const seconds = results.map((result) => result.durationSeconds).sort((a, b) => a - b)
    const median =
      (seconds[RAPID_TAP_TRIAL_COUNT / 2 - 1] + seconds[RAPID_TAP_TRIAL_COUNT / 2]) / 2
    const min = seconds[0]
    const max = seconds[seconds.length - 1]
    const mean = seconds.reduce((sum, value) => sum + value, 0) / seconds.length

    // launcherToy.tsのMath.randomにより固定値にはできないため、成立性と緩い上限だけを検証する。
    console.info(
      `pinball rapid toy taps (${RAPID_TAP_TRIAL_COUNT} trials, ${RAPID_TAP_INTERVAL_MS}ms): min=${min.toFixed(3)}s median=${median.toFixed(3)}s mean=${mean.toFixed(3)}s max=${max.toFixed(3)}s`,
    )

    expect(results.every((result) => result.completed)).toBe(true)
    expect(results.every((result) => !result.usedSafetyTimeout)).toBe(true)
    expect(results.every((result) => result.steps * STEP_MS === result.durationMs)).toBe(true)
    // 45秒の安全タイマーより5秒以上短い余裕を残し、連打で停滞していないことを確認する。
    expect(max).toBeLessThan(40)
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
