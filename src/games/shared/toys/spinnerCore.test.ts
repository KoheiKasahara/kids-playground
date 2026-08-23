import * as Matter from 'matter-js'
import { describe, expect, it } from 'vitest'
import { createSpinnerCore } from './spinnerCore'

const { Bodies, Body } = Matter
const STEP_MS = 1000 / 60

function createCore() {
  return createSpinnerCore({
    x: 100,
    y: 120,
    radius: 32,
    bladeThickness: 16,
    friction: 0.02,
    restitution: 0.6,
    label: 'test-spinner-core',
    ballSpeedCap: 5,
    influenceMargin: 8,
    ballRadius: 10,
    stepMs: STEP_MS,
  })
}

describe('spinnerCore の共通物理', () => {
  it('指定した角速度でstep時間ぶん角度が進む', () => {
    const core = createCore()

    core.advance(STEP_MS, 0.12)
    expect(core.angle).toBeCloseTo(0.12, 8)

    core.advance(STEP_MS * 2, 0.12)
    expect(core.angle).toBeCloseTo(0.36, 8)
  })

  it('影響範囲内のボール速度を上限へ丸め、範囲外は変更しない', () => {
    const core = createCore()
    const nearBall = Bodies.circle(132, 120, 10)
    const farBall = Bodies.circle(200, 120, 10)
    Body.setVelocity(nearBall, { x: 6, y: 8 })
    Body.setVelocity(farBall, { x: 6, y: 8 })

    core.capBallSpeed(nearBall)
    core.capBallSpeed(farBall)

    expect(Math.hypot(nearBall.velocity.x, nearBall.velocity.y)).toBeCloseTo(5, 8)
    expect(farBall.velocity.x).toBeCloseTo(6, 8)
    expect(farBall.velocity.y).toBeCloseTo(8, 8)
  })

  it('止まりかけた影響範囲内のボールへ接線方向のナッジを一度だけ与える', () => {
    const core = createCore()
    const ball = Bodies.circle(132, 120, 10)

    expect(core.nudgeIfStalled(ball, 0.35, 2.4)).toBe(true)
    expect(Math.hypot(ball.velocity.x, ball.velocity.y)).toBeCloseTo(2.4, 8)
    expect(core.nudgeIfStalled(ball, 0.35, 2.4)).toBe(false)
  })

  it('十字の羽根が静的Bodyとして面取り付きで生成される', () => {
    const core = createCore()

    expect(core.body.isStatic).toBe(true)
    expect(core.body.parts).toHaveLength(3)
    const blade = core.body.parts[1]
    expect(blade).toBeDefined()
    if (!blade) return
    expect(blade.vertices.length).toBeGreaterThan(4)
    expect(blade.bounds.max.x - blade.bounds.min.x).toBeCloseTo(64, 1)
    expect(blade.bounds.max.y - blade.bounds.min.y).toBeCloseTo(16, 1)
    expect(core.influenceRadius).toBe(50)
  })
})
