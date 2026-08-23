import { describe, expect, it } from 'vitest'
import { CANNON_MUZZLE_OFFSET } from './adventurePhysics'
import {
  canRecaptureCannon,
  calculateZoneEffects,
  getBoostedVelocity,
  getCannonLaunchVelocity,
  getCannonMuzzlePosition,
  getFloatCounterGravityForce,
  getLaunchVelocity,
  isPointInRotatedRect,
} from './gimmicks'

describe('gimmick pure logic', () => {
  it('回転した矩形の内外を判定する', () => {
    const rect = { x: 100, y: 100, width: 80, height: 20, angle: Math.PI / 4 }
    const inside = {
      x: rect.x + Math.cos(rect.angle) * 20,
      y: rect.y + Math.sin(rect.angle) * 20,
    }
    const outside = {
      x: rect.x + Math.cos(rect.angle) * 50,
      y: rect.y + Math.sin(rect.angle) * 50,
    }

    expect(isPointInRotatedRect(inside, rect)).toBe(true)
    expect(isPointInRotatedRect(outside, rect)).toBe(false)
  })

  it('大砲の砲口と射出速度を求め、速度をMAX_SPEED以下へクランプする', () => {
    const cannon = { x: 120, y: 240, angle: -Math.PI / 2, power: 20 }
    // 砲口の距離は定数側の調整で変わるため、値を直書きせず定数から導く。
    expect(getCannonMuzzlePosition(cannon)).toEqual({ x: 120, y: 240 - CANNON_MUZZLE_OFFSET })
    expect(getCannonLaunchVelocity(cannon).x).toBeCloseTo(0)
    expect(getCannonLaunchVelocity(cannon).y).toBeCloseTo(-14)
    const diagonal = getLaunchVelocity(Math.PI / 4, 20)
    expect(diagonal.x).toBeCloseTo(Math.SQRT1_2 * 14)
    expect(diagonal.y).toBeCloseTo(Math.SQRT1_2 * 14)
  })

  it('大砲は溜め中と射出直後に再捕獲できない', () => {
    expect(canRecaptureCannon(true, null, 520)).toBe(false)
    expect(canRecaptureCannon(false, 1000, 1699)).toBe(false)
    expect(canRecaptureCannon(false, 1000, 1700)).toBe(true)
  })

  it('加速レーンは速度を加算し、上限を超えない', () => {
    expect(getBoostedVelocity({ x: 10.8, y: 0 }, { angle: 0, force: 1, maxSpeed: 11 })).toEqual({ x: 11, y: 0 })
    expect(getBoostedVelocity({ x: 0, y: 0 }, { angle: Math.PI / 2, force: 0.35, maxSpeed: 11 })).toEqual({
      x: expect.closeTo(0),
      y: expect.closeTo(0.35),
    })
  })

  it('低重力の打ち消し力は残す重力の割合に応じる', () => {
    expect(getFloatCounterGravityForce(2, 0.35, 0.001, 0.45).x).toBe(0)
    expect(getFloatCounterGravityForce(2, 0.35, 0.001, 0.45).y).toBeCloseTo(-0.000385)
  })

  it('回転ゾーン内の加速と低重力を同じ計算で適用する', () => {
    const result = calculateZoneEffects(
      { x: 10, y: 0 },
      { x: 0, y: 0 },
      2,
      0.35,
      0.001,
      [
        { zone: { kind: 'boost', id: 'boost-a', x: 0, y: 0, width: 40, height: 20, angle: 0, force: 1, maxSpeed: 11 }, x: 0, y: 0, angle: 0 },
        { zone: { kind: 'float', id: 'float-a', x: 0, y: 0, width: 40, height: 20, gravityScale: 0.5 }, x: 0, y: 0, angle: 0 },
      ],
    )

    expect(result.velocity).toEqual({ x: 1, y: 0 })
    expect(result.boostIds).toEqual(['boost-a'])
    expect(result.counterGravityForce).toEqual({ x: 0, y: -0.00035 })
  })
})
