import { describe, expect, it } from 'vitest'
import {
  clampSpeed,
  GRAVITY_MAGNITUDE,
  gravityFromTilt,
  MAX_BALL_SPEED,
  MAX_TILT_RAD,
  visualTiltRotation,
  type PhysicsVector,
} from './mazePhysics'
import { NEUTRAL_TILT, type TiltInput } from './tiltInput'

/** 回転軸と角度をロドリゲスの公式で適用する（Three.jsのsetFromAxisAngleと同じ回転）。 */
function rotateByVisualTilt(tilt: TiltInput, vector: PhysicsVector): PhysicsVector {
  const { axis, angle } = visualTiltRotation(tilt)
  const length = Math.hypot(axis.x, axis.y, axis.z)
  const a = { x: axis.x / length, y: axis.y / length, z: axis.z / length }
  const cross = {
    x: a.y * vector.z - a.z * vector.y,
    y: a.z * vector.x - a.x * vector.z,
    z: a.x * vector.y - a.y * vector.x,
  }
  const dot = a.x * vector.x + a.y * vector.y + a.z * vector.z
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return {
    x: vector.x * cos + cross.x * sin + a.x * dot * (1 - cos),
    y: vector.y * cos + cross.y * sin + a.y * dot * (1 - cos),
    z: vector.z * cos + cross.z * sin + a.z * dot * (1 - cos),
  }
}

/**
 * 傾けた盤面の最急降下方向（単位ベクトル）。
 * 高さは y = -(nx·x + nz·z)/ny なので、下り坂の向きは法線の水平成分 (nx, nz) と同じ。
 */
function visualDownhillDirection(tilt: TiltInput): { x: number; z: number } {
  const normal = rotateByVisualTilt(tilt, { x: 0, y: 1, z: 0 })
  const length = Math.hypot(normal.x, normal.z)
  if (length === 0) return { x: 0, z: 0 }
  return { x: normal.x / length, z: normal.z / length }
}

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

  it('見た目の下り坂の向きが、ボールの転がる向きと一致する', () => {
    for (const tilt of [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
      { x: 0.6, y: -0.8 },
      { x: -0.5, y: 0.5 },
    ]) {
      const downhill = visualDownhillDirection(tilt)
      const length = Math.hypot(tilt.x, tilt.y)
      // 盤面が下がっていく向きと、重力で転がる向きが逆だと「上り坂へ転がる」ように見える。
      expect(downhill.x).toBeCloseTo(tilt.x / length, 6)
      expect(downhill.z).toBeCloseTo(tilt.y / length, 6)
    }
  })

  it('重力の水平成分と見た目の下り坂が同じ向きを指す', () => {
    const tilt = { x: 0.6, y: -0.8 }
    const gravity = gravityFromTilt(tilt)
    const gravityLength = Math.hypot(gravity.x, gravity.z)
    const downhill = visualDownhillDirection(tilt)
    expect(downhill.x).toBeCloseTo(gravity.x / gravityLength, 6)
    expect(downhill.z).toBeCloseTo(gravity.z / gravityLength, 6)
  })

  it('盤面は、ボールが向かう側の端が下がる', () => {
    // 奥(-Z)へ転がす入力では、奥側の端が下がって見える。
    const rotated = rotateByVisualTilt({ x: 0, y: -1 }, { x: 0, y: 0, z: -6.75 })
    expect(rotated.y).toBeLessThan(0)

    // 手前(+Z)へ転がす入力では、手前側の端が下がる。
    const nearSide = rotateByVisualTilt({ x: 0, y: 1 }, { x: 0, y: 0, z: 6.75 })
    expect(nearSide.y).toBeLessThan(0)
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
