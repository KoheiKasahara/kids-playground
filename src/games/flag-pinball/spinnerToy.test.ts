import * as Matter from 'matter-js'
import { describe, expect, it } from 'vitest'
import {
  BALL_RADIUS,
  BOARD_HEIGHT,
  BOARD_WIDTH,
} from './boardLayout'
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
  createSpinnerToy,
  SPINNER_ACTIVE_DURATION_MS,
  SPINNER_MAX_ANGULAR_VELOCITY,
} from './spinnerToy'
import type { ToyPlacement } from './toyLayout'
import type { ToyBall, ToyRuntime } from './toyRuntime'

const { Body, Bodies, Composite, Engine } = Matter

const SPINNER_PLACEMENT: ToyPlacement = {
  id: 'test-spinner',
  kind: 'spinner',
  x: 110,
  y: 385,
  radius: 34,
  tapRadius: 56,
  labelJa: 'くるくる おもちゃ',
}

const SPINNER_INFLUENCE_RADIUS = SPINNER_PLACEMENT.radius + BALL_RADIUS + 8
const BOARD_MARGIN = BALL_RADIUS * 2

type SpinnerHarness = {
  readonly engine: Matter.Engine
  readonly runtime: ToyRuntime
  readonly balls: readonly ToyBall[]
}

function createBall(ballIndex: number, x: number, y: number): ToyBall {
  return {
    ballIndex,
    body: Bodies.circle(x, y, BALL_RADIUS, {
      density: BALL_DENSITY,
      friction: BALL_FRICTION,
      frictionAir: BALL_FRICTION_AIR,
      label: `ball-${ballIndex}`,
      restitution: BALL_RESTITUTION,
    }),
  }
}

function addBoardWalls(engine: Matter.Engine): void {
  // 盤面の端だけを置き、長時間テストでも重力による落下を盤外判定にしないようにする。
  const wallOptions = {
    friction: 0.05,
    isStatic: true,
    restitution: 0.2,
  }
  Composite.add(engine.world, [
    Bodies.rectangle(-30, BOARD_HEIGHT / 2, 60, BOARD_HEIGHT + 100, wallOptions),
    Bodies.rectangle(BOARD_WIDTH + 30, BOARD_HEIGHT / 2, 60, BOARD_HEIGHT + 100, wallOptions),
    Bodies.rectangle(BOARD_WIDTH / 2, -30, BOARD_WIDTH + 100, 60, wallOptions),
    Bodies.rectangle(BOARD_WIDTH / 2, BOARD_HEIGHT + 30, BOARD_WIDTH + 100, 60, wallOptions),
  ])
}

function createHarness(
  ballPositions: readonly { readonly x: number; readonly y: number }[],
  withBoardWalls = false,
): SpinnerHarness {
  const engine = Engine.create({ gravity: { ...GRAVITY } })
  const runtime = createSpinnerToy(SPINNER_PLACEMENT)
  const balls = ballPositions.map((position, index) => createBall(index, position.x, position.y))

  if (withBoardWalls) addBoardWalls(engine)
  Composite.add(engine.world, [...runtime.bodies])
  Composite.add(engine.world, balls.map((ball) => ball.body))

  return { balls, engine, runtime }
}

function firstBody(runtime: ToyRuntime): Matter.Body {
  const body = runtime.bodies[0]
  if (!body) throw new Error('spinner test: spinner body is missing')
  return body
}

function distanceFromSpinner(ball: ToyBall): number {
  return Math.hypot(
    ball.body.position.x - SPINNER_PLACEMENT.x,
    ball.body.position.y - SPINNER_PLACEMENT.y,
  )
}

function speedOf(ball: ToyBall): number {
  return Math.hypot(ball.body.velocity.x, ball.body.velocity.y)
}

function advanceOneStep(harness: SpinnerHarness, now: number): void {
  Engine.update(harness.engine, STEP_MS)
  harness.runtime.update(now + STEP_MS, harness.balls)
}

function advanceSteps(
  harness: SpinnerHarness,
  steps: number,
  options?: { readonly activateAtStart?: boolean; readonly activateEveryFrame?: boolean },
): number {
  const activateAtStart = options?.activateAtStart ?? false
  const activateEveryFrame = options?.activateEveryFrame ?? false
  let now = 0
  if (activateAtStart) harness.runtime.activate(now)

  for (let step = 0; step < steps; step += 1) {
    if (activateEveryFrame) harness.runtime.activate(now)
    advanceOneStep(harness, now)
    now += STEP_MS
  }
  return now
}

describe('spinnerToy の固定ステップ物理', () => {
  it('回転中に羽根の近くのボールが物理的に動き出す', () => {
    const harness = createHarness([
      {
        x: SPINNER_PLACEMENT.x + SPINNER_PLACEMENT.radius + BALL_RADIUS - 4,
        y: SPINNER_PLACEMENT.y,
      },
    ])
    const ball = harness.balls[0]
    if (!ball) throw new Error('spinner test: ball is missing')
    const initialPosition = { ...ball.body.position }

    harness.runtime.activate(0)
    advanceSteps(harness, 60)

    const displacement = Math.hypot(
      ball.body.position.x - initialPosition.x,
      ball.body.position.y - initialPosition.y,
    )
    expect(displacement).toBeGreaterThan(2)
    expect(speedOf(ball)).toBeGreaterThan(0.5)
  })

  it('影響圏の外のボールには重力以外の変化を与えない', () => {
    const position = {
      x: SPINNER_PLACEMENT.x + SPINNER_INFLUENCE_RADIUS + 30,
      y: SPINNER_PLACEMENT.y,
    }
    const activeHarness = createHarness([position])
    const gravityOnlyHarness = createHarness([position])
    const activeBall = activeHarness.balls[0]
    const gravityOnlyBall = gravityOnlyHarness.balls[0]
    if (!activeBall || !gravityOnlyBall) throw new Error('spinner test: ball is missing')

    activeHarness.runtime.activate(0)
    advanceSteps(activeHarness, 60)
    advanceSteps(gravityOnlyHarness, 60)

    expect(activeBall.body.position.x).toBeCloseTo(gravityOnlyBall.body.position.x, 8)
    expect(activeBall.body.position.y).toBeCloseTo(gravityOnlyBall.body.position.y, 8)
    expect(activeBall.body.velocity.x).toBeCloseTo(gravityOnlyBall.body.velocity.x, 8)
    expect(activeBall.body.velocity.y).toBeCloseTo(gravityOnlyBall.body.velocity.y, 8)
  })

  it('未発動で羽根が完全停止しているときは影響圏内の速度を制限しない', () => {
    const harness = createHarness([
      {
        x: SPINNER_PLACEMENT.x + SPINNER_INFLUENCE_RADIUS - 4,
        y: SPINNER_PLACEMENT.y,
      },
    ])
    const ball = harness.balls[0]
    if (!ball) throw new Error('spinner test: ball is missing')

    // 未発動時のpassive回転を一度だけ消化し、羽根が完全停止した状態を作る。
    harness.runtime.update(0, harness.balls)
    harness.runtime.update(1000, harness.balls)
    const initialSpeed = 18
    Body.setVelocity(ball.body, { x: initialSpeed, y: 0 })
    harness.runtime.update(1000 + STEP_MS, harness.balls)

    expect(speedOf(ball)).toBeGreaterThan(MAX_SPEED * 0.5)
    expect(speedOf(ball)).toBeCloseTo(initialSpeed, 8)
  })

  it('発動を毎フレーム繰り返しても近傍ボールの速度が安全上限を超えない', () => {
    const harness = createHarness(
      [{ x: SPINNER_PLACEMENT.x + SPINNER_PLACEMENT.radius + BALL_RADIUS - 4, y: SPINNER_PLACEMENT.y }],
      true,
    )
    const ball = harness.balls[0]
    if (!ball) throw new Error('spinner test: ball is missing')
    let maxNearSpeed = 0
    let maxAngularVelocity = 0

    let now = 0
    for (let step = 0; step < 300; step += 1) {
      harness.runtime.activate(now)
      advanceOneStep(harness, now)
      maxAngularVelocity = Math.max(maxAngularVelocity, Math.abs(firstBody(harness.runtime).angularVelocity))
      if (distanceFromSpinner(ball) <= SPINNER_INFLUENCE_RADIUS) {
        maxNearSpeed = Math.max(maxNearSpeed, speedOf(ball))
      }
      now += STEP_MS
    }

    // 安全装置が毎フレーム働く影響圏内だけを観測し、重力による盤面下部の速度は評価対象にしない。
    expect(maxNearSpeed).toBeGreaterThan(0)
    expect(maxNearSpeed).toBeLessThanOrEqual(MAX_SPEED * 0.5 + 0.001)
    expect(maxAngularVelocity).toBeLessThanOrEqual(SPINNER_MAX_ANGULAR_VELOCITY + 0.001)
  })

  it('連打中もボールが盤面の想定範囲から飛び出さない', () => {
    const harness = createHarness(
      [{ x: SPINNER_PLACEMENT.x + SPINNER_PLACEMENT.radius + BALL_RADIUS - 4, y: SPINNER_PLACEMENT.y }],
      true,
    )
    const ball = harness.balls[0]
    if (!ball) throw new Error('spinner test: ball is missing')

    advanceSteps(harness, 300, { activateEveryFrame: true })

    expect(ball.body.position.x).toBeGreaterThanOrEqual(-BOARD_MARGIN)
    expect(ball.body.position.x).toBeLessThanOrEqual(BOARD_WIDTH + BOARD_MARGIN)
    expect(ball.body.position.y).toBeGreaterThanOrEqual(-BOARD_MARGIN)
    expect(ball.body.position.y).toBeLessThanOrEqual(BOARD_HEIGHT + BOARD_MARGIN)
  })

  it('発動中の再発動で角速度を積み上げず、同じ時間の回転量を大きく変えない', () => {
    const singleHarness = createHarness([])
    const repeatedHarness = createHarness([])
    const singleBody = firstBody(singleHarness.runtime)
    const repeatedBody = firstBody(repeatedHarness.runtime)
    singleHarness.runtime.activate(0)
    repeatedHarness.runtime.activate(0)

    let now = 0
    for (let step = 0; step < 180; step += 1) {
      if (step === 90) repeatedHarness.runtime.activate(now)
      advanceOneStep(singleHarness, now)
      advanceOneStep(repeatedHarness, now)
      now += STEP_MS
    }

    expect(Math.abs(repeatedBody.angle)).toBeGreaterThanOrEqual(Math.abs(singleBody.angle))
    expect(Math.abs(repeatedBody.angularVelocity)).toBeLessThanOrEqual(
      SPINNER_MAX_ANGULAR_VELOCITY + 0.001,
    )
  })

  it('回転中に再タップしても次フレームの角速度が下がらない', () => {
    const harness = createHarness([])
    const body = firstBody(harness.runtime)

    harness.runtime.activate(0)
    harness.runtime.update(1500, harness.balls)
    const recordedVelocity = Math.abs(body.angularVelocity)

    harness.runtime.activate(1500)
    harness.runtime.update(1500 + STEP_MS, harness.balls)

    expect(Math.abs(body.angularVelocity)).toBeGreaterThanOrEqual(recordedVelocity)
    expect(Math.abs(body.angularVelocity)).toBeLessThanOrEqual(
      SPINNER_MAX_ANGULAR_VELOCITY + 0.001,
    )
  })

  it('回転中の再タップで効果時間が延長され、無制限には積み上がらない', () => {
    const singleHarness = createHarness([])
    const repeatedHarness = createHarness([])
    const stopCheckTime = SPINNER_ACTIVE_DURATION_MS + STEP_MS
    const retapTime = SPINNER_ACTIVE_DURATION_MS / 2

    singleHarness.runtime.activate(0)
    repeatedHarness.runtime.activate(0)
    repeatedHarness.runtime.update(retapTime, repeatedHarness.balls)
    repeatedHarness.runtime.activate(retapTime)

    singleHarness.runtime.update(stopCheckTime, singleHarness.balls)
    repeatedHarness.runtime.update(stopCheckTime, repeatedHarness.balls)

    expect(singleHarness.runtime.readVisualState().active).toBe(false)
    expect(repeatedHarness.runtime.readVisualState().active).toBe(true)
  })

  it('羽根のBodyが静的で、回転しても中心位置が動かない', () => {
    const harness = createHarness([])
    const body = firstBody(harness.runtime)
    const initialPosition = { ...body.position }

    expect(body.isStatic).toBe(true)
    expect(body.parts).toHaveLength(3)
    const partSizes = body.parts.slice(1).map((part) => ({
      height: part.bounds.max.y - part.bounds.min.y,
      width: part.bounds.max.x - part.bounds.min.x,
    }))
    partSizes.sort((a, b) => b.width - a.width)
    const horizontalBlade = partSizes[0]
    const verticalBlade = partSizes[1]
    if (!horizontalBlade || !verticalBlade) throw new Error('spinner test: blade parts are missing')
    expect(horizontalBlade.width).toBeCloseTo(SPINNER_PLACEMENT.radius * 2, 1)
    expect(horizontalBlade.height).toBeCloseTo(13, 1)
    expect(verticalBlade.width).toBeCloseTo(13, 1)
    expect(verticalBlade.height).toBeCloseTo(SPINNER_PLACEMENT.radius * 2, 1)
    harness.runtime.activate(0)
    advanceSteps(harness, 90)

    expect(body.position.x).toBeCloseTo(initialPosition.x, 8)
    expect(body.position.y).toBeCloseTo(initialPosition.y, 8)
  })

  it('所定時間で回転が止まり active が false に戻る', () => {
    const harness = createHarness([])
    const body = firstBody(harness.runtime)
    harness.runtime.activate(0)
    harness.runtime.update(SPINNER_ACTIVE_DURATION_MS / 2, harness.balls)

    const halfwayVisual = harness.runtime.readVisualState()
    expect(halfwayVisual.active).toBe(true)
    expect(Math.abs(body.angularVelocity)).toBeGreaterThan(0)

    harness.runtime.update(SPINNER_ACTIVE_DURATION_MS + STEP_MS, harness.balls)

    const visual = harness.runtime.readVisualState()
    expect(visual.active).toBe(false)
    expect(Math.abs(body.angularVelocity)).toBeLessThan(0.001)
  })

  it('readVisualState の spinRad が実際のBody角度と一致する', () => {
    const harness = createHarness([])
    const body = firstBody(harness.runtime)
    harness.runtime.activate(0)
    advanceSteps(harness, 20)

    expect(harness.runtime.readVisualState().spinRad).toBe(body.angle)
  })

  it('おもちゃの真上のボールが回転後も下の得点ゾーン方向へ落ちていける', () => {
    const initialY = SPINNER_PLACEMENT.y - 130
    const harness = createHarness(
      [{ x: SPINNER_PLACEMENT.x, y: initialY }],
      true,
    )
    const ball = harness.balls[0]
    if (!ball) throw new Error('spinner test: ball is missing')

    harness.runtime.activate(0)
    advanceSteps(harness, 240)

    expect(ball.body.position.y).toBeGreaterThan(initialY + 100)
    expect(ball.body.position.y).toBeGreaterThan(SPINNER_PLACEMENT.y + 20)
  })
})

describe('左右2個の回転Toy（同じ共通ロジックの独立インスタンス）', () => {
  const LEFT_PLACEMENT: ToyPlacement = SPINNER_PLACEMENT
  const RIGHT_PLACEMENT: ToyPlacement = {
    ...SPINNER_PLACEMENT,
    id: 'test-spinner-right',
    x: BOARD_WIDTH - SPINNER_PLACEMENT.x,
  }

  it('左だけ発動しても右は静止したまま（片方の状態がもう片方へ漏れない）', () => {
    const left = createSpinnerToy(LEFT_PLACEMENT)
    const right = createSpinnerToy(RIGHT_PLACEMENT)
    const leftBody = firstBody(left)
    const rightBody = firstBody(right)

    left.activate(0)
    let now = 0
    for (let step = 0; step < 60; step += 1) {
      left.update(now, [])
      right.update(now, [])
      now += STEP_MS
    }

    expect(Math.abs(leftBody.angularVelocity)).toBeGreaterThan(0)
    expect(left.readVisualState().active).toBe(true)
    expect(rightBody.angularVelocity).toBe(0)
    expect(right.readVisualState().active).toBe(false)
  })

  it('右だけ発動しても左は静止したまま', () => {
    const left = createSpinnerToy(LEFT_PLACEMENT)
    const right = createSpinnerToy(RIGHT_PLACEMENT)
    const leftBody = firstBody(left)
    const rightBody = firstBody(right)

    right.activate(0)
    let now = 0
    for (let step = 0; step < 60; step += 1) {
      left.update(now, [])
      right.update(now, [])
      now += STEP_MS
    }

    expect(leftBody.angularVelocity).toBe(0)
    expect(left.readVisualState().active).toBe(false)
    expect(Math.abs(rightBody.angularVelocity)).toBeGreaterThan(0)
    expect(right.readVisualState().active).toBe(true)
  })

  it('両方発動すると両方回り、同じ角速度上限を共有する（左右で性能差がない）', () => {
    const left = createSpinnerToy(LEFT_PLACEMENT)
    const right = createSpinnerToy(RIGHT_PLACEMENT)
    const leftBody = firstBody(left)
    const rightBody = firstBody(right)

    left.activate(0)
    right.activate(0)
    let now = 0
    for (let step = 0; step < 60; step += 1) {
      left.update(now, [])
      right.update(now, [])
      now += STEP_MS
    }

    expect(Math.abs(leftBody.angularVelocity)).toBeCloseTo(Math.abs(rightBody.angularVelocity), 8)
    expect(Math.abs(leftBody.angularVelocity)).toBeCloseTo(SPINNER_MAX_ANGULAR_VELOCITY, 2)
  })

  it('見た目の羽根サイズ（長さ・厚さ）が左右で同じで、Bodyの寸法と一致する', () => {
    const left = createSpinnerToy(LEFT_PLACEMENT)
    const right = createSpinnerToy(RIGHT_PLACEMENT)
    const dimensionsOf = (runtime: ToyRuntime) => {
      const body = firstBody(runtime)
      const widths = body.parts.slice(1).map((part) => part.bounds.max.x - part.bounds.min.x)
      const heights = body.parts.slice(1).map((part) => part.bounds.max.y - part.bounds.min.y)
      return { maxWidth: Math.max(...widths), maxHeight: Math.max(...heights) }
    }

    expect(dimensionsOf(left)).toEqual(dimensionsOf(right))
  })
})
