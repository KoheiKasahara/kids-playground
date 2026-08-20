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
import {
  createLauncherToy,
  LAUNCHER_ARMED_DURATION_MS,
  LAUNCHER_ARMED_SCALE,
  LAUNCHER_INFLUENCE_RADIUS,
} from './launcherToy'
import type { ToyPlacement } from './toyLayout'
import type { ToyBall, ToyRuntime } from './toyRuntime'

const { Body, Bodies, Composite, Engine } = Matter

const LAUNCHER_PLACEMENT: ToyPlacement = {
  id: 'test-launcher',
  kind: 'launcher',
  x: 240,
  y: 645,
  radius: 30,
  tapRadius: 56,
  labelJa: 'ぽーん おもちゃ',
}

/** 作用範囲内へ置く座標を、接触距離を越えた位置から導出する。 */
const IN_RANGE_OFFSET = LAUNCHER_INFLUENCE_RADIUS * 0.5
/** 実装の作用範囲の外へ少しだけ離し、境界値に依存しないテスト位置にする。 */
const OUTSIDE_RANGE_MARGIN = LAUNCHER_INFLUENCE_RADIUS * 0.25
/** 上方判定の境界より十分上へ置き、浮遊中の球を対象にしないことを確認する。 */
const ABOVE_TOY_MARGIN = LAUNCHER_INFLUENCE_RADIUS * 0.75
/** タップ後に落下してくる球を、最初は作用範囲から十分離しておく。 */
const LATE_BALL_VERTICAL_OFFSET = LAUNCHER_INFLUENCE_RADIUS * 1.5
/** 落下中も静的パッドへ直接ぶつからず、作用範囲だけへ入る横位置にする。 */
const LATE_BALL_HORIZONTAL_OFFSET = LAUNCHER_INFLUENCE_RADIUS * 0.75
/** 得点ゾーン直前の球が作用範囲から遠いことを、作用範囲から導出して表す。 */
const SCORE_ZONE_APPROACH_OFFSET = LAUNCHER_INFLUENCE_RADIUS * 0.1
/** パルスが収束しても有効状態は続くことを確認する時刻。 */
const PULSE_SETTLED_TIME_MS = LAUNCHER_ARMED_DURATION_MS * 0.2
/** ゲーム終了性を見るため、既存の安全タイマー45秒より短い上限にする。 */
const GAME_END_TEST_TIMEOUT_MS = 25_000
/** 有効窓の中で、同じボールの個別間隔には届かない再タップ時刻として使う。 */
const BEFORE_BALL_COOLDOWN_MS = LAUNCHER_ARMED_DURATION_MS * 0.2

type BallSpec = {
  readonly x: number
  readonly y: number
  readonly velocity?: {
    readonly x: number
    readonly y: number
  }
}

type LauncherHarness = {
  readonly engine: Matter.Engine
  readonly runtime: ToyRuntime
  readonly balls: readonly ToyBall[]
}

function createBall(ballIndex: number, spec: BallSpec): ToyBall {
  const body = Bodies.circle(spec.x, spec.y, BALL_RADIUS, {
    density: BALL_DENSITY,
    friction: BALL_FRICTION,
    frictionAir: BALL_FRICTION_AIR,
    label: `ball-${ballIndex}`,
    restitution: BALL_RESTITUTION,
  })
  if (spec.velocity) Body.setVelocity(body, spec.velocity)
  return { ballIndex, body }
}

function createHarness(specs: readonly BallSpec[], random?: () => number): LauncherHarness {
  const engine = Engine.create({ gravity: { ...GRAVITY } })
  const runtime = createLauncherToy(LAUNCHER_PLACEMENT, random)
  const balls = specs.map((spec, index) => createBall(index, spec))
  Composite.add(engine.world, [...runtime.bodies, ...balls.map((ball) => ball.body)])
  return { balls, engine, runtime }
}

function getOnlyBall(harness: LauncherHarness): ToyBall {
  const ball = harness.balls[0]
  if (!ball) throw new Error('launcher test: ball is missing')
  return ball
}

function getLauncherBody(harness: LauncherHarness): Matter.Body {
  const body = harness.runtime.bodies[0]
  if (!body) throw new Error('launcher test: launcher body is missing')
  return body
}

function speedOf(ball: ToyBall): number {
  return Math.hypot(ball.body.velocity.x, ball.body.velocity.y)
}

function advanceOneStep(
  harness: LauncherHarness,
  now: number,
  activate: boolean,
): void {
  if (activate) harness.runtime.activate(now)
  Engine.update(harness.engine, STEP_MS)
  harness.runtime.update(now + STEP_MS, harness.balls)
}

describe('launcherToy の固定ステップ物理', () => {
  it('タップで有効状態になり、見た目の倍率も切り替わる', () => {
    const harness = createHarness([])

    harness.runtime.activate(0)

    expect(harness.runtime.readVisualState().active).toBe(true)
    expect(harness.runtime.readVisualState().scale).toBe(LAUNCHER_ARMED_SCALE)
  })

  it('有効状態が一定時間続き、終了時に元へ戻る', () => {
    const harness = createHarness([])

    harness.runtime.activate(0)
    harness.runtime.update(LAUNCHER_ARMED_DURATION_MS / 2, harness.balls)
    expect(harness.runtime.readVisualState().active).toBe(true)
    expect(harness.runtime.readVisualState().scale).toBe(LAUNCHER_ARMED_SCALE)

    harness.runtime.update(LAUNCHER_ARMED_DURATION_MS, harness.balls)
    expect(harness.runtime.readVisualState().active).toBe(false)
    expect(harness.runtime.readVisualState().scale).toBe(1)
  })

  it('タップ後にあとから作用範囲へ入ったボールを上向きへ弾く', () => {
    const harness = createHarness([
      {
        x: LAUNCHER_PLACEMENT.x + LATE_BALL_HORIZONTAL_OFFSET,
        y: LAUNCHER_PLACEMENT.y - LATE_BALL_VERTICAL_OFFSET,
        velocity: { x: 0, y: 0 },
      },
    ])
    const ball = getOnlyBall(harness)
    let enteredInfluence = false
    let wasLaunched = false

    harness.runtime.activate(0)
    const maxSteps = Math.ceil(LAUNCHER_ARMED_DURATION_MS / STEP_MS)
    for (let step = 0; step < maxSteps; step += 1) {
      const now = step * STEP_MS
      Engine.update(harness.engine, STEP_MS)
      harness.runtime.update(now + STEP_MS, harness.balls)
      const distance = Math.hypot(
        ball.body.position.x - LAUNCHER_PLACEMENT.x,
        ball.body.position.y - LAUNCHER_PLACEMENT.y,
      )
      if (distance <= LAUNCHER_INFLUENCE_RADIUS) enteredInfluence = true
      if (enteredInfluence && ball.body.velocity.y < 0) {
        wasLaunched = true
        break
      }
    }

    expect(enteredInfluence).toBe(true)
    expect(wasLaunched).toBe(true)
    expect(ball.body.velocity.y).toBeLessThan(0)
  })

  it('タップしていなければ落下中に作用範囲へ入っても押し上げない', () => {
    const harness = createHarness([
      {
        x: LAUNCHER_PLACEMENT.x + LATE_BALL_HORIZONTAL_OFFSET,
        y: LAUNCHER_PLACEMENT.y - LATE_BALL_VERTICAL_OFFSET,
        velocity: { x: 0, y: 0 },
      },
    ])
    const ball = getOnlyBall(harness)
    let enteredInfluence = false
    const maxSteps = Math.ceil(LAUNCHER_ARMED_DURATION_MS / STEP_MS)

    for (let step = 0; step < maxSteps; step += 1) {
      const now = step * STEP_MS
      Engine.update(harness.engine, STEP_MS)
      harness.runtime.update(now + STEP_MS, harness.balls)
      const distance = Math.hypot(
        ball.body.position.x - LAUNCHER_PLACEMENT.x,
        ball.body.position.y - LAUNCHER_PLACEMENT.y,
      )
      if (distance <= LAUNCHER_INFLUENCE_RADIUS) {
        enteredInfluence = true
        expect(ball.body.velocity.y).toBeGreaterThanOrEqual(0)
        break
      }
    }

    expect(enteredInfluence).toBe(true)
  })

  it('有効時間終了後に作用範囲へ入ったボールには作用しない', () => {
    const harness = createHarness([
      {
        x: LAUNCHER_PLACEMENT.x + LATE_BALL_HORIZONTAL_OFFSET,
        y: LAUNCHER_PLACEMENT.y - LATE_BALL_VERTICAL_OFFSET,
        velocity: { x: 0, y: 0 },
      },
    ])
    const ball = getOnlyBall(harness)
    let enteredInfluence = false

    harness.runtime.activate(0)
    harness.runtime.update(LAUNCHER_ARMED_DURATION_MS, harness.balls)
    expect(harness.runtime.readVisualState().active).toBe(false)

    const maxSteps = Math.ceil(LAUNCHER_ARMED_DURATION_MS / STEP_MS)
    for (let step = 0; step < maxSteps; step += 1) {
      const now = LAUNCHER_ARMED_DURATION_MS + step * STEP_MS
      Engine.update(harness.engine, STEP_MS)
      harness.runtime.update(now + STEP_MS, harness.balls)
      const distance = Math.hypot(
        ball.body.position.x - LAUNCHER_PLACEMENT.x,
        ball.body.position.y - LAUNCHER_PLACEMENT.y,
      )
      if (distance <= LAUNCHER_INFLUENCE_RADIUS) {
        enteredInfluence = true
        expect(ball.body.velocity.y).toBeGreaterThanOrEqual(0)
        break
      }
    }

    expect(enteredInfluence).toBe(true)
  })

  it('有効中の拡大と当たり判定が同期し、往復しても半径と中心に誤差を残さない', () => {
    const harness = createHarness([])
    const launcherBody = getLauncherBody(harness)
    const initialPosition = { ...launcherBody.position }

    expect(launcherBody.circleRadius).toBeCloseTo(LAUNCHER_PLACEMENT.radius, 8)

    harness.runtime.activate(0)
    expect(launcherBody.circleRadius).toBeCloseTo(
      LAUNCHER_PLACEMENT.radius * LAUNCHER_ARMED_SCALE,
      8,
    )
    expect(launcherBody.position.x).toBeCloseTo(initialPosition.x, 8)
    expect(launcherBody.position.y).toBeCloseTo(initialPosition.y, 8)

    harness.runtime.update(LAUNCHER_ARMED_DURATION_MS, harness.balls)
    expect(launcherBody.circleRadius).toBeCloseTo(LAUNCHER_PLACEMENT.radius, 8)
    expect(launcherBody.position.x).toBeCloseTo(initialPosition.x, 8)
    expect(launcherBody.position.y).toBeCloseTo(initialPosition.y, 8)

    for (let cycle = 0; cycle < 3; cycle += 1) {
      const now = LAUNCHER_ARMED_DURATION_MS * (cycle + 1)
      harness.runtime.activate(now)
      expect(launcherBody.circleRadius).toBeCloseTo(
        LAUNCHER_PLACEMENT.radius * LAUNCHER_ARMED_SCALE,
        8,
      )
      harness.runtime.update(now + LAUNCHER_ARMED_DURATION_MS, harness.balls)
      expect(launcherBody.circleRadius).toBeCloseTo(LAUNCHER_PLACEMENT.radius, 8)
      expect(launcherBody.position.x).toBeCloseTo(initialPosition.x, 8)
      expect(launcherBody.position.y).toBeCloseTo(initialPosition.y, 8)
    }
  })

  it('再タップで有効時間が延長される', () => {
    const harness = createHarness([])

    harness.runtime.activate(0)
    harness.runtime.update(LAUNCHER_ARMED_DURATION_MS * 0.75, harness.balls)
    harness.runtime.activate(LAUNCHER_ARMED_DURATION_MS * 0.75)

    harness.runtime.update(LAUNCHER_ARMED_DURATION_MS * 1.1, harness.balls)
    expect(harness.runtime.readVisualState().active).toBe(true)
    harness.runtime.update(LAUNCHER_ARMED_DURATION_MS * 1.75, harness.balls)
    expect(harness.runtime.readVisualState().active).toBe(false)
  })

  it('新しいランタイムはリスタート時の初期状態を持つ', () => {
    const runtime = createLauncherToy(LAUNCHER_PLACEMENT)
    const launcherBody = runtime.bodies[0]
    if (!launcherBody) throw new Error('launcher test: launcher body is missing')

    expect(runtime.readVisualState().active).toBe(false)
    expect(runtime.readVisualState().scale).toBe(1)
    expect(launcherBody.circleRadius).toBeCloseTo(LAUNCHER_PLACEMENT.radius, 8)
  })

  it('作用範囲内で落下中のボールを上向きへ弾く', () => {
    const harness = createHarness([
      {
        x: LAUNCHER_PLACEMENT.x + IN_RANGE_OFFSET,
        y: LAUNCHER_PLACEMENT.y + IN_RANGE_OFFSET,
        velocity: { x: 0, y: 2 },
      },
    ])
    const ball = getOnlyBall(harness)

    advanceOneStep(harness, 0, true)

    expect(ball.body.velocity.y).toBeLessThan(0)
    expect(speedOf(ball)).toBeLessThanOrEqual(MAX_SPEED)
  })

  it('注入された乱数源で左右の散らしを決める', () => {
    let randomCalls = 0
    const random = () => {
      randomCalls += 1
      return 0
    }
    const harness = createHarness(
      [
        {
          x: LAUNCHER_PLACEMENT.x + IN_RANGE_OFFSET,
          y: LAUNCHER_PLACEMENT.y + IN_RANGE_OFFSET,
          velocity: { x: 0, y: 2 },
        },
      ],
      random,
    )
    const ball = getOnlyBall(harness)

    harness.runtime.activate(0)
    harness.runtime.update(0, harness.balls)

    expect(randomCalls).toBe(2)
    expect(ball.body.velocity.x).toBeCloseTo(-0.8, 8)
    expect(ball.body.velocity.y).toBeCloseTo(-11.5, 8)
  })

  it('作用範囲の外にあるボールの速度を変えない', () => {
    const initialVelocity = { x: 0.7, y: 2.5 }
    const harness = createHarness([
      {
        x: LAUNCHER_PLACEMENT.x + LAUNCHER_INFLUENCE_RADIUS + OUTSIDE_RANGE_MARGIN,
        y: LAUNCHER_PLACEMENT.y + IN_RANGE_OFFSET,
        velocity: initialVelocity,
      },
    ])
    const ball = getOnlyBall(harness)

    harness.runtime.activate(0)
    harness.runtime.update(0, harness.balls)

    expect(ball.body.velocity.x).toBeCloseTo(initialVelocity.x, 8)
    expect(ball.body.velocity.y).toBeCloseTo(initialVelocity.y, 8)
  })

  it('おもちゃの真下でも得点ゾーン直前の遠いボールは押し上げない', () => {
    const initialVelocity = { x: 0.2, y: 1.5 }
    const harness = createHarness([
      {
        x: LAUNCHER_PLACEMENT.x,
        y: ZONE_TOP - SCORE_ZONE_APPROACH_OFFSET,
        velocity: initialVelocity,
      },
    ])
    const ball = getOnlyBall(harness)

    harness.runtime.activate(0)
    harness.runtime.update(0, harness.balls)

    expect(ball.body.velocity.x).toBeCloseTo(initialVelocity.x, 8)
    expect(ball.body.velocity.y).toBeCloseTo(initialVelocity.y, 8)
  })

  it('おもちゃより十分上にあるボールを押し上げない', () => {
    const initialVelocity = { x: -0.5, y: 1.2 }
    const harness = createHarness([
      {
        x: LAUNCHER_PLACEMENT.x,
        y: LAUNCHER_PLACEMENT.y - ABOVE_TOY_MARGIN,
        velocity: initialVelocity,
      },
    ])
    const ball = getOnlyBall(harness)

    harness.runtime.activate(0)
    harness.runtime.update(0, harness.balls)

    expect(ball.body.velocity.x).toBeCloseTo(initialVelocity.x, 8)
    expect(ball.body.velocity.y).toBeCloseTo(initialVelocity.y, 8)
  })

  it('短時間の50回発動でもボールの速さが安全上限を超えない', () => {
    const harness = createHarness([
      {
        x: LAUNCHER_PLACEMENT.x,
        y: LAUNCHER_PLACEMENT.y + IN_RANGE_OFFSET,
        velocity: { x: 0, y: 2 },
      },
    ])
    const ball = getOnlyBall(harness)
    let maxSpeed = 0

    for (let tap = 0; tap < 50; tap += 1) {
      const now = tap * 10
      harness.runtime.activate(now)
      harness.runtime.update(now, harness.balls)
      maxSpeed = Math.max(maxSpeed, speedOf(ball))
    }

    expect(maxSpeed).toBeLessThanOrEqual(MAX_SPEED)
  })

  it('有効中の再タップでも同じボールへ物理を二重に適用しない', () => {
    const harness = createHarness([
      {
        x: LAUNCHER_PLACEMENT.x + IN_RANGE_OFFSET,
        y: LAUNCHER_PLACEMENT.y + IN_RANGE_OFFSET,
        velocity: { x: 0, y: 2 },
      },
    ])
    const ball = getOnlyBall(harness)

    harness.runtime.activate(0)
    harness.runtime.update(0, harness.balls)
    const velocityAfterFirstTap = { ...ball.body.velocity }

    harness.runtime.activate(BEFORE_BALL_COOLDOWN_MS)
    harness.runtime.update(BEFORE_BALL_COOLDOWN_MS, harness.balls)

    expect(ball.body.velocity.x).toBe(velocityAfterFirstTap.x)
    expect(ball.body.velocity.y).toBe(velocityAfterFirstTap.y)
  })

  it('同じボールは個別クールダウン中に何度も押し上げられない', () => {
    const harness = createHarness([
      {
        x: LAUNCHER_PLACEMENT.x,
        y: LAUNCHER_PLACEMENT.y + IN_RANGE_OFFSET,
        velocity: { x: 0, y: 2 },
      },
    ])
    const ball = getOnlyBall(harness)

    harness.runtime.activate(0)
    harness.runtime.update(0, harness.balls)
    Body.setVelocity(ball.body, { x: 0, y: 2 })

    // 有効窓の中で、個別クールダウンがなければ再発動できる時刻にする。
    harness.runtime.activate(BEFORE_BALL_COOLDOWN_MS)
    harness.runtime.update(BEFORE_BALL_COOLDOWN_MS, harness.balls)

    expect(ball.body.velocity.x).toBeCloseTo(0, 8)
    expect(ball.body.velocity.y).toBeCloseTo(2, 8)
  })

  it('個別クールダウン中のボールがいても別のボールは押し上げられる', () => {
    const harness = createHarness([
      {
        x: LAUNCHER_PLACEMENT.x,
        y: LAUNCHER_PLACEMENT.y - ABOVE_TOY_MARGIN,
        velocity: { x: 0, y: 1.2 },
      },
      {
        x: LAUNCHER_PLACEMENT.x + IN_RANGE_OFFSET,
        y: LAUNCHER_PLACEMENT.y + IN_RANGE_OFFSET,
        velocity: { x: 0, y: 2 },
      },
    ])
    const firstBall = harness.balls[0]
    const secondBall = harness.balls[1]
    if (!firstBall || !secondBall) throw new Error('launcher test: balls are missing')

    harness.runtime.activate(0)
    harness.runtime.update(0, harness.balls)
    expect(firstBall.body.velocity.y).toBeCloseTo(1.2, 8)
    expect(secondBall.body.velocity.y).toBeLessThan(0)

    Body.setPosition(firstBall.body, {
      x: LAUNCHER_PLACEMENT.x,
      y: LAUNCHER_PLACEMENT.y + IN_RANGE_OFFSET,
    })
    Body.setVelocity(firstBall.body, { x: 0, y: 2 })
    Body.setVelocity(secondBall.body, { x: 0, y: 2 })
    harness.runtime.activate(BEFORE_BALL_COOLDOWN_MS)
    harness.runtime.update(BEFORE_BALL_COOLDOWN_MS, harness.balls)

    expect(firstBall.body.velocity.y).toBeLessThan(0)
    expect(secondBall.body.velocity.y).toBeCloseTo(2, 8)
  })

  it('空振りでも手応えが立ち、例外を投げない', () => {
    const harness = createHarness([])

    expect(() => {
      harness.runtime.activate(0)
      harness.runtime.update(0, harness.balls)
    }).not.toThrow()
    expect(harness.runtime.readVisualState().pulse).toBe(1)
    expect(harness.runtime.readVisualState().active).toBe(true)

    harness.runtime.update(PULSE_SETTLED_TIME_MS, harness.balls)
    expect(harness.runtime.readVisualState().pulse).toBe(0)
    expect(harness.runtime.readVisualState().active).toBe(true)
    expect(harness.runtime.readVisualState().scale).toBe(LAUNCHER_ARMED_SCALE)
    harness.runtime.update(LAUNCHER_ARMED_DURATION_MS, harness.balls)
    expect(harness.runtime.readVisualState().active).toBe(false)
    expect(harness.runtime.readVisualState().scale).toBe(1)
    expect(harness.runtime.readVisualState().spinRad).toBe(0)
  })

  it('作用条件を満たす複数のボールすべてに作用する', () => {
    const harness = createHarness([
      {
        x: LAUNCHER_PLACEMENT.x - IN_RANGE_OFFSET,
        y: LAUNCHER_PLACEMENT.y + IN_RANGE_OFFSET,
        velocity: { x: 0, y: 2 },
      },
      {
        x: LAUNCHER_PLACEMENT.x,
        y: LAUNCHER_PLACEMENT.y + IN_RANGE_OFFSET,
        velocity: { x: 0, y: 2 },
      },
      {
        x: LAUNCHER_PLACEMENT.x + IN_RANGE_OFFSET,
        y: LAUNCHER_PLACEMENT.y + IN_RANGE_OFFSET,
        velocity: { x: 0, y: 2 },
      },
    ])

    harness.runtime.activate(0)
    harness.runtime.update(0, harness.balls)

    for (const ball of harness.balls) {
      expect(ball.body.velocity.y).toBeLessThan(0)
    }
  })

  it('毎フレーム発動を続けても、ボールが有限時間で得点ゾーンへ落ちる', () => {
    const harness = createHarness([
      {
        x: LAUNCHER_PLACEMENT.x,
        y: LAUNCHER_PLACEMENT.y + LAUNCHER_INFLUENCE_RADIUS * 1.25,
        velocity: { x: 0, y: 1.5 },
      },
    ])
    const ball = getOnlyBall(harness)
    const maxSteps = Math.ceil(GAME_END_TEST_TIMEOUT_MS / STEP_MS)
    let reachedScoreZoneHeight = false

    for (let step = 0; step < maxSteps; step += 1) {
      const now = step * STEP_MS
      advanceOneStep(harness, now, true)
      if (ball.body.position.y > ZONE_TOP) {
        reachedScoreZoneHeight = true
        break
      }
    }

    expect(reachedScoreZoneHeight).toBe(true)
  })

  it('押し上げの横方向には左右どちらの散らしも出る', () => {
    let hasLeftwardVelocity = false
    let hasRightwardVelocity = false

    for (let trial = 0; trial < 48; trial += 1) {
      const harness = createHarness([
        {
          x: LAUNCHER_PLACEMENT.x,
          y: LAUNCHER_PLACEMENT.y + IN_RANGE_OFFSET,
          velocity: { x: 0, y: 2 },
        },
      ])
      const ball = getOnlyBall(harness)
      harness.runtime.activate(0)
      harness.runtime.update(0, harness.balls)
      if (ball.body.velocity.x < -0.01) hasLeftwardVelocity = true
      if (ball.body.velocity.x > 0.01) hasRightwardVelocity = true
    }

    expect(hasLeftwardVelocity).toBe(true)
    expect(hasRightwardVelocity).toBe(true)
  })
})
