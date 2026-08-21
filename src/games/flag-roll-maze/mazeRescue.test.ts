import { describe, expect, it } from 'vitest'
import { FALL_OUT_Y } from './mazePhysics'
import {
  createStallTracker,
  hasFallenOut,
  STALL_DURATION_MS,
  STALL_SPEED,
  STALL_TILT_THRESHOLD,
  updateStallTracker,
} from './mazeRescue'

const bounds = { minX: -6, maxX: 6, minZ: -6, maxZ: 6 }

describe('hasFallenOut', () => {
  it('盤面の上にいれば場外ではない', () => {
    expect(hasFallenOut({ x: 0, y: 0.4, z: 0 }, bounds)).toBe(false)
    expect(hasFallenOut({ x: 5.9, y: 0.4, z: -5.9 }, bounds)).toBe(false)
  })

  it('十分下まで落ちたら場外にする', () => {
    expect(hasFallenOut({ x: 0, y: FALL_OUT_Y - 0.1, z: 0 }, bounds)).toBe(true)
  })

  it('盤面の外へ大きく出たら場外にする', () => {
    expect(hasFallenOut({ x: 20, y: 0.4, z: 0 }, bounds)).toBe(true)
    expect(hasFallenOut({ x: 0, y: 0.4, z: -20 }, bounds)).toBe(true)
  })

  it('境界のわずかな外側では場外にしない', () => {
    // 壁に押しつけられて少しはみ出しただけで復帰させると、遊びが途切れる。
    expect(hasFallenOut({ x: bounds.maxX + 0.5, y: 0.4, z: 0 }, bounds)).toBe(false)
  })
})

describe('updateStallTracker', () => {
  const stalling = { speed: 0, tiltMagnitude: 1, deltaMs: 100 }

  it('しきい値に達するまではナッジしない', () => {
    let tracker = createStallTracker()
    let nudged = false
    for (let elapsed = 0; elapsed < STALL_DURATION_MS - 100; elapsed += 100) {
      const result = updateStallTracker(tracker, stalling)
      tracker = result.tracker
      nudged = nudged || result.nudge
    }
    expect(nudged).toBe(false)
  })

  it('停滞が続いたら一度だけナッジしてカウントを戻す', () => {
    let tracker = createStallTracker()
    let nudgeCount = 0
    let elapsed = 0
    while (elapsed <= STALL_DURATION_MS * 2 && nudgeCount === 0) {
      const result = updateStallTracker(tracker, stalling)
      tracker = result.tracker
      if (result.nudge) nudgeCount += 1
      elapsed += stalling.deltaMs
    }
    expect(nudgeCount).toBe(1)
    expect(elapsed).toBeGreaterThanOrEqual(STALL_DURATION_MS)
    // ナッジ後は積算を戻し、連続で押し続けないようにする。
    expect(tracker.stalledMs).toBe(0)
  })

  it('動き出したら停滞時間をリセットする', () => {
    const tracker = updateStallTracker({ stalledMs: 1000 }, {
      speed: STALL_SPEED + 1,
      tiltMagnitude: 1,
      deltaMs: 100,
    })
    expect(tracker.tracker.stalledMs).toBe(0)
    expect(tracker.nudge).toBe(false)
  })

  it('スティックに触れていないときは救済しない', () => {
    const tracker = updateStallTracker({ stalledMs: STALL_DURATION_MS }, {
      speed: 0,
      tiltMagnitude: STALL_TILT_THRESHOLD - 0.01,
      deltaMs: 100,
    })
    expect(tracker.nudge).toBe(false)
    expect(tracker.tracker.stalledMs).toBe(0)
  })
})
