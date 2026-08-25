import { describe, expect, test } from 'vitest'
import { MAX_SPEED } from './puzzlePhysics'
import { BUMPER_BOOST_SPEED, bumperBoostVelocity } from './bumperPhysics'

describe('bumperBoostVelocity', () => {
  test('バンパー中心からボールへ向かう外向きに、通常の反発より分かりやすく加速する', () => {
    const velocity = bumperBoostVelocity({ x: 30, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })
    expect(velocity.x).toBe(1 + BUMPER_BOOST_SPEED)
    expect(velocity.y).toBe(0)
  })

  test('接触方向が変われば押し出す方向も変わり、速度は上限を超えない', () => {
    const velocity = bumperBoostVelocity({ x: 0, y: -30 }, { x: 0, y: 0 }, { x: 15, y: -15 })
    expect(velocity.y).toBeLessThan(0)
    expect(Math.hypot(velocity.x, velocity.y)).toBeLessThanOrEqual(MAX_SPEED)
  })
})
