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
import { cellCenter, type Point } from './grid'
import { createStopObservation, observeBallStop } from './ballStopDetection'
import { isInGoalArea } from './goal'
import {
  isCannonPart,
  isJumpRampPart,
  isSpinnerPart,
  partDefinition,
} from './partTypes'
import { bumperBoostVelocity } from './bumperPhysics'
import { JUMP_RAMP_HIT_COOLDOWN_MS, jumpRampVelocity } from './jumpRampPhysics'
import {
  advanceCannonCapture,
  beginCannonCapture,
  canCaptureCannonBall,
  cannonCaptureKey,
  cannonChamberPosition,
  cannonDirectionVector,
  cannonLaunchVelocity,
  cannonMuzzlePosition,
  createCannonCaptureState,
  finishCannonCooldown,
  setCannonSensorContact,
  type CannonCaptureState,
} from './cannonPhysics'
import { createSpinnerCore, type SpinnerCore } from '../shared/toys/spinnerCore'
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

/** キャノンのセンサーは見た目のチャンバーにだけ置き、筒自体はボールを遮らない。 */
export const CANNON_SENSOR_RADIUS = 10
/** Spinnerの十字は1マス内へ収め、ボールへ伝わる接線速度を安全域に制限する。 */
export const PUZZLE_SPINNER_RADIUS = 24
export const PUZZLE_SPINNER_BLADE_THICKNESS = 10
export const PUZZLE_SPINNER_ANGULAR_VELOCITY = 0.08
export const PUZZLE_SPINNER_BALL_SPEED_CAP = 11
const PUZZLE_SPINNER_INFLUENCE_MARGIN = 8
const PUZZLE_SPINNER_STALL_SPEED = 0.3
const PUZZLE_SPINNER_NUDGE_SPEED = 2.2
const PUZZLE_SPINNER_NUDGE_COOLDOWN_MS = 220

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
  registerPartElement: (partId: string, el?: HTMLElement | null) => void
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

export function createPuzzlePartBodies(part: PlacedPart): Matter.Body[] {
  // Cannonの見た目は専用センサーだけ、Spinnerの見た目と当たり判定は専用Coreだけを使う。
  // どちらも通常の板Bodyを作らないため、入口を塞いだりCSSだけが回ったりしない。
  if (isCannonPart(part.typeId) || isSpinnerPart(part.typeId)) return []
  const definition = partDefinition(part.typeId)
  const center = cellCenter(part.cell)
  return definition.segments.map((segment, index) => {
    const options = {
      isStatic: true,
      angle: segment.angleDeg * DEG_TO_RAD,
      restitution: definition.restitution,
      friction: definition.friction,
      label: segment.kind === 'circle'
        ? `bumper:${part.id}:${index}`
        : isJumpRampPart(part.typeId)
          ? `jump-ramp:${part.typeId}:${part.id}:${index}`
          : `${part.id}-${index}`,
    }
    if (segment.kind === 'circle') {
      return Bodies.circle(center.x + segment.offsetX, center.y + segment.offsetY, segment.width / 2, options)
    }
    return Bodies.rectangle(center.x + segment.offsetX, center.y + segment.offsetY, segment.width, segment.height, options)
  })
}

type CannonRuntime = {
  readonly part: PlacedPart
  readonly sensor: Matter.Body
  readonly chamber: Point
  readonly muzzle: Point
  readonly direction: { readonly x: number; readonly y: number }
}

type SpinnerRuntime = {
  readonly partId: string
  readonly core: SpinnerCore
  readonly lastNudgeAt: Map<string, number>
}

function cannonSensorBody(part: PlacedPart): CannonRuntime {
  const center = cellCenter(part.cell)
  const chamber = cannonChamberPosition(center, part.typeId)
  const muzzle = cannonMuzzlePosition(center, part.typeId)
  const direction = cannonDirectionVector(part.typeId) ?? { x: 1, y: 0 }
  const sensor = Bodies.circle(chamber.x, chamber.y, CANNON_SENSOR_RADIUS, {
    isStatic: true,
    isSensor: true,
    label: `cannon-sensor:${part.id}`,
  })
  return { part, sensor, chamber, muzzle, direction }
}

/** キャノンが通常の板Bodyを持たず、チャンバーだけをセンサーにすることを検証できる公開工場。 */
export function createCannonSensorBody(part: PlacedPart): Matter.Body {
  return cannonSensorBody(part).sensor
}

function spinnerRuntime(part: PlacedPart): SpinnerRuntime {
  const center = cellCenter(part.cell)
  const core = createSpinnerCore({
    x: center.x,
    y: center.y,
    radius: PUZZLE_SPINNER_RADIUS,
    bladeThickness: PUZZLE_SPINNER_BLADE_THICKNESS,
    friction: partDefinition(part.typeId).friction,
    restitution: partDefinition(part.typeId).restitution,
    label: `spinner:${part.id}`,
    ballSpeedCap: PUZZLE_SPINNER_BALL_SPEED_CAP,
    influenceMargin: PUZZLE_SPINNER_INFLUENCE_MARGIN,
    ballRadius: BALL_RADIUS,
    stepMs: STEP_MS,
  })
  return { partId: part.id, core, lastNudgeAt: new Map() }
}

/** Spinner専用の静的な十字Bodyを返すテスト用ファクトリ。 */
export function createPuzzleSpinnerBody(part: PlacedPart): Matter.Body {
  return spinnerRuntime(part).core.body
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
      registerPartElement: (partId, el) => {
        if (el) elementsRef.current.set(`part:${partId}`, el)
        else elementsRef.current.delete(`part:${partId}`)
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
    for (const [key, element] of elementsRef.current) {
      if (key.startsWith('part:')) element.style.setProperty('--spinner-angle', '0rad')
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
    const cannonRuntimes = current.parts
      .filter((part) => isCannonPart(part.typeId))
      .map(cannonSensorBody)
    const spinnerRuntimes = current.parts
      .filter((part) => isSpinnerPart(part.typeId))
      .map(spinnerRuntime)
    const cannonByBodyId = new Map(cannonRuntimes.map((runtime) => [runtime.sensor.id, runtime]))
    const cannonByPartId = new Map(cannonRuntimes.map((runtime) => [runtime.part.id, runtime]))
    const runtimeBallByBodyId = new Map(runtimeBalls.map((runtime) => [runtime.body.id, runtime]))
    const runtimeBallById = new Map(runtimeBalls.map((runtime) => [runtime.id, runtime]))
    Composite.add(engine.world, [
      ...wallBodies(goalArea),
      ...current.parts.flatMap(createPuzzlePartBodies),
      ...cannonRuntimes.map((runtime) => runtime.sensor),
      ...spinnerRuntimes.map((runtime) => runtime.core.body),
      ...runtimeBalls.map(({ body }) => body),
    ])

    const lastBumperHitAt = new Map<string, number>()
    const lastJumpRampHitAt = new Map<string, number>()
    const cannonStates = new Map<string, CannonCaptureState>()
    const cannonCaptureRecords = new Map<string, { readonly ballId: string; readonly cannonId: string }>()
    const capturedCannonByBall = new Map<string, string>()
    let simulationTime = 0

    const cannonStateFor = (ballId: string, cannonId: string): CannonCaptureState => {
      const key = cannonCaptureKey(ballId, cannonId)
      const existing = cannonStates.get(key)
      if (existing) return existing
      const initial = createCannonCaptureState()
      cannonStates.set(key, initial)
      return initial
    }

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
        if (bumper && hitBall) {
          const now = performance.now()
          const cooldownKey = `${bumper.id}:${hitBall.id}`
          if (now - (lastBumperHitAt.get(cooldownKey) ?? -Infinity) >= BUMPER_HIT_COOLDOWN_MS) {
            lastBumperHitAt.set(cooldownKey, now)
            Body.setVelocity(hitBall, bumperBoostVelocity(hitBall.position, bumper.position, hitBall.velocity))
          }
        }

        const jumpRamp = pair.bodyA.label.startsWith('jump-ramp:')
          ? pair.bodyA
          : pair.bodyB.label.startsWith('jump-ramp:')
            ? pair.bodyB
            : null
        if (jumpRamp && hitBall) {
          const typeId = jumpRamp.label.split(':')[1]
          const cooldownKey = `${jumpRamp.id}:${hitBall.id}`
          if (
            isJumpRampPart(typeId)
            && simulationTime - (lastJumpRampHitAt.get(cooldownKey) ?? -Infinity) >= JUMP_RAMP_HIT_COOLDOWN_MS
          ) {
            const nextVelocity = jumpRampVelocity(typeId, hitBall.velocity)
            if (nextVelocity) {
              lastJumpRampHitAt.set(cooldownKey, simulationTime)
              Body.setVelocity(hitBall, nextVelocity)
            }
          }
        }

        const cannonSensor = cannonByBodyId.get(pair.bodyA.id) ?? cannonByBodyId.get(pair.bodyB.id)
        const cannonBall = runtimeBallByBodyId.get(pair.bodyA.id) ?? runtimeBallByBodyId.get(pair.bodyB.id)
        if (!cannonSensor || !cannonBall) continue
        // ゴール済み・停止済みのBodyや、同じtickで別キャノンに保持された球は捕獲しない。
        if (
          cannonBall.body.isStatic
          || cannonBall.reachedGoal
          || isInGoalArea(cannonBall.body.position.x, cannonBall.body.position.y, goalArea)
          || capturedCannonByBall.has(cannonBall.id)
        ) continue

        const key = cannonCaptureKey(cannonBall.id, cannonSensor.part.id)
        const state = cannonStateFor(cannonBall.id, cannonSensor.part.id)
        if (!canCaptureCannonBall(state, simulationTime, capturedCannonByBall.has(cannonBall.id))) continue

        cannonStates.set(key, beginCannonCapture(state, simulationTime))
        cannonCaptureRecords.set(key, { ballId: cannonBall.id, cannonId: cannonSensor.part.id })
        capturedCannonByBall.set(cannonBall.id, key)
        Body.setPosition(cannonBall.body, cannonSensor.chamber)
        Body.setVelocity(cannonBall.body, { x: 0, y: 0 })
        Body.setAngularVelocity(cannonBall.body, 0)
        // 保持中の低速を停止判定の観測へ持ち込まない。
        cannonBall.stopObservation = createStopObservation()
        cannonBall.stopped = false
        cannonBall.status = 'moving'
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

    const writeSpinnerTransforms = () => {
      for (const runtime of spinnerRuntimes) {
        const element = elementsRef.current.get(`part:${runtime.partId}`)
        element?.style.setProperty('--spinner-angle', `${runtime.core.angle}rad`)
      }
    }

    const holdCapturedBalls = () => {
      for (const [key, capture] of cannonCaptureRecords) {
        const state = cannonStates.get(key)
        if (!state || state.phase !== 'holding') continue
        const cannon = cannonByPartId.get(capture.cannonId)
        const ball = runtimeBallById.get(capture.ballId)
        if (!cannon || !ball || ball.body.isStatic || ball.reachedGoal) continue
        Body.setPosition(ball.body, cannon.chamber)
        Body.setVelocity(ball.body, { x: 0, y: 0 })
        Body.setAngularVelocity(ball.body, 0)
      }
    }

    const updateCannonContactsAndFire = () => {
      // collisionEndは使わず、固定ステップの位置から接触を求めるため、cleanup対象の
      // listenerを増やさずに「離れたら再入場可」を決定的に扱える。
      for (const cannon of cannonRuntimes) {
        for (const ball of runtimeBalls) {
          const key = cannonCaptureKey(ball.id, cannon.part.id)
          const state = cannonStates.get(key)
          if (!state) continue
          const distance = Math.hypot(
            ball.body.position.x - cannon.sensor.position.x,
            ball.body.position.y - cannon.sensor.position.y,
          )
          const contact = distance <= CANNON_SENSOR_RADIUS + BALL_RADIUS + 0.01
          let nextState = setCannonSensorContact(state, contact)
          nextState = finishCannonCooldown(nextState, simulationTime)
          cannonStates.set(key, nextState)
        }
      }

      for (const [key, state] of cannonStates) {
        const transition = advanceCannonCapture(state, simulationTime)
        cannonStates.set(key, transition.state)
        if (!transition.shouldFire) continue

        const capture = cannonCaptureRecords.get(key)
        if (!capture) continue
        const cannon = cannonByPartId.get(capture.cannonId)
        const ball = runtimeBallById.get(capture.ballId)
        if (!cannon || !ball || ball.body.isStatic || ball.reachedGoal) {
          cannonCaptureRecords.delete(key)
          capturedCannonByBall.delete(capture.ballId)
          continue
        }

        const launchVelocity = cannonLaunchVelocity(cannon.part.typeId)
        if (!launchVelocity) continue
        Body.setStatic(ball.body, false)
        Body.setPosition(ball.body, cannon.muzzle)
        // 入ってきた速度は捨て、向きだけから決まる固定ベクトルを与える。
        Body.setVelocity(ball.body, launchVelocity)
        Body.setAngularVelocity(ball.body, 0)
        ball.stopObservation = createStopObservation()
        ball.stopped = false
        ball.status = 'moving'
        cannonCaptureRecords.delete(key)
        capturedCannonByBall.delete(capture.ballId)
      }
    }

    const updateSpinners = () => {
      for (const spinner of spinnerRuntimes) {
        for (const ball of runtimeBalls) {
          if (ball.body.isStatic || ball.reachedGoal) continue
          spinner.core.capBallSpeed(ball.body)
          const speed = Math.hypot(ball.body.velocity.x, ball.body.velocity.y)
          if (speed >= PUZZLE_SPINNER_STALL_SPEED) continue
          const lastNudge = spinner.lastNudgeAt.get(ball.id) ?? -Infinity
          if (simulationTime - lastNudge < PUZZLE_SPINNER_NUDGE_COOLDOWN_MS) continue
          if (spinner.core.nudgeIfStalled(ball.body, PUZZLE_SPINNER_STALL_SPEED, PUZZLE_SPINNER_NUDGE_SPEED)) {
            spinner.lastNudgeAt.set(ball.id, simulationTime)
          }
        }
      }
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
        // 静的Spinnerでも、Engine.update前に角度を進めることで、このstepの
        // 接触解決が羽根の接線速度を実際の運動として受け取れる。
        for (const spinner of spinnerRuntimes) {
          spinner.core.advance(STEP_MS, PUZZLE_SPINNER_ANGULAR_VELOCITY)
        }
        holdCapturedBalls()
        Engine.update(engine, STEP_MS)
        simulationTime += STEP_MS
        updateCannonContactsAndFire()
        updateSpinners()
        accumulator -= STEP_MS
        substeps += 1
      }
      if (substeps >= MAX_SUBSTEPS) accumulator = 0

      writeSpinnerTransforms()

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
    const registeredElements = elementsRef.current

    return () => {
      stopped = true
      if (rafId !== null) cancelAnimationFrame(rafId)
      Events.off(engine, 'collisionStart', handleCollisionStart)
      for (const spinner of spinnerRuntimes) {
        registeredElements.get(`part:${spinner.partId}`)?.style.setProperty('--spinner-angle', '0rad')
      }
      Composite.clear(engine.world, false)
      Engine.clear(engine)
    }
  }, [running, runId])

  return handle
}
