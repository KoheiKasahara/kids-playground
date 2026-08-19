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
import { createHammerToy } from './hammerToy'
import type { ToyPlacement } from './toyLayout'
import type { ToyBall, ToyRuntime } from './toyRuntime'

const { Body, Bodies, Composite, Engine } = Matter

const HAMMER_PLACEMENT: ToyPlacement = {
  id: 'test-hammer',
  kind: 'hammer',
  x: 240,
  y: 560,
  radius: 50,
  tapRadius: 66,
  labelJa: 'キャンディハンマー おもちゃ',
}

type HammerHarness = {
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
): HammerHarness {
  const engine = Engine.create({ gravity: { ...GRAVITY } })
  const runtime = createHammerToy(HAMMER_PLACEMENT)
  const balls = ballSpecs.map((spec, index) => createBall(index, spec.x, spec.y, spec.velocity))
  Composite.add(engine.world, [...runtime.bodies, ...balls.map((ball) => ball.body)])
  return { balls, engine, runtime }
}

function speedOf(ball: ToyBall): number {
  return Math.hypot(ball.body.velocity.x, ball.body.velocity.y)
}

/** update() をnowを進めながら複数回呼ぶ。既定の刻み(16ms)は1ステップ相当に近い値にしている。 */
function runUpdates(harness: HammerHarness, steps: number, stepMs = 16): void {
  for (let i = 1; i <= steps; i += 1) {
    harness.runtime.update(i * stepMs, harness.balls)
  }
}

describe('hammerToy の固定ステップ物理', () => {
  it('新しいランタイムは角度0（水平）・非アクティブの初期状態を持つ', () => {
    const runtime = createHammerToy(HAMMER_PLACEMENT)
    expect(runtime.readVisualState().spinRad).toBe(0)
    expect(runtime.readVisualState().active).toBe(false)
    expect(runtime.readVisualState().pulse).toBe(0)
    expect(runtime.readVisualState().scale).toBe(1)
    expect(runtime.bodies).toHaveLength(1)
    expect(runtime.bodies[0].isStatic).toBe(true)
  })

  it('タップしなくても、時間経過だけで自動的に往復スイングする', () => {
    const harness = createHarness([])
    runUpdates(harness, 20)
    const angleAfter20 = harness.runtime.readVisualState().spinRad
    expect(angleAfter20).not.toBe(0)
    expect(Number.isFinite(angleAfter20)).toBe(true)
  })

  it('360度回転しない。角度は常に一定範囲（90度=約1.57radよりずっと小さい範囲）に収まる', () => {
    const harness = createHarness([])
    let maxAbsAngle = 0
    for (let step = 0; step < 400; step += 1) {
      harness.runtime.update(step * 16, harness.balls)
      maxAbsAngle = Math.max(maxAbsAngle, Math.abs(harness.runtime.readVisualState().spinRad))
    }
    expect(maxAbsAngle).toBeLessThan(1.0)
    expect(maxAbsAngle).toBeGreaterThan(0.3)
  })

  it('往復運動である。角度が正にも負にもなる（片側だけに回り続けない）', () => {
    const harness = createHarness([])
    let sawPositive = false
    let sawNegative = false
    for (let step = 0; step < 200; step += 1) {
      harness.runtime.update(step * 16, harness.balls)
      const angle = harness.runtime.readVisualState().spinRad
      if (angle > 0.1) sawPositive = true
      if (angle < -0.1) sawNegative = true
    }
    expect(sawPositive).toBe(true)
    expect(sawNegative).toBe(true)
  })

  it('リセット（新しいランタイム生成）後は毎回同じ角度0・同じ位相から始まる', () => {
    const runtimeA = createHammerToy(HAMMER_PLACEMENT)
    const runtimeB = createHammerToy(HAMMER_PLACEMENT)
    for (let step = 0; step < 50; step += 1) {
      runtimeA.update(step * 16, [])
      runtimeB.update(step * 16, [])
      expect(runtimeA.readVisualState().spinRad).toBeCloseTo(runtimeB.readVisualState().spinRad, 8)
    }
  })

  it('スイングが速いタイミングで棒の端付近に来たボールは、明確に横方向へ弾かれる', () => {
    const harness = createHarness([])
    // 棒がおおむね水平（角速度が最大に近い、角度がゼロを横切る付近）になるタイミングまで進める。
    // 周期1200msの1/4手前（角度がゼロ付近を通過する瞬間）を狙う。
    let hit = false
    for (let step = 1; step <= 200 && !hit; step += 1) {
      const now = step * 5
      harness.runtime.update(now, [])
      const angle = harness.runtime.readVisualState().spinRad
      if (Math.abs(angle) < 0.05) {
        // 角度がほぼ水平（=角速度が最大付近）になった瞬間、棒の右端(+radius,0)近くへボールを置く。
        const ball = createBall(0, HAMMER_PLACEMENT.x + HAMMER_PLACEMENT.radius, HAMMER_PLACEMENT.y, {
          x: 0,
          y: 0.5,
        })
        Composite.add(harness.engine.world, ball.body)
        const before = { ...ball.body.velocity }
        harness.runtime.update(now + 5, [ball])
        const after = ball.body.velocity
        if (Math.hypot(after.x - before.x, after.y - before.y) > 3) {
          hit = true
          expect(speedOf(ball)).toBeGreaterThan(3)
          expect(speedOf(ball)).toBeLessThanOrEqual(MAX_SPEED)
        }
      }
    }
    expect(hit).toBe(true)
  })

  it('作用範囲の外にあるボールには「バコーン」を与えない', () => {
    const harness = createHarness([
      {
        x: HAMMER_PLACEMENT.x + HAMMER_PLACEMENT.radius + 200,
        y: HAMMER_PLACEMENT.y,
        velocity: { x: 0.3, y: 1 },
      },
    ])
    const ball = harness.balls[0]
    const initialVelocity = { ...ball.body.velocity }

    runUpdates(harness, 100)

    // 遠く離れたボールは重力以外の影響を受けない（x速度は不変のまま）。
    expect(ball.body.velocity.x).toBeCloseTo(initialVelocity.x, 5)
  })

  it('同じボールは個別クールダウン中に連続で弾かれない', () => {
    const harness = createHarness([])
    let firstKickStep = -1
    let secondKickStep = -1
    let ball: ToyBall | null = null

    for (let step = 1; step <= 400; step += 1) {
      const now = step * 8
      if (ball === null) {
        const angle = harness.runtime.readVisualState().spinRad
        harness.runtime.update(now, [])
        if (Math.abs(angle) < 0.05) {
          ball = createBall(0, HAMMER_PLACEMENT.x + HAMMER_PLACEMENT.radius, HAMMER_PLACEMENT.y, { x: 0, y: 0 })
          Composite.add(harness.engine.world, ball.body)
        }
        continue
      }
      const before = speedOf(ball)
      harness.runtime.update(now, [ball])
      const after = speedOf(ball)
      if (after > before + 3) {
        if (firstKickStep === -1) {
          firstKickStep = step
          // すぐ次のステップでも再び弾かれるかを確認するため、位置とほぼゼロ速度へ戻す。
          Body.setPosition(ball.body, { x: HAMMER_PLACEMENT.x + HAMMER_PLACEMENT.radius, y: HAMMER_PLACEMENT.y })
          Body.setVelocity(ball.body, { x: 0, y: 0 })
        } else {
          secondKickStep = step
          break
        }
      }
    }

    expect(firstKickStep).toBeGreaterThan(0)
    // クールダウン(550ms)より短い間隔では再発動しないはず。
    if (secondKickStep !== -1) {
      expect((secondKickStep - firstKickStep) * 8).toBeGreaterThanOrEqual(550)
    }
  })

  it('複数ボールが同時に端の近くへ来ても例外を投げず、物理が破綻しない', () => {
    const harness = createHarness([
      { x: HAMMER_PLACEMENT.x + HAMMER_PLACEMENT.radius, y: HAMMER_PLACEMENT.y - 5 },
      { x: HAMMER_PLACEMENT.x + HAMMER_PLACEMENT.radius, y: HAMMER_PLACEMENT.y },
      { x: HAMMER_PLACEMENT.x + HAMMER_PLACEMENT.radius, y: HAMMER_PLACEMENT.y + 5 },
      { x: HAMMER_PLACEMENT.x - HAMMER_PLACEMENT.radius, y: HAMMER_PLACEMENT.y },
    ])

    expect(() => runUpdates(harness, 300, 8)).not.toThrow()

    for (const ball of harness.balls) {
      expect(Number.isFinite(ball.body.position.x)).toBe(true)
      expect(Number.isFinite(ball.body.position.y)).toBe(true)
      expect(speedOf(ball)).toBeLessThanOrEqual(MAX_SPEED)
    }
  })

  it('ハンマーとボールが接触し続けても、ボールの速度がゼロへ固定され続けることはない（永久停止しない）', () => {
    const harness = createHarness([
      { x: HAMMER_PLACEMENT.x + HAMMER_PLACEMENT.radius * 0.5, y: HAMMER_PLACEMENT.y - HAMMER_PLACEMENT.radius },
    ])
    const ball = harness.balls[0]
    let maxSpeedObserved = 0

    for (let step = 0; step < 400; step += 1) {
      const now = step * STEP_MS
      Engine.update(harness.engine, STEP_MS)
      harness.runtime.update(now + STEP_MS, harness.balls)
      maxSpeedObserved = Math.max(maxSpeedObserved, speedOf(ball))
    }

    expect(maxSpeedObserved).toBeGreaterThan(0.5)
    expect(Number.isFinite(ball.body.position.x)).toBe(true)
    expect(Number.isFinite(ball.body.position.y)).toBe(true)
  })

  it('タップは見た目のパルスだけを起こし、スイングの位相（角度の時間変化）は変化させない', () => {
    const tapped = createHammerToy(HAMMER_PLACEMENT)
    const untapped = createHammerToy(HAMMER_PLACEMENT)

    for (let step = 0; step <= 10; step += 1) {
      tapped.update(step * 16, [])
      untapped.update(step * 16, [])
    }
    tapped.activate(160)
    expect(tapped.readVisualState().pulse).toBe(1)
    expect(untapped.readVisualState().pulse).toBe(0)

    for (let step = 11; step <= 60; step += 1) {
      tapped.update(step * 16, [])
      untapped.update(step * 16, [])
      // タップの有無に関わらず、時間だけに依存する角度は常に一致する。
      expect(tapped.readVisualState().spinRad).toBeCloseTo(untapped.readVisualState().spinRad, 8)
    }

    expect(tapped.readVisualState().pulse).toBe(0)
  })

  it('弾かれたボールは、有限時間で得点ゾーンの高さへ到達する', () => {
    const harness = createHarness([
      { x: HAMMER_PLACEMENT.x, y: HAMMER_PLACEMENT.y - HAMMER_PLACEMENT.radius * 1.5, velocity: { x: 0, y: 0 } },
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
