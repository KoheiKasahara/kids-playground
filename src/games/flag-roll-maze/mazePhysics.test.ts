import { describe, expect, it } from 'vitest'
import {
  BALL_RADIUS,
  CELL_SIZE_IN_RADII,
  clampSpeed,
  FALL_OUT_Y,
  FLOOR_THICKNESS,
  GRAVITY_MAGNITUDE,
  GOAL_RADIUS,
  gravityFromTilt,
  MAX_BALL_SPEED,
  MAX_TILT_RAD,
  visualTiltPivotOffset,
  visualTiltRotation,
  WALL_HEIGHT,
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

/** 任意の回転をロドリゲスの公式で適用し、pivot補正の不変条件を検証する。 */
function rotateByAxisAngle(
  rotation: { axis: PhysicsVector; angle: number },
  vector: PhysicsVector,
): PhysicsVector {
  const length = Math.hypot(rotation.axis.x, rotation.axis.y, rotation.axis.z)
  const axis = {
    x: rotation.axis.x / length,
    y: rotation.axis.y / length,
    z: rotation.axis.z / length,
  }
  const cross = {
    x: axis.y * vector.z - axis.z * vector.y,
    y: axis.z * vector.x - axis.x * vector.z,
    z: axis.x * vector.y - axis.y * vector.x,
  }
  const dot = axis.x * vector.x + axis.y * vector.y + axis.z * vector.z
  const cos = Math.cos(rotation.angle)
  const sin = Math.sin(rotation.angle)
  return {
    x: vector.x * cos + cross.x * sin + axis.x * dot * (1 - cos),
    y: vector.y * cos + cross.y * sin + axis.y * dot * (1 - cos),
    z: vector.z * cos + cross.z * sin + axis.z * dot * (1 - cos),
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

describe('R基準のコース寸法', () => {
  it('床は正の厚みを持ち、壁は球の直径より高い', () => {
    expect(FLOOR_THICKNESS).toBeGreaterThan(0)
    expect(WALL_HEIGHT).toBeGreaterThan(BALL_RADIUS * 2)
  })

  it('ゴール判定は球半径以上で1マスの半分未満に収まる', () => {
    expect(GOAL_RADIUS).toBeGreaterThanOrEqual(BALL_RADIUS)
    expect(GOAL_RADIUS).toBeLessThan((BALL_RADIUS * CELL_SIZE_IN_RADII) / 2)
  })

  it('落下判定の高さは盤面より十分下にある', () => {
    expect(FALL_OUT_Y).toBeLessThan(-BALL_RADIUS)
  })
})

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

describe('visualTiltPivotOffset', () => {
  it('回転後のpivotへ補正を足してもpivotが動かない', () => {
    const rotation = visualTiltRotation({ x: 0.6, y: -0.8 })
    const pivot = { x: 4.2, y: 0.9, z: -3.7 }
    const rotated = rotateByAxisAngle(rotation, pivot)
    const offset = visualTiltPivotOffset(rotation, pivot)

    expect(rotated.x + offset.x).toBeCloseTo(pivot.x, 10)
    expect(rotated.y + offset.y).toBeCloseTo(pivot.y, 10)
    expect(rotated.z + offset.z).toBeCloseTo(pivot.z, 10)
  })

  it('角度が0なら補正量も0になる', () => {
    expect(
      visualTiltPivotOffset(
        { axis: { x: 0, y: 1, z: 0 }, angle: 0 },
        { x: 4, y: 2, z: -3 },
      ),
    ).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('原点をpivotにしたときは従来の原点回転と同じく補正しない', () => {
    const rotation = visualTiltRotation({ x: -0.7, y: 0.4 })
    expect(visualTiltPivotOffset(rotation, { x: 0, y: 0, z: 0 })).toEqual({
      x: 0,
      y: 0,
      z: 0,
    })
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
