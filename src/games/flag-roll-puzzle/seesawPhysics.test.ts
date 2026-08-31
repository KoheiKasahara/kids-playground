import Matter from 'matter-js'
import { describe, expect, it } from 'vitest'
import {
  clampSeesawAngle,
  SEESAW_MAX_ANGLE,
  SEESAW_MAX_ANGULAR_VELOCITY,
  stabilizeSeesawBody,
} from './seesawPhysics'

describe('seesawPhysics', () => {
  it('シーソーの角度を最大角度の内側へ制限する', () => {
    expect(clampSeesawAngle(SEESAW_MAX_ANGLE * 2)).toBe(SEESAW_MAX_ANGLE)
    expect(clampSeesawAngle(-SEESAW_MAX_ANGLE * 2)).toBe(-SEESAW_MAX_ANGLE)
    expect(clampSeesawAngle(Math.PI * 2 + 0.1)).toBeCloseTo(0.1)
  })

  it('角度・角速度・支点位置の安全域を1箇所で守る', () => {
    const body = Matter.Bodies.rectangle(100, 100, 54, 10, { density: 0.0035 })
    Matter.Body.setAngle(body, 1)
    Matter.Body.setAngularVelocity(body, 1)
    Matter.Body.setPosition(body, { x: 104, y: 98 })

    stabilizeSeesawBody(body, { x: 100, y: 100 })

    expect(body.angle).toBeCloseTo(SEESAW_MAX_ANGLE)
    expect(Math.abs(body.angularVelocity)).toBe(0)
    expect(body.position).toEqual({ x: 100, y: 100 })

    Matter.Body.setAngularVelocity(body, SEESAW_MAX_ANGULAR_VELOCITY * 2)
    stabilizeSeesawBody(body, { x: 100, y: 100 })
    expect(body.angularVelocity).toBe(SEESAW_MAX_ANGULAR_VELOCITY)
  })
})
