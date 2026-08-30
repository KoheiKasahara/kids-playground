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

  test('左向きに回転すると左へ進む球だけを上へ跳ねる', () => {
    const result = jumpRampVelocity('jumpRampLeft', { x: -5, y: 1 })
    expect(result).not.toBeNull()
    expect(result!.x).toBeLessThan(0)
    expect(result!.y).toBeLessThan(0)
  })

  test('逆向き・上昇中の球へは補正を重ねない', () => {
    expect(jumpRampVelocity('jumpRampRight', { x: -4, y: 2 })).toBeNull()
    expect(jumpRampVelocity('jumpRampRight', { x: 4, y: -3 })).toBeNull()
  })
})
