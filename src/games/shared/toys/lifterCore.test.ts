import * as Matter from 'matter-js'
import { describe, expect, it } from 'vitest'
import { createLifterCore } from './lifterCore'

const { Bodies, Body } = Matter

function createCore() {
  return createLifterCore({
    x: 100,
    y: 180,
    radius: 24,
    friction: 0.06,
    restitution: 0.5,
    label: 'test-lifter-core',
    ballRadius: 10,
    influenceMargin: 8,
    upSpeed: 8,
    maxHorizontalSpeed: 5.5,
    randomHorizontalMin: 1.6,
    randomHorizontalMax: 3.4,
    horizontalRetention: 0.3,
    speedCap: 12,
    cooldownMs: 900,
  })
}

describe('lifterCore の共通物理', () => {
  it('作用範囲内のボールを上方向へ打ち上げる', () => {
    const core = createCore()
    const ball = Bodies.circle(100, 210, 10)
    Body.setVelocity(ball, { x: 0, y: 2 })

    expect(core.tryLaunch(0, ball.id, ball, () => 0)).toBe(true)
    expect(ball.velocity.x).toBeCloseTo(-1.6, 8)
    expect(ball.velocity.y).toBeCloseTo(-8, 8)
    expect(Math.hypot(ball.velocity.x, ball.velocity.y)).toBeLessThanOrEqual(12)
  })

  it('同じボールにはクールダウン中に再発火せず、時間が過ぎると再発火する', () => {
    const core = createCore()
    const ball = Bodies.circle(100, 210, 10)
    Body.setVelocity(ball, { x: 0, y: 2 })

    expect(core.tryLaunch(0, 'flag-a', ball, () => 0)).toBe(true)
    Body.setVelocity(ball, { x: 0, y: 2 })
    expect(core.tryLaunch(899, 'flag-a', ball, () => 0)).toBe(false)
    expect(ball.velocity.y).toBeCloseTo(2, 8)
    expect(core.tryLaunch(900, 'flag-a', ball, () => 0)).toBe(true)
  })

  it('すでに上昇中のボールへ二重に打ち上げを加えない', () => {
    const core = createCore()
    const ball = Bodies.circle(100, 180, 10)
    Body.setVelocity(ball, { x: 0, y: -5 })

    expect(core.tryLaunch(0, ball.id, ball, () => 0)).toBe(false)
    expect(ball.velocity.y).toBeCloseTo(-5, 8)
  })

  it('乱数源を使って左右の散らしを決める', () => {
    const core = createCore()
    const ball = Bodies.circle(100, 210, 10)
    Body.setVelocity(ball, { x: 2, y: 2 })

    let calls = 0
    const random = () => {
      calls += 1
      return 1
    }

    expect(core.tryLaunch(0, ball.id, ball, random)).toBe(true)
    expect(calls).toBe(2)
    expect(ball.velocity.x).toBeCloseTo(4, 8)
    expect(ball.velocity.y).toBeCloseTo(-8, 8)
  })
})
