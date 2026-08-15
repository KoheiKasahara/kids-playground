import * as Matter from 'matter-js'
import { MAX_SPEED, OBSTACLE_FRICTION } from './pinballPhysics'
import type { ToyPlacement } from './toyLayout'
import type { ToyRuntime, ToyVisualState } from './toyRuntime'

const { Body, Bodies } = Matter

/** 発動直後の「ポンッ」を260msで見せ切り、タップの手応えだけを短く残す。 */
const ACTIVE_DURATION_MS = 260
/** 連打のたびに速度を更新せず、子どもの連続タップを受け止める短い間隔にする。 */
const PHYSICS_COOLDOWN_MS = 360
/** 同じボールを何度も救い続けないようにし、別のボールには同じタップ機会を残す。 */
const BALL_PHYSICS_COOLDOWN_MS = 1200
/** おもちゃ半径とボール半径に少し余裕を足した近距離だけを補助し、得点直前の球を拾わない。 */
const INFLUENCE_RADIUS = 130
/** おもちゃの中心より30px上までは救えるが、それより上の浮遊中の球は追わない。 */
const UPPER_TARGET_MARGIN = 30
/** 射出口の初速6〜10px/stepと同程度にし、落下球を少しだけ上へ戻す。 */
const LAUNCH_UP_SPEED = 9
/** 横方向の速度を小さく抑え、真上へ固定せず盤面中央を狙い続けないようにする。 */
const MAX_HORIZONTAL_SPEED = 4
/** 左右の散らしを最低限残し、タップごとに同じ得点帯へ寄らないようにする。 */
const RANDOM_HORIZONTAL_MIN_SPEED = 0.8
/** 横成分をこの値以下にし、斜め上への補助が盤外へ飛ばす力にならないようにする。 */
const RANDOM_HORIZONTAL_MAX_SPEED = 1.8
/** 通常の合成速度より十分大きく、異常値が入っても既存の上限24px/stepを越えない安全弁にする。 */
const LAUNCH_SPEED_CAP = Math.min(MAX_SPEED * 0.5, 12)
/** 静的パッドの反発を控えめにし、接触だけでボールが過度に跳ね続けないようにする。 */
const LAUNCHER_RESTITUTION = 0.45
/** 障害物・得点ゾーン・ball-Nの特殊処理と衝突しない専用ラベルにする。 */
const LAUNCHER_BODY_LABEL = 'toy-launcher-pad'

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function createLauncherBody(placement: ToyPlacement): Matter.Body {
  return Bodies.circle(placement.x, placement.y, placement.radius, {
    friction: OBSTACLE_FRICTION,
    isStatic: true,
    label: LAUNCHER_BODY_LABEL,
    restitution: LAUNCHER_RESTITUTION,
  })
}

function setLaunchVelocity(body: Matter.Body, placement: ToyPlacement): boolean {
  const offsetX = body.position.x - placement.x
  const offsetY = body.position.y - placement.y
  const isWithinInfluenceRange = Math.hypot(offsetX, offsetY) <= INFLUENCE_RADIUS
  const isLowEnough = body.position.y >= placement.y - UPPER_TARGET_MARGIN
  const isAlreadyRising = body.velocity.y <= -LAUNCH_UP_SPEED
  if (!isWithinInfluenceRange || !isLowEnough || isAlreadyRising) return false

  // 既存の横速度は少しだけ残し、そこへ左右ランダムの小さな散らしを足す。
  const dampedHorizontalVelocity = clamp(
    body.velocity.x * 0.25,
    -MAX_HORIZONTAL_SPEED,
    MAX_HORIZONTAL_SPEED,
  )
  const randomHorizontalDirection = Math.random() < 0.5 ? -1 : 1
  const randomHorizontalSpeed =
    RANDOM_HORIZONTAL_MIN_SPEED +
    Math.random() * (RANDOM_HORIZONTAL_MAX_SPEED - RANDOM_HORIZONTAL_MIN_SPEED)
  const horizontalVelocity = clamp(
    dampedHorizontalVelocity + randomHorizontalDirection * randomHorizontalSpeed,
    -MAX_HORIZONTAL_SPEED,
    MAX_HORIZONTAL_SPEED,
  )
  const verticalVelocity = -LAUNCH_UP_SPEED
  const rawSpeed = Math.hypot(horizontalVelocity, verticalVelocity)
  const speedScale = rawSpeed > LAUNCH_SPEED_CAP ? LAUNCH_SPEED_CAP / rawSpeed : 1

  // applyForceはdeltaの二乗で効き方が変わるため、狙った速度を直接設定する。
  Body.setVelocity(body, {
    x: horizontalVelocity * speedScale,
    y: verticalVelocity * speedScale,
  })
  return true
}

export function createLauncherToy(placement: ToyPlacement): ToyRuntime {
  const launcherBody = createLauncherBody(placement)
  let activatedAt: number | null = null
  let pendingPhysicsActivationAt: number | null = null
  let lastPhysicsActivationAt: number | null = null
  const lastBallPhysicsActivationAt = new Map<number, number>()
  const visual: ToyVisualState = {
    spinRad: 0,
    pulse: 0,
    active: false,
  }

  return {
    placement,
    bodies: [launcherBody],
    activate(now) {
      activatedAt = now
      visual.active = true
      // クールダウン中も見た目は反応させ、タップが無視された印象を与えない。
      visual.pulse = 1

      const canApplyPhysics =
        lastPhysicsActivationAt === null ||
        now - lastPhysicsActivationAt >= PHYSICS_COOLDOWN_MS
      if (canApplyPhysics) pendingPhysicsActivationAt = now
    },
    update(now, balls) {
      if (
        pendingPhysicsActivationAt !== null &&
        now >= pendingPhysicsActivationAt
      ) {
        for (const ball of balls) {
          const lastBallActivationAt = lastBallPhysicsActivationAt.get(ball.ballIndex)
          if (
            lastBallActivationAt !== undefined &&
            now - lastBallActivationAt < BALL_PHYSICS_COOLDOWN_MS
          ) {
            continue
          }
          if (setLaunchVelocity(ball.body, placement)) {
            lastBallPhysicsActivationAt.set(ball.ballIndex, now)
          }
        }
        lastPhysicsActivationAt = now
        pendingPhysicsActivationAt = null
      }

      if (activatedAt !== null) {
        const elapsed = Math.max(0, now - activatedAt)
        const clampedElapsed = Math.min(elapsed, ACTIVE_DURATION_MS)
        visual.active = elapsed < ACTIVE_DURATION_MS
        visual.pulse = 1 - clampedElapsed / ACTIVE_DURATION_MS
      }
      visual.spinRad = 0
    },
    readVisualState() {
      return visual
    },
  }
}
