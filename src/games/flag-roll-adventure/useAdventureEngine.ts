import { useEffect, useMemo, useRef } from 'react'
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
  ENTRY_EMERGE_MS,
  GRAVITY,
  GOAL_RESCUE_DROP_LIMIT,
  MAX_ANGULAR_VELOCITY,
  MAX_FRAME_DELTA_MS,
  MAX_SPEED,
  MAX_SUBSTEPS,
  OUT_OF_BOUNDS_MARGIN_X,
  OUT_OF_BOUNDS_MARGIN_Y,
  OUTER_WALL_THICKNESS,
  PIN_FRICTION,
  PIN_HIT_COOLDOWN_MS,
  PIN_RESTITUTION,
  PIN_SOUND_GLOBAL_COOLDOWN_MS,
  START,
  STALL_DURATION_MS,
  STALL_NUDGE_SPEED,
  STALL_SPEED_THRESHOLD,
  STEP_MS,
  WALL_FRICTION,
  WALL_RESTITUTION,
} from './adventurePhysics'
import { AREAS, findArea, pickExitForBallX, resolveExitTarget, START_AREA_ID } from './data/areas'
import stageStyles from './AdventureStage.module.css'
import { cameraPositionForArea, interpolateCameraPosition, type CameraPosition } from './camera'
import { areaGroundRects, cupBottomRect, cupSensorRect, type AdventureRect } from './adventureGeometry'
import type { AreaCup, AreaEntry, AreaExit, AreaPin, AreaWall } from './types'

const { Engine, Bodies, Body, Composite, Events } = Matter

export type AdventureEngineOptions = {
  /** プレイの世代。値が変わったら物理世界を作り直して最初から始める。 */
  runId: number
  /** カメラ移動と物理再開が完了し、次エリアへ入ったときに一度だけ呼ぶ。 */
  onAreaEnter: (areaId: string) => void
  /** カップイン後の沈み込みが終わったときに呼ぶ。 */
  onGoal: () => void
  /** ピン衝突の演出用通知。物理の軌道をReact stateで描画しないための軽いイベント。 */
  onPinHit: (pinId: string) => void
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
}

type ExitEntry = { areaId: string; exit: AreaExit }
type CupEntry = { areaId: string; cup: AreaCup }
type LinearVelocity = { x: number; y: number }

/** area objectをworld座標へ置くための変換。ローカル座標を変更しないことが重要。 */
function worldPoint(areaId: string, x: number, y: number) {
  const area = findArea(areaId)
  if (!area) throw new Error(`flag-roll-adventure: 不明なエリアidです: ${areaId}`)
  return { x: area.origin.x + x, y: area.origin.y + y }
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

/** 出口・カップ以外の下抜けを防ぐ床。開口だけを残すので、外側へ落ちたときも通常は救済に頼らない。 */
function createRectBody(areaId: string, rect: AdventureRect, options: Matter.IChamferableBodyDefinition): Matter.Body {
  const center = worldPoint(areaId, rect.left + rect.width / 2, rect.top + rect.height / 2)
  return Bodies.rectangle(center.x, center.y, rect.width, rect.height, options)
}

/** ゴールの地面はカップのリムから続く左右の塊にし、見た目と内側の側壁を同じ矩形から作る。 */
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
  const common = {
    isStatic: true,
    restitution: CUP_RESTITUTION,
    friction: CUP_FRICTION,
  }
  const bottom = createRectBody(area.id, cupBottomRect(cup), {
    ...common,
    label: `cup-bottom:${area.id}:${cup.id}`,
  })

  // センサー上端を「判定線+ボール半径」まで下げることで、球の中心が判定線を越えてから衝突が始まる。
  const sensor = createRectBody(area.id, cupSensorRect(cup), {
    isStatic: true,
    isSensor: true,
    label: `cup-sensor:${area.id}:${cup.id}`,
  })
  cupByLabel.set(sensor.label, { areaId: area.id, cup })
  return [bottom, sensor]
}

/**
 * matter-jsのEngineだけを動かす。
 * カメラとボールの座標は毎フレームDOMへ直接書き込み、Reactの再レンダーを通さない。
 * 物理世界は全4エリアを最初に生成するが、Engine.updateはrunning/cup-inだけ呼ぶ。
 */
export function useAdventureEngine(options: AdventureEngineOptions): AdventureEngineHandle {
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  })

  const ballElementRef = useRef<HTMLElement | null>(null)
  const ballVisualElementRef = useRef<HTMLElement | null>(null)
  const worldElementRef = useRef<HTMLElement | null>(null)

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
    }),
    [],
  )

  // StrictModeのmount→cleanup→mountで、古いrAFやtimeoutが新しい世界へ混ざらないようにする。
  const activeRunRef = useRef<symbol | null>(null)

  useEffect(() => {
    const runToken = Symbol('adventure-run')
    activeRunRef.current = runToken

    const startArea = findArea(START_AREA_ID)
    const startEntry = startArea?.entries[0]
    if (!startArea || !startEntry) {
      throw new Error(`flag-roll-adventure: START_AREA_IDまたは既定入口が見つかりません: ${START_AREA_ID}`)
    }

    const reducedMotion = prefersReducedMotion()
    const exitSwallowMs = reducedMotion ? 0 : EXIT_SWALLOW_MS
    const cameraTransitionMs = reducedMotion ? 0 : CAMERA_TRANSITION_MS
    const cameraSettleMs = reducedMotion ? 0 : CAMERA_SETTLE_MS
    const entryEmergeMs = reducedMotion ? 0 : ENTRY_EMERGE_MS
    const cupSettleMs = CUP_SETTLE_MS
    const engine = Engine.create({ gravity: { ...GRAVITY } })

    // 外壁はコースの面白さを表すarea dataへ混ぜず、全エリアで共通の安全柵として生成する。
    const outerWalls = AREAS.flatMap((area) => {
      const left = Bodies.rectangle(
        area.origin.x,
        area.origin.y + AREA_HEIGHT / 2,
        OUTER_WALL_THICKNESS,
        AREA_HEIGHT,
        { isStatic: true, restitution: WALL_RESTITUTION, friction: WALL_FRICTION, label: `outer-left:${area.id}` },
      )
      const right = Bodies.rectangle(
        area.origin.x + AREA_WIDTH,
        area.origin.y + AREA_HEIGHT / 2,
        OUTER_WALL_THICKNESS,
        AREA_HEIGHT,
        { isStatic: true, restitution: WALL_RESTITUTION, friction: WALL_FRICTION, label: `outer-right:${area.id}` },
      )
      const top =
        area.id === START_AREA_ID
          ? [
              Bodies.rectangle(
                area.origin.x + AREA_WIDTH / 2,
                area.origin.y,
                AREA_WIDTH,
                OUTER_WALL_THICKNESS,
                { isStatic: true, restitution: WALL_RESTITUTION, friction: WALL_FRICTION, label: `outer-top:${area.id}` },
              ),
            ]
          : []
      return [left, right, ...top]
    })

    const wallBodies: Matter.Body[] = []
    const pinBodies: Matter.Body[] = []
    const pinByLabel = new Map<string, AreaPin>()
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
          const label = `pin:${area.id}:${pin.id}`
          pinBodies.push(
            Bodies.circle(point.x, point.y, pin.radius, {
              isStatic: true,
              restitution: pin.restitution ?? PIN_RESTITUTION,
              friction: PIN_FRICTION,
              label,
            }),
          )
          pinByLabel.set(label, pin)
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
      startEntry.x + (Math.random() * 2 - 1) * START.jitterX,
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
      x: START.minVx + Math.random() * (START.maxVx - START.minVx),
      y: START.minVy + Math.random() * (START.maxVy - START.minVy),
    })
    Composite.add(engine.world, ballBody)

    const ballElement = ballElementRef.current
    if (ballElement) ballElement.style.visibility = 'visible'

    let currentAreaId = START_AREA_ID
    let motion: 'running' | 'exiting' | 'moving' | 'cup-in' | 'goal' = 'running'
    let currentCamera = cameraPositionForArea(START_AREA_ID)
    let areaEnteredAt = performance.now()
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

        const exit = exitByLabel.get(other.label)
        if (exit) {
          handleExit(exit, now)
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
        const lastHit = lastPinHitAt.get(pin.id) ?? -Infinity
        if (now - lastHit < PIN_HIT_COOLDOWN_MS || now - lastPinSoundAt < PIN_SOUND_GLOBAL_COOLDOWN_MS) {
          continue
        }
        lastPinHitAt.set(pin.id, now)
        lastPinSoundAt = now
        optionsRef.current.onPinHit(pin.id)
      }
    }
    Events.on(engine, 'collisionStart', handleCollisionStart)

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
    optionsRef.current.onBallLaunched?.()
    rafId = requestAnimationFrame(tick)

    return () => {
      if (activeRunRef.current === runToken) activeRunRef.current = null
      if (rafId !== null) cancelAnimationFrame(rafId)
      if (settleTimeout !== null) clearTimeout(settleTimeout)
      if (entryVisualTimeout !== null) clearTimeout(entryVisualTimeout)
      Events.off(engine, 'collisionStart', handleCollisionStart)
      Composite.clear(engine.world, false)
      Engine.clear(engine)
      setBallVisualMotion('normal')
      const element = ballElementRef.current
      if (element) element.style.visibility = 'hidden'
    }
  }, [options.runId])

  return handle
}
