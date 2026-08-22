import { describe, expect, it } from 'vitest'
import { CELL_SIZE, cellToWorld } from './mazeGrid'
import {
  BALL_RADIUS,
  CANNON_CAPTURE_MAX_Y,
  CANNON_CAPTURE_RADIUS,
  CANNON_CAPTURE_TIMEOUT_MS,
  CANNON_COOLDOWN_MS,
  CANNON_HOLD_MS,
  CANNON_MUZZLE_Y,
  GRAVITY_MAGNITUDE,
} from './mazePhysics'
import {
  cannonChamberPosition,
  cannonLaunchVelocity,
  createCannonState,
  updateCannon,
  type CannonState,
} from './mazeCannon'
import type { CannonGimmick } from './mazeGimmicks'
import { createMazeStageById } from './mazeStages'

const cannon: CannonGimmick = {
  id: 'test-cannon',
  center: { x: 2, z: 3 },
  muzzleY: CANNON_MUZZLE_Y,
  elevationRad: (42 * Math.PI) / 180,
  headingRad: 0,
  speed: 7.6,
  captureRadius: CANNON_CAPTURE_RADIUS,
}

describe('updateCannon', () => {
  it('捕捉半径内で低いボールを収め、範囲外・高すぎるボールは捕捉しない', () => {
    const captured = updateCannon(
      createCannonState(),
      { x: cannon.center.x + cannon.captureRadius, y: CANNON_CAPTURE_MAX_Y, z: cannon.center.z },
      cannon,
      100,
    )
    expect(captured.action).toBe('capture')
    expect(captured.hold).toBe(true)
    expect(captured.state).toEqual({ phase: 'capturing', startedAtMs: 100 })

    expect(
      updateCannon(
        createCannonState(),
        { x: cannon.center.x + cannon.captureRadius + 0.001, y: 0, z: cannon.center.z },
        cannon,
        100,
      ),
    ).toEqual({ state: { phase: 'ready' }, action: null, hold: false })
    expect(
      updateCannon(
        createCannonState(),
        { x: cannon.center.x, y: CANNON_CAPTURE_MAX_Y + 0.001, z: cannon.center.z },
        cannon,
        100,
      ),
    ).toEqual({ state: { phase: 'ready' }, action: null, hold: false })
  })

  it('短い捕捉後に発射し、クールダウンを経て再びreadyになる', () => {
    const captured = updateCannon(
      createCannonState(),
      cannonChamberPosition(cannon),
      cannon,
      100,
    )
    const holding = updateCannon(
      captured.state,
      cannonChamberPosition(cannon),
      cannon,
      100 + CANNON_HOLD_MS - 1,
    )
    expect(holding.action).toBeNull()
    expect(holding.hold).toBe(true)

    const fired = updateCannon(
      holding.state,
      cannonChamberPosition(cannon),
      cannon,
      100 + CANNON_HOLD_MS,
    )
    expect(fired.action).toBe('fire')
    expect(fired.hold).toBe(false)
    expect(fired.state).toEqual({
      phase: 'cooldown',
      readyAtMs: 100 + CANNON_HOLD_MS + CANNON_COOLDOWN_MS,
    })

    const cooling = updateCannon(
      fired.state,
      cannonChamberPosition(cannon),
      cannon,
      100 + CANNON_HOLD_MS + CANNON_COOLDOWN_MS - 1,
    )
    expect(cooling.state.phase).toBe('cooldown')
    const ready = updateCannon(
      cooling.state,
      cannonChamberPosition(cannon),
      cannon,
      100 + CANNON_HOLD_MS + CANNON_COOLDOWN_MS,
    )
    expect(ready).toEqual({ state: { phase: 'ready' }, action: null, hold: false })
  })

  it('タイムアウト時にも必ず発射へ進み、砲室で永久に止まらない', () => {
    const capturing: CannonState = { phase: 'capturing', startedAtMs: 0 }
    const result = updateCannon(
      capturing,
      cannonChamberPosition(cannon),
      cannon,
      CANNON_CAPTURE_TIMEOUT_MS,
    )
    expect(result.action).toBe('fire')
    expect(result.hold).toBe(false)
    expect(result.state.phase).toBe('cooldown')
  })
})

describe('cannonLaunchVelocity', () => {
  it('指定した速さを保ち、42度の仰角で+zへ発射する', () => {
    const velocity = cannonLaunchVelocity(cannon)
    expect(Math.hypot(velocity.x, velocity.y, velocity.z)).toBeCloseTo(cannon.speed, 8)
    expect(velocity.x).toBeCloseTo(0, 8)
    expect(velocity.y).toBeCloseTo(cannon.speed * Math.sin(cannon.elevationRad), 8)
    expect(velocity.z).toBeCloseTo(cannon.speed * Math.cos(cannon.elevationRad), 8)
    expect(cannonChamberPosition(cannon)).toEqual({ x: 2, y: CANNON_MUZZLE_Y, z: 3 })
  })

  it('実ステージの弾道は尾根を越え、着地帯から続く中央通路へ安全に着地する', () => {
    const stage = createMazeStageById('athletic')
    const athleticCannon = stage.gimmicks.cannons.find(({ id }) => id === 'cannon-athletic')
    const ridge = stage.terrain.boxes.find(({ id }) => id === 'athletic-cannon-ridge')
    const ridgeCap = stage.terrain.bars.find(({ id }) => id === 'athletic-cannon-ridge-cap')
    expect(athleticCannon).toBeDefined()
    expect(ridge).toBeDefined()
    expect(ridgeCap).toBeDefined()
    if (athleticCannon === undefined || ridge === undefined || ridgeCap === undefined) return

    const chamber = cannonChamberPosition(athleticCannon)
    const launch = cannonLaunchVelocity(athleticCannon)
    const ridgeSeconds = (ridge.z - chamber.z) / launch.z
    const centerYAtRidge =
      chamber.y +
      launch.y * ridgeSeconds -
      (GRAVITY_MAGNITUDE / 2) * ridgeSeconds ** 2
    const ridgeClearance = centerYAtRidge - BALL_RADIUS - (ridgeCap.y + ridgeCap.radius)
    expect(ridgeClearance).toBeGreaterThan(0.39)

    const peakSeconds = launch.y / GRAVITY_MAGNITUDE
    const peakY =
      chamber.y +
      launch.y * peakSeconds -
      (GRAVITY_MAGNITUDE / 2) * peakSeconds ** 2
    // 発射方向は中央レーンのままなので、最高点でも横の外壁を越えて盤外へ出ない。
    expect(Math.abs(chamber.x + launch.x * peakSeconds)).toBeLessThan(CELL_SIZE * 1.5)
    expect(peakY).toBeLessThan(stage.start.y ?? Infinity)

    const landingSeconds =
      (launch.y +
        Math.sqrt(
          launch.y ** 2 +
            2 * GRAVITY_MAGNITUDE * (chamber.y - BALL_RADIUS),
        )) /
      GRAVITY_MAGNITUDE
    const landingZ = chamber.z + launch.z * landingSeconds
    const landingAreaStart =
      cellToWorld(6, 22, stage.columnCount, stage.rowCount).z - CELL_SIZE / 2
    const landingAreaAndCenterLaneEnd =
      cellToWorld(6, 24, stage.columnCount, stage.rowCount).z + CELL_SIZE / 2
    // 設計値の着地点(row 23.53)は、広い着地帯の直後に連続する中央通路にも収まる。
    expect(landingZ).toBeGreaterThan(landingAreaStart)
    expect(landingZ).toBeLessThan(landingAreaAndCenterLaneEnd)
  })
})
