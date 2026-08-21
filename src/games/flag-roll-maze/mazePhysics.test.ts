import { describe, expect, it } from 'vitest'
import {
  clampSpeed,
  GRAVITY_MAGNITUDE,
  gravityFromTilt,
  MAX_BALL_SPEED,
  MAX_TILT_RAD,
  visualTiltRotation,
} from './mazePhysics'
import { NEUTRAL_TILT } from './tiltInput'

describe('gravityFromTilt', () => {
  it('入力が無ければ真下を向く', () => {
    const gravity = gravityFromTilt(NEUTRAL_TILT)
    expect(gravity.x).toBe(0)
    expect(gravity.z).toBe(0)
    expect(gravity.y).toBeCloseTo(-GRAVITY_MAGNITUDE, 6)
  })

  it('傾けても重力の大きさは変わらない', () => {
    for (const tilt of [{ x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0.5, y: 0.5 }]) {
      const gravity = gravityFromTilt(tilt)
      expect(Math.hypot(gravity.x, gravity.y, gravity.z)).toBeCloseTo(GRAVITY_MAGNITUDE, 6)
    }
  })

  it('入力の向きへ水平成分が生まれる', () => {
    expect(gravityFromTilt({ x: 1, y: 0 }).x).toBeGreaterThan(0)
    expect(gravityFromTilt({ x: -1, y: 0 }).x).toBeLessThan(0)
    expect(gravityFromTilt({ x: 0, y: 1 }).z).toBeGreaterThan(0)
    expect(gravityFromTilt({ x: 0, y: -1 }).z).toBeLessThan(0)
  })

  it('最大入力でも傾き角は上限を超えない', () => {
    const gravity = gravityFromTilt({ x: 3, y: 4 })
    const horizontal = Math.hypot(gravity.x, gravity.z)
    const angle = Math.atan2(horizontal, -gravity.y)
    expect(angle).toBeLessThanOrEqual(MAX_TILT_RAD + 1e-9)
    expect(angle).toBeCloseTo(MAX_TILT_RAD, 6)
  })

  it('入力が半分なら傾き角も半分になる', () => {
    const gravity = gravityFromTilt({ x: 0.5, y: 0 })
    const angle = Math.atan2(Math.hypot(gravity.x, gravity.z), -gravity.y)
    expect(angle).toBeCloseTo(MAX_TILT_RAD / 2, 6)
  })

  it('幼児向けに、最大傾きでも転がり加速度が3を超えない', () => {
    const gravity = gravityFromTilt({ x: 1, y: 0 })
    // 一様な球の転がり加速度は (5/7)·g·sinθ。
    const rollingAcceleration = (5 / 7) * Math.hypot(gravity.x, gravity.z)
    expect(rollingAcceleration).toBeLessThan(3)
    expect(rollingAcceleration).toBeGreaterThan(1)
  })
})

describe('visualTiltRotation', () => {
  it('入力が無ければ回転しない', () => {
    expect(visualTiltRotation(NEUTRAL_TILT).angle).toBe(0)
  })

  it('見た目の傾きは物理の傾きより浅い', () => {
    expect(visualTiltRotation({ x: 1, y: 0 }).angle).toBeLessThan(MAX_TILT_RAD)
  })

  it('回転後の盤面法線が重力の水平成分と同じ向きへ倒れる', () => {
    const tilt = { x: 0.6, y: -0.8 }
    const { axis, angle } = visualTiltRotation(tilt)
    const length = Math.hypot(axis.x, axis.y, axis.z)
    const unitAxis = { x: axis.x / length, y: axis.y / length, z: axis.z / length }
    // ロドリゲスの回転公式で(0,1,0)を回す。軸はY成分を持たないので単純化できる。
    const up = { x: 0, y: 1, z: 0 }
    const cross = {
      x: unitAxis.y * up.z - unitAxis.z * up.y,
      y: unitAxis.z * up.x - unitAxis.x * up.z,
      z: unitAxis.x * up.y - unitAxis.y * up.x,
    }
    const rotated = {
      x: up.x * Math.cos(angle) + cross.x * Math.sin(angle),
      y: up.y * Math.cos(angle) + cross.y * Math.sin(angle),
      z: up.z * Math.cos(angle) + cross.z * Math.sin(angle),
    }
    const tiltLength = Math.hypot(tilt.x, tilt.y)
    expect(rotated.x).toBeCloseTo(-(tilt.x / tiltLength) * Math.sin(angle), 6)
    expect(rotated.z).toBeCloseTo(-(tilt.y / tiltLength) * Math.sin(angle), 6)
    expect(rotated.y).toBeGreaterThan(0)
  })
})

describe('clampSpeed', () => {
  it('上限以下ならnullを返して速度をそのままにする', () => {
    expect(clampSpeed({ x: 1, y: 0, z: 1 })).toBeNull()
  })

  it('上限を超えたら方向を保ったまま縮める', () => {
    const limited = clampSpeed({ x: 30, y: 0, z: 40 })
    expect(limited).not.toBeNull()
    expect(Math.hypot(limited!.x, limited!.y, limited!.z)).toBeCloseTo(MAX_BALL_SPEED, 6)
    expect(limited!.z / limited!.x).toBeCloseTo(40 / 30, 6)
  })
})
