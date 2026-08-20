import * as Matter from 'matter-js'
import {
  BALL_RADIUS,
  BOARD_WIDTH,
  LAUNCH_DELAYS_MS,
  SCORE_ZONES,
  ZONE_DIVIDER_WIDTH,
  ZONE_DIVIDERS,
  findCornerEscapeZone,
  zoneAtX,
  wallsForMode,
} from './boardLayout'
import { normalBoard, type BoardConfig } from './boardConfigs'
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
import { createToyRuntime } from './toyRuntime'
import type { ToyBall } from './toyRuntime'
import type { PinballMode } from './types'

const { Engine, Bodies, Body, Composite, Events } = Matter

export type PinballSimulationResult = {
  /** 1球目の射出から最後の球の得点確定までに進んだ固定ステップ数 */
  readonly steps: number
  readonly durationMs: number
  readonly durationSeconds: number
  readonly scoreSteps: readonly number[]
  /** 各球が得点確定したゾーンID。scoreStepsと同じ順序で観測に使う */
  readonly scoredZoneIds: readonly string[]
  readonly completed: boolean
  readonly usedSafetyTimeout: boolean
  /** 射出済みかつ未得点だった球の同時最大数。射出間隔の妥当性確認に使う */
  readonly maxConcurrentBalls: number
}

/**
 * simulatePinballRun のオプション。省略時は3球・通常モード・おもちゃをタップしない設定になる。
 * おもちゃのBody自体は実機と同じ盤面に含めるため、従来の測定結果とは一致しない。
 * 全射出モードの測定など、球数・射出間隔・モードを変えたいときにも使う。
 */
export type PinballSimulationOptions = {
  /** 射出する球数。既定 SIMULATION_BALL_COUNT */
  ballCount?: number
  /** 各球の射出遅延(ms)。長さは ballCount 以上を想定し、先頭から ballCount 件を使う。既定 LAUNCH_DELAYS_MS */
  launchDelaysMs?: readonly number[]
  /** モード。既定 'normal'（'allFlags' なら wall-bottom を置かない） */
  mode?: PinballMode
  /** おもちゃを全てタップする間隔(ms)。nullまたは省略時はタップしない */
  toyTapIntervalMs?: number | null
  /** 使う盤面設定。既定は通常テーマ（normalBoard）で、従来の測定値と対応する */
  boardConfig?: BoardConfig
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
export function simulatePinballRun(seed: number, options?: PinballSimulationOptions): PinballSimulationResult {
  const ballCount = options?.ballCount ?? SIMULATION_BALL_COUNT
  const mode = options?.mode ?? 'normal'
  const delaysMs = options?.launchDelaysMs ?? LAUNCH_DELAYS_MS
  const toyTapIntervalMs = options?.toyTapIntervalMs ?? null
  const boardConfig = options?.boardConfig ?? normalBoard

  if (toyTapIntervalMs !== null && (!Number.isFinite(toyTapIntervalMs) || toyTapIntervalMs <= 0)) {
    throw new Error('flag-pinball: toyTapIntervalMs は正の有限値またはnullで指定してください')
  }

  const random = createSeededRandom(seed)
  const engine = Engine.create({ gravity: { ...GRAVITY } })

  const wallBodies = [...wallsForMode(boardConfig.walls, mode), ...ZONE_DIVIDERS].map((wall) =>
    Bodies.rectangle(wall.x, wall.y, wall.width, wall.height, {
      isStatic: true,
      angle: wall.angle,
      restitution: wall.restitution,
      friction: WALL_FRICTION,
    }),
  )
  const obstacleBodies = boardConfig.obstacles.map((obstacle) =>
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

  // おもちゃのBodyも実機と同じ物理世界へ加える。タップしない測定でも障害物として
  // 残るため、画面側とヘッドレス測定の盤面構成を一致させる。
  const toyRuntimes = boardConfig.toys.map((placement) => createToyRuntime(placement, random))
  Composite.add(engine.world, toyRuntimes.flatMap((runtime) => runtime.bodies))

  const ballBodies: Matter.Body[] = []
  for (let i = 0; i < ballCount; i += 1) {
    ballBodies.push(
      Bodies.circle(boardConfig.launch.x, boardConfig.launch.y, BALL_RADIUS, {
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

  const launchSteps = delaysMs.slice(0, ballCount).map((delay) => Math.round(delay / STEP_MS))
  const launched = ballBodies.map(() => false)
  const scored = ballBodies.map(() => false)
  const launchedAtMs: (number | null)[] = ballBodies.map(() => null)
  const stallSinceMs: (number | null)[] = ballBodies.map(() => null)
  const scoreSteps: number[] = []
  const scoredZoneIds: string[] = []
  let scoredCount = 0
  let physicsStep = 0
  let firstLaunchStep: number | null = null
  let usedSafetyTimeout = false
  let inFlightCount = 0
  let maxConcurrentBalls = 0
  let nextToyTapAtMs = toyTapIntervalMs === null ? null : 0

  const finalizeBall = (ballIndex: number, zoneId: string, safetyTimeout: boolean) => {
    if (scored[ballIndex]) return
    scored[ballIndex] = true
    scoredCount += 1
    inFlightCount -= 1
    if (safetyTimeout) usedSafetyTimeout = true
    scoreSteps.push(physicsStep)
    scoredZoneIds.push(zoneId)
  }

  Events.on(engine, 'collisionStart', (event: Matter.IEventCollision<Matter.Engine>) => {
    for (const pair of event.pairs) {
      const collision = ballIndexAndOther(pair)
      if (!collision || !collision.other.label.startsWith('zone-')) continue
      finalizeBall(collision.ballIndex, collision.other.label, false)
    }
  })

  // 全射出モードは射出間隔が長く球数も多いため、安全タイマー分の余裕に加えて
  // 「最後の球の射出遅延」ぶんも見込んで上限ステップ数を決める（そうしないと
  // 終盤の球がまだ射出待ちのうちにループを打ち切ってしまう）。
  const maxSteps = Math.ceil((SAFETY_TIMEOUT_MS + Math.max(...delaysMs, 0)) / STEP_MS) + 10
  while (scoredCount < ballCount && physicsStep < maxSteps) {
    for (let ballIndex = 0; ballIndex < ballCount; ballIndex += 1) {
      if (launched[ballIndex] || physicsStep < launchSteps[ballIndex]) continue
      const body = ballBodies[ballIndex]
      Body.setPosition(body, {
        x: boardConfig.launch.x + (random() * 2 - 1) * boardConfig.launch.jitterX,
        y: boardConfig.launch.y,
      })
      Body.setVelocity(body, {
        x: boardConfig.launch.minVx + random() * (boardConfig.launch.maxVx - boardConfig.launch.minVx),
        y: boardConfig.launch.minVy + random() * (boardConfig.launch.maxVy - boardConfig.launch.minVy),
      })
      Composite.add(engine.world, body)
      launched[ballIndex] = true
      launchedAtMs[ballIndex] = physicsStep * STEP_MS
      if (firstLaunchStep === null) firstLaunchStep = physicsStep
      inFlightCount += 1
      maxConcurrentBalls = Math.max(maxConcurrentBalls, inFlightCount)
    }

    physicsStep += 1
    Engine.update(engine, STEP_MS)
    const nowMs = physicsStep * STEP_MS

    for (let ballIndex = 0; ballIndex < ballCount; ballIndex += 1) {
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
          const escapeZone = findCornerEscapeZone(boardConfig.cornerEscapeZones, body.position.x, body.position.y)
          if (escapeZone) {
            // 射出ガイド壁と外壁が挟む隅（CORNER_ESCAPE_ZONES）は通常のナッジでは
            // 脱出できないため、その一点だけ通り抜けさせる。
            Body.setPosition(body, { x: escapeZone.toX, y: escapeZone.toY })
            Body.setVelocity(body, { x: 0, y: Math.max(body.velocity.y, 2) })
          } else {
            const magnitude = STALL_NUDGE_SPEED * (0.5 + random() * 0.5)
            const direction = random() < 0.5 ? -1 : 1
            Body.setVelocity(body, { x: direction * magnitude, y: body.velocity.y - 0.6 })
          }
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
        finalizeBall(ballIndex, zoneAtX(body.position.x).id, false)
      } else if (launchedAtMs[ballIndex] !== null && nowMs - launchedAtMs[ballIndex]! >= SAFETY_TIMEOUT_MS) {
        finalizeBall(ballIndex, zoneAtX(body.position.x).id, true)
      }
    }

    // 射出済みかつ未得点の球だけをおもちゃへ渡す。得点確定後の球が再びおもちゃの
    // 物理処理へ入ると、終了済みの球が別の球のプレイ時間へ影響してしまうため。
    activeToyBalls.length = 0
    for (let ballIndex = 0; ballIndex < ballCount; ballIndex += 1) {
      if (launched[ballIndex] && !scored[ballIndex]) {
        activeToyBalls.push(toyBallEntries[ballIndex])
      }
    }

    if (toyTapIntervalMs !== null && nextToyTapAtMs !== null && nowMs >= nextToyTapAtMs) {
      for (const runtime of toyRuntimes) {
        runtime.activate(nowMs)
      }
      // launch/stall と同じ seeded random を toy へも渡しているため、タップありの
      // シナリオも固定シードから完全に再現できる。
      nextToyTapAtMs += toyTapIntervalMs
    }
    for (const runtime of toyRuntimes) {
      runtime.update(nowMs, activeToyBalls)
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
    scoredZoneIds,
    completed: scoredCount === ballCount,
    usedSafetyTimeout,
    maxConcurrentBalls,
  }
}
