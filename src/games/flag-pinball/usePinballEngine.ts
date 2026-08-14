import { useEffect, useMemo, useRef } from 'react'
import * as Matter from 'matter-js'
import {
  BALL_RADIUS,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  LAUNCH,
  LAUNCH_DELAYS_MS,
  OBSTACLES,
  SCORE_ZONES,
  WALLS,
  ZONE_DIVIDER_WIDTH,
  ZONE_DIVIDERS,
  ZONE_TOP,
  zoneAtX,
  type ScoreZone,
} from './boardLayout'

const { Engine, Bodies, Body, Composite, Events } = Matter

export type PinballEngineOptions = {
  /** 選択された3つの flagId。配列の並び順が ballIndex（0..2）になる */
  flagIds: readonly string[]
  /** プレイの世代。値が変わったら物理世界を作り直して最初から射出する（「もういちど」用） */
  runId: number
  /** 1球の得点が確定したとき（同じ ballIndex では必ず一度だけ呼ぶ） */
  onBallScored: (ballIndex: number, zone: ScoreZone) => void
  /** バンパー／ピンにボールが当たったとき（演出用）。obstacleId は OBSTACLES の id */
  onObstacleHit: (obstacleId: string) => void
  /** 1球が射出されたとき（効果音用） */
  onBallLaunched: (ballIndex: number) => void
  /** 3球すべての得点が確定したとき（必ず一度だけ呼ぶ） */
  onFinished: () => void
}

export type PinballEngineHandle = {
  /** ボールの DOM 要素を ballIndex ごとに登録する ref コールバック（参照は安定させること） */
  registerBall: (ballIndex: number) => (el: HTMLElement | null) => void
}

// --- 固定パラメータ ----------------------------------------------------------
// 物理更新は 60fps 固定のタイムステップで進める。可変フレームレートのまま
// Engine.update に渡すと、端末ごとに反発の強さや飛距離が変わってしまうため。
const STEP_MS = 1000 / 60
/** 1フレームぶんのdeltaがこれを超えたらクランプする（タブを裏に回して復帰した直後の暴走防止） */
const MAX_FRAME_DELTA_MS = 100
/** 1フレームで進める物理ステップの上限。MAX_FRAME_DELTA_MS ぶんを一気に消化しない */
const MAX_SUBSTEPS = 5

/** ボールの最大速度(px/step)。これを超えたら向きを保ったまま縮め、薄い壁のすり抜けを防ぐ */
const MAX_SPEED = 22
/** ボールの最大角速度(rad/step)。国旗が読めなくなるほど速く回らないようにする */
const MAX_ANGULAR_VELOCITY = 0.22

/** 同じ障害物への連続ヒット音・演出を間引くクールダウン(ms) */
const OBSTACLE_HIT_COOLDOWN_MS = 120

/** これ未満の速さ(px/step)を「停滞」とみなす */
const STALL_SPEED_THRESHOLD = 0.4
/** 停滞がこれだけ続いたらナッジする(ms) */
const STALL_DURATION_MS = 1500
/**
 * 停滞ナッジで直接与える水平方向の速さ(px/step)。
 * matter-js の Body.applyForce は velocity += force / mass * delta^2 として適用され、
 * delta≈16.67ms のとき係数は約278倍にもなる。そのため applyForce で「小さく突く」ことは
 * 事実上できず（MAX_SPEEDで頭打ちになり、最大速度で真横へ弾き飛ばす挙動になってしまう）、
 * Body.setVelocity で狙った速さをそのまま与える。
 */
const STALL_NUDGE_SPEED = 2.2

/** 射出から確定までの安全タイマー(ms)。通常プレイでは発動しない想定の最終手段 */
const SAFETY_TIMEOUT_MS = 18000
/** 盤外脱出とみなす、盤面下端からの余裕(px) */
const OUT_OF_BOUNDS_Y = BOARD_HEIGHT + 100
/** 盤外脱出とみなす、盤面左右からの余裕(px) */
const OUT_OF_BOUNDS_MARGIN_X = 150

/** 得点ゾーンのセンサー（矩形）の高さと中心y */
const ZONE_SENSOR_HEIGHT = 20
const ZONE_SENSOR_Y = ZONE_TOP + 30

const WALL_FRICTION = 0.05
const OBSTACLE_FRICTION = 0.02
const BALL_RESTITUTION = 0.5
const BALL_FRICTION = 0.02
const BALL_FRICTION_AIR = 0.005
const BALL_DENSITY = 0.002

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
    }),
    [],
  )

  // flagIds の「内容」が変わったときだけ作り直したいので、配列参照ではなく内容を依存に使う
  // （選択画面から同じ3件がそのまま渡ってくる場合に不要な再構築をしないため）。
  const flagIdsKey = options.flagIds.join(',')

  // 「今アクティブな世界」を指すトークン。React StrictMode の開発時二重実行
  // （mount→cleanup→mountが同期的に走る）でも、rAF/setTimeoutのコールバックが
  // 自分の世界のcleanup後に紛れ込んで動かないよう、cancelAnimationFrame/clearTimeout
  // に加えて二重にガードする。cleanupで必ずnullへリセットする。
  const activeRunRef = useRef<symbol | null>(null)

  useEffect(() => {
    const runToken = Symbol('pinball-run')
    activeRunRef.current = runToken

    // ballCount は flagIdsKey（=このeffectの依存）から求める。
    // options.flagIds.length を直接使うと react-hooks/exhaustive-deps が
    // options.flagIds 自体を依存に求めてしまい、内容が同じでも配列参照が変わるたびに
    // 世界が作り直される事態になるため、依存に入れている flagIdsKey から導出する。
    const ballCount = flagIdsKey === '' ? 0 : flagIdsKey.split(',').length

    const engine = Engine.create({ gravity: { x: 0, y: 1 } })

    // --- 静的な壁（外壁・ガイド壁・ゾーン仕切り） ---------------------------
    const wallBodies = [...WALLS, ...ZONE_DIVIDERS].map((wall) =>
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

    const launched = ballBodies.map(() => false)
    const scored = ballBodies.map(() => false)
    const launchedAt = ballBodies.map(() => 0)
    const stallSince: (number | null)[] = ballBodies.map(() => null)
    let scoredCount = 0
    let finished = false

    // 射出前は見えない状態にしておく（射出時に visible へ切り替える）
    for (let i = 0; i < ballCount; i += 1) {
      const el = ballElementsRef.current.get(i)
      if (el) el.style.visibility = 'hidden'
    }

    // --- 時間差射出 -----------------------------------------------------
    const timeoutIds: ReturnType<typeof setTimeout>[] = []
    LAUNCH_DELAYS_MS.slice(0, ballCount).forEach((delay, ballIndex) => {
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
        launchedAt[ballIndex] = performance.now()
        const el = ballElementsRef.current.get(ballIndex)
        if (el) el.style.visibility = 'visible'
        optionsRef.current.onBallLaunched(ballIndex)
      }, delay)
      timeoutIds.push(timeoutId)
    })

    /** ballIndex の得点を確定する。二重確定・二重の onFinished を防ぐゲートを兼ねる */
    function finalizeBall(ballIndex: number, zone: ScoreZone) {
      if (scored[ballIndex]) return
      scored[ballIndex] = true
      scoredCount += 1
      optionsRef.current.onBallScored(ballIndex, zone)
      if (!finished && scoredCount >= ballCount) {
        finished = true
        optionsRef.current.onFinished()
      }
    }

    // --- 衝突判定 ---------------------------------------------------------
    const lastObstacleHitAt = new Map<string, number>()

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
          const lastHit = lastObstacleHitAt.get(other.label) ?? 0
          if (now - lastHit >= OBSTACLE_HIT_COOLDOWN_MS) {
            lastObstacleHitAt.set(other.label, now)
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

          // 盤外脱出の救済
          const outOfBounds =
            body.position.y > OUT_OF_BOUNDS_Y ||
            body.position.x < -OUT_OF_BOUNDS_MARGIN_X ||
            body.position.x > BOARD_WIDTH + OUT_OF_BOUNDS_MARGIN_X
          if (outOfBounds) {
            finalizeBall(ballIndex, zoneAtX(body.position.x))
          } else if (now - launchedAt[ballIndex] >= SAFETY_TIMEOUT_MS) {
            // 安全タイマー（通常プレイでは発動しない想定の最終手段）
            finalizeBall(ballIndex, zoneAtX(body.position.x))
          }
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
    }
    rafId = requestAnimationFrame(tick)

    return () => {
      // 「今アクティブな世界」トークンをリセットし、cleanup後に紛れ込んだ
      // rAF/setTimeoutコールバックが処理を続行しないようにする
      if (activeRunRef.current === runToken) activeRunRef.current = null
      if (rafId !== null) cancelAnimationFrame(rafId)
      timeoutIds.forEach((id) => clearTimeout(id))
      Events.off(engine, 'collisionStart', handleCollisionStart)
      Composite.clear(engine.world, false)
      Engine.clear(engine)
    }
  }, [options.runId, flagIdsKey])

  return handle
}
