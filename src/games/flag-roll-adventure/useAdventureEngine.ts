import { useEffect, useMemo, useRef } from 'react'
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
import { AREAS, findArea, START_AREA_ID } from './data/areas'
import { cameraPositionForArea, interpolateCameraPosition, type CameraPosition } from './camera'
import type { AreaExit, AreaPin, AreaWall } from './types'

const { Engine, Bodies, Body, Composite, Events } = Matter

export type AdventureEngineOptions = {
  /** プレイの世代。値が変わったら物理世界を作り直して最初から始める。 */
  runId: number
  /** カメラ移動と物理再開が完了し、次エリアへ入ったときに一度だけ呼ぶ。 */
  onAreaEnter: (areaId: string) => void
  /** ゴールセンサーに入った、または最終エリアのタイムアウト救済が発動したときに呼ぶ。 */
  onGoal: () => void
  /** ピン衝突の演出用通知。物理の軌道をReact stateで描画しないための軽いイベント。 */
  onPinHit: (pinId: string) => void
  /** 最初のボールをワールドへ追加したときの効果音用通知。 */
  onBallLaunched?: () => void
}

export type AdventureEngineHandle = {
  /** 1球のDOM要素を登録するrefコールバック。参照は世界の再構築をまたいで安定させる。 */
  registerBall: (el: HTMLElement | null) => void
  /** 全エリアを含むworldのDOM要素を登録するrefコールバック。カメラtransformを直接書き込む。 */
  registerWorld: (el: HTMLElement | null) => void
}

type ExitEntry = { areaId: string; exit: AreaExit }

/** area objectをworld座標へ置くための変換。ローカル座標を変更しないことが重要。 */
function worldPoint(areaId: string, x: number, y: number) {
  const area = findArea(areaId)
  if (!area) throw new Error(`flag-roll-adventure: 不明なエリアidです: ${areaId}`)
  return { x: area.origin.x + x, y: area.origin.y + y }
}

/**
 * matter-jsのEngineだけをヘッドレスで動かす。
 * カメラとボールの座標は毎フレームDOMへ直接書き込み、Reactの再レンダーを通さない。
 * 物理世界は全4エリアを最初に生成するが、Engine.updateは現在エリアを走行中のときだけ呼ぶ。
 */
export function useAdventureEngine(options: AdventureEngineOptions): AdventureEngineHandle {
  // コールバックは画面のstate更新で毎回新しい関数になりうる。
  // effectの依存に入れると世界が作り直されるため、コミット後にrefへ同期して最新値を読む。
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  })

  const ballElementRef = useRef<HTMLElement | null>(null)
  const worldElementRef = useRef<HTMLElement | null>(null)

  // register関数はref callbackのidentityを安定させる。毎レンダーで別関数にすると、
  // 物理effectの途中でDOM登録が外れ、直接transformを書く先を失うことがある。
  const handle = useMemo<AdventureEngineHandle>(
    () => ({
      registerBall: (el) => {
        ballElementRef.current = el
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
    if (!startArea) throw new Error(`flag-roll-adventure: START_AREA_IDが見つかりません: ${START_AREA_ID}`)

    const engine = Engine.create({ gravity: { ...GRAVITY } })

    // --- 全エリアの静的ボディ -------------------------------------------------
    // 外壁は面白さを表すarea dataへ混ぜず、全エリアで共通の安全柵としてここで生成する。
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
      // 上壁はスタートだけに置く。他エリアは入口から直接ボールを置くため、
      // 上へ戻る壁を置くとカメラ移動後に入口で跳ね返りやすくなる。
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

    // 出口は全エリア分を先に作る。ボールがいるエリアの出口だけをイベント側で受け付けるため、
    // 分岐を追加しても「どのエリアのセンサーか」をlabelで解決できる。
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

    // --- ボール -------------------------------------------------------------
    // 入口のclearance内にはデータ障害物を置かない。中心をclearance+半径に置くことで、
    // ボールの外周も障害物のない区間に収まり、カメラ移動直後に詰まらない。
    // 開始位置と初速を少し揺らすことで、毎回まったく同じ映像になるのを防ぐ。
    const initialPosition = worldPoint(
      START_AREA_ID,
      START.x + (Math.random() * 2 - 1) * START.jitterX,
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
      x: START.minVx + Math.random() * (START.maxVx - START.minVx),
      y: START.minVy + Math.random() * (START.maxVy - START.minVy),
    })
    Composite.add(engine.world, ballBody)

    const ballElement = ballElementRef.current
    if (ballElement) {
      ballElement.style.visibility = 'visible'
    }

    let currentAreaId = START_AREA_ID
    let motion: 'running' | 'moving' | 'goal' = 'running'
    let currentCamera = cameraPositionForArea(START_AREA_ID)
    let areaEnteredAt = performance.now()
    let stallSince: number | null = null
    let transition: { from: CameraPosition; to: CameraPosition; nextAreaId: string; startedAt: number } | null = null
    let settleTimeout: ReturnType<typeof setTimeout> | null = null
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

    function resetBallToAreaEntry(areaId: string, resetVelocity: boolean) {
      const area = findArea(areaId)
      if (!area) return
      const position = worldPoint(areaId, AREA_WIDTH / 2, AREA_ENTRY_CLEARANCE + BALL_RADIUS)
      Body.setPosition(ballBody, position)
      if (resetVelocity) {
        Body.setVelocity(ballBody, { x: 0, y: 0 })
        Body.setAngularVelocity(ballBody, 0)
      }
      stallSince = null
      writeBall()
    }

    function notifyGoal() {
      if (goalNotified) return
      goalNotified = true
      motion = 'goal'
      transition = null
      if (settleTimeout !== null) {
        clearTimeout(settleTimeout)
        settleTimeout = null
      }
      optionsRef.current.onGoal()
    }

    function startAreaTransition(nextAreaId: string, resetVelocity: boolean, now: number) {
      if (motion !== 'running') return
      const nextArea = findArea(nextAreaId)
      if (!nextArea) {
        // area dataの不整合を黙って進めず、ゲームをゴール扱いにして終了保証を守る。
        notifyGoal()
        return
      }

      motion = 'moving'
      transition = {
        from: { ...currentCamera },
        to: cameraPositionForArea(nextAreaId),
        nextAreaId,
        startedAt: now,
      }
      // カメラ移動中はEngine.updateを呼ばない。ボールを次の入口へ置くだけにし、
      // 通常遷移では速度を保持して、再開時に「続きから転がる」ようにする。
      resetBallToAreaEntry(nextAreaId, resetVelocity)
      // 移動中に溜まった実時間を再開時にまとめて消化すると急に走り出すため、累積を捨てる。
      accumulator = 0
      stallSince = null
    }

    function handleExit(entry: ExitEntry, now: number) {
      if (motion !== 'running' || entry.areaId !== currentAreaId) return
      if (entry.exit.to === null) {
        notifyGoal()
        return
      }
      startAreaTransition(entry.exit.to, false, now)
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
      if (!transition || settleTimeout !== null) return
      currentCamera = transition.to
      writeCamera(currentCamera)
      const nextAreaId = transition.nextAreaId
      settleTimeout = setTimeout(() => {
        if (activeRunRef.current !== runToken) return
        settleTimeout = null
        currentAreaId = nextAreaId
        motion = 'running'
        transition = null
        areaEnteredAt = performance.now()
        lastFrameTime = performance.now()
        accumulator = 0
        optionsRef.current.onAreaEnter(nextAreaId)
      }, CAMERA_SETTLE_MS)
    }

    function updateCamera(now: number) {
      if (!transition) return
      const progress = (now - transition.startedAt) / CAMERA_TRANSITION_MS
      currentCamera = interpolateCameraPosition(transition.from, transition.to, progress)
      writeCamera(currentCamera)
      if (progress >= 1) finishCameraTransition()
    }

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

    function applyStallNudge(now: number) {
      const speed = Math.hypot(ballBody.velocity.x, ballBody.velocity.y)
      if (speed < STALL_SPEED_THRESHOLD) {
        if (stallSince === null) {
          stallSince = now
        } else if (now - stallSince >= STALL_DURATION_MS) {
          const direction = Math.random() < 0.5 ? -1 : 1
          // Body.applyForceはdeltaの二乗が掛かり、狙った「軽い押し」が過大になりやすい。
          // setVelocityなら1.8px/stepをそのまま与えられるので、ワープ感のないナッジになる。
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
        // ゴールの出口は中央120pxだけなので、床のない外側へ落ちても空白を作らない。
        // 下へ落ちた場合は、このエリアの出口へ進めるか、出口がゴールなら即時終了する。
        const exit = area.exits[0]
        if (!exit || exit.to === null) {
          notifyGoal()
        } else {
          startAreaTransition(exit.to, true, now)
        }
        return
      }

      resetBallToAreaEntry(currentAreaId, true)
    }

    function applyAreaTimeout(now: number) {
      if (now - areaEnteredAt < AREA_TIMEOUT_MS || motion !== 'running') return
      const area = findArea(currentAreaId)
      const exit = area?.exits[0]
      if (!exit) {
        notifyGoal()
        return
      }
      if (exit.to === null) {
        notifyGoal()
        return
      }
      // タイムアウトは「最初の出口へ到達した」とみなす。速度を0へ戻して入口へ置くので、
      // 通常遷移の速度保持とは違い、詰まりからのワープが不自然に連鎖しない。
      startAreaTransition(exit.to, true, now)
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
      while (motion === 'running' && accumulator >= STEP_MS && substeps < MAX_SUBSTEPS) {
        Engine.update(engine, STEP_MS)
        accumulator -= STEP_MS
        substeps += 1
      }
      if (substeps >= MAX_SUBSTEPS) accumulator = 0
      if (motion !== 'running') accumulator = 0

      if (motion === 'moving') {
        updateCamera(now)
      } else if (motion === 'running') {
        clampVelocity()
        applyStallNudge(now)
        applyOutOfBoundsRecovery(now)
        applyAreaTimeout(now)
      }

      writeBall()
    }

    writeCamera(currentCamera)
    writeBall()
    optionsRef.current.onBallLaunched?.()
    rafId = requestAnimationFrame(tick)

    return () => {
      if (activeRunRef.current === runToken) activeRunRef.current = null
      if (rafId !== null) cancelAnimationFrame(rafId)
      if (settleTimeout !== null) clearTimeout(settleTimeout)
      Events.off(engine, 'collisionStart', handleCollisionStart)
      Composite.clear(engine.world, false)
      Engine.clear(engine)
      const element = ballElementRef.current
      if (element) element.style.visibility = 'hidden'
    }
  }, [options.runId])

  return handle
}
