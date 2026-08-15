import { describe, expect, it } from 'vitest'
import {
  BALL_RADIUS,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  OBSTACLES,
  ZONE_TOP,
} from './boardLayout'
import { TOYS } from './toyLayout'

const PRACTICAL_MIN_SCALE = 0.7
const MIN_TAP_DIAMETER_PX = 44

describe('TOYS', () => {
  it('おもちゃidが重複しない', () => {
    const ids = TOYS.map((toy) => toy.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('ボール半径ぶんの余裕を持って盤面内にある', () => {
    for (const toy of TOYS) {
      expect(toy.x - toy.radius - BALL_RADIUS).toBeGreaterThanOrEqual(0)
      expect(toy.x + toy.radius + BALL_RADIUS).toBeLessThanOrEqual(BOARD_WIDTH)
      expect(toy.y - toy.radius - BALL_RADIUS).toBeGreaterThanOrEqual(0)
      expect(toy.y + toy.radius + BALL_RADIUS).toBeLessThanOrEqual(BOARD_HEIGHT)
    }
  })

  it('障害物との中心距離にボール直径ぶんの余裕がある', () => {
    for (const toy of TOYS) {
      for (const obstacle of OBSTACLES) {
        const distance = Math.hypot(toy.x - obstacle.x, toy.y - obstacle.y)
        const required = toy.radius + obstacle.radius + BALL_RADIUS * 2
        expect(distance).toBeGreaterThanOrEqual(required)
      }
    }
  })

  it('おもちゃ同士のタップ判定円が重ならない', () => {
    for (let i = 0; i < TOYS.length; i += 1) {
      for (let j = i + 1; j < TOYS.length; j += 1) {
        const a = TOYS[i]
        const b = TOYS[j]
        const distance = Math.hypot(a.x - b.x, a.y - b.y)
        expect(distance).toBeGreaterThanOrEqual(a.tapRadius + b.tapRadius)
      }
    }
  })

  it('得点ゾーン領域に入っていない', () => {
    for (const toy of TOYS) {
      expect(toy.y + toy.radius).toBeLessThanOrEqual(ZONE_TOP)
    }
  })

  it('実機スケール0.7倍でもタップ判定の直径が44px以上ある', () => {
    for (const toy of TOYS) {
      expect(toy.tapRadius * 2 * PRACTICAL_MIN_SCALE).toBeGreaterThanOrEqual(MIN_TAP_DIAMETER_PX)
    }
  })
})
