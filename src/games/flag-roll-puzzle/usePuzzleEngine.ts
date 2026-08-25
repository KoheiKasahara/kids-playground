import { useEffect, useMemo, useRef } from 'react'
import * as Matter from 'matter-js'
import {
  BALL_RADIUS,
  BALL_START,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  GOAL_AREA,
  GOAL_EXIT_WALL,
  WALL_THICKNESS,
  goalBoundaryWallsForArea,
  type GoalArea,
} from './boardLayout'
import { cellCenter } from './grid'
import { createStopObservation, observeBallStop } from './ballStopDetection'
import { isInGoalArea } from './goal'
import { partDefinition } from './partTypes'
import { bumperBoostVelocity } from './bumperPhysics'
import type { PlacedPart } from './placement'
import type { PuzzleBallSnapshot, PuzzleBallState } from './puzzleState'
import {
  BALL_DENSITY,
  BALL_FRICTION,
  BALL_FRICTION_AIR,
  BALL_RESTITUTION,
  BUMPER_HIT_COOLDOWN_MS,
  GRAVITY,
  MAX_ANGULAR_VELOCITY,
  MAX_FRAME_DELTA_MS,
  MAX_SPEED,
  MAX_SUBSTEPS,
  STEP_MS,
  WALL_FRICTION,
  WALL_RESTITUTION,
} from './puzzlePhysics'

const { Engine, Bodies, Body, Composite, Events } = Matter
const DEG_TO_RAD = Math.PI / 180

export type PuzzleEngineOptions = {
  parts: readonly PlacedPart[]
  /** stage条件に基づく全ボール。旧呼び出し互換のため省略時はBALL_START相当を使う。 */
  balls?: readonly PuzzleBallState[]
  goalArea?: GoalArea
  running: boolean
  runId: number
  onGoal: (ballId?: string, snapshots?: readonly PuzzleBallSnapshot[]) => void
  onStopped: (ballId?: string, snapshots?: readonly PuzzleBallSnapshot[]) => void
}

export type PuzzleEngineHandle = {
  registerBall: (ballId: string | HTMLElement, el?: HTMLElement | null) => void
}

/** ステージのゴール右境界へ置く薄い出口壁（旧default APIも維持）。 */
export function createGoalExitWallBody(goalArea: GoalArea = GOAL_AREA): Matter.Body {
  const wall = goalBoundaryWallsForArea(goalArea).find(
    (candidate) => candidate.x > goalArea.x + goalArea.width / 2,
  )
  const definition = wall ?? GOAL_EXIT_WALL
  return createGoalBoundaryWallBody(definition)
}

/** ゴールの左右境界に置く4px壁。盤面外周と共有する側には呼び出さない。 */
export function createGoalBoundaryWallBody(definition: GoalArea): Matter.Body {
  return Bodies.rectangle(definition.x, definition.y, definition.width, definition.height, {
    isStatic: true,
    restitution: WALL_RESTITUTION,
    friction: WALL_FRICTION,
    label: 'goal-wall',
  })
}

function wallBodies(goalArea: GoalArea): Matter.Body[] {
  const half = WALL_THICKNESS / 2
  const options = {
    isStatic: true,
    restitution: WALL_RESTITUTION,
    friction: WALL_FRICTION,
    label: 'wall',
  }
  const goalWalls = goalBoundaryWallsForArea(goalArea)
  return [
    Bodies.rectangle(-half, BOARD_HEIGHT / 2, WALL_THICKNESS, BOARD_HEIGHT * 2, options),
    Bodies.rectangle(BOARD_WIDTH + half, BOARD_HEIGHT / 2, WALL_THICKNESS, BOARD_HEIGHT * 2, options),
    Bodies.rectangle(BOARD_WIDTH / 2, BOARD_HEIGHT + half, BOARD_WIDTH + WALL_THICKNESS * 2, WALL_THICKNESS, options),
    ...goalWalls.map(createGoalBoundaryWallBody),
  ]
}

function partBodies(part: PlacedPart): Matter.Body[] {
  const definition = partDefinition(part.typeId)
  const center = cellCenter(part.cell)
  return definition.segments.map((segment, index) => {
    const options = {
      isStatic: true,
      angle: segment.angleDeg * DEG_TO_RAD,
      restitution: definition.restitution,
      friction: definition.friction,
      label: segment.kind === 'circle' ? `bumper:${part.id}:${index}` : `${part.id}-${index}`,
    }
    if (segment.kind === 'circle') {
      return Bodies.circle(center.x + segment.offsetX, center.y + segment.offsetY, segment.width / 2, options)
    }
    return Bodies.rectangle(center.x + segment.offsetX, center.y + segment.offsetY, segment.width, segment.height, options)
  })
}

type RuntimeBall = {
  readonly id: string
  readonly body: Matter.Body
  status: PuzzleBallSnapshot['status']
  stopObservation: ReturnType<typeof createStopObservation>
  stopped: boolean
  reachedGoal: boolean
}

function defaultBall(): PuzzleBallState {
  // Importing the stage definition here would make the fallback less obvious in tests;
  // the actual game always passes its stage balls.
  return {
    id: 'ball-a',
    flagId: 'jp',
    startPosition: BALL_START,
    position: BALL_START,
    status: 'moving',
  }
}

function snapshotFor(runtimeBalls: readonly RuntimeBall[]): PuzzleBallSnapshot[] {
  return runtimeBalls.map(({ id, body, status, reachedGoal }) => ({
    id,
    position: { x: body.position.x, y: body.position.y },
    status: reachedGoal ? 'goal' : status,
  }))
}

function writeBallTransform(element: HTMLElement | null, body: Matter.Body) {
  if (!element) return
  element.style.transform = `translate(${body.position.x - BALL_RADIUS}px, ${body.position.y - BALL_RADIUS}px) rotate(${body.angle}rad)`
}

/**
 * 1つのMatter worldにstageの全ボールを登録する。Bodyはhook内のMapだけで管理し、
 * React stateには一意id・位置・状態のスナップショットだけを返す。
 */
export function usePuzzleEngine(options: PuzzleEngineOptions): PuzzleEngineHandle {
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  })

  const elementsRef = useRef(new Map<string, HTMLElement>())
  const handle = useMemo<PuzzleEngineHandle>(
    () => ({
      registerBall: (ballId, el) => {
        // Phase 4 の単一ボール呼び出し(registerBall(element))も受け付ける。
        const id = typeof ballId === 'string' ? ballId : 'ball-a'
        const element = typeof ballId === 'string' ? el : ballId
        if (element) elementsRef.current.set(id, element)
        else elementsRef.current.delete(id)
      },
    }),
    [],
  )

  const { running, runId } = options

  // 編集中・停止後は、最後に保存した位置（returnBall後は各startPosition）を描く。
  useEffect(() => {
    if (running) return
    for (const ball of optionsRef.current.balls ?? [defaultBall()]) {
      const element = elementsRef.current.get(ball.id)
      if (!element) continue
      element.style.transform = `translate(${ball.position.x - BALL_RADIUS}px, ${ball.position.y - BALL_RADIUS}px)`
    }
  }, [running, runId, options.balls])

  useEffect(() => {
    if (!running) return

    const current = optionsRef.current
    const balls = current.balls?.length ? current.balls : [defaultBall()]
    const goalArea = current.goalArea ?? GOAL_AREA
    const engine = Engine.create({ gravity: { ...GRAVITY } })
    const runtimeBalls: RuntimeBall[] = balls.map((ball) => {
      const shouldRemainGoal = ball.status === 'goal'
      const body = Bodies.circle(ball.position.x, ball.position.y, BALL_RADIUS, {
        isStatic: shouldRemainGoal,
        restitution: BALL_RESTITUTION,
        friction: BALL_FRICTION,
        frictionAir: BALL_FRICTION_AIR,
        density: BALL_DENSITY,
        label: `ball:${ball.id}`,
      })
      return {
        id: ball.id,
        body,
        status: shouldRemainGoal ? 'goal' : 'moving',
        stopObservation: createStopObservation(),
        stopped: false,
        reachedGoal: shouldRemainGoal,
      }
    })
    Composite.add(engine.world, [
      ...wallBodies(goalArea),
      ...current.parts.flatMap(partBodies),
      ...runtimeBalls.map(({ body }) => body),
    ])

    const lastBumperHitAt = new Map<string, number>()
    const handleCollisionStart = (collision: Matter.IEventCollision<Matter.Engine>) => {
      for (const pair of collision.pairs) {
        const bumper = pair.bodyA.label.startsWith('bumper:')
          ? pair.bodyA
          : pair.bodyB.label.startsWith('bumper:')
            ? pair.bodyB
            : null
        const hitBall = pair.bodyA.label.startsWith('ball:')
          ? pair.bodyA
          : pair.bodyB.label.startsWith('ball:')
            ? pair.bodyB
            : null
        if (!bumper || !hitBall) continue

        const now = performance.now()
        const cooldownKey = `${bumper.id}:${hitBall.id}`
        if (now - (lastBumperHitAt.get(cooldownKey) ?? -Infinity) < BUMPER_HIT_COOLDOWN_MS) continue
        lastBumperHitAt.set(cooldownKey, now)
        Body.setVelocity(hitBall, bumperBoostVelocity(hitBall.position, bumper.position, hitBall.velocity))
      }
    }
    Events.on(engine, 'collisionStart', handleCollisionStart)

    let rafId: number | null = null
    let lastFrameTime: number | null = null
    let accumulator = 0
    let stopped = false

    const writeAllTransforms = () => {
      for (const runtime of runtimeBalls) writeBallTransform(elementsRef.current.get(runtime.id) ?? null, runtime.body)
    }

    const tick = (now: number) => {
      if (stopped) return
      rafId = requestAnimationFrame(tick)
      if (lastFrameTime === null) {
        lastFrameTime = now
        return
      }
      accumulator += Math.min(now - lastFrameTime, MAX_FRAME_DELTA_MS)
      lastFrameTime = now

      let substeps = 0
      while (accumulator >= STEP_MS && substeps < MAX_SUBSTEPS) {
        Engine.update(engine, STEP_MS)
        accumulator -= STEP_MS
        substeps += 1
      }
      if (substeps >= MAX_SUBSTEPS) accumulator = 0

      for (const runtime of runtimeBalls) {
        if (runtime.body.isStatic) {
          writeBallTransform(elementsRef.current.get(runtime.id) ?? null, runtime.body)
          continue
        }

        const speedBeforeClamp = Math.hypot(runtime.body.velocity.x, runtime.body.velocity.y)
        if (speedBeforeClamp > MAX_SPEED) {
          const factor = MAX_SPEED / speedBeforeClamp
          Body.setVelocity(runtime.body, {
            x: runtime.body.velocity.x * factor,
            y: runtime.body.velocity.y * factor,
          })
        }
        if (Math.abs(runtime.body.angularVelocity) > MAX_ANGULAR_VELOCITY) {
          Body.setAngularVelocity(runtime.body, Math.sign(runtime.body.angularVelocity) * MAX_ANGULAR_VELOCITY)
        }
        const speed = Math.hypot(runtime.body.velocity.x, runtime.body.velocity.y)
        writeBallTransform(elementsRef.current.get(runtime.id) ?? null, runtime.body)

        if (!runtime.reachedGoal && isInGoalArea(runtime.body.position.x, runtime.body.position.y, goalArea)) {
          runtime.reachedGoal = true
          runtime.status = 'goal'
          optionsRef.current.onGoal(runtime.id, snapshotFor(runtimeBalls))
        }

        // ゴール後は自然に転がし続ける。停止判定は未ゴール球だけに適用する。
        const stopResult = observeBallStop(
          runtime.stopObservation,
          { x: runtime.body.position.x, y: runtime.body.position.y, speed },
          now,
          runtime.reachedGoal,
        )
        runtime.stopObservation = stopResult.observation
        if (stopResult.stopped) {
          runtime.stopped = true
          runtime.status = 'stopped'
          Body.setVelocity(runtime.body, { x: 0, y: 0 })
          Body.setAngularVelocity(runtime.body, 0)
          Body.setStatic(runtime.body, true)
          writeBallTransform(elementsRef.current.get(runtime.id) ?? null, runtime.body)
          optionsRef.current.onStopped(runtime.id, snapshotFor(runtimeBalls))
        }
      }
    }

    writeAllTransforms()
    rafId = requestAnimationFrame(tick)

    return () => {
      stopped = true
      if (rafId !== null) cancelAnimationFrame(rafId)
      Events.off(engine, 'collisionStart', handleCollisionStart)
      Composite.clear(engine.world, false)
      Engine.clear(engine)
    }
  }, [running, runId])

  return handle
}
