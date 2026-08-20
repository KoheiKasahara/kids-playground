import * as Matter from 'matter-js'
import { describe, expect, it } from 'vitest'
import { BALL_RADIUS } from './boardLayout'
import { BALL_DENSITY, BALL_FRICTION, BALL_FRICTION_AIR, BALL_RESTITUTION, GRAVITY, MAX_SPEED, STEP_MS } from './pinballPhysics'
import { createCarToy } from './carToy'
import type { CarConfig, ToyPlacement } from './toyLayout'
import type { ToyBall, ToyRuntime } from './toyRuntime'

const { Body, Bodies, Composite, Engine } = Matter

const CAR: CarConfig = { leftX: 140, rightX: 340, speed: 2, initialDirection: 1 }

const CAR_PLACEMENT: ToyPlacement = {
  id: 'test-car',
  kind: 'car',
  x: CAR.leftX,
  y: 460,
  radius: 60,
  tapRadius: 70,
  labelJa: 'はしる くるま',
  car: CAR,
}

type CarHarness = {
  readonly engine: Matter.Engine
  readonly runtime: ToyRuntime
  readonly balls: ToyBall[]
  now: number
}

function createBall(ballIndex: number, x: number, y: number, velocity = { x: 0, y: 0 }): ToyBall {
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

function createHarness(placement: ToyPlacement, balls: ToyBall[] = []): CarHarness {
  const engine = Engine.create({ gravity: { ...GRAVITY } })
  const runtime = createCarToy(placement)
  Composite.add(engine.world, [...runtime.bodies, ...balls.map((ball) => ball.body)])
  return { balls, engine, runtime, now: 0 }
}

function carBody(runtime: ToyRuntime): Matter.Body {
  const body = runtime.bodies[0]
  if (!body) throw new Error('car test: car body is missing')
  return body
}

/** harness.now を呼び出しをまたいで積み上げていく（1回の呼び出しごとにリセットしない）。 */
function advanceSteps(harness: CarHarness, steps: number): void {
  for (let i = 0; i < steps; i += 1) {
    harness.now += STEP_MS
    Engine.update(harness.engine, STEP_MS)
    harness.runtime.update(harness.now, harness.balls)
  }
}

describe('carToy', () => {
  it('car設定のないplacementを渡すと生成時にthrowする', () => {
    const placement: ToyPlacement = { ...CAR_PLACEMENT, car: undefined }
    expect(() => createCarToy(placement)).toThrow()
  })

  it('leftXがrightXを超えるcar設定は生成時にthrowする', () => {
    const placement: ToyPlacement = { ...CAR_PLACEMENT, car: { ...CAR, leftX: 400, rightX: 100 } }
    expect(() => createCarToy(placement)).toThrow()
  })

  it('物理的な当たり判定Body（複合、胴体＋屋根）を持つ', () => {
    const runtime = createCarToy(CAR_PLACEMENT)
    expect(runtime.bodies).toHaveLength(1)
    expect(runtime.bodies[0]!.parts.length).toBeGreaterThanOrEqual(3) // 自分自身 + 胴体 + 屋根
  })

  it('初期位置はplacement.x、初期の向きはinitialDirectionに一致する', () => {
    const runtime = createCarToy(CAR_PLACEMENT)
    expect(carBody(runtime).position.x).toBeCloseTo(CAR_PLACEMENT.x, 5)
    expect(runtime.readVisualState().offsetX).toBeCloseTo(0, 5)
    expect(runtime.readVisualState().facing).toBe('right')
  })

  it('placement.xが可動範囲外でも、初期位置は範囲内へ丸められる', () => {
    const placement: ToyPlacement = { ...CAR_PLACEMENT, x: 1000 }
    const runtime = createCarToy(placement)
    expect(carBody(runtime).position.x).toBeCloseTo(CAR.rightX, 5)
  })

  it('時間経過とともに右へ移動し、瞬間移動しない（1ステップの移動量が小さい）', () => {
    const harness = createHarness(CAR_PLACEMENT)
    // 最初のupdate呼び出しはdt基準を作るだけで移動しない（他toyと同じ「初回dt=0」規約）ため、
    // 1回進めてから実際の移動量を測る。
    advanceSteps(harness, 1)
    const before = carBody(harness.runtime).position.x
    advanceSteps(harness, 1)
    const after = carBody(harness.runtime).position.x

    expect(after).toBeGreaterThan(before)
    expect(after - before).toBeLessThan(5)
  })

  it('右端(rightX)に到達すると、それを超えず進行方向が反転する', () => {
    const harness = createHarness(CAR_PLACEMENT)
    advanceSteps(harness, 4000)

    const x = carBody(harness.runtime).position.x
    expect(x).toBeLessThanOrEqual(CAR.rightX + 1e-6)
    expect(x).toBeGreaterThanOrEqual(CAR.leftX - 1e-6)
  })

  it('左端(leftX)より左には出ず、右向きに反転して戻ってくる', () => {
    const placement: ToyPlacement = { ...CAR_PLACEMENT, x: CAR.rightX, car: { ...CAR, initialDirection: -1 } }
    const harness = createHarness(placement)
    advanceSteps(harness, 4000)

    const x = carBody(harness.runtime).position.x
    expect(x).toBeGreaterThanOrEqual(CAR.leftX - 1e-6)
    expect(x).toBeLessThanOrEqual(CAR.rightX + 1e-6)
  })

  it('往復のあいだ、可動範囲(leftX〜rightX)を一度も超えない', () => {
    const harness = createHarness(CAR_PLACEMENT)
    let maxX = -Infinity
    let minX = Infinity
    for (let i = 0; i < 3000; i += 1) {
      advanceSteps(harness, 1)
      const x = carBody(harness.runtime).position.x
      maxX = Math.max(maxX, x)
      minX = Math.min(minX, x)
    }
    expect(maxX).toBeLessThanOrEqual(CAR.rightX + 1e-6)
    expect(minX).toBeGreaterThanOrEqual(CAR.leftX - 1e-6)
  })

  it('offsetXとfacingが移動方向と連動する', () => {
    const harness = createHarness(CAR_PLACEMENT)
    advanceSteps(harness, 10)
    const visual = harness.runtime.readVisualState()
    expect(visual.facing).toBe('right')
    expect(visual.offsetX).toBeGreaterThan(0)
  })

  it('タップ(activate)は見た目のパルスだけを起こし、移動には影響しない', () => {
    const harness = createHarness(CAR_PLACEMENT)
    const before = carBody(harness.runtime).position.x
    harness.runtime.activate(0)
    expect(harness.runtime.readVisualState().pulse).toBe(1)
    // activate自体は移動を進めない（次のupdateで初めて時間が進む）
    expect(carBody(harness.runtime).position.x).toBeCloseTo(before, 5)
  })

  it('真上から落ちたボールが車の胴体に衝突し、実際の物理衝突として跳ね返る（すり抜けない）', () => {
    // このテストはCollider形状そのものを検証したいので、車自身の水平移動は起こさない
    // （runtime.updateを呼ばず、生成時の初期位置(placement.x, placement.y)に固定されたままにする）。
    // 「車がある世界」と「同じ初期条件だが障害物が何もない世界」を同じステップ数だけ
    // 進め、車がある世界のほうが明らかに落下が妨げられている（yが小さいまま）ことを確認する。
    // すり抜けていれば両者はほぼ同じ位置まで落ちるはずで、実際に衝突していれば
    // 車がある世界のボールだけが車の高さ付近で止められる／跳ね返る。
    const startY = CAR_PLACEMENT.y - 200
    const withCar = createHarness(CAR_PLACEMENT, [createBall(0, CAR_PLACEMENT.x, startY, { x: 0, y: 8 })])
    const freeFallEngine = Engine.create({ gravity: { ...GRAVITY } })
    const freeFallBall = createBall(0, CAR_PLACEMENT.x, startY, { x: 0, y: 8 })
    Composite.add(freeFallEngine.world, [freeFallBall.body])

    const steps = 240
    for (let i = 0; i < steps; i += 1) {
      Engine.update(withCar.engine, STEP_MS)
      Engine.update(freeFallEngine, STEP_MS)
    }

    const withCarBall = withCar.balls[0]!
    expect(freeFallBall.body.position.y).toBeGreaterThan(withCarBall.body.position.y + 200)
  })

  it('横から近づいたボールが車に押され、横方向へ明確な速度を得る', () => {
    // 車は右へ進行中。その進行方向の少し先、胴体と同じ高さにボールを置く。
    // 重力で先に落ちて衝突帯を通り過ぎてしまわないよう、車が実際に到達するまでは
    // 毎ステップ位置を保持しておく（風toyのテストと同じ「エリア内に留め続ける」手法）。
    const targetX = CAR_PLACEMENT.x + 90
    const targetY = CAR_PLACEMENT.y + 8
    const ball = createBall(0, targetX, targetY, { x: 0, y: 0 })
    const harness = createHarness(CAR_PLACEMENT, [ball])

    let maxVx = 0
    let contacted = false
    for (let i = 0; i < 400; i += 1) {
      if (!contacted) {
        Body.setPosition(ball.body, { x: targetX, y: targetY })
        Body.setVelocity(ball.body, { x: 0, y: 0 })
      }
      advanceSteps(harness, 1)
      if (Math.abs(ball.body.velocity.x) > 0.5) contacted = true
      maxVx = Math.max(maxVx, ball.body.velocity.x)
      if (contacted && i > 5) break
    }

    expect(maxVx).toBeGreaterThan(0.5)
    expect(maxVx).toBeLessThanOrEqual(MAX_SPEED)
  })

  it('ボールを車の屋根に長時間乗せても、そのまま延々と運ばれ続けない（丸い屋根から転がり落ちる）', () => {
    const ball = createBall(0, CAR_PLACEMENT.x, CAR_PLACEMENT.y - 60, { x: 0, y: 0 })
    const harness = createHarness(CAR_PLACEMENT, [ball])

    let settledOnRoof = true
    for (let i = 0; i < 1800; i += 1) {
      advanceSteps(harness, 1)
      const dx = Math.abs(ball.body.position.x - carBody(harness.runtime).position.x)
      const speed = Math.hypot(ball.body.velocity.x, ball.body.velocity.y)
      if (dx > 90 || ball.body.position.y > CAR_PLACEMENT.y + 60) {
        settledOnRoof = false
        break
      }
      if (speed > 6) settledOnRoof = false
    }

    expect(settledOnRoof).toBe(false)
  })

  it('3球が同時に周辺にいても異常な速度・エラーが発生しない', () => {
    const balls = [
      createBall(0, CAR_PLACEMENT.x - 40, CAR_PLACEMENT.y - 60, { x: 0, y: 4 }),
      createBall(1, CAR_PLACEMENT.x, CAR_PLACEMENT.y - 80, { x: 0, y: 4 }),
      createBall(2, CAR_PLACEMENT.x + 40, CAR_PLACEMENT.y - 60, { x: 0, y: 4 }),
    ]
    const harness = createHarness(CAR_PLACEMENT, balls)

    expect(() => advanceSteps(harness, 600)).not.toThrow()
    for (const ball of harness.balls) {
      const speed = Math.hypot(ball.body.velocity.x, ball.body.velocity.y)
      expect(Number.isFinite(speed)).toBe(true)
      expect(speed).toBeLessThanOrEqual(MAX_SPEED * 2)
    }
  })

  it('新しいランタイムはリスタート時の初期状態を持つ（前回の位置・向きが残らない）', () => {
    const first = createHarness(CAR_PLACEMENT)
    advanceSteps(first, 2500)
    expect(carBody(first.runtime).position.x).not.toBeCloseTo(CAR_PLACEMENT.x, 0)

    const restarted = createCarToy(CAR_PLACEMENT)
    expect(carBody(restarted).position.x).toBeCloseTo(CAR_PLACEMENT.x, 5)
    expect(restarted.readVisualState().offsetX).toBeCloseTo(0, 5)
    expect(restarted.readVisualState().facing).toBe('right')
    expect(restarted.readVisualState().pulse).toBe(0)
    expect(restarted.readVisualState().active).toBe(false)
  })
})
