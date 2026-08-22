import { describe, expect, it } from 'vitest'
import {
  BUMPER_COOLDOWN_MS,
  BUMPER_KICK_IMPULSE,
  BUMPER_RADIUS,
  CAR_BODY_HEIGHT,
  CAR_CABIN_RADIUS,
  CAR_DEPTH,
  CAR_WIDTH,
  CANNON_CAPTURE_RADIUS,
  CANNON_MUZZLE_Y,
  JUMP_PAD_TOP,
  SPINNER_HEIGHT,
  SPINNER_LENGTH,
  SPINNER_THICKNESS,
} from './mazePhysics'
import {
  bumperKick,
  canKickBumper,
  markBumperKicked,
  resolveGimmicks,
  spinnerAngleAt,
  type BumperGimmick,
  type SpinnerGimmick,
} from './mazeGimmicks'

describe('spinnerAngleAt', () => {
  const spinner: SpinnerGimmick = {
    id: 'test-spinner',
    center: { x: 0, z: 0 },
    length: SPINNER_LENGTH,
    thickness: SPINNER_THICKNESS,
    height: SPINNER_HEIGHT,
    angularSpeed: 1.25,
    initialAngle: -0.4,
    sweepRadius: Math.hypot(SPINNER_LENGTH / 2, SPINNER_THICKNESS / 2),
  }

  it('角速度と経過時間から符号を保って角度を求める', () => {
    expect(spinnerAngleAt(spinner, 2)).toBeCloseTo(2.1, 8)
    expect(
      spinnerAngleAt({ ...spinner, angularSpeed: -1.25 }, 2),
    ).toBeCloseTo(-2.9, 8)
  })
})

describe('bumperKick', () => {
  const bumper: BumperGimmick = {
    id: 'test-bumper',
    center: { x: 0, z: 0 },
    radius: BUMPER_RADIUS,
    height: 0.9,
  }

  it('ボールからバンパーの外向きへ一定の大きさでキックする', () => {
    const kick = bumperKick({ x: 0.8, y: 0.5, z: 0.6 }, bumper)
    expect(kick).not.toBeNull()
    expect(kick!.y).toBe(0)
    expect(Math.hypot(kick!.x, kick!.z)).toBeCloseTo(BUMPER_KICK_IMPULSE, 8)
    expect(kick!.x).toBeGreaterThan(0)
    expect(kick!.z).toBeGreaterThan(0)
    expect(kick!.x * 0.8 + kick!.z * 0.6).toBeGreaterThan(0)
  })

  it('圏外と中心一致ではキックしない', () => {
    expect(bumperKick({ x: 1.2, y: 0, z: 0 }, bumper)).toBeNull()
    expect(bumperKick({ x: 0, y: 0, z: 0 }, bumper)).toBeNull()
  })
})

describe('バンパーのクールダウン', () => {
  it('同じIDは間隔中に再発火せず、経過後に発火できる', () => {
    const cooldowns = new Map<string, number>()
    expect(canKickBumper(cooldowns, 'bumper-a', 1000)).toBe(true)
    markBumperKicked(cooldowns, 'bumper-a', 1000)
    expect(canKickBumper(cooldowns, 'bumper-a', 1000 + BUMPER_COOLDOWN_MS - 1)).toBe(false)
    expect(canKickBumper(cooldowns, 'bumper-a', 1000 + BUMPER_COOLDOWN_MS)).toBe(true)
  })
})

describe('resolveGimmicks', () => {
  it('小数セル座標を盤面中央原点のワールド座標へ変換する', () => {
    const gimmicks = resolveGimmicks(
      [
        {
          kind: 'spinner',
          id: 'spinner-test',
          cell: { column: 2.5, row: 1.25 },
          angularSpeed: 0.8,
          initialAngle: 0.2,
        },
        {
          kind: 'bumper',
          id: 'bumper-test',
          cell: { column: 1.5, row: 0.5 },
          radius: 0.5,
        },
        {
          kind: 'car',
          id: 'car-test',
          cell: { column: 2, row: 1.75 },
          amplitude: 3,
          speed: 1.5,
          phaseOffsetSeconds: 0.4,
          initialDirection: -1,
        },
        {
          kind: 'jumpPad',
          id: 'jump-pad-test',
          cell: { column: 3.5, row: 1.5 },
          widthCells: 2,
          depthCells: 0.5,
        },
        {
          kind: 'cannon',
          id: 'cannon-test',
          cell: { column: 2.5, row: 1.5 },
          elevationRad: 0.7,
          headingRad: 0,
          speed: 7.6,
        },
      ],
      5,
      3,
      2,
    )

    expect(gimmicks.spinners[0]!.center).toEqual({ x: 1, z: 0.5 })
    expect(gimmicks.spinners[0]!.length).toBe(SPINNER_LENGTH)
    expect(gimmicks.spinners[0]!.sweepRadius).toBeCloseTo(
      Math.hypot(SPINNER_LENGTH / 2, SPINNER_THICKNESS / 2),
      8,
    )
    expect(gimmicks.bumpers[0]!.center).toEqual({ x: -1, z: -1 })
    expect(gimmicks.bumpers[0]!.radius).toBe(0.5)
    expect(gimmicks.cars[0]).toEqual({
      id: 'car-test',
      center: { x: 0, y: CAR_BODY_HEIGHT / 2, z: 1.5 },
      amplitude: 3,
      speed: 1.5,
      phaseOffsetSeconds: 0.4,
      initialDirection: -1,
      halfWidth: CAR_WIDTH / 2,
      halfHeight: CAR_BODY_HEIGHT / 2,
      halfDepth: CAR_DEPTH / 2,
      cabinRadius: CAR_CABIN_RADIUS,
    })
    expect(gimmicks.jumpPads[0]).toEqual({
      id: 'jump-pad-test',
      center: { x: 3, z: 1 },
      halfWidth: 2,
      halfDepth: 0.5,
      top: JUMP_PAD_TOP,
    })
    expect(gimmicks.cannons[0]).toEqual({
      id: 'cannon-test',
      center: { x: 1, z: 1 },
      muzzleY: CANNON_MUZZLE_Y,
      elevationRad: 0.7,
      headingRad: 0,
      speed: 7.6,
      captureRadius: CANNON_CAPTURE_RADIUS,
    })
  })
})
