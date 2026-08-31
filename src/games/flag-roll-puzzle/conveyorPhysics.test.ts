import { describe, expect, it } from 'vitest'
import {
  CONVEYOR_ACCELERATION_PER_STEP,
  CONVEYOR_MAX_SPEED,
  CONVEYOR_TARGET_SPEED,
  conveyorDirection,
  conveyorVelocity,
} from './conveyorPhysics'

describe('conveyorPhysics', () => {
  it('回転向きに対応する搬送方向を返す', () => {
    expect(conveyorDirection('conveyorRight')).toEqual({ x: 1, y: 0 })
    expect(conveyorDirection('conveyorDown')).toEqual({ x: 0, y: 1 })
    expect(conveyorDirection('conveyorLeft')).toEqual({ x: -1, y: 0 })
    expect(conveyorDirection('conveyorUp')).toEqual({ x: 0, y: -1 })
    expect(conveyorDirection('slopeLeft')).toBeNull()
  })

  it('搬送方向の成分だけを接触中に穏やかに補正する', () => {
    const next = conveyorVelocity({ x: 0, y: 2 }, { x: 1, y: 0 })
    expect(next.x).toBe(CONVEYOR_ACCELERATION_PER_STEP)
    expect(next.y).toBe(2)
  })

  it('同じ速度を繰り返し補正しても目標速度を超えない', () => {
    let velocity = { x: 0, y: 0 }
    for (let index = 0; index < 100; index += 1) {
      velocity = conveyorVelocity(velocity, { x: 1, y: 0 })
    }
    expect(velocity.x).toBe(CONVEYOR_TARGET_SPEED)
    expect(velocity.x).toBeLessThanOrEqual(CONVEYOR_MAX_SPEED)
    expect(velocity.y).toBe(0)
  })

  it('離れた後を表す未補正の速度はそのまま維持する', () => {
    expect(conveyorVelocity({ x: 5, y: -3 }, { x: 1, y: 0 })).toEqual({ x: 5, y: -3 })
  })
})
