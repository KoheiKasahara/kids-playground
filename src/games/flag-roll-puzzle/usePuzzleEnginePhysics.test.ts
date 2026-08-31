import * as Matter from 'matter-js'
import { describe, expect, it } from 'vitest'
import { createCannonSensorBody, createPuzzlePartBodies, createPuzzleSeesawRuntime, createPuzzleSpinnerBody } from './usePuzzleEngine'
import { SEESAW_MAX_ANGLE, SEESAW_MAX_ANGULAR_VELOCITY, stabilizeSeesawBody } from './seesawPhysics'

describe('flag-roll-puzzle の特殊パーツBody', () => {
  it('キャノンは置かれたidをラベルへ含む円形センサーだけを作る', () => {
    const sensor = createCannonSensorBody({
      id: 'part-42',
      typeId: 'cannon',
      cell: { col: 2, row: 3 },
    })
    expect(sensor.label).toBe('cannon-sensor:part-42')
    expect(sensor.isSensor).toBe(true)
    expect(sensor.isStatic).toBe(true)
    expect(sensor.circleRadius).toBeGreaterThan(0)
  })

  it('Spinnerは静的な面取り十字Bodyを返す', () => {
    const spinner = createPuzzleSpinnerBody({
      id: 'part-7',
      typeId: 'spinner',
      cell: { col: 2, row: 3 },
    })
    expect(spinner.isStatic).toBe(true)
    expect(spinner.isSensor).toBe(false)
    expect(spinner.parts).toHaveLength(3)
  })

  it('ジャンプ台は配置したIDと向きを持つ静的な傾斜Bodyを作る', () => {
    const bodies = createPuzzlePartBodies({
      id: 'part-ramp',
      typeId: 'jumpRampRight',
      cell: { col: 2, row: 3 },
    })
    expect(bodies).toHaveLength(1)
    expect(bodies[0].isStatic).toBe(true)
    expect(bodies[0].label).toBe('jump-ramp:jumpRampRight:part-ramp:0')
    expect(bodies[0].angle).toBeLessThan(0)
  })

  it('ベルトコンベアは配置したIDをラベルへ含む静的なBodyを作る', () => {
    const bodies = createPuzzlePartBodies({
      id: 'part-conveyor',
      typeId: 'conveyorRight',
      cell: { col: 2, row: 3 },
    })
    expect(bodies).toHaveLength(1)
    expect(bodies[0].isStatic).toBe(true)
    expect(bodies[0].label).toBe('conveyor:part-conveyor:0')
  })

  it('シーソーは中央支点へつながる動的なデッキBodyとConstraintを作る', () => {
    const runtime = createPuzzleSeesawRuntime({
      id: 'part-seesaw',
      typeId: 'seesaw',
      cell: { col: 2, row: 3 },
    })

    expect(runtime.body.isStatic).toBe(false)
    expect(runtime.body.label).toBe('seesaw:part-seesaw:deck')
    expect(runtime.constraint.label).toBe('seesaw-constraint:part-seesaw')
    expect(runtime.constraint.bodyA).toBe(runtime.body)
    expect(runtime.constraint.bodyB).toBeUndefined()
    expect(runtime.constraint.length).toBe(0)
    expect(runtime.constraint.pointB).toEqual(runtime.pivot)
    expect(runtime.body.position).toEqual(runtime.pivot)
    expect(createPuzzlePartBodies({
      id: 'part-seesaw-static-check',
      typeId: 'seesaw',
      cell: { col: 2, row: 3 },
    })).toHaveLength(0)
  })

  it('ボールの左右で傾きが変わり、中央支点と最大角度を保つ', () => {
    const simulate = (ballOffsetX: number) => {
      const runtime = createPuzzleSeesawRuntime({
        id: `part-seesaw-${ballOffsetX}`,
        typeId: 'seesaw',
        cell: { col: 2, row: 3 },
      })
      const engine = Matter.Engine.create({ gravity: { x: 0, y: 0.6 } })
      const ball = Matter.Bodies.circle(runtime.pivot.x + ballOffsetX, runtime.pivot.y - 60, 20, {
        density: 0.002,
        friction: 0.02,
        frictionAir: 0.006,
        restitution: 0.28,
        label: 'ball:test',
      })
      Matter.Composite.add(engine.world, [runtime.body, runtime.constraint, ball])

      let minAngle = 0
      let maxAngle = 0
      let maxPivotDrift = 0
      let maxAngularVelocity = 0
      for (let step = 0; step < 180; step += 1) {
        Matter.Engine.update(engine, 1000 / 60)
        stabilizeSeesawBody(runtime.body, runtime.pivot)
        minAngle = Math.min(minAngle, runtime.body.angle)
        maxAngle = Math.max(maxAngle, runtime.body.angle)
        maxAngularVelocity = Math.max(maxAngularVelocity, Math.abs(runtime.body.angularVelocity))
        maxPivotDrift = Math.max(
          maxPivotDrift,
          Math.hypot(runtime.body.position.x - runtime.pivot.x, runtime.body.position.y - runtime.pivot.y),
        )
      }

      Matter.Composite.clear(engine.world, false)
      return { minAngle, maxAngle, maxAngularVelocity, maxPivotDrift, finalAngularVelocity: runtime.body.angularVelocity }
    }

    const left = simulate(-15)
    const center = simulate(0)
    const right = simulate(15)
    expect(left.minAngle).toBeLessThan(-0.15)
    expect(center.minAngle).toBeGreaterThan(-0.05)
    expect(center.maxAngle).toBeLessThan(0.05)
    expect(right.maxAngle).toBeGreaterThan(0.15)
    expect(Math.abs(left.minAngle)).toBeLessThanOrEqual(SEESAW_MAX_ANGLE)
    expect(right.maxAngle).toBeLessThanOrEqual(SEESAW_MAX_ANGLE)
    expect(left.maxAngularVelocity).toBeLessThanOrEqual(SEESAW_MAX_ANGULAR_VELOCITY)
    expect(right.maxAngularVelocity).toBeLessThanOrEqual(SEESAW_MAX_ANGULAR_VELOCITY)
    expect(Math.abs(left.finalAngularVelocity)).toBeLessThan(0.02)
    expect(Math.abs(right.finalAngularVelocity)).toBeLessThan(0.02)
    expect(left.maxPivotDrift).toBeLessThan(1)
    expect(center.maxPivotDrift).toBeLessThan(1)
    expect(right.maxPivotDrift).toBeLessThan(1)
  })

  it('複数シーソーのConstraintを個別に削除できる', () => {
    const first = createPuzzleSeesawRuntime({ id: 'part-seesaw-a', typeId: 'seesaw', cell: { col: 1, row: 2 } })
    const second = createPuzzleSeesawRuntime({ id: 'part-seesaw-b', typeId: 'seesaw', cell: { col: 5, row: 6 } })
    const engine = Matter.Engine.create()
    Matter.Composite.add(engine.world, [first.body, first.constraint, second.body, second.constraint])

    Matter.Composite.remove(engine.world, first.constraint)
    Matter.Composite.remove(engine.world, first.body)

    expect(engine.world.bodies).not.toContain(first.body)
    expect(engine.world.constraints).not.toContain(first.constraint)
    expect(engine.world.bodies).toContain(second.body)
    expect(engine.world.constraints).toContain(second.constraint)
    expect(second.constraint.bodyA).toBe(second.body)
    expect(second.constraint.pointB).toEqual(second.pivot)
    Matter.Composite.clear(engine.world, false)
  })
})
