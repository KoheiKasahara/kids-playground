import { describe, expect, it } from 'vitest'
import { BALL_RADIUS, FALL_OUT_Y, HOLE_FALL_Y } from './mazePhysics'
import { createMazeStage } from './mazeStage'
import {
  checkpointPosition,
  createCheckpointTracker,
  createSpinnerTrapTracker,
  createStallTracker,
  hasFallenBelowFloor,
  hasFallenOut,
  RESPAWN_SETTLE_MS,
  STALL_RESCUE_NUDGE_COUNT,
  STALL_DURATION_MS,
  STALL_SPEED,
  STALL_TILT_THRESHOLD,
  SPINNER_TRAP_ESCAPE_LIMIT,
  SPINNER_TRAP_MS,
  updateCheckpointTracker,
  updateSpinnerTrapTracker,
  updateStallTracker,
} from './mazeRescue'

const bounds = { minX: -6, maxX: 6, minZ: -6, maxZ: 6 }

describe('hasFallenBelowFloor', () => {
  it('HOLE_FALL_Yを下回ったときだけ落下扱いにする', () => {
    expect(hasFallenBelowFloor({ x: 0, y: HOLE_FALL_Y + 0.01, z: 0 })).toBe(
      false,
    )
    expect(hasFallenBelowFloor({ x: 0, y: HOLE_FALL_Y, z: 0 })).toBe(false)
    expect(hasFallenBelowFloor({ x: 0, y: HOLE_FALL_Y - 0.01, z: 0 })).toBe(
      true,
    )
  })

  it('指定した判定高さを使える', () => {
    expect(hasFallenBelowFloor({ x: 0, y: -2, z: 0 }, -1)).toBe(true)
    expect(hasFallenBelowFloor({ x: 0, y: -1, z: 0 }, -1)).toBe(false)
  })
})

describe('チェックポイント追跡', () => {
  it('実ステージのチェックポイントを前進方向にだけ追跡する', () => {
    const stage = createMazeStage()
    expect(stage.checkpoints[0]).toEqual(stage.start)

    let tracker = createCheckpointTracker()
    const firstCheckpoint = stage.checkpoints[1]
    tracker = updateCheckpointTracker(
      tracker,
      { x: stage.start.x, y: 100, z: stage.start.z },
      stage.checkpoints,
    )
    expect(tracker.index).toBe(0)

    tracker = updateCheckpointTracker(
      tracker,
      { x: firstCheckpoint.x, y: -100, z: firstCheckpoint.z },
      stage.checkpoints,
    )
    expect(tracker.index).toBe(1)

    tracker = updateCheckpointTracker(
      tracker,
      { x: stage.start.x, y: 100, z: stage.start.z },
      stage.checkpoints,
    )
    expect(tracker.index).toBe(1)
  })

  it('次のチェックポイントへ近づかなければ進まず、無効な復帰先はフォールバックする', () => {
    const stage = createMazeStage()
    const fallback = { x: 123, z: -456 }

    expect(
      updateCheckpointTracker(
        createCheckpointTracker(),
        { x: stage.start.x, y: 0, z: stage.start.z },
        stage.checkpoints,
      ).index,
    ).toBe(0)
    expect(
      checkpointPosition({ index: stage.checkpoints.length }, stage.checkpoints, fallback),
    ).toEqual(fallback)
  })

  it('落下後の復帰位置は全ての穴のマス矩形からボール半径以上離れる', () => {
    const stage = createMazeStage()

    for (let index = 0; index < stage.checkpoints.length; index += 1) {
      const respawn = checkpointPosition(
        { index },
        stage.checkpoints,
        stage.start,
      )
      for (const hole of stage.holes) {
        const horizontalDistance = Math.max(
          Math.abs(respawn.x - hole.center.x) - hole.size / 2,
          0,
        )
        const depthDistance = Math.max(
          Math.abs(respawn.z - hole.center.z) - hole.size / 2,
          0,
        )
        const distanceFromHoleRect = Math.hypot(
          horizontalDistance,
          depthDistance,
        )
        expect(distanceFromHoleRect).toBeGreaterThanOrEqual(BALL_RADIUS)
      }
    }
  })
})

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

  it('ナッジを3回繰り返すと復帰要求を返す', () => {
    let tracker = createStallTracker()
    const results = []
    for (let count = 0; count < STALL_RESCUE_NUDGE_COUNT; count += 1) {
      const result = updateStallTracker(tracker, {
        speed: 0,
        tiltMagnitude: 1,
        deltaMs: STALL_DURATION_MS,
      })
      results.push(result)
      tracker = result.tracker
    }

    expect(results.map((result) => result.nudge)).toEqual([true, true, true])
    expect(results.map((result) => result.rescue)).toEqual([false, false, true])
    expect(tracker).toEqual({ stalledMs: 0, nudgeCount: 0 })
  })
})

describe('updateSpinnerTrapTracker', () => {
  const stage = createMazeStage()
  const spinner = stage.gimmicks.spinners[0]!
  const otherSpinner = stage.gimmicks.spinners[1]!
  const spinnerPosition = {
    x: spinner.center.x,
    y: 0,
    z: spinner.center.z,
  }

  it('圏外に出たらトラッカーを初期化する', () => {
    const result = updateSpinnerTrapTracker(
      { spinnerId: spinner.id, trappedMs: 100, escapeCount: 1 },
      {
        x: spinner.center.x + spinner.sweepRadius + BALL_RADIUS + 0.01,
        y: 0,
        z: spinner.center.z,
      },
      [spinner],
      100,
    )

    expect(result.tracker).toEqual(createSpinnerTrapTracker())
    expect(result.escapeFrom).toBeNull()
    expect(result.rescue).toBe(false)
  })

  it('別の回転棒に移ったらトラッカーを初期化する', () => {
    const result = updateSpinnerTrapTracker(
      { spinnerId: spinner.id, trappedMs: 100, escapeCount: 1 },
      {
        x: otherSpinner.center.x,
        y: 0,
        z: otherSpinner.center.z,
      },
      [spinner, otherSpinner],
      100,
    )

    expect(result.tracker).toEqual(createSpinnerTrapTracker())
    expect(result.escapeFrom).toBeNull()
    expect(result.rescue).toBe(false)
  })

  it('同じ回転棒の圏内に一定時間いると押し出し対象を返す', () => {
    const result = updateSpinnerTrapTracker(
      { spinnerId: spinner.id, trappedMs: 0, escapeCount: 0 },
      spinnerPosition,
      [spinner],
      SPINNER_TRAP_MS,
    )

    expect(result.tracker).toEqual({
      spinnerId: spinner.id,
      trappedMs: 0,
      escapeCount: 1,
    })
    expect(result.escapeFrom).toBe(spinner)
    expect(result.rescue).toBe(false)
  })

  it('押し出し上限に達したら復帰を要求する', () => {
    const result = updateSpinnerTrapTracker(
      {
        spinnerId: spinner.id,
        trappedMs: 0,
        escapeCount: SPINNER_TRAP_ESCAPE_LIMIT - 1,
      },
      spinnerPosition,
      [spinner],
      SPINNER_TRAP_MS,
    )

    expect(result.tracker).toEqual(createSpinnerTrapTracker())
    expect(result.escapeFrom).toBe(spinner)
    expect(result.rescue).toBe(true)
  })

  it('復帰直後の落ち着き時間を定義する', () => {
    expect(RESPAWN_SETTLE_MS).toBe(500)
  })
})
