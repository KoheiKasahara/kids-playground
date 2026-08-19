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
import { createJumppadToy } from './jumppadToy'
import type { ToyPlacement } from './toyLayout'
import type { ToyBall, ToyRuntime } from './toyRuntime'

const { Body, Bodies, Composite, Engine } = Matter

const JUMPPAD_PLACEMENT: ToyPlacement = {
  id: 'test-jumppad',
  kind: 'jumppad',
  x: 240,
  y: 656,
  radius: 32,
  tapRadius: 58,
  labelJa: 'ロケット はっしゃだい',
}

/** 実装の作用範囲（半径＋ボール半径＋余白）の内側へ置く座標。 */
const INFLUENCE_RADIUS = JUMPPAD_PLACEMENT.radius + BALL_RADIUS + 10
const IN_RANGE_OFFSET = INFLUENCE_RADIUS * 0.5
const OUTSIDE_RANGE_MARGIN = INFLUENCE_RADIUS * 0.5

type JumppadHarness = {
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
  ballSpecs: readonly { x: number; y: number; velocity?: { x: number; y: number } }[],
): JumppadHarness {
  const engine = Engine.create({ gravity: { ...GRAVITY } })
  const runtime = createJumppadToy(JUMPPAD_PLACEMENT)
  const balls = ballSpecs.map((spec, index) => createBall(index, spec.x, spec.y, spec.velocity))
  Composite.add(engine.world, [...runtime.bodies, ...balls.map((ball) => ball.body)])
  return { balls, engine, runtime }
}

function speedOf(ball: ToyBall): number {
  return Math.hypot(ball.body.velocity.x, ball.body.velocity.y)
}

describe('jumppadToy の固定ステップ物理', () => {
  it('タップしなくても、作用範囲へ入ったボールを自動で上方向へ弾く', () => {
    const harness = createHarness([
      { x: JUMPPAD_PLACEMENT.x, y: JUMPPAD_PLACEMENT.y + IN_RANGE_OFFSET, velocity: { x: 0, y: 2 } },
    ])
    const ball = harness.balls[0]

    harness.runtime.update(0, harness.balls)

    expect(ball.body.velocity.y).toBeLessThan(0)
    expect(speedOf(ball)).toBeLessThanOrEqual(MAX_SPEED)
  })

  it('作用範囲の外にあるボールには作用しない', () => {
    const initialVelocity = { x: 0.5, y: 2 }
    const harness = createHarness([
      {
        x: JUMPPAD_PLACEMENT.x + INFLUENCE_RADIUS + OUTSIDE_RANGE_MARGIN,
        y: JUMPPAD_PLACEMENT.y,
        velocity: initialVelocity,
      },
    ])
    const ball = harness.balls[0]

    harness.runtime.update(0, harness.balls)

    expect(ball.body.velocity.x).toBeCloseTo(initialVelocity.x, 8)
    expect(ball.body.velocity.y).toBeCloseTo(initialVelocity.y, 8)
  })

  it('打ち上げ後の上昇速度は画面上端まで吹き飛ぶほど強くない（現実的な上限の範囲）', () => {
    const harness = createHarness([
      { x: JUMPPAD_PLACEMENT.x, y: JUMPPAD_PLACEMENT.y + IN_RANGE_OFFSET, velocity: { x: 0, y: 2 } },
    ])
    const ball = harness.balls[0]

    harness.runtime.update(0, harness.balls)

    // 重力からの復元時間から求めた上昇量が、盤面全体の高さよりずっと小さいことを確認する
    // （厳密な等式ではなく、暴走していないことの緩い上限チェック）。
    expect(Math.abs(ball.body.velocity.y)).toBeLessThan(20)
    expect(speedOf(ball)).toBeLessThanOrEqual(MAX_SPEED)
  })

  it('同じボールは個別クールダウン中に何度も打ち上げられない（同じ場所での無限バウンドを防ぐ）', () => {
    const harness = createHarness([
      { x: JUMPPAD_PLACEMENT.x, y: JUMPPAD_PLACEMENT.y + IN_RANGE_OFFSET, velocity: { x: 0, y: 2 } },
    ])
    const ball = harness.balls[0]

    harness.runtime.update(0, harness.balls)
    const velocityAfterFirstLaunch = { ...ball.body.velocity }

    // クールダウン中に無理やり作用範囲へ戻し、再度上向きへ弾かれないことを確認する。
    Body.setPosition(ball.body, { x: JUMPPAD_PLACEMENT.x, y: JUMPPAD_PLACEMENT.y + IN_RANGE_OFFSET })
    Body.setVelocity(ball.body, { x: 0, y: 2 })
    harness.runtime.update(200, harness.balls)

    expect(ball.body.velocity.x).toBeCloseTo(0, 8)
    expect(ball.body.velocity.y).toBeCloseTo(2, 8)
    expect(velocityAfterFirstLaunch.y).toBeLessThan(0)
  })

  it('クールダウンが明けると再び打ち上げられる（永久停止しない）', () => {
    const harness = createHarness([
      { x: JUMPPAD_PLACEMENT.x, y: JUMPPAD_PLACEMENT.y + IN_RANGE_OFFSET, velocity: { x: 0, y: 2 } },
    ])
    const ball = harness.balls[0]

    harness.runtime.update(0, harness.balls)
    Body.setPosition(ball.body, { x: JUMPPAD_PLACEMENT.x, y: JUMPPAD_PLACEMENT.y + IN_RANGE_OFFSET })
    Body.setVelocity(ball.body, { x: 0, y: 2 })

    harness.runtime.update(1000, harness.balls)

    expect(ball.body.velocity.y).toBeLessThan(0)
  })

  it('複数ボールが同時に作用範囲へ入っても、すべて上向きへ弾かれ物理が破綻しない', () => {
    const harness = createHarness([
      { x: JUMPPAD_PLACEMENT.x - 10, y: JUMPPAD_PLACEMENT.y + IN_RANGE_OFFSET, velocity: { x: 0, y: 2 } },
      { x: JUMPPAD_PLACEMENT.x, y: JUMPPAD_PLACEMENT.y + IN_RANGE_OFFSET, velocity: { x: 0, y: 2 } },
      { x: JUMPPAD_PLACEMENT.x + 10, y: JUMPPAD_PLACEMENT.y + IN_RANGE_OFFSET, velocity: { x: 0, y: 2 } },
    ])

    expect(() => harness.runtime.update(0, harness.balls)).not.toThrow()

    for (const ball of harness.balls) {
      expect(ball.body.velocity.y).toBeLessThan(0)
      expect(speedOf(ball)).toBeLessThanOrEqual(MAX_SPEED)
      expect(Number.isFinite(ball.body.position.x)).toBe(true)
      expect(Number.isFinite(ball.body.position.y)).toBe(true)
    }
  })

  it('すでに上昇中のボールへは重ねて作用しない（二重加算しない）', () => {
    const harness = createHarness([
      { x: JUMPPAD_PLACEMENT.x, y: JUMPPAD_PLACEMENT.y, velocity: { x: 0, y: -20 } },
    ])
    const ball = harness.balls[0]

    harness.runtime.update(0, harness.balls)

    expect(ball.body.velocity.y).toBeCloseTo(-20, 8)
  })

  it('タップは見た目のパルスだけを起こし、例外を投げない', () => {
    const harness = createHarness([])

    expect(() => {
      harness.runtime.activate(0)
      harness.runtime.update(0, harness.balls)
    }).not.toThrow()
    expect(harness.runtime.readVisualState().pulse).toBe(1)

    harness.runtime.update(300, harness.balls)
    expect(harness.runtime.readVisualState().pulse).toBe(0)
  })

  it('実際にボールを打ち上げた瞬間は見た目がactiveになり、時間経過で収まる', () => {
    const harness = createHarness([
      { x: JUMPPAD_PLACEMENT.x, y: JUMPPAD_PLACEMENT.y + IN_RANGE_OFFSET, velocity: { x: 0, y: 2 } },
    ])

    harness.runtime.update(0, harness.balls)
    expect(harness.runtime.readVisualState().active).toBe(true)

    harness.runtime.update(1000, harness.balls)
    expect(harness.runtime.readVisualState().active).toBe(false)
  })

  it('得点ゾーンへ向けて自然に落ちる（打ち上げられたボールが有限時間で得点ゾーンへ到達する）', () => {
    const harness = createHarness([
      { x: JUMPPAD_PLACEMENT.x, y: JUMPPAD_PLACEMENT.y + IN_RANGE_OFFSET, velocity: { x: 0, y: 2 } },
    ])
    const ball = harness.balls[0]
    const maxSteps = Math.ceil(15_000 / STEP_MS)
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

  it('新しいランタイムはリスタート時の初期状態を持つ', () => {
    const runtime = createJumppadToy(JUMPPAD_PLACEMENT)
    expect(runtime.readVisualState().active).toBe(false)
    expect(runtime.readVisualState().pulse).toBe(0)
    expect(runtime.readVisualState().scale).toBe(1)
  })
})
