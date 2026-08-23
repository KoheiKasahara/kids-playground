import { useEffect, useMemo, useRef } from 'react'
import * as Matter from 'matter-js'
import {
  AREA_HEIGHT,
  AREA_TIMEOUT_MS,
  AREA_WIDTH,
  BALL_RADIUS,
  CAMERA_SETTLE_MS,
  CAMERA_TRANSITION_MS,
  BOOST_SOUND_COOLDOWN_MS,
  CUP_INNER_DEPTH,
  CUP_INNER_WIDTH,
  CUP_RESCUE_DROP_HEIGHT,
  CUP_SENSOR_INSET,
  CUP_SETTLE_MS,
  EXIT_SWALLOW_MS,
  ENTRY_EMERGE_MS,
  GOAL_RESCUE_DROP_LIMIT,
  JUMP_COOLDOWN_MS,
  MAX_ANGULAR_VELOCITY,
  MAX_FRAME_DELTA_MS,
  MAX_SPEED,
  MAX_SUBSTEPS,
  OUT_OF_BOUNDS_MARGIN_X,
  OUT_OF_BOUNDS_MARGIN_Y,
  PIN_HIT_COOLDOWN_MS,
  PIN_SOUND_GLOBAL_COOLDOWN_MS,
  STALL_DURATION_MS,
  STALL_NUDGE_SPEED,
  STALL_SPEED_THRESHOLD,
  STEP_MS,
} from './adventurePhysics'
import { findArea, pickExitForBallX, resolveExitTarget, START_AREA_ID } from './data/areas'
import { createAdventureWorld, type AdventureZoneEntry } from './adventureWorld'
import {
  canRecaptureCannon,
  calculateZoneEffects,
  getCannonHoldMs,
  getCannonLaunchVelocity,
  getCannonMuzzlePosition,
  getJumpLaunchVelocity,
  type AdventureGimmickEvent,
} from './gimmicks'
import stageStyles from './AdventureStage.module.css'
import { cameraPositionForArea, interpolateCameraPosition, type CameraPosition } from './camera'
import type { AreaCannon, AreaEntry, AreaExit, AreaJumpPad } from './types'

const { Engine, Body, Composite, Events } = Matter

export type AdventureEngineOptions = {
  /** プレイの世代。値が変わったら物理世界を作り直して最初から始める。 */
  runId: number
  /** カメラ移動と物理再開が完了し、次エリアへ入ったときに一度だけ呼ぶ。 */
  onAreaEnter: (areaId: string) => void
  /** カップイン後の沈み込みが終わったときに呼ぶ。 */
  onGoal: () => void
  /** ピン衝突の演出用通知。物理の軌道をReact stateで描画しないための軽いイベント。 */
  onPinHit: (pinId: string) => void
  /** ギミックの捕獲・射出・発火を見た目と音へ伝える軽いイベント。 */
  onGimmick?: (event: AdventureGimmickEvent) => void
  /** 最初のボールをワールドへ追加したときの効果音用通知。 */
  onBallLaunched?: () => void
}

export type AdventureEngineHandle = {
  /** 1球のDOM要素を登録するrefコールバック。参照は世界の再構築をまたいで安定させる。 */
  registerBall: (el: HTMLElement | null) => void
  /** 位置用の外枠とは別に、吸い込み/出現の見た目を持つ内側要素を登録する。 */
  registerBallVisual: (el: HTMLElement | null) => void
  /** 全エリアを含むworldのDOM要素を登録するrefコールバック。カメラtransformを直接書き込む。 */
  registerWorld: (el: HTMLElement | null) => void
  /** Toyの見た目を登録し、spinnerの回転transformを物理フレームごとに直接書き込む。 */
  registerToy: (key: string, el: HTMLElement | null) => void
}

type ExitEntry = { areaId: string; exit: AreaExit }
type LinearVelocity = { x: number; y: number }
type ActiveCannon = {
  label: string
  areaId: string
  cannon: AreaCannon
  startedAt: number
}

/** area objectをworld座標へ置くための変換。ローカル座標を変更しないことが重要。 */
function worldPoint(areaId: string, x: number, y: number) {
  const area = findArea(areaId)
  if (!area) throw new Error(`flag-roll-adventure: 不明なエリアidです: ${areaId}`)
  return { x: area.origin.x + x, y: area.origin.y + y }
}

function toyElementKey(areaId: string, toyId: string): string {
  return `${areaId}:${toyId}`
}

function clampLinearVelocity(velocity: LinearVelocity): LinearVelocity {
  const speed = Math.hypot(velocity.x, velocity.y)
  if (speed <= MAX_SPEED) return velocity
  const factor = MAX_SPEED / speed
  return { x: velocity.x * factor, y: velocity.y * factor }
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

/**
 * matter-jsのEngineだけを動かす。
 * カメラとボールの座標は毎フレームDOMへ直接書き込み、Reactの再レンダーを通さない。
 * 物理世界は全6エリアを最初に生成するが、Engine.updateはrunning/cup-inだけ呼ぶ。
 */
export function useAdventureEngine(options: AdventureEngineOptions): AdventureEngineHandle {
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  })

  const ballElementRef = useRef<HTMLElement | null>(null)
  const ballVisualElementRef = useRef<HTMLElement | null>(null)
  const worldElementRef = useRef<HTMLElement | null>(null)
  const toyElementsRef = useRef<Map<string, HTMLElement | null>>(new Map())

  const handle = useMemo<AdventureEngineHandle>(
    () => ({
      registerBall: (el) => {
        ballElementRef.current = el
      },
      registerBallVisual: (el) => {
        ballVisualElementRef.current = el
      },
      registerWorld: (el) => {
        worldElementRef.current = el
      },
      registerToy: (key, el) => {
        if (el) toyElementsRef.current.set(key, el)
        else toyElementsRef.current.delete(key)
      },
    }),
    [],
  )

  // StrictModeのmount→cleanup→mountで、古いrAFやtimeoutが新しい世界へ混ざらないようにする。
  const activeRunRef = useRef<symbol | null>(null)

  useEffect(() => {
    const runToken = Symbol('adventure-run')
    activeRunRef.current = runToken

    const reducedMotion = prefersReducedMotion()
    const exitSwallowMs = reducedMotion ? 0 : EXIT_SWALLOW_MS
    const cameraTransitionMs = reducedMotion ? 0 : CAMERA_TRANSITION_MS
    const cameraSettleMs = reducedMotion ? 0 : CAMERA_SETTLE_MS
    const entryEmergeMs = reducedMotion ? 0 : ENTRY_EMERGE_MS
    const cupSettleMs = CUP_SETTLE_MS
    const {
      engine,
      ballBody,
      pinByLabel,
      jumpByLabel,
      exitByLabel,
      cupByLabel,
      zoneByLabel,
      toyRuntimes,
      toyByLabel,
    } = createAdventureWorld(Math.random)
    const zoneWorldGeometry = [...zoneByLabel.values()].map((entry) => ({
      zone: entry.zone,
      x: entry.body.position.x,
      y: entry.body.position.y,
      angle: entry.body.angle,
    }))

    const ballElement = ballElementRef.current
    if (ballElement) ballElement.style.visibility = 'visible'

    let currentAreaId = START_AREA_ID
    let motion: 'running' | 'exiting' | 'moving' | 'cannon' | 'cup-in' | 'goal' = 'running'
    let currentCamera = cameraPositionForArea(START_AREA_ID)
    let areaEnteredAt = performance.now()
    let physicsTime = areaEnteredAt
    let stallSince: number | null = null
    let exitLatched = false
    let exitTransition: {
      entry: ExitEntry
      targetAreaId: string
      targetEntry: AreaEntry
      from: { x: number; y: number }
      velocity: LinearVelocity
      startedAt: number
    } | null = null
    let cameraTransition: {
      from: CameraPosition
      to: CameraPosition
      nextAreaId: string
      entry: AreaEntry
      velocity: LinearVelocity
      startedAt: number
    } | null = null
    let settleTimeout: ReturnType<typeof setTimeout> | null = null
    let entryVisualTimeout: ReturnType<typeof setTimeout> | null = null
    let cupInStartedAt: number | null = null
    let goalTimeoutCount = 0
    let goalNotified = false
    let activeCannon: ActiveCannon | null = null
    const cannonLastFiredAt = new Map<string, number>()
    const jumpLastHitAt = new Map<string, number>()
    const jumpUsed = new Set<string>()
    const boostInsideIds = new Set<string>()
    const boostLastNotifiedAt = new Map<string, number>()

    function writeCamera(position: CameraPosition) {
      const worldElement = worldElementRef.current
      if (!worldElement) return
      worldElement.style.transform = `translate(${-position.x}px, ${-position.y}px)`
    }

    function writeBall() {
      const element = ballElementRef.current
      if (!element) return
      const x = ballBody.position.x - BALL_RADIUS
      const y = ballBody.position.y - BALL_RADIUS
      element.style.transform = `translate(${x}px, ${y}px) rotate(${ballBody.angle}rad)`
    }

    function setBallVisualMotion(kind: 'normal' | 'swallow' | 'emerge') {
      const element = ballVisualElementRef.current
      if (!element) return
      element.classList.remove(stageStyles.ballSwallow, stageStyles.ballEmerge)
      if (kind === 'swallow') element.classList.add(stageStyles.ballSwallow)
      if (kind === 'emerge') element.classList.add(stageStyles.ballEmerge)
    }

    function writeAdventureToyVisuals() {
      for (const runtime of toyRuntimes) {
        if (runtime.toy.kind !== 'spinner') continue
        const element = toyElementsRef.current.get(toyElementKey(runtime.areaId, runtime.toy.id))
        if (!element) continue
        element.style.transform = `rotate(${runtime.readVisual().spinRad}rad)`
      }
    }

    function updateAdventureToys(now: number) {
      for (const runtime of toyRuntimes) {
        const ballForToy = motion === 'running' && runtime.areaId === currentAreaId ? ballBody : null
        const event = runtime.update(now, ballForToy)
        if (event) optionsRef.current.onGimmick?.({ kind: event.kind, id: event.id })
      }
      writeAdventureToyVisuals()
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

      const now = performance.now()
      const nextBoostIds = new Set(effects.boostIds)
      for (const boostId of nextBoostIds) {
        if (boostInsideIds.has(boostId)) continue
        const lastNotifiedAt = boostLastNotifiedAt.get(boostId) ?? -Infinity
        if (now - lastNotifiedAt < BOOST_SOUND_COOLDOWN_MS) continue
        boostLastNotifiedAt.set(boostId, now)
        optionsRef.current.onGimmick?.({ kind: 'boost', id: boostId })
      }
      boostInsideIds.clear()
      nextBoostIds.forEach((boostId) => boostInsideIds.add(boostId))
    }

    function captureCannon(entry: AdventureZoneEntry, now: number) {
      if (entry.zone.kind !== 'cannon' || motion !== 'running') return
      const lastFiredAt = cannonLastFiredAt.get(entry.body.label) ?? null
      if (!canRecaptureCannon(activeCannon !== null, lastFiredAt, now)) return
      activeCannon = {
        label: entry.body.label,
        areaId: entry.areaId,
        cannon: entry.zone,
        startedAt: now,
      }
      motion = 'cannon'
      Body.setPosition(ballBody, entry.body.position)
      Body.setVelocity(ballBody, { x: 0, y: 0 })
      Body.setAngularVelocity(ballBody, 0)
      stallSince = null
      optionsRef.current.onGimmick?.({ kind: 'cannon-capture', id: entry.zone.id })
    }

    function fireCannon(now: number) {
      if (!activeCannon) return
      const pending = activeCannon
      const muzzle = getCannonMuzzlePosition(pending.cannon)
      Body.setPosition(ballBody, worldPoint(pending.areaId, muzzle.x, muzzle.y))
      Body.setVelocity(ballBody, getCannonLaunchVelocity(pending.cannon))
      Body.setAngularVelocity(ballBody, 0)
      cannonLastFiredAt.set(pending.label, now)
      activeCannon = null
      motion = 'running'
      stallSince = null
      clampVelocity()
      optionsRef.current.onGimmick?.({ kind: 'cannon-fire', id: pending.cannon.id })
    }

    function updateCannon(now: number) {
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
      if (now - activeCannon.startedAt >= getCannonHoldMs(activeCannon.cannon)) fireCannon(now)
    }

    function applyJumpPad(entry: { areaId: string; jump: AreaJumpPad }, now: number) {
      if (motion !== 'running') return
      const jumpKey = entry.areaId + ':' + entry.jump.id
      if (jumpUsed.has(jumpKey)) return
      const lastHitAt = jumpLastHitAt.get(jumpKey) ?? -Infinity
      if (now - lastHitAt < JUMP_COOLDOWN_MS) return
      Body.setVelocity(ballBody, getJumpLaunchVelocity(entry.jump))
      jumpLastHitAt.set(jumpKey, now)
      jumpUsed.add(jumpKey)
      optionsRef.current.onGimmick?.({ kind: 'jump', id: entry.jump.id })
    }

    function resetBallToAreaEntry(areaId: string, resetVelocity: boolean) {
      const area = findArea(areaId)
      const entry = area?.entries[0]
      if (!area || !entry) return
      const position = worldPoint(areaId, entry.x, entry.y)
      Body.setPosition(ballBody, position)
      if (resetVelocity) {
        Body.setVelocity(ballBody, { x: 0, y: 0 })
        Body.setAngularVelocity(ballBody, 0)
      }
      stallSince = null
      writeBall()
    }

    function resetBallToCupDrop() {
      const area = findArea(currentAreaId)
      const cup = area?.cup
      if (!area || !cup) return
      Body.setPosition(ballBody, worldPoint(currentAreaId, cup.x, cup.rimY - CUP_RESCUE_DROP_HEIGHT))
      Body.setVelocity(ballBody, { x: 0, y: 0 })
      Body.setAngularVelocity(ballBody, 0)
      stallSince = null
      writeBall()
    }

    function placeBallAtCupBottom() {
      const area = findArea(currentAreaId)
      const cup = area?.cup
      if (!area || !cup) return
      Body.setPosition(
        ballBody,
        worldPoint(currentAreaId, cup.x, cup.rimY + CUP_INNER_DEPTH - BALL_RADIUS),
      )
      Body.setVelocity(ballBody, { x: 0, y: 0 })
      Body.setAngularVelocity(ballBody, 0)
      stallSince = null
      writeBall()
    }

    function notifyGoal() {
      if (goalNotified) return
      goalNotified = true
      motion = 'goal'
      cameraTransition = null
      exitTransition = null
      cupInStartedAt = null
      if (settleTimeout !== null) {
        clearTimeout(settleTimeout)
        settleTimeout = null
      }
      if (entryVisualTimeout !== null) {
        clearTimeout(entryVisualTimeout)
        entryVisualTimeout = null
      }
      optionsRef.current.onGoal()
    }

    function beginCupIn(now: number) {
      if (motion !== 'running') return
      motion = 'cup-in'
      cupInStartedAt = now
      stallSince = null
    }

    function finishExit(now: number) {
      if (!exitTransition) return
      const pending = exitTransition
      const position = worldPoint(pending.targetAreaId, pending.targetEntry.x, pending.targetEntry.y)
      Body.setPosition(ballBody, position)
      Body.setVelocity(ballBody, { x: 0, y: 0 })
      Body.setAngularVelocity(ballBody, 0)
      cameraTransition = {
        from: { ...currentCamera },
        to: cameraPositionForArea(pending.targetAreaId),
        nextAreaId: pending.targetAreaId,
        entry: pending.targetEntry,
        velocity: pending.velocity,
        startedAt: now,
      }
      exitTransition = null
      motion = 'moving'
      accumulator = 0
      stallSince = null
    }

    function startExitTransition(entry: ExitEntry, now: number, resetVelocity: boolean) {
      if (motion !== 'running' || exitLatched || entry.areaId !== currentAreaId) return
      const target = resolveExitTarget(entry.areaId, entry.exit.id)
      if (!target) {
        // データ不整合で出口から戻れない場合も、画面を永久に止めない。
        notifyGoal()
        return
      }

      exitLatched = true
      const velocity = resetVelocity
        ? { x: 0, y: 0 }
        : clampLinearVelocity({ x: ballBody.velocity.x, y: ballBody.velocity.y })
      exitTransition = {
        entry,
        targetAreaId: target.areaId,
        targetEntry: target.entry,
        from: { x: ballBody.position.x, y: ballBody.position.y },
        velocity,
        startedAt: now,
      }
      motion = 'exiting'
      if (entryVisualTimeout !== null) {
        clearTimeout(entryVisualTimeout)
        entryVisualTimeout = null
      }
      Body.setVelocity(ballBody, { x: 0, y: 0 })
      Body.setAngularVelocity(ballBody, 0)
      setBallVisualMotion('swallow')
      accumulator = 0
      stallSince = null
      if (exitSwallowMs === 0) finishExit(now)
    }

    function handleExit(entry: ExitEntry, now: number) {
      startExitTransition(entry, now, false)
    }

    const lastPinHitAt = new Map<string, number>()
    let lastPinSoundAt = -Infinity

    function handleCollisionStart(event: Matter.IEventCollision<Matter.Engine>) {
      const now = performance.now()
      for (const pair of event.pairs) {
        const ballIsA = pair.bodyA.label === 'adventure-ball'
        const ballIsB = pair.bodyB.label === 'adventure-ball'
        if (!ballIsA && !ballIsB) continue
        const other = ballIsA ? pair.bodyB : pair.bodyA

        const toy = toyByLabel.get(other.label)
        if (toy?.toy.kind === 'spinner') {
          optionsRef.current.onGimmick?.({ kind: 'spinner-hit', id: toy.toy.id })
        }

        const exit = exitByLabel.get(other.label)
        if (exit) {
          handleExit(exit, now)
          continue
        }

        const jump = jumpByLabel.get(other.label)
        if (jump) {
          applyJumpPad(jump, now)
          continue
        }

        const zone = zoneByLabel.get(other.label)
        if (zone) {
          captureCannon(zone, now)
          continue
        }

        const cup = cupByLabel.get(other.label)
        if (cup) {
          const area = findArea(cup.areaId)
          const rimY = area ? area.origin.y + cup.cup.rimY : Number.POSITIVE_INFINITY
          // センサー接触だけでなく中心の深さも確認し、リムやセンサー上端の接触を除外する。
          if (
            motion === 'running' &&
            cup.areaId === currentAreaId &&
            ballBody.position.y >= rimY + CUP_SENSOR_INSET
          ) {
            beginCupIn(now)
          }
          continue
        }

        const pin = pinByLabel.get(other.label)
        if (!pin || motion !== 'running') continue
        const pinId = pin.pin.id
        const lastHit = lastPinHitAt.get(pinId) ?? -Infinity
        if (now - lastHit < PIN_HIT_COOLDOWN_MS || now - lastPinSoundAt < PIN_SOUND_GLOBAL_COOLDOWN_MS) {
          continue
        }
        lastPinHitAt.set(pinId, now)
        lastPinSoundAt = now
        optionsRef.current.onPinHit(pinId)
      }
    }
    Events.on(engine, 'collisionStart', handleCollisionStart)
    const handleBeforeUpdate = () => updateZoneEffects()
    Events.on(engine, 'beforeUpdate', handleBeforeUpdate)

    let rafId: number | null = null
    let lastFrameTime: number | null = null
    let accumulator = 0

    function finishCameraTransition() {
      if (!cameraTransition || settleTimeout !== null) return
      currentCamera = cameraTransition.to
      writeCamera(currentCamera)
      const pending = cameraTransition
      settleTimeout = setTimeout(() => {
        if (activeRunRef.current !== runToken) return
        settleTimeout = null
        currentAreaId = pending.nextAreaId
        motion = 'running'
        cameraTransition = null
        exitLatched = false
        cupInStartedAt = null
        areaEnteredAt = performance.now()
        lastFrameTime = performance.now()
        accumulator = 0

        const velocity = pending.entry.velocity
          ? clampLinearVelocity(pending.entry.velocity)
          : pending.velocity
        Body.setVelocity(ballBody, velocity)
        Body.setAngularVelocity(ballBody, 0)
        setBallVisualMotion('emerge')
        if (entryVisualTimeout !== null) clearTimeout(entryVisualTimeout)
        entryVisualTimeout = setTimeout(() => {
          if (activeRunRef.current !== runToken) return
          entryVisualTimeout = null
          setBallVisualMotion('normal')
        }, entryEmergeMs)
        optionsRef.current.onAreaEnter(pending.nextAreaId)
      }, cameraSettleMs)
    }

    function updateExit(now: number) {
      if (!exitTransition) return
      const pending = exitTransition
      const progress = exitSwallowMs === 0 ? 1 : Math.min(1, (now - pending.startedAt) / exitSwallowMs)
      const target = worldPoint(pending.entry.areaId, pending.entry.exit.x, pending.entry.exit.y)
      Body.setPosition(ballBody, {
        x: pending.from.x + (target.x - pending.from.x) * progress,
        y: pending.from.y + (target.y - pending.from.y) * progress,
      })
      if (progress >= 1) finishExit(now)
    }

    function updateCamera(now: number) {
      if (!cameraTransition) return
      const progress = cameraTransitionMs === 0 ? 1 : (now - cameraTransition.startedAt) / cameraTransitionMs
      currentCamera = interpolateCameraPosition(cameraTransition.from, cameraTransition.to, progress)
      writeCamera(currentCamera)
      if (progress >= 1) finishCameraTransition()
    }

    function clampVelocity() {
      const velocity = clampLinearVelocity({ x: ballBody.velocity.x, y: ballBody.velocity.y })
      if (velocity.x !== ballBody.velocity.x || velocity.y !== ballBody.velocity.y) Body.setVelocity(ballBody, velocity)
      if (Math.abs(ballBody.angularVelocity) > MAX_ANGULAR_VELOCITY) {
        Body.setAngularVelocity(ballBody, Math.sign(ballBody.angularVelocity) * MAX_ANGULAR_VELOCITY)
      }
    }

    function applyStallNudge(now: number) {
      const area = findArea(currentAreaId)
      const cup = area?.cup
      const localX = area ? ballBody.position.x - area.origin.x : 0
      const localY = area ? ballBody.position.y - area.origin.y : 0
      if (cup && localY >= cup.rimY && Math.abs(localX - cup.x) <= CUP_INNER_WIDTH / 2) {
        // 口の中で速度が落ちるのは詰まりではなく、底へ沈む途中なので人工的に押さない。
        stallSince = null
        return
      }

      const speed = Math.hypot(ballBody.velocity.x, ballBody.velocity.y)
      if (speed < STALL_SPEED_THRESHOLD) {
        if (stallSince === null) {
          stallSince = now
        } else if (now - stallSince >= STALL_DURATION_MS) {
          const direction = Math.random() < 0.5 ? -1 : 1
          Body.setVelocity(ballBody, {
            x: direction * STALL_NUDGE_SPEED,
            y: ballBody.velocity.y - 0.45,
          })
          stallSince = now
        }
      } else {
        stallSince = null
      }
    }

    function applyOutOfBoundsRecovery(now: number) {
      const area = findArea(currentAreaId)
      if (!area) return
      const localX = ballBody.position.x - area.origin.x
      const localY = ballBody.position.y - area.origin.y
      const escaped =
        localX < -OUT_OF_BOUNDS_MARGIN_X ||
        localX > AREA_WIDTH + OUT_OF_BOUNDS_MARGIN_X ||
        localY < -OUT_OF_BOUNDS_MARGIN_Y ||
        localY > AREA_HEIGHT + OUT_OF_BOUNDS_MARGIN_Y
      if (!escaped) return

      if (localY > AREA_HEIGHT + OUT_OF_BOUNDS_MARGIN_Y) {
        if (area.cup) {
          resetBallToCupDrop()
        } else {
          const exit = pickExitForBallX(area, localX)
          if (exit) startExitTransition({ areaId: area.id, exit }, now, true)
          else resetBallToAreaEntry(currentAreaId, true)
        }
        return
      }

      resetBallToAreaEntry(currentAreaId, true)
    }

    function applyAreaTimeout(now: number) {
      if (now - areaEnteredAt < AREA_TIMEOUT_MS || motion !== 'running') return
      const area = findArea(currentAreaId)
      if (!area) return

      if (area.cup) {
        goalTimeoutCount += 1
        if (goalTimeoutCount < GOAL_RESCUE_DROP_LIMIT) {
          resetBallToCupDrop()
          areaEnteredAt = now
        } else {
          placeBallAtCupBottom()
          beginCupIn(now)
          areaEnteredAt = now
        }
        return
      }

      const localX = ballBody.position.x - area.origin.x
      const exit = pickExitForBallX(area, localX)
      if (exit) startExitTransition({ areaId: area.id, exit }, now, true)
      else resetBallToAreaEntry(currentAreaId, true)
    }

    function tick(now: number) {
      if (activeRunRef.current !== runToken) return
      rafId = requestAnimationFrame(tick)

      if (lastFrameTime === null) {
        lastFrameTime = now
        writeCamera(currentCamera)
        writeBall()
        return
      }
      const delta = Math.min(now - lastFrameTime, MAX_FRAME_DELTA_MS)
      lastFrameTime = now
      accumulator += delta

      let substeps = 0
      while ((motion === 'running' || motion === 'cup-in') && accumulator >= STEP_MS && substeps < MAX_SUBSTEPS) {
        physicsTime += STEP_MS
        updateAdventureToys(physicsTime)
        Engine.update(engine, STEP_MS)
        accumulator -= STEP_MS
        substeps += 1
      }
      if (substeps >= MAX_SUBSTEPS) accumulator = 0
      if (motion !== 'running' && motion !== 'cup-in') accumulator = 0

      if (motion === 'exiting') {
        updateExit(now)
      } else if (motion === 'moving') {
        updateCamera(now)
      } else if (motion === 'cannon') {
        updateCannon(now)
      } else if (motion === 'running') {
        clampVelocity()
        applyStallNudge(now)
        applyOutOfBoundsRecovery(now)
        applyAreaTimeout(now)
      } else if (motion === 'cup-in') {
        clampVelocity()
        if (cupInStartedAt !== null && now - cupInStartedAt >= cupSettleMs) notifyGoal()
      }

      writeBall()
    }

    setBallVisualMotion('normal')
    writeCamera(currentCamera)
    writeBall()
    writeAdventureToyVisuals()
    optionsRef.current.onBallLaunched?.()
    rafId = requestAnimationFrame(tick)

    return () => {
      if (activeRunRef.current === runToken) activeRunRef.current = null
      if (rafId !== null) cancelAnimationFrame(rafId)
      if (settleTimeout !== null) clearTimeout(settleTimeout)
      if (entryVisualTimeout !== null) clearTimeout(entryVisualTimeout)
      Events.off(engine, 'collisionStart', handleCollisionStart)
      Events.off(engine, 'beforeUpdate', handleBeforeUpdate)
      Composite.clear(engine.world, false)
      Engine.clear(engine)
      setBallVisualMotion('normal')
      const element = ballElementRef.current
      if (element) element.style.visibility = 'hidden'
    }
  }, [options.runId])

  return handle
}
