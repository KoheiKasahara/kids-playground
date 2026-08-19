import * as Matter from 'matter-js'
import { describe, expect, it } from 'vitest'
import { BALL_RADIUS, ZONE_TOP } from './boardLayout'
import {
  BALL_DENSITY,
  BALL_FRICTION,
  BALL_FRICTION_AIR,
  BALL_RESTITUTION,
  GRAVITY,
  STEP_MS,
} from './pinballPhysics'
import { createSeesawToy } from './seesawToy'
import type { ToyPlacement } from './toyLayout'
import type { ToyBall, ToyRuntime } from './toyRuntime'

const { Body, Bodies, Composite, Engine } = Matter

const SEESAW_PLACEMENT: ToyPlacement = {
  id: 'test-seesaw',
  kind: 'seesaw',
  x: 240,
  y: 560,
  radius: 95,
  tapRadius: 110,
  labelJa: 'シーソー おもちゃ',
}

/** 板の左端寄り・右端寄りに乗ったとみなせるx位置（支点からのオフセット）。 */
const NEAR_LEFT_END_OFFSET = -SEESAW_PLACEMENT.radius * 0.8
const NEAR_RIGHT_END_OFFSET = SEESAW_PLACEMENT.radius * 0.8
/** 作用範囲の外側とみなせる余白。 */
const OUTSIDE_MARGIN = 60

type SeesawHarness = {
  readonly engine: Matter.Engine
  readonly runtime: ToyRuntime
  readonly balls: readonly ToyBall[]
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

function createHarness(
  ballSpecs: readonly { x: number; y: number; velocity?: { x: number; y: number } }[],
): SeesawHarness {
  const engine = Engine.create({ gravity: { ...GRAVITY } })
  const runtime = createSeesawToy(SEESAW_PLACEMENT)
  const balls = ballSpecs.map((spec, index) => createBall(index, spec.x, spec.y, spec.velocity))
  Composite.add(engine.world, [...runtime.bodies, ...balls.map((ball) => ball.body)])
  return { balls, engine, runtime }
}

/** update() をnowを進めながら複数回呼び、角度がtargetへ近づくのを待つ。 */
function runUpdates(harness: SeesawHarness, steps: number, stepMs = 16): void {
  for (let i = 1; i <= steps; i += 1) {
    harness.runtime.update(i * stepMs, harness.balls)
  }
}

describe('seesawToy の固定ステップ物理', () => {
  it('新しいランタイムは水平（角度0）の初期状態を持つ', () => {
    const runtime = createSeesawToy(SEESAW_PLACEMENT)
    expect(runtime.readVisualState().spinRad).toBe(0)
    expect(runtime.readVisualState().active).toBe(false)
    expect(runtime.readVisualState().pulse).toBe(0)
    expect(runtime.bodies).toHaveLength(1)
    expect(runtime.bodies[0].isStatic).toBe(true)
  })

  it('板の右端寄りにボールが乗ると、右が下がる向きへ傾く', () => {
    const harness = createHarness([
      { x: SEESAW_PLACEMENT.x + NEAR_RIGHT_END_OFFSET, y: SEESAW_PLACEMENT.y },
    ])
    runUpdates(harness, 30)

    const angle = harness.runtime.readVisualState().spinRad
    expect(angle).toBeGreaterThan(0)
  })

  it('板の左端寄りにボールが乗ると、左が下がる向き（逆符号）へ傾く', () => {
    const harness = createHarness([
      { x: SEESAW_PLACEMENT.x + NEAR_LEFT_END_OFFSET, y: SEESAW_PLACEMENT.y },
    ])
    runUpdates(harness, 30)

    const angle = harness.runtime.readVisualState().spinRad
    expect(angle).toBeLessThan(0)
  })

  it('作用範囲の外にあるボールには作用せず、角度は0のまま', () => {
    const harness = createHarness([
      { x: SEESAW_PLACEMENT.x, y: SEESAW_PLACEMENT.y - SEESAW_PLACEMENT.radius - OUTSIDE_MARGIN },
    ])
    runUpdates(harness, 30)

    expect(harness.runtime.readVisualState().spinRad).toBe(0)
  })

  it('一定角度（MAX_ANGLE相当）以上には傾かない。板の端に乗り続けても頭打ちになる', () => {
    const harness = createHarness([
      { x: SEESAW_PLACEMENT.x + NEAR_RIGHT_END_OFFSET, y: SEESAW_PLACEMENT.y },
    ])
    runUpdates(harness, 200)

    const angle = harness.runtime.readVisualState().spinRad
    // 実装の内部定数を直接importしないが、90度(=約1.57rad)よりずっと小さい範囲に
    // 収まっていることを確認する（急角度・異常回転の防止）。
    expect(Math.abs(angle)).toBeLessThan(0.5)
    expect(Math.abs(angle)).toBeGreaterThan(0.05)
  })

  it('360度回転しない。左右へ繰り返し乗せ替えても角度は常に有限範囲に収まる', () => {
    const harness = createHarness([{ x: SEESAW_PLACEMENT.x, y: SEESAW_PLACEMENT.y }])
    const ball = harness.balls[0]

    for (let cycle = 0; cycle < 20; cycle += 1) {
      const side = cycle % 2 === 0 ? NEAR_RIGHT_END_OFFSET : NEAR_LEFT_END_OFFSET
      Body.setPosition(ball.body, { x: SEESAW_PLACEMENT.x + side, y: SEESAW_PLACEMENT.y })
      runUpdates(harness, 15)
      const angle = harness.runtime.readVisualState().spinRad
      expect(Math.abs(angle)).toBeLessThanOrEqual(0.5)
      expect(Number.isFinite(angle)).toBe(true)
    }
  })

  it('ボールが離れると、水平（角度0）へ戻ろうとする', () => {
    const harness = createHarness([
      { x: SEESAW_PLACEMENT.x + NEAR_RIGHT_END_OFFSET, y: SEESAW_PLACEMENT.y },
    ])
    runUpdates(harness, 30)
    const tiltedAngle = harness.runtime.readVisualState().spinRad
    expect(tiltedAngle).toBeGreaterThan(0)

    // ボールを作用範囲の外へ移動させ、以後は乗っていない状態にする
    Body.setPosition(harness.balls[0].body, { x: SEESAW_PLACEMENT.x, y: 0 })
    runUpdates(harness, 60)

    expect(harness.runtime.readVisualState().spinRad).toBeCloseTo(0, 2)
  })

  it('板の上でボールの速度がゼロに固定され続けることはない（永久停止しない）', () => {
    // 板にわずかに傾きを作った状態で、ほぼ静止したボールを乗せる。
    const harness = createHarness([
      { x: SEESAW_PLACEMENT.x + NEAR_RIGHT_END_OFFSET, y: SEESAW_PLACEMENT.y - 40, velocity: { x: 0, y: 0 } },
    ])
    const ball = harness.balls[0]

    let maxSpeedObserved = 0
    for (let step = 0; step < 300; step += 1) {
      const now = step * STEP_MS
      Engine.update(harness.engine, STEP_MS)
      harness.runtime.update(now + STEP_MS, harness.balls)
      maxSpeedObserved = Math.max(maxSpeedObserved, Math.hypot(ball.body.velocity.x, ball.body.velocity.y))
    }

    // 板が傾いた斜面上で、ボールが一度も動き出さないまま止まり続けることはない。
    expect(maxSpeedObserved).toBeGreaterThan(0.2)
  })

  it('3球同時に乗っても例外を投げず、角度は範囲内に収まる', () => {
    const harness = createHarness([
      { x: SEESAW_PLACEMENT.x + NEAR_RIGHT_END_OFFSET, y: SEESAW_PLACEMENT.y },
      { x: SEESAW_PLACEMENT.x, y: SEESAW_PLACEMENT.y },
      { x: SEESAW_PLACEMENT.x + NEAR_LEFT_END_OFFSET, y: SEESAW_PLACEMENT.y },
    ])

    expect(() => runUpdates(harness, 60)).not.toThrow()

    const angle = harness.runtime.readVisualState().spinRad
    expect(Number.isFinite(angle)).toBe(true)
    expect(Math.abs(angle)).toBeLessThanOrEqual(0.5)
    for (const ball of harness.balls) {
      expect(Number.isFinite(ball.body.position.x)).toBe(true)
      expect(Number.isFinite(ball.body.position.y)).toBe(true)
    }
  })

  it('同じ側に複数球が乗っても目標角度はMAX_ANGLE相当で頭打ちになり、1球のときと同じ向きを保つ', () => {
    const single = createHarness([
      { x: SEESAW_PLACEMENT.x + NEAR_RIGHT_END_OFFSET, y: SEESAW_PLACEMENT.y },
    ])
    runUpdates(single, 60)
    const singleAngle = single.runtime.readVisualState().spinRad

    const triple = createHarness([
      { x: SEESAW_PLACEMENT.x + NEAR_RIGHT_END_OFFSET, y: SEESAW_PLACEMENT.y },
      { x: SEESAW_PLACEMENT.x + NEAR_RIGHT_END_OFFSET + 10, y: SEESAW_PLACEMENT.y },
      { x: SEESAW_PLACEMENT.x + NEAR_RIGHT_END_OFFSET + 20, y: SEESAW_PLACEMENT.y },
    ])
    runUpdates(triple, 60)
    const tripleAngle = triple.runtime.readVisualState().spinRad

    // 複数球が同じ側に乗ると単独より傾きが大きくなってよいが、
    // どちらも同じ向き（正）で、かつ単独ボールの上限（MAX_ANGLE相当）を超えない。
    expect(singleAngle).toBeGreaterThan(0)
    expect(tripleAngle).toBeGreaterThan(0)
    expect(tripleAngle).toBeGreaterThanOrEqual(singleAngle)
    expect(tripleAngle).toBeLessThanOrEqual(0.5)
  })

  it('タップは見た目のパルスだけを起こし、角度は変化させない（例外も投げない）', () => {
    const harness = createHarness([])

    expect(() => {
      harness.runtime.activate(0)
      harness.runtime.update(0, harness.balls)
    }).not.toThrow()
    expect(harness.runtime.readVisualState().pulse).toBe(1)
    expect(harness.runtime.readVisualState().spinRad).toBe(0)

    harness.runtime.update(300, harness.balls)
    expect(harness.runtime.readVisualState().pulse).toBe(0)
  })

  it('傾いた板から転がり落ちたボールは、有限時間で得点ゾーンの高さへ到達する', () => {
    const harness = createHarness([
      { x: SEESAW_PLACEMENT.x + NEAR_RIGHT_END_OFFSET, y: SEESAW_PLACEMENT.y - 40, velocity: { x: 0, y: 0 } },
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
})
