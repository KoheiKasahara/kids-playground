import * as Matter from 'matter-js'
import {
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
  CUP_FRICTION,
  CUP_INNER_DEPTH,
  CUP_INNER_WIDTH,
  CUP_RESCUE_DROP_HEIGHT,
  CUP_RESTITUTION,
  CUP_SENSOR_INSET,
  CUP_SETTLE_MS,
  EXIT_SENSOR_HEIGHT,
  EXIT_SWALLOW_MS,
  GOAL_RESCUE_DROP_LIMIT,
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
import { AREAS, findArea, pickExitForBallX, resolveExitTarget, START_AREA_ID } from './data/areas'
import { areaGroundRects, cupBottomRect, cupSensorRect, type AdventureRect } from './adventureGeometry'
import type { AreaCup, AreaEntry, AreaExit, AreaPin, AreaWall } from './types'

const { Engine, Bodies, Body, Composite, Events } = Matter

export type AdventureSimulationResult = {
  readonly totalSeconds: number
  readonly dwellSecondsByArea: Readonly<Record<string, number>>
  readonly visitedAreaIds: readonly string[]
  readonly completed: boolean
  readonly cupIn: boolean
  readonly goalRescueDropCount: number
  readonly stallNudgeCount: number
  readonly areaTimeoutCount: number
  readonly rescueCount: number
}

type ExitEntry = { areaId: string; exit: AreaExit }
type CupEntry = { areaId: string; cup: AreaCup }
type LinearVelocity = { x: number; y: number }
type Motion = 'running' | 'exiting' | 'moving' | 'cup-in' | 'goal'
type PendingExit = {
  entry: ExitEntry
  targetAreaId: string
  targetEntry: AreaEntry
  from: { x: number; y: number }
  velocity: LinearVelocity
  startedAtMs: number
}
type PendingMove = {
  nextAreaId: string
  entry: AreaEntry
  velocity: LinearVelocity
  startedAtMs: number
}

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

function clampLinearVelocity(velocity: LinearVelocity): LinearVelocity {
  const speed = Math.hypot(velocity.x, velocity.y)
  if (speed <= MAX_SPEED) return velocity
  const factor = MAX_SPEED / speed
  return { x: velocity.x * factor, y: velocity.y * factor }
}

function createRectBody(areaId: string, rect: AdventureRect, options: Matter.IChamferableBodyDefinition): Matter.Body {
  const center = worldPoint(areaId, rect.left + rect.width / 2, rect.top + rect.height / 2)
  return Bodies.rectangle(center.x, center.y, rect.width, rect.height, options)
}

function createPortalFloorBodies(area: (typeof AREAS)[number]): Matter.Body[] {
  const material = area.cup
    ? { restitution: CUP_RESTITUTION, friction: CUP_FRICTION }
    : { restitution: WALL_RESTITUTION, friction: WALL_FRICTION }
  return areaGroundRects(area).map((rect, index) =>
    createRectBody(area.id, rect, {
      isStatic: true,
      ...material,
      label: area.cup
        ? `cup-ground:${area.id}:${index === 0 ? 'left' : 'right'}`
        : `portal-floor:${area.id}:${index === 0 ? 'left' : 'right'}`,
    }),
  )
}

function createCupBodies(
  area: (typeof AREAS)[number],
  cupByLabel: Map<string, CupEntry>,
): Matter.Body[] {
  if (!area.cup) return []
  const { cup } = area
  const common = { isStatic: true, restitution: CUP_RESTITUTION, friction: CUP_FRICTION }
  const bottom = createRectBody(area.id, cupBottomRect(cup), {
    ...common,
    label: `cup-bottom:${area.id}:${cup.id}`,
  })
  const sensor = createRectBody(area.id, cupSensorRect(cup), {
    isStatic: true,
    isSensor: true,
    label: `cup-sensor:${area.id}:${cup.id}`,
  })
  cupByLabel.set(sensor.label, { areaId: area.id, cup })
  return [bottom, sensor]
}

/**
 * useAdventureEngineと同じエリアデータ・物理定数で、固定ステップだけを進める測定器。
 * CSS scaleや画面サイズを参照しないため、端末に依存しないテンポ回帰テストに使える。
 */
export function simulateAdventureRun(seed: number): AdventureSimulationResult {
  const random = createSeededRandom(seed)
  const startArea = findArea(START_AREA_ID)
  const startEntry = startArea?.entries[0]
  if (!startArea || !startEntry) throw new Error(`flag-roll-adventure: start entry is missing`)

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
  const cupByLabel = new Map<string, CupEntry>()
  const portalFloors = AREAS.flatMap((area) => createPortalFloorBodies(area))
  const cupBodies = AREAS.flatMap((area) => createCupBodies(area, cupByLabel))
  Composite.add(engine.world, [...outerWalls, ...wallBodies, ...pinBodies, ...portalFloors, ...exitSensors, ...cupBodies])

  const initialPosition = worldPoint(
    START_AREA_ID,
    startEntry.x + (random() * 2 - 1) * START.jitterX,
    startEntry.y,
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
  let motion: Motion = 'running'
  let pendingExit: PendingExit | null = null
  let pendingMove: PendingMove | null = null
  let elapsedMs = 0
  let areaEnteredAtMs = 0
  let stallSinceMs: number | null = null
  let cupInStartedAtMs: number | null = null
  let exitLatched = false
  let completed = false
  let cupIn = false
  let goalRescueDropCount = 0
  let stallNudgeCount = 0
  let areaTimeoutCount = 0
  let rescueCount = 0
  let goalTimeoutCount = 0

  function addDwellUntil(nowMs: number) {
    const previous = dwellMsByArea.get(currentAreaId) ?? 0
    dwellMsByArea.set(currentAreaId, previous + Math.max(0, nowMs - areaEnteredAtMs))
  }

  function resetBallToAreaEntry(areaId: string, resetVelocity: boolean) {
    const area = findArea(areaId)
    const entry = area?.entries[0]
    if (!area || !entry) return
    Body.setPosition(ballBody, worldPoint(areaId, entry.x, entry.y))
    if (resetVelocity) {
      Body.setVelocity(ballBody, { x: 0, y: 0 })
      Body.setAngularVelocity(ballBody, 0)
    }
    stallSinceMs = null
  }

  function resetBallToCupDrop() {
    const area = findArea(currentAreaId)
    const cup = area?.cup
    if (!area || !cup) return
    Body.setPosition(ballBody, worldPoint(currentAreaId, cup.x, cup.rimY - CUP_RESCUE_DROP_HEIGHT))
    Body.setVelocity(ballBody, { x: 0, y: 0 })
    Body.setAngularVelocity(ballBody, 0)
    stallSinceMs = null
    goalRescueDropCount += 1
  }

  function placeBallAtCupBottom() {
    const area = findArea(currentAreaId)
    const cup = area?.cup
    if (!area || !cup) return
    Body.setPosition(ballBody, worldPoint(currentAreaId, cup.x, cup.rimY + CUP_INNER_DEPTH - BALL_RADIUS))
    Body.setVelocity(ballBody, { x: 0, y: 0 })
    Body.setAngularVelocity(ballBody, 0)
    stallSinceMs = null
    goalRescueDropCount += 1
  }

  function notifyGoal() {
    if (motion === 'goal') return
    addDwellUntil(elapsedMs)
    motion = 'goal'
    completed = true
  }

  function beginCupIn() {
    if (motion !== 'running') return
    motion = 'cup-in'
    cupIn = true
    cupInStartedAtMs = elapsedMs
    stallSinceMs = null
  }

  function finishExit() {
    if (!pendingExit) return
    const pending = pendingExit
    Body.setPosition(ballBody, worldPoint(pending.targetAreaId, pending.targetEntry.x, pending.targetEntry.y))
    Body.setVelocity(ballBody, { x: 0, y: 0 })
    Body.setAngularVelocity(ballBody, 0)
    pendingMove = {
      nextAreaId: pending.targetAreaId,
      entry: pending.targetEntry,
      velocity: pending.velocity,
      startedAtMs: elapsedMs,
    }
    motion = 'moving'
    pendingExit = null
    stallSinceMs = null
  }

  function startExitTransition(entry: ExitEntry, resetVelocity: boolean) {
    if (motion !== 'running' || exitLatched || entry.areaId !== currentAreaId) return
    const target = resolveExitTarget(entry.areaId, entry.exit.id)
    if (!target) {
      notifyGoal()
      return
    }
    addDwellUntil(elapsedMs)
    exitLatched = true
    pendingExit = {
      entry,
      targetAreaId: target.areaId,
      targetEntry: target.entry,
      from: { x: ballBody.position.x, y: ballBody.position.y },
      velocity: resetVelocity
        ? { x: 0, y: 0 }
        : clampLinearVelocity({ x: ballBody.velocity.x, y: ballBody.velocity.y }),
      startedAtMs: elapsedMs,
    }
    motion = 'exiting'
    Body.setVelocity(ballBody, { x: 0, y: 0 })
    Body.setAngularVelocity(ballBody, 0)
  }

  Events.on(engine, 'collisionStart', (event: Matter.IEventCollision<Matter.Engine>) => {
    if (motion !== 'running') return
    for (const pair of event.pairs) {
      const ballIsA = pair.bodyA.label === 'adventure-ball'
      const ballIsB = pair.bodyB.label === 'adventure-ball'
      if (!ballIsA && !ballIsB) continue
      const other = ballIsA ? pair.bodyB : pair.bodyA
      const exit = exitByLabel.get(other.label)
      if (exit) {
        startExitTransition(exit, false)
        continue
      }

      const cup = cupByLabel.get(other.label)
      if (cup) {
        const area = findArea(cup.areaId)
        const rimY = area ? area.origin.y + cup.cup.rimY : Number.POSITIVE_INFINITY
        if (
          motion === 'running' &&
          cup.areaId === currentAreaId &&
          ballBody.position.y >= rimY + CUP_SENSOR_INSET
        ) {
          beginCupIn()
        }
        continue
      }
    }
  })

  function clampVelocity() {
    const velocity = clampLinearVelocity({ x: ballBody.velocity.x, y: ballBody.velocity.y })
    if (velocity.x !== ballBody.velocity.x || velocity.y !== ballBody.velocity.y) Body.setVelocity(ballBody, velocity)
    if (Math.abs(ballBody.angularVelocity) > MAX_ANGULAR_VELOCITY) {
      Body.setAngularVelocity(ballBody, Math.sign(ballBody.angularVelocity) * MAX_ANGULAR_VELOCITY)
    }
  }

  function applyStallNudge() {
    const area = findArea(currentAreaId)
    const cup = area?.cup
    const localX = area ? ballBody.position.x - area.origin.x : 0
    const localY = area ? ballBody.position.y - area.origin.y : 0
    if (cup && localY >= cup.rimY && Math.abs(localX - cup.x) <= CUP_INNER_WIDTH / 2) {
      stallSinceMs = null
      return
    }

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
      if (area.cup) {
        resetBallToCupDrop()
      } else {
        const exit = pickExitForBallX(area, localX)
        if (exit) startExitTransition({ areaId: area.id, exit }, true)
        else resetBallToAreaEntry(currentAreaId, true)
      }
      return
    }

    resetBallToAreaEntry(currentAreaId, true)
  }

  function applyAreaTimeout() {
    if (elapsedMs - areaEnteredAtMs < AREA_TIMEOUT_MS || motion !== 'running') return
    areaTimeoutCount += 1
    const area = findArea(currentAreaId)
    if (!area) return

    if (area.cup) {
      goalTimeoutCount += 1
      if (goalTimeoutCount < GOAL_RESCUE_DROP_LIMIT) {
        resetBallToCupDrop()
        areaEnteredAtMs = elapsedMs
      } else {
        placeBallAtCupBottom()
        beginCupIn()
        areaEnteredAtMs = elapsedMs
      }
      return
    }

    const localX = ballBody.position.x - area.origin.x
    const exit = pickExitForBallX(area, localX)
    if (exit) startExitTransition({ areaId: area.id, exit }, true)
    else resetBallToAreaEntry(currentAreaId, true)
  }

  const maxSimulationMs =
    AREAS.length * (AREA_TIMEOUT_MS + EXIT_SWALLOW_MS + CAMERA_TRANSITION_MS + CAMERA_SETTLE_MS) + CUP_SETTLE_MS + 5000
  const maxPhysicsSteps = Math.ceil(maxSimulationMs / STEP_MS) + 10
  let physicsSteps = 0
  while (!completed && physicsSteps < maxPhysicsSteps && elapsedMs < maxSimulationMs) {
    physicsSteps += 1
    elapsedMs += STEP_MS

    const loopMotion = motion as Motion
    if (loopMotion === 'exiting') {
      const exit = pendingExit as PendingExit | null
      if (exit) {
        const progress = Math.min(1, (elapsedMs - exit.startedAtMs) / EXIT_SWALLOW_MS)
        const target = worldPoint(exit.entry.areaId, exit.entry.exit.x, exit.entry.exit.y)
        Body.setPosition(ballBody, {
          x: exit.from.x + (target.x - exit.from.x) * progress,
          y: exit.from.y + (target.y - exit.from.y) * progress,
        })
        if (progress >= 1) finishExit()
      }
      continue
    }
    if (loopMotion === 'moving') {
      const move = pendingMove as PendingMove | null
      if (move && elapsedMs - move.startedAtMs >= CAMERA_TRANSITION_MS + CAMERA_SETTLE_MS) {
        const pending = move
        currentAreaId = pending.nextAreaId
        visitedAreaIds.push(currentAreaId)
        areaEnteredAtMs = elapsedMs
        motion = 'running'
        pendingMove = null
        exitLatched = false
        const velocity = pending.entry.velocity
          ? clampLinearVelocity(pending.entry.velocity)
          : pending.velocity
        Body.setVelocity(ballBody, velocity)
        Body.setAngularVelocity(ballBody, 0)
        stallSinceMs = null
      }
      continue
    }

    if (loopMotion === 'goal') break

    Engine.update(engine, STEP_MS)
    // collisionStartのコールバックがEngine.update中にmotionを変えるため、状態を再取得する。
    const motionAfterPhysics = motion as Motion
    if (motionAfterPhysics === 'exiting' || motionAfterPhysics === 'moving') continue
    if (motionAfterPhysics === 'cup-in') {
      clampVelocity()
      if (cupInStartedAtMs !== null && elapsedMs - cupInStartedAtMs >= CUP_SETTLE_MS) notifyGoal()
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
    cupIn,
    goalRescueDropCount,
    stallNudgeCount,
    areaTimeoutCount,
    rescueCount,
  }
}
