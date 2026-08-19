import * as Matter from 'matter-js'
import { describe, expect, it } from 'vitest'
import { BALL_RADIUS, ZONE_TOP } from './boardLayout'
import {
  BALL_DENSITY,
  BALL_FRICTION,
  BALL_FRICTION_AIR,
  BALL_RESTITUTION,
  GRAVITY,
  MAX_SPEED,
  STEP_MS,
} from './pinballPhysics'
import { createWindToy } from './windToy'
import type { ToyPlacement } from './toyLayout'
import type { ToyBall, ToyRuntime } from './toyRuntime'

const { Body, Bodies, Composite, Engine } = Matter

const RIGHT_WIND_PLACEMENT: ToyPlacement = {
  id: 'test-wind-right',
  kind: 'wind',
  x: 240,
  y: 300,
  radius: 58,
  tapRadius: 68,
  labelJa: 'かぜ（みぎむき）',
  wind: { directionX: 1, halfWidth: 170, halfHeight: 55 },
}

const LEFT_WIND_PLACEMENT: ToyPlacement = {
  ...RIGHT_WIND_PLACEMENT,
  id: 'test-wind-left',
  wind: { directionX: -1, halfWidth: 170, halfHeight: 55 },
}

const UPWARD_WIND_PLACEMENT: ToyPlacement = {
  ...RIGHT_WIND_PLACEMENT,
  id: 'test-wind-upward',
  wind: { directionX: 1, horizontalTargetSpeed: 1.7, upwardTargetVy: -0.7, halfWidth: 160, halfHeight: 35 },
}

type WindHarness = {
  readonly engine: Matter.Engine
  readonly runtime: ToyRuntime
  readonly balls: readonly ToyBall[]
}

function createBall(ballIndex: number, x: number, y: number, velocity = { x: 0, y: 2 }): ToyBall {
  const body = Bodies.circle(x, y, BALL_RADIUS, {
    density: BALL_DENSITY,
    friction: BALL_FRICTION,
    frictionAir: BALL_FRICTION_AIR,
    label: `ball-${ballIndex}`,
    restitution: BALL_RESTITUTION,
  })
  Body.setVelocity(body, velocity)
  return { ballIndex, body }
}

function createHarness(
  placement: ToyPlacement,
  ballSpecs: readonly { x: number; y: number; velocity?: { x: number; y: number } }[],
): WindHarness {
  const engine = Engine.create({ gravity: { ...GRAVITY } })
  const runtime = createWindToy(placement)
  const balls = ballSpecs.map((spec, index) => createBall(index, spec.x, spec.y, spec.velocity))
  Composite.add(engine.world, [...runtime.bodies, ...balls.map((ball) => ball.body)])
  return { balls, engine, runtime }
}

function speedOf(ball: ToyBall): number {
  return Math.hypot(ball.body.velocity.x, ball.body.velocity.y)
}

describe('windToy の固定ステップ物理', () => {
  it('wind設定のないplacementを渡すと生成時にthrowする', () => {
    const placement: ToyPlacement = { ...RIGHT_WIND_PLACEMENT, wind: undefined }
    expect(() => createWindToy(placement)).toThrow()
  })

  it('物理的な当たり判定Bodyを持たない（透明なセンサーとして振る舞う）', () => {
    const runtime = createWindToy(RIGHT_WIND_PLACEMENT)
    expect(runtime.bodies).toHaveLength(0)
  })

  it('エリア内のボールには継続的に横方向の力がかかり、右向きなら少しずつ右へ流される', () => {
    const harness = createHarness(RIGHT_WIND_PLACEMENT, [
      { x: RIGHT_WIND_PLACEMENT.x, y: RIGHT_WIND_PLACEMENT.y, velocity: { x: 0, y: 2 } },
    ])
    const ball = harness.balls[0]

    harness.runtime.update(0, harness.balls)

    expect(ball.body.velocity.x).toBeGreaterThan(0)
    expect(speedOf(ball)).toBeLessThanOrEqual(MAX_SPEED)
  })

  it('左向きの風は左方向へ力がかかる', () => {
    const harness = createHarness(LEFT_WIND_PLACEMENT, [
      { x: LEFT_WIND_PLACEMENT.x, y: LEFT_WIND_PLACEMENT.y, velocity: { x: 0, y: 2 } },
    ])
    const ball = harness.balls[0]

    harness.runtime.update(0, harness.balls)

    expect(ball.body.velocity.x).toBeLessThan(0)
  })

  it('エリア外のボールには一切作用しない', () => {
    const initialVelocity = { x: 0.5, y: 2 }
    const wind = RIGHT_WIND_PLACEMENT.wind!
    const harness = createHarness(RIGHT_WIND_PLACEMENT, [
      {
        x: RIGHT_WIND_PLACEMENT.x + wind.halfWidth + 20,
        y: RIGHT_WIND_PLACEMENT.y,
        velocity: initialVelocity,
      },
    ])
    const ball = harness.balls[0]

    harness.runtime.update(0, harness.balls)

    expect(ball.body.velocity.x).toBeCloseTo(initialVelocity.x, 8)
    expect(ball.body.velocity.y).toBeCloseTo(initialVelocity.y, 8)
  })

  it('エリアから出た直後は、それ以上横方向へ力が加わらない（状態を持ち越さない）', () => {
    const harness = createHarness(RIGHT_WIND_PLACEMENT, [
      { x: RIGHT_WIND_PLACEMENT.x, y: RIGHT_WIND_PLACEMENT.y, velocity: { x: 0, y: 2 } },
    ])
    const ball = harness.balls[0]

    harness.runtime.update(0, harness.balls)
    const velocityInsideArea = { ...ball.body.velocity }

    const wind = RIGHT_WIND_PLACEMENT.wind!
    Body.setPosition(ball.body, { x: RIGHT_WIND_PLACEMENT.x + wind.halfWidth + 30, y: RIGHT_WIND_PLACEMENT.y })
    harness.runtime.update(16, harness.balls)

    expect(ball.body.velocity.x).toBeCloseTo(velocityInsideArea.x, 8)
  })

  it('横方向の速度は一定の目標値を超えて際限なく増え続けない（壁に貼り付くほど強くならない）', () => {
    const harness = createHarness(RIGHT_WIND_PLACEMENT, [
      { x: RIGHT_WIND_PLACEMENT.x, y: RIGHT_WIND_PLACEMENT.y, velocity: { x: 0, y: 0 } },
    ])
    const ball = harness.balls[0]

    // ボールをエリア内に留め続け、風だけを何百フレームも当て続けても目標速度を超えないことを確認する。
    for (let step = 0; step < 300; step += 1) {
      Body.setPosition(ball.body, { x: RIGHT_WIND_PLACEMENT.x, y: RIGHT_WIND_PLACEMENT.y })
      Body.setVelocity(ball.body, { x: ball.body.velocity.x, y: 0 })
      harness.runtime.update(step * STEP_MS, harness.balls)
    }

    const horizontalTargetSpeed = RIGHT_WIND_PLACEMENT.wind!.horizontalTargetSpeed ?? 3.2
    expect(ball.body.velocity.x).toBeLessThanOrEqual(horizontalTargetSpeed + 1e-6)
  })

  it('すでに目標より速く同じ向きに進んでいるボールを減速させない（既存の勢いを弱めない）', () => {
    const harness = createHarness(RIGHT_WIND_PLACEMENT, [
      { x: RIGHT_WIND_PLACEMENT.x, y: RIGHT_WIND_PLACEMENT.y, velocity: { x: 10, y: 2 } },
    ])
    const ball = harness.balls[0]

    harness.runtime.update(0, harness.balls)

    expect(ball.body.velocity.x).toBeCloseTo(10, 8)
  })

  it('上向き成分を持つ風でも、上向き速度は目標値を超えて増え続けない（延々と浮き続けない）', () => {
    const harness = createHarness(UPWARD_WIND_PLACEMENT, [
      { x: UPWARD_WIND_PLACEMENT.x, y: UPWARD_WIND_PLACEMENT.y, velocity: { x: 0, y: 0 } },
    ])
    const ball = harness.balls[0]

    for (let step = 0; step < 300; step += 1) {
      Body.setPosition(ball.body, { x: UPWARD_WIND_PLACEMENT.x, y: UPWARD_WIND_PLACEMENT.y })
      harness.runtime.update(step * STEP_MS, harness.balls)
    }

    const upwardTarget = UPWARD_WIND_PLACEMENT.wind!.upwardTargetVy!
    expect(ball.body.velocity.y).toBeGreaterThanOrEqual(upwardTarget - 1e-6)
  })

  it('上向き成分の風であっても、実際のエンジン重力の中では有限時間で得点ゾーンへ到達する（永久滞空しない）', () => {
    const harness = createHarness(UPWARD_WIND_PLACEMENT, [
      { x: UPWARD_WIND_PLACEMENT.x, y: UPWARD_WIND_PLACEMENT.y, velocity: { x: 0, y: 0 } },
    ])
    const ball = harness.balls[0]
    const maxSteps = Math.ceil(20_000 / STEP_MS)
    let reachedScoreZoneHeight = false

    for (let step = 0; step < maxSteps; step += 1) {
      const now = step * STEP_MS
      Engine.update(harness.engine, STEP_MS)
      harness.runtime.update(now + STEP_MS, harness.balls)
      if (ball.body.position.y > ZONE_TOP) {
        reachedScoreZoneHeight = true
        break
      }
    }

    expect(reachedScoreZoneHeight).toBe(true)
  })

  it('3球が同時にエリア内へ入っても、それぞれ独立して同じ強さの風を受ける（球数で力が変わらない）', () => {
    const harness = createHarness(RIGHT_WIND_PLACEMENT, [
      { x: RIGHT_WIND_PLACEMENT.x - 40, y: RIGHT_WIND_PLACEMENT.y, velocity: { x: 0, y: 2 } },
      { x: RIGHT_WIND_PLACEMENT.x, y: RIGHT_WIND_PLACEMENT.y, velocity: { x: 0, y: 2 } },
      { x: RIGHT_WIND_PLACEMENT.x + 40, y: RIGHT_WIND_PLACEMENT.y, velocity: { x: 0, y: 2 } },
    ])

    expect(() => harness.runtime.update(0, harness.balls)).not.toThrow()

    const velocities = harness.balls.map((ball) => ball.body.velocity.x)
    for (const vx of velocities) {
      expect(vx).toBeCloseTo(velocities[0], 8)
      expect(vx).toBeGreaterThan(0)
    }
  })

  it('片方だけがエリア内にいる場合、エリア外の球は影響を受けない', () => {
    const wind = RIGHT_WIND_PLACEMENT.wind!
    const harness = createHarness(RIGHT_WIND_PLACEMENT, [
      { x: RIGHT_WIND_PLACEMENT.x, y: RIGHT_WIND_PLACEMENT.y, velocity: { x: 0, y: 2 } },
      { x: RIGHT_WIND_PLACEMENT.x + wind.halfWidth + 40, y: RIGHT_WIND_PLACEMENT.y, velocity: { x: 0, y: 2 } },
    ])

    harness.runtime.update(0, harness.balls)

    expect(harness.balls[0].body.velocity.x).toBeGreaterThan(0)
    expect(harness.balls[1].body.velocity.x).toBeCloseTo(0, 8)
  })

  it('タップ(activate)は見た目のパルスだけを起こし、物理には作用しない', () => {
    const harness = createHarness(RIGHT_WIND_PLACEMENT, [
      { x: RIGHT_WIND_PLACEMENT.x + 1000, y: RIGHT_WIND_PLACEMENT.y, velocity: { x: 0.3, y: 2 } },
    ])
    const ball = harness.balls[0]

    expect(() => {
      harness.runtime.activate(0)
      harness.runtime.update(0, harness.balls)
    }).not.toThrow()
    expect(harness.runtime.readVisualState().pulse).toBe(1)
    expect(ball.body.velocity.x).toBeCloseTo(0.3, 8)

    harness.runtime.update(300, harness.balls)
    expect(harness.runtime.readVisualState().pulse).toBe(0)
  })

  it('エリア内にボールがいる間だけ見た目がactiveになる', () => {
    const harness = createHarness(RIGHT_WIND_PLACEMENT, [
      { x: RIGHT_WIND_PLACEMENT.x, y: RIGHT_WIND_PLACEMENT.y, velocity: { x: 0, y: 2 } },
    ])

    harness.runtime.update(0, harness.balls)
    expect(harness.runtime.readVisualState().active).toBe(true)

    const wind = RIGHT_WIND_PLACEMENT.wind!
    Body.setPosition(harness.balls[0].body, { x: RIGHT_WIND_PLACEMENT.x + wind.halfWidth + 40, y: RIGHT_WIND_PLACEMENT.y })
    harness.runtime.update(16, harness.balls)
    expect(harness.runtime.readVisualState().active).toBe(false)
  })

  it('新しいランタイムはリスタート時の初期状態を持つ（前回の風の状態が残らない）', () => {
    const runtime = createWindToy(RIGHT_WIND_PLACEMENT)
    expect(runtime.readVisualState().active).toBe(false)
    expect(runtime.readVisualState().pulse).toBe(0)
    expect(runtime.readVisualState().scale).toBe(1)
    expect(runtime.readVisualState().spinRad).toBe(0)
  })
})
