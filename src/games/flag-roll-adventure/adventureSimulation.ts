import * as Matter from 'matter-js'
import {
  AREA_HEIGHT,
  AREA_TIMEOUT_MS,
  AREA_WIDTH,
  BALL_RADIUS,
  CAMERA_SETTLE_MS,
  CAMERA_TRANSITION_MS,
  CUP_INNER_DEPTH,
  CUP_INNER_WIDTH,
  CUP_RESCUE_DROP_HEIGHT,
  CUP_SENSOR_INSET,
  CUP_SETTLE_MS,
  EXIT_SWALLOW_MS,
  GOAL_RESCUE_DROP_LIMIT,
  JUMP_COOLDOWN_MS,
  MAX_ANGULAR_VELOCITY,
  MAX_SPEED,
  OUT_OF_BOUNDS_MARGIN_X,
  OUT_OF_BOUNDS_MARGIN_Y,
  STALL_DURATION_MS,
  STALL_NUDGE_SPEED,
  STALL_SPEED_THRESHOLD,
  STEP_MS,
} from './adventurePhysics'
import { AREAS, findArea, gravityYForArea, pickExitForBallX, resolveExitTarget, START_AREA_ID } from './data/areas'
import { createAdventureWorld, type AdventureZoneEntry } from './adventureWorld'
import {
  canRecaptureCannon,
  calculateZoneEffects,
  getCannonHoldMs,
  getCannonLaunchVelocity,
  getCannonMuzzlePosition,
  getJumpLaunchVelocity,
} from './gimmicks'
import type { AreaCannon, AreaEntry, AreaExit, AreaJumpPad } from './types'

const { Engine, Body, Composite, Events, Query } = Matter

export type AdventureSimulationResult = {
  readonly totalSeconds: number
  readonly dwellSecondsByArea: Readonly<Record<string, number>>
  readonly maxSpeedByArea: Readonly<Record<string, number>>
  readonly stallNudgeCountByArea: Readonly<Record<string, number>>
  readonly pinHitCount: number
  readonly pinHitCountByArea: Readonly<Record<string, number>>
  readonly pinHitCountById: Readonly<Record<string, number>>
  readonly spinnerHitCountById: Readonly<Record<string, number>>
  readonly lifterFireCountById: Readonly<Record<string, number>>
  readonly objectContactCountByArea: Readonly<Record<string, number>>
  readonly maxAirborneSeconds: number
  readonly maxAirborneSecondsByArea: Readonly<Record<string, number>>
  readonly maxContactlessDropPx: number
  readonly maxContactlessDropPxByArea: Readonly<Record<string, number>>
  readonly cannonFireCount: number
  readonly cannonFireCountById: Readonly<Record<string, number>>
  readonly jumpCount: number
  readonly jumpCountById: Readonly<Record<string, number>>
  readonly boostSeconds: number
  readonly visitedAreaIds: readonly string[]
  readonly completed: boolean
  readonly cupIn: boolean
  readonly goalRescueDropCount: number
  readonly stallNudgeCount: number
  readonly areaTimeoutCount: number
  readonly rescueCount: number
}

type ExitEntry = { areaId: string; exit: AreaExit }
type LinearVelocity = { x: number; y: number }
type Motion = 'running' | 'exiting' | 'moving' | 'cannon' | 'cup-in' | 'goal'
type ActiveCannon = {
  label: string
  areaId: string
  cannon: AreaCannon
  startedAtMs: number
}
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

/**
 * useAdventureEngineと同じエリアデータ・物理定数で、固定ステップだけを進める測定器。
 * CSS scaleや画面サイズを参照しないため、端末に依存しないテンポ回帰テストに使える。
 */
export function simulateAdventureRun(seed: number): AdventureSimulationResult {
  const random = createSeededRandom(seed)
  const {
    engine,
    ballBody,
    solidBodies,
    pinByLabel,
    jumpByLabel,
    exitByLabel,
    cupByLabel,
    zoneByLabel,
    toyRuntimes,
    toyByLabel,
  } = createAdventureWorld(random)
  const zoneWorldGeometry = [...zoneByLabel.values()].map((entry) => ({
    zone: entry.zone,
    x: entry.body.position.x,
    y: entry.body.position.y,
    angle: entry.body.angle,
  }))

  const dwellMsByArea = new Map(AREAS.map((area) => [area.id, 0]))
  const maxSpeedByArea = new Map(AREAS.map((area) => [area.id, 0]))
  const stallNudgeCountByArea = new Map(AREAS.map((area) => [area.id, 0]))
  const pinHitCountByArea = new Map(AREAS.map((area) => [area.id, 0]))
  const pinHitCountById = new Map<string, number>()
  const spinnerHitCountById = new Map<string, number>()
  const lifterFireCountById = new Map<string, number>()
  const objectContactCountByArea = new Map(AREAS.map((area) => [area.id, 0]))
  const maxAirborneMsByArea = new Map(AREAS.map((area) => [area.id, 0]))
  const visitedAreaIds: string[] = [START_AREA_ID]
  let currentAreaId = START_AREA_ID
  const applyAreaGravity = (areaId: string) => {
    engine.gravity.y = gravityYForArea(areaId)
  }
  applyAreaGravity(currentAreaId)
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
  let pinHitCount = 0
  let airborneSinceMs: number | null = null
  let maxAirborneMs = 0
  let contactlessDropStartY: number | null = null
  let maxContactlessDropPx = 0
  const maxContactlessDropPxByArea = new Map(AREAS.map((area) => [area.id, 0]))
  let activeCannon: ActiveCannon | null = null
  const cannonLastFiredAt = new Map<string, number>()
  let cannonFireCount = 0
  const cannonFireCountById = new Map<string, number>()
  const jumpLastHitAt = new Map<string, number>()
  const jumpUsed = new Set<string>()
  let jumpCount = 0
  const jumpCountById = new Map<string, number>()
  let boostSeconds = 0

  function finishAirborne(nowMs: number) {
    if (airborneSinceMs === null) return
    const durationMs = Math.max(0, nowMs - airborneSinceMs)
    maxAirborneMs = Math.max(maxAirborneMs, durationMs)
    maxAirborneMsByArea.set(
      currentAreaId,
      Math.max(maxAirborneMsByArea.get(currentAreaId) ?? 0, durationMs),
    )
    airborneSinceMs = null
  }

  function updateAirborne(hasSolidContact: boolean) {
    if (motion !== 'running' || hasSolidContact) {
      finishAirborne(elapsedMs)
      return
    }
    if (airborneSinceMs === null) {
      airborneSinceMs = Math.max(0, elapsedMs - STEP_MS)
    }
  }

  function finishContactlessDrop() {
    if (contactlessDropStartY === null) return
    const area = findArea(currentAreaId)
    const currentY = ballBody.position.y - (area?.origin.y ?? 0)
    const dropPx = currentY - contactlessDropStartY
    if (dropPx > 0) {
      maxContactlessDropPx = Math.max(maxContactlessDropPx, dropPx)
      maxContactlessDropPxByArea.set(
        currentAreaId,
        Math.max(maxContactlessDropPxByArea.get(currentAreaId) ?? 0, dropPx),
      )
    }
    contactlessDropStartY = null
  }

  function updateContactlessDrop(hasSolidContact: boolean) {
    if (motion !== 'running' || hasSolidContact) {
      finishContactlessDrop()
      return
    }
    if (contactlessDropStartY === null) {
      const area = findArea(currentAreaId)
      contactlessDropStartY = ballBody.position.y - (area?.origin.y ?? 0)
    }
  }

  function updateZoneEffects() {
    const effects = calculateZoneEffects(
      ballBody.position,
      ballBody.velocity,
      ballBody.mass,
      engine.gravity.y,
      engine.gravity.scale,
      zoneWorldGeometry,
    )
    if (effects.velocity.x !== ballBody.velocity.x || effects.velocity.y !== ballBody.velocity.y) {
      Body.setVelocity(ballBody, effects.velocity)
    }
    if (effects.counterGravityForce.x !== 0 || effects.counterGravityForce.y !== 0) {
      Body.applyForce(ballBody, ballBody.position, effects.counterGravityForce)
    }
    if (effects.boostIds.length > 0) boostSeconds += STEP_MS / 1000
  }

  function captureCannon(entry: AdventureZoneEntry) {
    if (entry.zone.kind !== 'cannon' || motion !== 'running') return
    const lastFiredAt = cannonLastFiredAt.get(entry.body.label) ?? null
    if (!canRecaptureCannon(activeCannon !== null, lastFiredAt, elapsedMs)) return
    finishAirborne(elapsedMs)
    finishContactlessDrop()
    activeCannon = {
      label: entry.body.label,
      areaId: entry.areaId,
      cannon: entry.zone,
      startedAtMs: elapsedMs,
    }
    motion = 'cannon'
    Body.setPosition(ballBody, entry.body.position)
    Body.setVelocity(ballBody, { x: 0, y: 0 })
    Body.setAngularVelocity(ballBody, 0)
    stallSinceMs = null
  }

  function fireCannon() {
    if (!activeCannon) return
    const pending = activeCannon
    finishAirborne(elapsedMs)
    finishContactlessDrop()
    const muzzle = getCannonMuzzlePosition(pending.cannon)
    Body.setPosition(ballBody, worldPoint(pending.areaId, muzzle.x, muzzle.y))
    Body.setVelocity(ballBody, getCannonLaunchVelocity(pending.cannon))
    Body.setAngularVelocity(ballBody, 0)
    cannonLastFiredAt.set(pending.label, elapsedMs)
    activeCannon = null
    motion = 'running'
    airborneSinceMs = null
    contactlessDropStartY = null
    stallSinceMs = null
    clampVelocity()
    cannonFireCount += 1
    cannonFireCountById.set(pending.cannon.id, (cannonFireCountById.get(pending.cannon.id) ?? 0) + 1)
  }

  function updateCannon() {
    if (!activeCannon) {
      motion = 'running'
      return
    }
    const cannonBody = zoneByLabel.get(activeCannon.label)?.body
    if (!cannonBody) {
      activeCannon = null
      motion = 'running'
      return
    }
    Body.setPosition(ballBody, cannonBody.position)
    Body.setVelocity(ballBody, { x: 0, y: 0 })
    Body.setAngularVelocity(ballBody, 0)
    if (elapsedMs - activeCannon.startedAtMs >= getCannonHoldMs(activeCannon.cannon)) fireCannon()
  }

  function applyJumpPad(entry: { areaId: string; jump: AreaJumpPad }, label: string) {
    if (motion !== 'running') return
    if (jumpUsed.has(label)) return
    const lastHitAt = jumpLastHitAt.get(label) ?? -Infinity
    if (elapsedMs - lastHitAt < JUMP_COOLDOWN_MS) return
    Body.setVelocity(ballBody, getJumpLaunchVelocity(entry.jump))
    jumpLastHitAt.set(label, elapsedMs)
    jumpUsed.add(label)
    jumpCount += 1
    jumpCountById.set(entry.jump.id, (jumpCountById.get(entry.jump.id) ?? 0) + 1)
  }

  function updateAdventureToys() {
    for (const runtime of toyRuntimes) {
      const ballForToy = motion === 'running' && runtime.areaId === currentAreaId ? ballBody : null
      const event = runtime.update(elapsedMs, ballForToy)
      if (!event) continue
      if (event.kind === 'spinner-hit') {
        spinnerHitCountById.set(event.id, (spinnerHitCountById.get(event.id) ?? 0) + 1)
      } else {
        lifterFireCountById.set(event.id, (lifterFireCountById.get(event.id) ?? 0) + 1)
      }
    }
  }

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
    finishAirborne(elapsedMs)
    finishContactlessDrop()
  }

  function resetBallToCupDrop() {
    const area = findArea(currentAreaId)
    const cup = area?.cup
    if (!area || !cup) return
    Body.setPosition(ballBody, worldPoint(currentAreaId, cup.x, cup.rimY - CUP_RESCUE_DROP_HEIGHT))
    Body.setVelocity(ballBody, { x: 0, y: 0 })
    Body.setAngularVelocity(ballBody, 0)
    stallSinceMs = null
    finishAirborne(elapsedMs)
    finishContactlessDrop()
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
    finishAirborne(elapsedMs)
    finishContactlessDrop()
    goalRescueDropCount += 1
  }

  function notifyGoal() {
    if (motion === 'goal') return
    finishAirborne(elapsedMs)
    finishContactlessDrop()
    addDwellUntil(elapsedMs)
    motion = 'goal'
    completed = true
  }

  function beginCupIn() {
    if (motion !== 'running') return
    finishAirborne(elapsedMs)
    finishContactlessDrop()
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
    finishAirborne(elapsedMs)
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
      const pin = pinByLabel.get(other.label)
      const toy = toyByLabel.get(other.label)
      const wallAreaId = other.label.startsWith('wall:') ? other.label.split(':')[1] : undefined
      const objectAreaId = pin?.areaId ?? toy?.areaId ?? wallAreaId
      if (objectAreaId) {
        objectContactCountByArea.set(
          objectAreaId,
          (objectContactCountByArea.get(objectAreaId) ?? 0) + 1,
        )
      }
      if (toy?.toy.kind === 'spinner') {
        spinnerHitCountById.set(toy.toy.id, (spinnerHitCountById.get(toy.toy.id) ?? 0) + 1)
      }
      const exit = exitByLabel.get(other.label)
      if (exit) {
        startExitTransition(exit, false)
        continue
      }

      const jump = jumpByLabel.get(other.label)
      if (jump) {
        applyJumpPad(jump, other.label)
        continue
      }

      const zone = zoneByLabel.get(other.label)
      if (zone) {
        captureCannon(zone)
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

      if (pin) {
        pinHitCount += 1
        pinHitCountByArea.set(pin.areaId, (pinHitCountByArea.get(pin.areaId) ?? 0) + 1)
        pinHitCountById.set(other.label, (pinHitCountById.get(other.label) ?? 0) + 1)
        continue
      }
    }
  })
  const handleBeforeUpdate = () => updateZoneEffects()
  Events.on(engine, 'beforeUpdate', handleBeforeUpdate)

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
        stallNudgeCountByArea.set(currentAreaId, (stallNudgeCountByArea.get(currentAreaId) ?? 0) + 1)
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

  function observeRunningSpeed() {
    if (motion !== 'running') return
    const speed = Math.hypot(ballBody.velocity.x, ballBody.velocity.y)
    maxSpeedByArea.set(currentAreaId, Math.max(maxSpeedByArea.get(currentAreaId) ?? 0, speed))
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
        applyAreaGravity(currentAreaId)
        visitedAreaIds.push(currentAreaId)
        areaEnteredAtMs = elapsedMs
        motion = 'running'
        pendingMove = null
        exitLatched = false
        airborneSinceMs = null
        contactlessDropStartY = null
        const velocity = pending.entry.velocity
          ? clampLinearVelocity(pending.entry.velocity)
          : pending.velocity
        Body.setVelocity(ballBody, velocity)
        Body.setAngularVelocity(ballBody, 0)
        stallSinceMs = null
      }
      continue
    }

    if (loopMotion === 'cannon') {
      updateCannon()
      continue
    }

    if (loopMotion === 'goal') break

    // 動的Toyを先に進め、同じ固定ステップ内の角度・速度をEngine.updateへ渡す。
    updateAdventureToys()
    Engine.update(engine, STEP_MS)
    // collisionStartのコールバックがEngine.update中にmotionを変えるため、状態を再取得する。
    const motionAfterPhysics = motion as Motion
    if (motionAfterPhysics === 'exiting' || motionAfterPhysics === 'moving') {
      finishAirborne(elapsedMs)
      continue
    }
    if (motionAfterPhysics === 'cup-in') {
      finishAirborne(elapsedMs)
      clampVelocity()
      if (cupInStartedAtMs !== null && elapsedMs - cupInStartedAtMs >= CUP_SETTLE_MS) notifyGoal()
      continue
    }
    if (motionAfterPhysics !== 'running') continue

    const hasSolidContact = Query.collides(ballBody, solidBodies).length > 0
    updateAirborne(hasSolidContact)
    updateContactlessDrop(hasSolidContact)
    clampVelocity()
    observeRunningSpeed()
    applyStallNudge()
    applyOutOfBoundsRecovery()
    if (motion === 'running') applyAreaTimeout()
  }

  Events.off(engine, 'collisionStart')
  Events.off(engine, 'beforeUpdate', handleBeforeUpdate)
  finishAirborne(elapsedMs)
  finishContactlessDrop()
  Composite.clear(engine.world, false)
  Engine.clear(engine)

  const dwellSecondsByArea = Object.fromEntries(
    AREAS.map((area) => [area.id, (dwellMsByArea.get(area.id) ?? 0) / 1000]),
  )
  const maxSpeedByAreaRecord = Object.fromEntries(maxSpeedByArea)
  const stallNudgeCountByAreaRecord = Object.fromEntries(
    AREAS.map((area) => [area.id, stallNudgeCountByArea.get(area.id) ?? 0]),
  )
  const pinHitCountByAreaRecord = Object.fromEntries(
    AREAS.map((area) => [area.id, pinHitCountByArea.get(area.id) ?? 0]),
  )
  const pinHitCountByIdRecord = Object.fromEntries(pinHitCountById)
  const spinnerHitCountByIdRecord = Object.fromEntries(spinnerHitCountById)
  const lifterFireCountByIdRecord = Object.fromEntries(lifterFireCountById)
  const objectContactCountByAreaRecord = Object.fromEntries(objectContactCountByArea)
  const maxAirborneSecondsByArea = Object.fromEntries(
    AREAS.map((area) => [area.id, (maxAirborneMsByArea.get(area.id) ?? 0) / 1000]),
  )
  const maxContactlessDropPxByAreaRecord = Object.fromEntries(maxContactlessDropPxByArea)
  const cannonFireCountByIdRecord = Object.fromEntries(cannonFireCountById)
  const jumpCountByIdRecord = Object.fromEntries(jumpCountById)
  return {
    totalSeconds: elapsedMs / 1000,
    dwellSecondsByArea,
    maxSpeedByArea: maxSpeedByAreaRecord,
    stallNudgeCountByArea: stallNudgeCountByAreaRecord,
    pinHitCount,
    pinHitCountByArea: pinHitCountByAreaRecord,
    pinHitCountById: pinHitCountByIdRecord,
    spinnerHitCountById: spinnerHitCountByIdRecord,
    lifterFireCountById: lifterFireCountByIdRecord,
    objectContactCountByArea: objectContactCountByAreaRecord,
    maxAirborneSeconds: maxAirborneMs / 1000,
    maxAirborneSecondsByArea,
    maxContactlessDropPx,
    maxContactlessDropPxByArea: maxContactlessDropPxByAreaRecord,
    cannonFireCount,
    cannonFireCountById: cannonFireCountByIdRecord,
    jumpCount,
    jumpCountById: jumpCountByIdRecord,
    boostSeconds,
    visitedAreaIds,
    completed,
    cupIn,
    goalRescueDropCount,
    stallNudgeCount,
    areaTimeoutCount,
    rescueCount,
  }
}
