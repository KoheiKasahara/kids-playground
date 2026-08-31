import { describe, expect, test } from 'vitest'
import { MAX_SPEED } from './puzzlePhysics'
import { jumpRampVelocity } from './jumpRampPhysics'

describe('jumpRampVelocity', () => {
  test('右向きに進入すると横方向を保ちながら上へ跳ねる', () => {
    const result = jumpRampVelocity('jumpRampRight', { x: 6, y: 2 })
    expect(result).not.toBeNull()
    expect(result!.x).toBeGreaterThan(0)
    expect(result!.y).toBeLessThan(0)
    expect(Math.hypot(result!.x, result!.y)).toBeLessThanOrEqual(MAX_SPEED)
  })

  test('真上から落ちてもジャンプ台の右上方向へ最低限飛ばす', () => {
    const result = jumpRampVelocity('jumpRampRight', { x: 0, y: 8 })
    expect(result).not.toBeNull()
    expect(result!.x).toBeGreaterThanOrEqual(4.5)
    expect(result!.y).toBeLessThanOrEqual(-7.4)
  })

  test('低速・逆方向からの接触でも、台の向きへ飛ばす', () => {
    const result = jumpRampVelocity('jumpRampRight', { x: -0.05, y: 0.1 })
    expect(result).not.toBeNull()
    expect(result!.x).toBeGreaterThanOrEqual(4.5)
    expect(result!.y).toBeLessThanOrEqual(-7.4)
  })

  test('左向きへ回転した台は、接触方向に関わらず左上へ飛ばす', () => {
    const result = jumpRampVelocity('jumpRampLeft', { x: 5, y: 1 })
    expect(result).not.toBeNull()
    expect(result!.x).toBeLessThanOrEqual(-4.5)
    expect(result!.y).toBeLessThanOrEqual(-7.4)
  })

  test('強い下向き速度でも上向き速度を保証する', () => {
    const result = jumpRampVelocity('jumpRampRight', { x: 2, y: 40 })
    expect(result).not.toBeNull()
    expect(result!.x).toBeGreaterThan(0)
    expect(result!.y).toBeLessThanOrEqual(-9.6)
    expect(Math.hypot(result!.x, result!.y)).toBeLessThanOrEqual(MAX_SPEED)
  })

  test('ジャンプ台以外では発射速度を作らない', () => {
    expect(jumpRampVelocity('slopeRight', { x: 6, y: 2 })).toBeNull()
  })
})
