import * as Matter from 'matter-js'
import {
  BALL_RADIUS,
  BOARD_WIDTH,
  LAUNCH,
  LAUNCH_DELAYS_MS,
  OBSTACLES,
  SCORE_ZONES,
  WALLS,
  ZONE_DIVIDER_WIDTH,
  ZONE_DIVIDERS,
} from './boardLayout'
import {
  BALL_DENSITY,
  BALL_FRICTION,
  BALL_FRICTION_AIR,
  BALL_RESTITUTION,
  GRAVITY,
  MAX_SPEED,
  OBSTACLE_FRICTION,
  OUT_OF_BOUNDS_MARGIN_X,
  OUT_OF_BOUNDS_Y,
  SAFETY_TIMEOUT_MS,
  SIMULATION_BALL_COUNT,
  STALL_DURATION_MS,
  STALL_NUDGE_SPEED,
  STALL_SPEED_THRESHOLD,
  STEP_MS,
  WALL_FRICTION,
  ZONE_SENSOR_HEIGHT,
  ZONE_SENSOR_Y,
} from './pinballPhysics'

const { Engine, Bodies, Body, Composite, Events } = Matter

export type PinballSimulationResult = {
  /** 1球目の射出から3球目の得点確定までに進んだ固定ステップ数 */
  readonly steps: number
  readonly durationMs: number
  readonly durationSeconds: number
  readonly scoreSteps: readonly number[]
  readonly completed: boolean
  readonly usedSafetyTimeout: boolean
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0
    return state / 4294967296
  }
}

function ballIndexAndOther(pair: Matter.Pair): { ballIndex: number; other: Matter.Body } | null {
  if (pair.bodyA.label.startsWith('ball-')) {
    return { ballIndex: Number(pair.bodyA.label.slice('ball-'.length)), other: pair.bodyB }
  }
  if (pair.bodyB.label.startsWith('ball-')) {
    return { ballIndex: Number(pair.bodyB.label.slice('ball-'.length)), other: pair.bodyA }
  }
  return null
}

/**
 * usePinballEngine と同じ盤面・物理定数で、rAFなしに固定ステップを進める測定器。
 * 画面サイズやCSS scaleを一切参照しないため、ここで得る時間は端末に依存しない。
 */
export function simulatePinballRun(seed: number): PinballSimulationResult {
  const random = createSeededRandom(seed)
  const engine = Engine.create({ gravity: { ...GRAVITY } })

  const wallBodies = [...WALLS, ...ZONE_DIVIDERS].map((wall) =>
    Bodies.rectangle(wall.x, wall.y, wall.width, wall.height, {
      isStatic: true,
      angle: wall.angle,
      restitution: wall.restitution,
      friction: WALL_FRICTION,
    }),
  )
  const obstacleBodies = OBSTACLES.map((obstacle) =>
    Bodies.circle(obstacle.x, obstacle.y, obstacle.radius, {
      isStatic: true,
      restitution: obstacle.restitution,
      friction: OBSTACLE_FRICTION,
      label: obstacle.id,
    }),
  )
  const zoneSensors = SCORE_ZONES.map((zone) =>
    Bodies.rectangle(
      zone.x + zone.width / 2,
      ZONE_SENSOR_Y,
      zone.width - ZONE_DIVIDER_WIDTH,
      ZONE_SENSOR_HEIGHT,
      { isStatic: true, isSensor: true, label: zone.id },
    ),
  )
  Composite.add(engine.world, [...wallBodies, ...obstacleBodies, ...zoneSensors])

  const ballBodies: Matter.Body[] = []
  for (let i = 0; i < SIMULATION_BALL_COUNT; i += 1) {
    ballBodies.push(
      Bodies.circle(LAUNCH.x, LAUNCH.y, BALL_RADIUS, {
        restitution: BALL_RESTITUTION,
        friction: BALL_FRICTION,
        frictionAir: BALL_FRICTION_AIR,
        density: BALL_DENSITY,
        label: `ball-${i}`,
      }),
    )
  }

  const launchSteps = LAUNCH_DELAYS_MS.slice(0, SIMULATION_BALL_COUNT).map((delay) =>
    Math.round(delay / STEP_MS),
  )
  const launched = ballBodies.map(() => false)
  const scored = ballBodies.map(() => false)
  const launchedAtMs: (number | null)[] = ballBodies.map(() => null)
  const stallSinceMs: (number | null)[] = ballBodies.map(() => null)
  const scoreSteps: number[] = []
  let scoredCount = 0
  let physicsStep = 0
  let firstLaunchStep: number | null = null
  let usedSafetyTimeout = false

  const finalizeBall = (ballIndex: number, safetyTimeout: boolean) => {
    if (scored[ballIndex]) return
    scored[ballIndex] = true
    scoredCount += 1
    if (safetyTimeout) usedSafetyTimeout = true
    scoreSteps.push(physicsStep)
  }

  Events.on(engine, 'collisionStart', (event: Matter.IEventCollision<Matter.Engine>) => {
    for (const pair of event.pairs) {
      const collision = ballIndexAndOther(pair)
      if (!collision || !collision.other.label.startsWith('zone-')) continue
      finalizeBall(collision.ballIndex, false)
    }
  })

  const maxSteps = Math.ceil((SAFETY_TIMEOUT_MS + Math.max(...LAUNCH_DELAYS_MS)) / STEP_MS) + 10
  while (scoredCount < SIMULATION_BALL_COUNT && physicsStep < maxSteps) {
    for (let ballIndex = 0; ballIndex < SIMULATION_BALL_COUNT; ballIndex += 1) {
      if (launched[ballIndex] || physicsStep < launchSteps[ballIndex]) continue
      const body = ballBodies[ballIndex]
      Body.setPosition(body, {
        x: LAUNCH.x + (random() * 2 - 1) * LAUNCH.jitterX,
        y: LAUNCH.y,
      })
      Body.setVelocity(body, {
        x: LAUNCH.minVx + random() * (LAUNCH.maxVx - LAUNCH.minVx),
        y: LAUNCH.minVy + random() * (LAUNCH.maxVy - LAUNCH.minVy),
      })
      Composite.add(engine.world, body)
      launched[ballIndex] = true
      launchedAtMs[ballIndex] = physicsStep * STEP_MS
      if (firstLaunchStep === null) firstLaunchStep = physicsStep
    }

    physicsStep += 1
    Engine.update(engine, STEP_MS)
    const nowMs = physicsStep * STEP_MS

    for (let ballIndex = 0; ballIndex < SIMULATION_BALL_COUNT; ballIndex += 1) {
      if (!launched[ballIndex] || scored[ballIndex]) continue
      const body = ballBodies[ballIndex]
      const speed = Math.hypot(body.velocity.x, body.velocity.y)
      if (speed > MAX_SPEED) {
        const factor = MAX_SPEED / speed
        Body.setVelocity(body, { x: body.velocity.x * factor, y: body.velocity.y * factor })
      }

      if (speed < STALL_SPEED_THRESHOLD) {
        if (stallSinceMs[ballIndex] === null) {
          stallSinceMs[ballIndex] = nowMs
        } else if (nowMs - stallSinceMs[ballIndex]! >= STALL_DURATION_MS) {
          const magnitude = STALL_NUDGE_SPEED * (0.5 + random() * 0.5)
          const direction = random() < 0.5 ? -1 : 1
          Body.setVelocity(body, { x: direction * magnitude, y: body.velocity.y - 0.6 })
          stallSinceMs[ballIndex] = nowMs
        }
      } else {
        stallSinceMs[ballIndex] = null
      }

      const outOfBounds =
        body.position.y > OUT_OF_BOUNDS_Y ||
        body.position.x < -OUT_OF_BOUNDS_MARGIN_X ||
        body.position.x > BOARD_WIDTH + OUT_OF_BOUNDS_MARGIN_X
      if (outOfBounds) {
        finalizeBall(ballIndex, false)
      } else if (launchedAtMs[ballIndex] !== null && nowMs - launchedAtMs[ballIndex]! >= SAFETY_TIMEOUT_MS) {
        finalizeBall(ballIndex, true)
      }
    }
  }

  const startStep = firstLaunchStep ?? 0
  const endStep = scoreSteps.length === 0 ? physicsStep : Math.max(...scoreSteps)
  const steps = Math.max(0, endStep - startStep)
  return {
    steps,
    durationMs: steps * STEP_MS,
    durationSeconds: (steps * STEP_MS) / 1000,
    scoreSteps,
    completed: scoredCount === SIMULATION_BALL_COUNT,
    usedSafetyTimeout,
  }
}
