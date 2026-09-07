import { describe, expect, it } from 'vitest'
import { ALL_FLAGS_LAUNCH_INTERVAL_MS, launchDelaysMs, SCORE_ZONES } from './boardLayout'
import { candyBoard, oceanBoard, skyBoard, spaceBoard } from './boardConfigs'
import { PINBALL_FLAG_IDS } from './data/pinballFlags'
import { SIMULATION_BALL_COUNT, STEP_MS } from './pinballPhysics'
import { simulatePinballRun } from './pinballSimulation'

// Quickは全5盤面×2入力を固定seedで確認する。分布・中央値・多seedはFullに残す。
describe.each([undefined, spaceBoard, oceanBoard, candyBoard, skyBoard])('代表盤面 %j', (boardConfig) => {
  it.each([null, 100])('入力間隔 %s msでも全球が安全タイマーなしで得点確定する', (toyTapIntervalMs) => {
    const result = simulatePinballRun(0x1f2e3d4c, { boardConfig, toyTapIntervalMs })
    expect(result.completed).toBe(true)
    expect(result.usedSafetyTimeout).toBe(false)
    expect(result.steps * STEP_MS).toBe(result.durationMs)
    expect(result.scoredZoneIds).toHaveLength(SIMULATION_BALL_COUNT)
    expect(result.scoredZoneIds.every((id) => SCORE_ZONES.some((zone) => zone.id === id))).toBe(true)
    expect(result.maxConcurrentBalls).toBeGreaterThan(1)
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
