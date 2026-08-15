import { useEffect, useMemo, useRef } from 'react'
import * as Matter from 'matter-js'
import {
  BALL_RADIUS,
  BOARD_WIDTH,
  LAUNCH,
  OBSTACLES,
  SCORE_ZONES,
  ZONE_DIVIDER_WIDTH,
  ZONE_DIVIDERS,
  launchDelaysMs,
  wallsForMode,
  zoneAtX,
  type ScoreZone,
} from './boardLayout'
import {
  BALL_DENSITY,
  BALL_FRICTION,
  BALL_FRICTION_AIR,
  BALL_RESTITUTION,
  GRAVITY,
  MAX_ANGULAR_VELOCITY,
  MAX_FRAME_DELTA_MS,
  MAX_SPEED,
  MAX_SUBSTEPS,
  OBSTACLE_FRICTION,
  OBSTACLE_HIT_COOLDOWN_MS,
  OBSTACLE_SOUND_GLOBAL_COOLDOWN_MS,
  OUT_OF_BOUNDS_MARGIN_X,
  OUT_OF_BOUNDS_Y,
  SAFETY_TIMEOUT_MS,
  SCORED_BALL_REMOVAL_TIMEOUT_MS,
  STALL_DURATION_MS,
  STALL_NUDGE_SPEED,
  STALL_SPEED_THRESHOLD,
  STEP_MS,
  WALL_FRICTION,
  ZONE_SENSOR_HEIGHT,
  ZONE_SENSOR_Y,
} from './pinballPhysics'
import { createToyRuntime } from './toyRuntime'
import type { ToyBall, ToyRuntime } from './toyRuntime'
import { TOYS } from './toyLayout'
import type { PinballMode } from './types'

const { Engine, Bodies, Body, Composite, Events } = Matter

export type PinballEngineOptions = {
  /** 選択された flagId。配列の並び順が ballIndex（0..flagIds.length-1）になる */
  flagIds: readonly string[]
  /** 遊びかた。壁の構成・射出間隔・終了判定がモードごとに変わる */
  mode: PinballMode
  /** プレイの世代。値が変わったら物理世界を作り直して最初から射出する（「もういちど」用） */
  runId: number
  /** 1球の得点が確定したとき（同じ ballIndex では必ず一度だけ呼ぶ） */
  onBallScored: (ballIndex: number, zone: ScoreZone) => void
  /** バンパー／ピンにボールが当たったとき（演出用）。obstacleId は OBSTACLES の id */
  onObstacleHit: (obstacleId: string) => void
  /** 1球が射出されたとき（効果音用） */
  onBallLaunched: (ballIndex: number) => void
  /** 射出予定の全球が settled（後述）になったとき（必ず一度だけ呼ぶ） */
  onFinished: () => void
}

export type PinballEngineHandle = {
  /** ボールの DOM 要素を ballIndex ごとに登録する ref コールバック（参照は安定させること） */
  registerBall: (ballIndex: number) => (el: HTMLElement | null) => void
  /** おもちゃの見た目を持つ DOM 要素を toyId ごとに登録する ref コールバック */
  registerToy: (toyId: string) => (el: HTMLElement | null) => void
  /** アクティブな物理世界のおもちゃを発動する */
  activateToy: (toyId: string) => void
}

/** ball-N ラベルからボールの ballIndex を取り出す。ボール以外のラベルは null */
function ballIndexFromLabel(label: string): number | null {
  if (!label.startsWith('ball-')) return null
  const index = Number(label.slice('ball-'.length))
  return Number.isNaN(index) ? null : index
}

/**
 * matter-js の Engine だけをヘッドレスで動かす（Matter.Render は使わない）。
 * 描画は呼び出し側の DOM 要素へ毎フレーム直接 transform を書き込む方式にして、
 * React の再レンダーを介さないことで、3球が同時に動く間もフレーム落ちしにくくする。
 */
export function usePinballEngine(options: PinballEngineOptions): PinballEngineHandle {
  // onBallScored などのコールバックは呼び出し側の再レンダーのたびに新しい関数になりうる。
  // これを物理世界を作る useEffect の依存に入れると、毎レンダーで世界が作り直されて
  // ボールが射出し直されてしまうため、ref に格納して effect の外から常に最新値を読む。
  // ref への書き込みは render中に行わず（react-hooks/refs）、useQuestionSpeech と同様に
  // 依存配列なしの useEffect で「毎コミット後に同期する」形にする。
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  })

  // ボールの DOM 要素。registerBall はランタイム（世界の再構築）をまたいで同じ要素を指し続ける
  // ため、物理エフェクトの依存には含めない（実行のたびに作り直さない）。
  const ballElementsRef = useRef<Map<number, HTMLElement | null>>(new Map())
  const registerBallFnsRef = useRef<Map<number, (el: HTMLElement | null) => void>>(new Map())
  const toyElementsRef = useRef<Map<string, HTMLElement | null>>(new Map())
  const registerToyFnsRef = useRef<Map<string, (el: HTMLElement | null) => void>>(new Map())
  const toyRuntimesRef = useRef<Map<string, ToyRuntime>>(new Map())
  // 物理エフェクトのcleanup後に残ったタップから、古いランタイムを発動させないためのトークン。
  const activeRunRef = useRef<symbol | null>(null)
  // registerBall は呼び出し側（PinballBoard）へ渡す安定した参照。useMemo の初期化子は
  // ref を「あとで読む関数」を作るだけで .current を読まないため、render中のref読み取り
  // 禁止ルールには抵触しない。
  const handle = useMemo<PinballEngineHandle>(
    () => ({
      registerBall: (ballIndex: number) => {
        const existing = registerBallFnsRef.current.get(ballIndex)
        if (existing) return existing
        const fn = (el: HTMLElement | null) => {
          ballElementsRef.current.set(ballIndex, el)
        }
        registerBallFnsRef.current.set(ballIndex, fn)
        return fn
      },
      registerToy: (toyId: string) => {
        const existing = registerToyFnsRef.current.get(toyId)
        if (existing) return existing
        const fn = (el: HTMLElement | null) => {
          toyElementsRef.current.set(toyId, el)
        }
        registerToyFnsRef.current.set(toyId, fn)
        return fn
      },
      activateToy: (toyId: string) => {
        if (activeRunRef.current === null) return
        const runtime = toyRuntimesRef.current.get(toyId)
        if (!runtime) return
        runtime.activate(performance.now())
      },
    }),
    [],
  )

  // flagIds の「内容」が変わったときだけ作り直したいので、配列参照ではなく内容を依存に使う
  // （選択画面から同じ3件がそのまま渡ってくる場合に不要な再構築をしないため）。
  const flagIdsKey = options.flagIds.join(',')

  useEffect(() => {
    const runToken = Symbol('pinball-run')
    activeRunRef.current = runToken

    const mode = options.mode

    // ballCount は flagIdsKey（=このeffectの依存）から求める。
    // options.flagIds.length を直接使うと react-hooks/exhaustive-deps が
    // options.flagIds 自体を依存に求めてしまい、内容が同じでも配列参照が変わるたびに
    // 世界が作り直される事態になるため、依存に入れている flagIdsKey から導出する。
    const ballCount = flagIdsKey === '' ? 0 : flagIdsKey.split(',').length

    const engine = Engine.create({ gravity: { ...GRAVITY } })

    // --- 静的な壁（外壁・ガイド壁・ゾーン仕切り）。壁の構成はモードで変える -------
    // （全射出モードは得点ゾーン通過後のボールをそのまま盤外へ落として消すため、床を置かない）
    const wallBodies = [...wallsForMode(mode), ...ZONE_DIVIDERS].map((wall) =>
      Bodies.rectangle(wall.x, wall.y, wall.width, wall.height, {
        isStatic: true,
        angle: wall.angle,
        restitution: wall.restitution,
        friction: WALL_FRICTION,
      }),
    )

    // --- 静的な障害物（バンパー・ピン）。label に id を入れて衝突時に識別する ---
    const obstacleBodies = OBSTACLES.map((obstacle) =>
      Bodies.circle(obstacle.x, obstacle.y, obstacle.radius, {
        isStatic: true,
        restitution: obstacle.restitution,
        friction: OBSTACLE_FRICTION,
        label: obstacle.id,
      }),
    )
    const obstacleIds = new Set(OBSTACLES.map((obstacle) => obstacle.id))

    // --- 得点ゾーンのセンサー。label にゾーンidを入れる ---------------------
    const zoneSensors = SCORE_ZONES.map((zone) =>
      Bodies.rectangle(
        zone.x + zone.width / 2,
        ZONE_SENSOR_Y,
        zone.width - ZONE_DIVIDER_WIDTH,
        ZONE_SENSOR_HEIGHT,
        { isStatic: true, isSensor: true, label: zone.id },
      ),
    )
    const zoneById = new Map(SCORE_ZONES.map((zone) => [zone.id, zone]))

    Composite.add(engine.world, [...wallBodies, ...obstacleBodies, ...zoneSensors])

    // おもちゃの物理Bodyとランタイムを同じ世界へ登録する。ランタイムの種類分岐は
    // createToyRuntimeに閉じ込め、エンジン側は共通インターフェースだけを扱う。
    const toyRuntimes = TOYS.map(createToyRuntime)
    const toyRuntimeMap = toyRuntimesRef.current
    toyRuntimeMap.clear()
    for (const runtime of toyRuntimes) {
      toyRuntimeMap.set(runtime.placement.id, runtime)
    }
    Composite.add(engine.world, toyRuntimes.flatMap((runtime) => runtime.bodies))

    // --- ボール本体。最初はワールドに追加せず、時間差射出のタイミングで追加する ---
    const ballBodies: Matter.Body[] = []
    for (let i = 0; i < ballCount; i += 1) {
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
    const toyBallEntries: readonly ToyBall[] = ballBodies.map((body, ballIndex) => ({
      ballIndex,
      body,
    }))
    const activeToyBalls: ToyBall[] = []

    const launched = ballBodies.map(() => false)
    const scored = ballBodies.map(() => false)
    // 得点確定後に画面外へ落として World から削除した球かどうか。全射出モードの終了判定
    // （settled = scored && removed）と、削除済み球を以降の処理から完全に除外するために使う。
    const removed = ballBodies.map(() => false)
    // settled（後述の isSettled）に達したことを1度だけ数えるためのガード。
    const settled = ballBodies.map(() => false)
    const launchedAt = ballBodies.map(() => 0)
    const scoredAt = ballBodies.map(() => 0)
    const stallSince: (number | null)[] = ballBodies.map(() => null)
    let launchedCount = 0
    let settledCount = 0
    let finished = false

    // 射出前は見えない状態にしておく（射出時に visible へ切り替える）
    for (let i = 0; i < ballCount; i += 1) {
      const el = ballElementsRef.current.get(i)
      if (el) el.style.visibility = 'hidden'
    }

    // --- 時間差射出 -----------------------------------------------------
    const timeoutIds: ReturnType<typeof setTimeout>[] = []
    launchDelaysMs(mode, ballCount).forEach((delay, ballIndex) => {
      const timeoutId = setTimeout(() => {
        if (activeRunRef.current !== runToken) return
        const body = ballBodies[ballIndex]
        const jitter = (Math.random() * 2 - 1) * LAUNCH.jitterX
        Body.setPosition(body, { x: LAUNCH.x + jitter, y: LAUNCH.y })
        Body.setVelocity(body, {
          x: LAUNCH.minVx + Math.random() * (LAUNCH.maxVx - LAUNCH.minVx),
          y: LAUNCH.minVy + Math.random() * (LAUNCH.maxVy - LAUNCH.minVy),
        })
        Composite.add(engine.world, body)
        launched[ballIndex] = true
        launchedCount += 1
        launchedAt[ballIndex] = performance.now()
        const el = ballElementsRef.current.get(ballIndex)
        if (el) el.style.visibility = 'visible'
        optionsRef.current.onBallLaunched(ballIndex)
      }, delay)
      timeoutIds.push(timeoutId)
    })

    /**
     * ballIndex の「これ以上プレイに関与しない」状態（settled）を判定する。
     * 通常モードは得点確定がそのままプレイ終了（床の上に球が残る現在の見た目を維持するため、
     * removed は終了条件に含めない）。全射出モードは得点確定に加えて盤外へ削除されるまでを待つ
     * （得点ゾーン通過後は床がなく、削除されるまで盤面上に残り続けるため）。
     */
    function isSettled(ballIndex: number): boolean {
      return mode === 'allFlags' ? scored[ballIndex] && removed[ballIndex] : scored[ballIndex]
    }

    /**
     * settled になったボールを1度だけ数え、射出予定の全球が settled になったら onFinished を呼ぶ。
     * 「射出済みの球すべてが settled」だけでなく「射出予定の全球が射出済み」も条件にすることで、
     * 射出間隔が長い全射出モードで終盤の球がまだ射出待ちのうちに終了してしまわないようにする。
     */
    function maybeSettle(ballIndex: number) {
      if (settled[ballIndex]) return
      if (!isSettled(ballIndex)) return
      settled[ballIndex] = true
      settledCount += 1
      if (!finished && launchedCount === ballCount && settledCount === ballCount) {
        finished = true
        optionsRef.current.onFinished()
      }
    }

    /** ballIndex の得点を確定する。二重確定を防ぐゲートを兼ねる（この関数は絶対に緩めないこと） */
    function finalizeBall(ballIndex: number, zone: ScoreZone) {
      if (scored[ballIndex]) return
      scored[ballIndex] = true
      scoredAt[ballIndex] = performance.now()
      optionsRef.current.onBallScored(ballIndex, zone)
      maybeSettle(ballIndex)
    }

    /**
     * 得点確定済みの ballIndex を World から取り除き、DOM 上でも隠す。
     * 全射出モードで得点ゾーン通過後のボールを盤面から消すための処理（通常モードでは
     * 床(wall-bottom)があるため、盤外脱出の救済ルート以外でこの経路に入ることは実質ない）。
     */
    function removeBall(ballIndex: number) {
      if (removed[ballIndex]) return
      removed[ballIndex] = true
      Composite.remove(engine.world, ballBodies[ballIndex])
      const el = ballElementsRef.current.get(ballIndex)
      if (el) el.style.visibility = 'hidden'
      maybeSettle(ballIndex)
    }

    // --- 衝突判定 ---------------------------------------------------------
    const lastObstacleHitAt = new Map<string, number>()
    let lastObstacleSoundAt = -Infinity

    function handleCollisionStart(event: Matter.IEventCollision<Matter.Engine>) {
      const now = performance.now()
      for (const pair of event.pairs) {
        const ballA = ballIndexFromLabel(pair.bodyA.label)
        const ballB = ballIndexFromLabel(pair.bodyB.label)
        // ボールが関わらない組み合わせ（壁とバンパーなど）は無視する
        if (ballA === null && ballB === null) continue
        const ballIndex = ballA ?? ballB
        const other = ballA !== null ? pair.bodyB : pair.bodyA
        if (ballIndex === null) continue
        // ボール同士の衝突は matter-js の物理演算に任せるだけでよく、特別な処理はしない
        if (ballIndexFromLabel(other.label) !== null) continue

        const zone = zoneById.get(other.label)
        if (zone) {
          finalizeBall(ballIndex, zone)
          continue
        }

        if (obstacleIds.has(other.label)) {
          const lastHit = lastObstacleHitAt.get(other.label) ?? -Infinity
          if (
            now - lastHit >= OBSTACLE_HIT_COOLDOWN_MS &&
            now - lastObstacleSoundAt >= OBSTACLE_SOUND_GLOBAL_COOLDOWN_MS
          ) {
            lastObstacleHitAt.set(other.label, now)
            lastObstacleSoundAt = now
            optionsRef.current.onObstacleHit(other.label)
          }
        }
      }
    }
    Events.on(engine, 'collisionStart', handleCollisionStart)

    // --- 更新ループ（固定タイムステップ + rAF） -----------------------------
    let rafId: number | null = null
    let lastFrameTime: number | null = null
    let accumulator = 0
    const previousToyActive = new Map<string, boolean>()

    function tick(now: number) {
      // cleanup後に紛れ込んだ呼び出しがあっても再スケジュールしない（cancelAnimationFrameとの二重防御）
      if (activeRunRef.current !== runToken) return
      rafId = requestAnimationFrame(tick)
      if (lastFrameTime === null) {
        lastFrameTime = now
        return
      }
      const delta = Math.min(now - lastFrameTime, MAX_FRAME_DELTA_MS)
      lastFrameTime = now
      accumulator += delta

      let substeps = 0
      while (accumulator >= STEP_MS && substeps < MAX_SUBSTEPS) {
        Engine.update(engine, STEP_MS)
        accumulator -= STEP_MS
        substeps += 1
      }
      // substep上限に達した場合は端数を持ち越さない（タブ復帰直後などに
      // アキュムレータが溜まり続けて何フレームも急いで追いつこうとするのを防ぐ）
      if (substeps >= MAX_SUBSTEPS) accumulator = 0

      for (let ballIndex = 0; ballIndex < ballCount; ballIndex += 1) {
        if (!launched[ballIndex]) continue
        // 削除済みの球は速度クランプ・DOM書き込みを含め以降の処理を全部スキップする
        if (removed[ballIndex]) continue
        const body = ballBodies[ballIndex]

        // 速度クランプ（薄い壁のすり抜け防止）。得点確定後も転がり続けるボールに
        // 適用してよい安全策なので scored かどうかは問わない。
        const speed = Math.hypot(body.velocity.x, body.velocity.y)
        if (speed > MAX_SPEED) {
          const factor = MAX_SPEED / speed
          Body.setVelocity(body, { x: body.velocity.x * factor, y: body.velocity.y * factor })
        }
        // 角速度クランプ（国旗が読めなくなるほど速く回らないようにする）
        if (Math.abs(body.angularVelocity) > MAX_ANGULAR_VELOCITY) {
          Body.setAngularVelocity(
            body,
            Math.sign(body.angularVelocity) * MAX_ANGULAR_VELOCITY,
          )
        }

        if (!scored[ballIndex]) {
          // 停滞ナッジ
          const currentSpeed = Math.hypot(body.velocity.x, body.velocity.y)
          if (currentSpeed < STALL_SPEED_THRESHOLD) {
            if (stallSince[ballIndex] === null) {
              stallSince[ballIndex] = now
            } else if (now - stallSince[ballIndex]! >= STALL_DURATION_MS) {
              const sign = Math.random() < 0.5 ? -1 : 1
              const magnitude = STALL_NUDGE_SPEED * (0.5 + Math.random() * 0.5)
              // 停滞したボールを「小さく突く」。applyForce は matter-js 内部で delta の二乗が
              // 掛かって速度変化が過大になるため、狙った速さを setVelocity で直接与える。
              Body.setVelocity(body, { x: sign * magnitude, y: body.velocity.y - 0.6 })
              stallSince[ballIndex] = now
            }
          } else {
            stallSince[ballIndex] = null
          }
        }

        // 盤外脱出の判定。得点済みの球も対象にするのは、全射出モードでは得点ゾーン通過後に
        // 床(wall-bottom)がなくそのまま盤外へ落ちるため、ここで World から削除する必要があるため
        // （通常モードは床があるため、scored後の球がこの経路に入ることは実質ない）。
        const outOfBounds =
          body.position.y > OUT_OF_BOUNDS_Y ||
          body.position.x < -OUT_OF_BOUNDS_MARGIN_X ||
          body.position.x > BOARD_WIDTH + OUT_OF_BOUNDS_MARGIN_X
        if (outOfBounds) {
          // 未確定のまま盤外へ出た場合は、抜けた x 位置からゾーンを推定して救済する
          if (!scored[ballIndex]) finalizeBall(ballIndex, zoneAtX(body.position.x))
          removeBall(ballIndex)
          continue
        }
        if (!scored[ballIndex] && now - launchedAt[ballIndex] >= SAFETY_TIMEOUT_MS) {
          // 安全タイマー（通常プレイでは発動しない想定の最終手段）
          finalizeBall(ballIndex, zoneAtX(body.position.x))
        }
        // 全射出モードのみ: 得点済みなのに盤外へ抜けない球を強制回収する保険。
        // これがあることで「全射出モードが必ず終了する」ことを構造で保証する。
        if (
          mode === 'allFlags' &&
          scored[ballIndex] &&
          now - scoredAt[ballIndex] >= SCORED_BALL_REMOVAL_TIMEOUT_MS
        ) {
          removeBall(ballIndex)
          continue
        }

        // DOMへ直接反映する。React の再レンダーは経由しない。
        // 座標は論理座標のまま書き込み、実機サイズへの拡縮は親要素のCSS transformに任せる。
        const el = ballElementsRef.current.get(ballIndex)
        if (el) {
          const x = body.position.x - BALL_RADIUS
          const y = body.position.y - BALL_RADIUS
          el.style.transform = `translate(${x}px, ${y}px) rotate(${body.angle}rad)`
        }
      }

      // 射出済みかつ削除されていない球だけを、毎フレーム同じ配列へ詰め直して渡す。
      // 配列を作り直さないことで、おもちゃが増えても更新ループの割り当てを増やさない。
      activeToyBalls.length = 0
      for (let ballIndex = 0; ballIndex < ballCount; ballIndex += 1) {
        if (launched[ballIndex] && !removed[ballIndex]) {
          activeToyBalls.push(toyBallEntries[ballIndex])
        }
      }
      for (const runtime of toyRuntimes) {
        runtime.update(now, activeToyBalls)
      }

      // おもちゃの見た目はReactを再レンダーせず、ボールと同じくDOMへ直接反映する。
      // activeのdata属性だけは状態が変わったフレームに限定して書き換える。
      for (const runtime of toyRuntimes) {
        const visual = runtime.readVisualState()
        const el = toyElementsRef.current.get(runtime.placement.id)
        if (!el) continue
        el.style.setProperty('--toy-spin', `${visual.spinRad}rad`)
        el.style.setProperty('--toy-pulse', `${visual.pulse}`)
        el.style.setProperty('--toy-scale', `${visual.scale}`)
        const previousActive = previousToyActive.get(runtime.placement.id)
        if (previousActive !== visual.active) {
          el.dataset.toyActive = visual.active ? 'true' : 'false'
          previousToyActive.set(runtime.placement.id, visual.active)
        }
      }
    }
    rafId = requestAnimationFrame(tick)

    return () => {
      // 「今アクティブな世界」トークンをリセットし、cleanup後に紛れ込んだ
      // rAF/setTimeoutコールバックが処理を続行しないようにする
      if (activeRunRef.current === runToken) {
        activeRunRef.current = null
        toyRuntimeMap.clear()
      }
      if (rafId !== null) cancelAnimationFrame(rafId)
      timeoutIds.forEach((id) => clearTimeout(id))
      Events.off(engine, 'collisionStart', handleCollisionStart)
      Composite.clear(engine.world, false)
      Engine.clear(engine)
    }
  }, [options.runId, options.mode, flagIdsKey])

  return handle
}
