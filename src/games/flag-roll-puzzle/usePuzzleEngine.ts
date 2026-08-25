import { useEffect, useMemo, useRef } from 'react'
import * as Matter from 'matter-js'
import {
  BALL_RADIUS,
  BALL_START,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  WALL_THICKNESS,
} from './boardLayout'
import { cellCenter } from './grid'
import { createStopObservation, observeBallStop } from './ballStopDetection'
import { isInGoalArea } from './goal'
import { partDefinition } from './partTypes'
import { bumperBoostVelocity } from './bumperPhysics'
import type { PlacedPart } from './placement'
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

export type PuzzleEngineOptions = {
  /** 盤面に置かれているパーツ。実行開始時のスナップショットから物理Bodyを作る */
  parts: readonly PlacedPart[]
  /** 実行中か。false のあいだボールは開始位置で静止し、物理世界は作らない */
  running: boolean
  /** 「ボールをおとす」ごとに増える世代。値が変わったら世界を作り直す */
  runId: number
  /** ボールがゴール領域へ入ったとき（1回の実行につき最大1度だけ呼ぶ） */
  onGoal: () => void
  /** ゴール以外で一定時間動かなかったとき。編集状態へ戻す */
  onStopped: () => void
}

export type PuzzleEngineHandle = {
  /** 国旗ボールのDOM要素を登録する ref コールバック（参照は安定している） */
  registerBall: (el: HTMLElement | null) => void
}

/**
 * 盤面の外周壁（左・右・床）。
 * 外周壁は盤面の外側に置き、見た目には出さない。
 */
function wallBodies(): Matter.Body[] {
  const half = WALL_THICKNESS / 2
  const options = {
    isStatic: true,
    restitution: WALL_RESTITUTION,
    friction: WALL_FRICTION,
    label: 'wall',
  }
  return [
    Bodies.rectangle(-half, BOARD_HEIGHT / 2, WALL_THICKNESS, BOARD_HEIGHT * 2, options),
    Bodies.rectangle(BOARD_WIDTH + half, BOARD_HEIGHT / 2, WALL_THICKNESS, BOARD_HEIGHT * 2, options),
    Bodies.rectangle(BOARD_WIDTH / 2, BOARD_HEIGHT + half, BOARD_WIDTH + WALL_THICKNESS * 2, WALL_THICKNESS, options),
  ]
}

/**
 * 置かれたパーツ1つぶんの静的Body。パーツ定義のセグメントをそのままBodyにする。
 * ここにパーツ種類ごとの分岐がないため、新しいパーツはpartTypes.tsへ定義を足すだけで動く。
 */
function partBodies(part: PlacedPart): Matter.Body[] {
  const definition = partDefinition(part.typeId)
  const center = cellCenter(part.cell)
  return definition.segments.map((segment, index) => {
    const options = {
      isStatic: true,
      angle: segment.angleDeg * DEG_TO_RAD,
      restitution: definition.restitution,
      friction: definition.friction,
      label: segment.kind === 'circle' ? `bumper:${part.id}:${index}` : `${part.id}-${index}`,
    }
    if (segment.kind === 'circle') {
      return Bodies.circle(center.x + segment.offsetX, center.y + segment.offsetY, segment.width / 2, options)
    }
    return Bodies.rectangle(center.x + segment.offsetX, center.y + segment.offsetY, segment.width, segment.height, options)
  })
}

/**
 * matter-js の Engine だけをヘッドレスで動かす（Matter.Render は使わない）。
 * 描画は毎フレーム、国旗ボールのDOM要素へ直接 transform を書き込む方式にして、
 * Reactの再レンダーを物理演算のフレームから切り離す。
 *
 * Reactが持つのは「どのマスに何を置いたか」と「編集中か実行中か」だけで、
 * 物理Bodyはこのフックの中だけに閉じている。Phase 2で編集モードと実行モードを
 * 行き来させるときも、Reactの状態と物理世界が絡まないようにするための分担。
 */
export function usePuzzleEngine(options: PuzzleEngineOptions): PuzzleEngineHandle {
  // onGoal は呼び出し側の再レンダーのたびに新しい関数になりうる。これを物理世界を作る
  // useEffect の依存に入れると毎レンダーで世界が作り直されてしまうため、refから最新値を読む。
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  })

  const ballElementRef = useRef<HTMLElement | null>(null)
  const handle = useMemo<PuzzleEngineHandle>(
    () => ({
      registerBall: (el: HTMLElement | null) => {
        ballElementRef.current = el
      },
    }),
    [],
  )

  const { running, runId } = options

  // 編集中は開始位置に静止させる。途中停止後も、次の再挑戦はここから始める。
  useEffect(() => {
    if (running) return
    const el = ballElementRef.current
    if (!el) return
    el.style.transform = `translate(${BALL_START.x - BALL_RADIUS}px, ${BALL_START.y - BALL_RADIUS}px)`
  }, [running, runId])

  useEffect(() => {
    if (!running) return

    // 実行開始時点の配置をスナップショットとして読む。実行中はパーツを触れない仕様のため、
    // これを依存配列に入れて世界を作り直す必要はない（runIdが実行の世代を表す）。
    const parts = optionsRef.current.parts

    const engine = Engine.create({ gravity: { ...GRAVITY } })
    const ball = Bodies.circle(BALL_START.x, BALL_START.y, BALL_RADIUS, {
      restitution: BALL_RESTITUTION,
      friction: BALL_FRICTION,
      frictionAir: BALL_FRICTION_AIR,
      density: BALL_DENSITY,
      label: 'ball',
    })
    Composite.add(engine.world, [...wallBodies(), ...parts.flatMap(partBodies), ball])

    const lastBumperHitAt = new Map<number, number>()
    const handleCollisionStart = (collision: Matter.IEventCollision<Matter.Engine>) => {
      for (const pair of collision.pairs) {
        const bumper = pair.bodyA.label.startsWith('bumper:')
          ? pair.bodyA
          : pair.bodyB.label.startsWith('bumper:')
            ? pair.bodyB
            : null
        const hitBall = pair.bodyA.label === 'ball' ? pair.bodyA : pair.bodyB.label === 'ball' ? pair.bodyB : null
        if (!bumper || !hitBall) continue

        const now = performance.now()
        if (now - (lastBumperHitAt.get(bumper.id) ?? -Infinity) < BUMPER_HIT_COOLDOWN_MS) continue
        lastBumperHitAt.set(bumper.id, now)
        Body.setVelocity(hitBall, bumperBoostVelocity(hitBall.position, bumper.position, hitBall.velocity))
      }
    }
    Events.on(engine, 'collisionStart', handleCollisionStart)

    let rafId: number | null = null
    let lastFrameTime: number | null = null
    let accumulator = 0
    let reachedGoal = false
    let stopped = false
    let stopObservation = createStopObservation()

    const writeBallTransform = () => {
      const el = ballElementRef.current
      if (!el) return
      const x = ball.position.x - BALL_RADIUS
      const y = ball.position.y - BALL_RADIUS
      el.style.transform = `translate(${x}px, ${y}px) rotate(${ball.angle}rad)`
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
        Engine.update(engine, STEP_MS)
        accumulator -= STEP_MS
        substeps += 1
      }
      // 上限に達したぶんの端数は捨てる（復帰直後に何フレームも急いで追いつかないように）
      if (substeps >= MAX_SUBSTEPS) accumulator = 0

      // 速度クランプ。薄い板をすり抜けたり、国旗が読めないほど回るのを防ぐ
      const speed = Math.hypot(ball.velocity.x, ball.velocity.y)
      if (speed > MAX_SPEED) {
        const factor = MAX_SPEED / speed
        Body.setVelocity(ball, { x: ball.velocity.x * factor, y: ball.velocity.y * factor })
      }
      if (Math.abs(ball.angularVelocity) > MAX_ANGULAR_VELOCITY) {
        Body.setAngularVelocity(ball, Math.sign(ball.angularVelocity) * MAX_ANGULAR_VELOCITY)
      }

      writeBallTransform()

      // ゴール判定。入った瞬間に一度だけ通知し、ボールはそのまま転がし続ける
      // （その場で固定すると動きが不自然に途切れるため）。reachedGoal は
      // この実行(runId)のあいだ保たれるので、ゴール内で出入りしても再通知はしない。
      if (!reachedGoal && isInGoalArea(ball.position.x, ball.position.y)) {
        reachedGoal = true
        optionsRef.current.onGoal()
      }

      // ゴール後は Phase 1 の「受け皿で自然に転がる」動きを維持するため停止判定しない。
      const stopResult = observeBallStop(
        stopObservation,
        { x: ball.position.x, y: ball.position.y, speed },
        now,
        reachedGoal || isInGoalArea(ball.position.x, ball.position.y),
      )
      stopObservation = stopResult.observation
      if (stopResult.stopped) {
        stopped = true
        Body.setVelocity(ball, { x: 0, y: 0 })
        Body.setAngularVelocity(ball, 0)
        Body.setStatic(ball, true)
        writeBallTransform()
        optionsRef.current.onStopped()
      }
    }

    writeBallTransform()
    rafId = requestAnimationFrame(tick)

    return () => {
      stopped = true
      if (rafId !== null) cancelAnimationFrame(rafId)
      Events.off(engine, 'collisionStart', handleCollisionStart)
      Composite.clear(engine.world, false)
      Engine.clear(engine)
    }
  }, [running, runId])

  return handle
}
