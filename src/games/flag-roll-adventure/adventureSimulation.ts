import * as Matter from 'matter-js'
import {
  AREA_ENTRY_CLEARANCE,
  AREA_HEIGHT,
  AREA_TIMEOUT_MS,
  AREA_WIDTH,
  BALL_DENSITY,
  BALL_FRICTION,
  BALL_FRICTION_AIR,
  BALL_RADIUS,
  BALL_RESTITUTION,
  CAMERA_SETTLE_MS,
  CAMERA_TRANSITION_MS,
  EXIT_SENSOR_HEIGHT,
  GRAVITY,
  MAX_ANGULAR_VELOCITY,
  MAX_SPEED,
  OUT_OF_BOUNDS_MARGIN_X,
  OUT_OF_BOUNDS_MARGIN_Y,
  OUTER_WALL_THICKNESS,
  PIN_FRICTION,
  PIN_RESTITUTION,
  START,
  STALL_DURATION_MS,
  STALL_NUDGE_SPEED,
  STALL_SPEED_THRESHOLD,
  STEP_MS,
  WALL_FRICTION,
  WALL_RESTITUTION,
} from './adventurePhysics'
import { AREAS, findArea, START_AREA_ID } from './data/areas'
import type { AreaExit, AreaPin, AreaWall } from './types'

const { Engine, Bodies, Body, Composite, Events } = Matter

export type AdventureSimulationResult = {
  readonly totalSeconds: number
  readonly dwellSecondsByArea: Readonly<Record<string, number>>
  readonly visitedAreaIds: readonly string[]
  readonly completed: boolean
  readonly stallNudgeCount: number
  readonly areaTimeoutCount: number
  readonly rescueCount: number
}

type ExitEntry = { areaId: string; exit: AreaExit }

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0
    return state / 4294967296
  }
}

function worldPoint(areaId: string, x: number, y: number) {
  const area = findArea(areaId)
  if (!area) throw new Error(`flag-roll-adventure: unknown area id: ${areaId}`)
  return { x: area.origin.x + x, y: area.origin.y + y }
}

/**
 * useAdventureEngineと同じエリアデータ・物理定数で、固定ステップだけを進める測定器。
 * CSS scaleや画面サイズを参照しないため、端末に依存しないテンポ回帰テストに使える。
 */
export function simulateAdventureRun(seed: number): AdventureSimulationResult {
  const random = createSeededRandom(seed)
  const engine = Engine.create({ gravity: { ...GRAVITY } })

  const outerWalls = AREAS.flatMap((area) => {
    const left = Bodies.rectangle(
      area.origin.x,
      area.origin.y + AREA_HEIGHT / 2,
      OUTER_WALL_THICKNESS,
      AREA_HEIGHT,
      { isStatic: true, restitution: WALL_RESTITUTION, friction: WALL_FRICTION },
    )
    const right = Bodies.rectangle(
      area.origin.x + AREA_WIDTH,
      area.origin.y + AREA_HEIGHT / 2,
      OUTER_WALL_THICKNESS,
      AREA_HEIGHT,
      { isStatic: true, restitution: WALL_RESTITUTION, friction: WALL_FRICTION },
    )
    const top =
      area.id === START_AREA_ID
        ? [
            Bodies.rectangle(
              area.origin.x + AREA_WIDTH / 2,
              area.origin.y,
              AREA_WIDTH,
              OUTER_WALL_THICKNESS,
              { isStatic: true, restitution: WALL_RESTITUTION, friction: WALL_FRICTION },
            ),
          ]
        : []
    return [left, right, ...top]
  })

  const wallBodies: Matter.Body[] = []
  const pinBodies: Matter.Body[] = []
  for (const area of AREAS) {
    for (const object of area.objects) {
      const point = worldPoint(area.id, object.x, object.y)
      if (object.kind === 'wall') {
        const wall = object as AreaWall
        wallBodies.push(
          Bodies.rectangle(point.x, point.y, wall.width, wall.height, {
            isStatic: true,
            angle: wall.angle,
            restitution: wall.restitution ?? WALL_RESTITUTION,
            friction: WALL_FRICTION,
            label: `wall:${area.id}:${wall.id}`,
          }),
        )
      } else {
        const pin = object as AreaPin
        pinBodies.push(
          Bodies.circle(point.x, point.y, pin.radius, {
            isStatic: true,
            restitution: pin.restitution ?? PIN_RESTITUTION,
            friction: PIN_FRICTION,
            label: `pin:${area.id}:${pin.id}`,
          }),
        )
      }
    }
  }

  const exitByLabel = new Map<string, ExitEntry>()
  const exitSensors = AREAS.flatMap((area) =>
    area.exits.map((exit) => {
      const point = worldPoint(area.id, exit.x, exit.y)
      const label = `exit:${area.id}:${exit.id}`
      exitByLabel.set(label, { areaId: area.id, exit })
      return Bodies.rectangle(point.x, point.y, exit.width, exit.height || EXIT_SENSOR_HEIGHT, {
        isStatic: true,
        isSensor: true,
        label,
      })
    }),
  )

  Composite.add(engine.world, [...outerWalls, ...wallBodies, ...pinBodies, ...exitSensors])

  const initialPosition = worldPoint(
    START_AREA_ID,
    START.x + (random() * 2 - 1) * START.jitterX,
    AREA_ENTRY_CLEARANCE + BALL_RADIUS,
  )
  const ballBody = Bodies.circle(initialPosition.x, initialPosition.y, BALL_RADIUS, {
    restitution: BALL_RESTITUTION,
    friction: BALL_FRICTION,
    frictionAir: BALL_FRICTION_AIR,
    density: BALL_DENSITY,
    label: 'adventure-ball',
  })
  Body.setVelocity(ballBody, {
    x: START.minVx + random() * (START.maxVx - START.minVx),
    y: START.minVy + random() * (START.maxVy - START.minVy),
  })
  Composite.add(engine.world, ballBody)

  const dwellMsByArea = new Map(AREAS.map((area) => [area.id, 0]))
  const visitedAreaIds: string[] = [START_AREA_ID]
  let currentAreaId = START_AREA_ID
  let motion: 'running' | 'moving' | 'goal' = 'running'
  let pendingTransition: { nextAreaId: string } | null = null
  let elapsedMs = 0
  let areaEnteredAtMs = 0
  let stallSinceMs: number | null = null
  let completed = false
  let stallNudgeCount = 0
  let areaTimeoutCount = 0
  let rescueCount = 0

  function addDwellUntil(nowMs: number) {
    const previous = dwellMsByArea.get(currentAreaId) ?? 0
    dwellMsByArea.set(currentAreaId, previous + Math.max(0, nowMs - areaEnteredAtMs))
  }

  function resetBallToAreaEntry(areaId: string, resetVelocity: boolean) {
    const position = worldPoint(areaId, AREA_WIDTH / 2, AREA_ENTRY_CLEARANCE + BALL_RADIUS)
    Body.setPosition(ballBody, position)
    if (resetVelocity) {
      Body.setVelocity(ballBody, { x: 0, y: 0 })
      Body.setAngularVelocity(ballBody, 0)
    }
    stallSinceMs = null
  }

  function notifyGoal() {
    if (motion === 'goal') return
    addDwellUntil(elapsedMs)
    motion = 'goal'
    completed = true
  }

  function startAreaTransition(nextAreaId: string, resetVelocity: boolean) {
    if (motion !== 'running') return
    if (!findArea(nextAreaId)) {
      notifyGoal()
      return
    }
    addDwellUntil(elapsedMs)
    motion = 'moving'
    pendingTransition = { nextAreaId }
    resetBallToAreaEntry(nextAreaId, resetVelocity)
  }

  function completeAreaTransition() {
    if (!pendingTransition) return
    elapsedMs += CAMERA_TRANSITION_MS + CAMERA_SETTLE_MS
    currentAreaId = pendingTransition.nextAreaId
    visitedAreaIds.push(currentAreaId)
    areaEnteredAtMs = elapsedMs
    pendingTransition = null
    motion = 'running'
    stallSinceMs = null
  }

  Events.on(engine, 'collisionStart', (event: Matter.IEventCollision<Matter.Engine>) => {
    if (motion !== 'running') return
    for (const pair of event.pairs) {
      const ballIsA = pair.bodyA.label === 'adventure-ball'
      const ballIsB = pair.bodyB.label === 'adventure-ball'
      if (!ballIsA && !ballIsB) continue
      const other = ballIsA ? pair.bodyB : pair.bodyA
      const exit = exitByLabel.get(other.label)
      if (!exit || exit.areaId !== currentAreaId) continue
      if (exit.exit.to === null) {
        notifyGoal()
      } else {
        startAreaTransition(exit.exit.to, false)
      }
      return
    }
  })

  function clampVelocity() {
    const speed = Math.hypot(ballBody.velocity.x, ballBody.velocity.y)
    if (speed > MAX_SPEED) {
      const factor = MAX_SPEED / speed
      Body.setVelocity(ballBody, {
        x: ballBody.velocity.x * factor,
        y: ballBody.velocity.y * factor,
      })
    }
    if (Math.abs(ballBody.angularVelocity) > MAX_ANGULAR_VELOCITY) {
      Body.setAngularVelocity(ballBody, Math.sign(ballBody.angularVelocity) * MAX_ANGULAR_VELOCITY)
    }
  }

  function applyStallNudge() {
    const speed = Math.hypot(ballBody.velocity.x, ballBody.velocity.y)
    if (speed < STALL_SPEED_THRESHOLD) {
      if (stallSinceMs === null) {
        stallSinceMs = elapsedMs
      } else if (elapsedMs - stallSinceMs >= STALL_DURATION_MS) {
        const direction = random() < 0.5 ? -1 : 1
        Body.setVelocity(ballBody, {
          x: direction * STALL_NUDGE_SPEED,
          y: ballBody.velocity.y - 0.45,
        })
        stallSinceMs = elapsedMs
        stallNudgeCount += 1
      }
    } else {
      stallSinceMs = null
    }
  }

  function applyOutOfBoundsRecovery() {
    const area = findArea(currentAreaId)
    if (!area) return
    const localX = ballBody.position.x - area.origin.x
    const localY = ballBody.position.y - area.origin.y
    const escapedBelow = localY > AREA_HEIGHT + OUT_OF_BOUNDS_MARGIN_Y
    const escaped =
      localX < -OUT_OF_BOUNDS_MARGIN_X ||
      localX > AREA_WIDTH + OUT_OF_BOUNDS_MARGIN_X ||
      localY < -OUT_OF_BOUNDS_MARGIN_Y ||
      escapedBelow
    if (!escaped) return

    rescueCount += 1
    if (escapedBelow) {
      const exit = area.exits[0]
      if (!exit || exit.to === null) {
        notifyGoal()
      } else {
        startAreaTransition(exit.to, true)
      }
      return
    }

    resetBallToAreaEntry(currentAreaId, true)
  }

  function applyAreaTimeout() {
    if (elapsedMs - areaEnteredAtMs < AREA_TIMEOUT_MS || motion !== 'running') return
    areaTimeoutCount += 1
    const exit = findArea(currentAreaId)?.exits[0]
    if (!exit || exit.to === null) {
      notifyGoal()
      return
    }
    startAreaTransition(exit.to, true)
  }

  const maxSimulationMs = AREAS.length * (AREA_TIMEOUT_MS + CAMERA_TRANSITION_MS + CAMERA_SETTLE_MS) + 5000
  const maxPhysicsSteps = Math.ceil(maxSimulationMs / STEP_MS) + 10
  let physicsSteps = 0
  while (!completed && physicsSteps < maxPhysicsSteps && elapsedMs < maxSimulationMs) {
    physicsSteps += 1
    elapsedMs += STEP_MS
    Engine.update(engine, STEP_MS)

    // collisionStartのコールバックがEngine.update中にmotionを変えるため、状態を再取得する。
    const motionAfterPhysics = motion as 'running' | 'moving' | 'goal'
    if (motionAfterPhysics === 'moving') {
      // カメラ移動中と着地待ちは物理を止め、その時間だけを経過時間へ加える。
      completeAreaTransition()
      continue
    }
    if (motionAfterPhysics !== 'running') continue

    clampVelocity()
    applyStallNudge()
    applyOutOfBoundsRecovery()
    if (motion === 'running') applyAreaTimeout()
  }

  Events.off(engine, 'collisionStart')
  Composite.clear(engine.world, false)
  Engine.clear(engine)

  const dwellSecondsByArea = Object.fromEntries(
    AREAS.map((area) => [area.id, (dwellMsByArea.get(area.id) ?? 0) / 1000]),
  )
  return {
    totalSeconds: elapsedMs / 1000,
    dwellSecondsByArea,
    visitedAreaIds,
    completed,
    stallNudgeCount,
    areaTimeoutCount,
    rescueCount,
  }
}
