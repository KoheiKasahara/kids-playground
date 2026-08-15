import * as Matter from 'matter-js'
import { BALL_RADIUS } from './boardLayout'
import { MAX_ANGULAR_VELOCITY, MAX_SPEED, OBSTACLE_FRICTION, STEP_MS } from './pinballPhysics'
import type { ToyRuntime, ToyVisualState } from './toyRuntime'
import type { ToyPlacement } from './toyLayout'

const { Body, Bodies } = Matter

/** 1回のタップで回転を発動する時間を、ボールがあとから当たる余裕を持てる長さにする。 */
export const SPINNER_ACTIVE_DURATION_MS = 2600
/** 終了間際だけ角速度を滑らかに落とし、残り時間の大半は上限速度を保つ区間。 */
export const SPINNER_SPIN_DOWN_MS = 700
/** 既存の全体角速度上限より少し下に置き、羽根の接線速度が過大にならないようにする。 */
export const SPINNER_MAX_ANGULAR_VELOCITY = Math.min(MAX_ANGULAR_VELOCITY * 0.75, 0.16)
/** 回転の効果時間とは分離し、タップ直後の手応えだけを短く見せるパルス時間。 */
const PULSE_DURATION_MS = 320
/** タブ復帰時などの大きな時刻差で羽根が一気に進まないよう、1回の更新量を制限する。 */
const MAX_UPDATE_DT_MS = 100
/** ボールの最大速度24px/stepの半分以下にし、羽根が盤外へ飛ばす力を構造的に抑える。 */
const SPINNER_BALL_SPEED_CAP = Math.min(MAX_SPEED * 0.5, 10)
/** 羽根そのものの接触範囲に少しだけ余裕を足し、接触直前のボールにも穏やかな補助を届ける。 */
const SPINNER_INFLUENCE_MARGIN = 8
/** ほぼ止まったボールだけを補助し、通常の落下や得点ゾーンへの移動を邪魔しない。 */
const SPINNER_STALL_SPEED_THRESHOLD = 0.35
/** 停滞解除の速度を小さく固定し、毎回の加速ではなく一度のきっかけとして使う。 */
const SPINNER_NUDGE_SPEED = 2.4
/** 同じボールへの補助を間引き、連続フレームで速度が積み上がらないようにする。 */
const SPINNER_NUDGE_COOLDOWN_MS = 200
/** 非回転時の軽いリアクションを短時間だけ残し、障害物としての存在感を保つ。 */
const PASSIVE_SPIN_DURATION_MS = 420
/** 非回転時の角速度を十分小さくし、接触したボールを弾き飛ばさないようにする。 */
const PASSIVE_SPIN_MAX_ANGULAR_VELOCITY = 0.022
/** 羽根を細くして十字の隙間を残し、直径48pxのボールが周囲へ抜けられるようにする。 */
const BLADE_THICKNESS = 12
/** 角を丸めて接触時の急な引っ掛かりを減らす。 */
const BLADE_CHAMFER_RADIUS = 4
/** 既存の障害物・得点ゾーン・ball-N と衝突せず、盤面側の特殊処理を発火させない名前にする。 */
const SPINNER_BODY_LABEL = 'toy-spinner-blade'

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function speedOf(body: Matter.Body): number {
  return Math.hypot(body.velocity.x, body.velocity.y)
}

function setCappedVelocity(body: Matter.Body): void {
  const speed = speedOf(body)
  if (speed <= SPINNER_BALL_SPEED_CAP) return

  const factor = SPINNER_BALL_SPEED_CAP / speed
  Body.setVelocity(body, {
    x: body.velocity.x * factor,
    y: body.velocity.y * factor,
  })
}

function createSpinnerBody(placement: ToyPlacement): Matter.Body {
  const bladeLength = placement.radius * 2
  const bladeOptions = {
    chamfer: { radius: BLADE_CHAMFER_RADIUS },
    friction: OBSTACLE_FRICTION,
    label: SPINNER_BODY_LABEL,
    restitution: 0.55,
  }
  const horizontalBlade = Bodies.rectangle(
    placement.x,
    placement.y,
    bladeLength,
    BLADE_THICKNESS,
    bladeOptions,
  )
  const verticalBlade = Bodies.rectangle(
    placement.x,
    placement.y,
    BLADE_THICKNESS,
    bladeLength,
    bladeOptions,
  )
  const body = Body.create({
    isStatic: true,
    label: SPINNER_BODY_LABEL,
    parts: [horizontalBlade, verticalBlade],
  })

  // Body.create({ isStatic: true }) はデフォルトの摩擦・反発を上書きするため、
  // 盤上の障害物と同じ軽い摩擦へ戻し、羽根の角速度が接線速度として伝わるようにする。
  for (const part of body.parts) {
    part.friction = OBSTACLE_FRICTION
    part.frictionStatic = OBSTACLE_FRICTION
    part.restitution = 0.55
    part.label = SPINNER_BODY_LABEL
  }
  body.friction = OBSTACLE_FRICTION
  body.frictionStatic = OBSTACLE_FRICTION
  body.restitution = 0.55

  return body
}

export function createSpinnerToy(placement: ToyPlacement): ToyRuntime {
  const spinnerBody = createSpinnerBody(placement)
  const influenceRadius = placement.radius + BALL_RADIUS + SPINNER_INFLUENCE_MARGIN
  let activeUntil: number | null = null
  let passiveUntil: number | null = null
  let passiveStartedAt: number | null = null
  let rotationVelocity = 0
  let lastUpdateAt: number | null = null
  let lastPulseAt: number | null = null
  let passiveRotationVelocity = 0
  const insideBallIndices = new Set<number>()
  const lastNudgeAt = new Map<number, number>()
  const visual: ToyVisualState = {
    spinRad: spinnerBody.angle,
    pulse: 0,
    active: false,
    scale: 1,
  }

  return {
    placement,
    bodies: [spinnerBody],
    activate(now) {
      // 現在時刻からの効果時間を上限にするため、連打しても発動時間や角速度が無制限に積み上がらない。
      activeUntil = Math.max(activeUntil ?? -Infinity, now + SPINNER_ACTIVE_DURATION_MS)
      if (lastUpdateAt === null) lastUpdateAt = now
      lastPulseAt = now
      visual.active = true
      visual.pulse = 1
    },
    update(now, balls) {
      const rawDt = lastUpdateAt === null ? 0 : now - lastUpdateAt
      const dt = clamp(Math.max(0, rawDt), 0, MAX_UPDATE_DT_MS)
      lastUpdateAt = now

      const isActive = activeUntil !== null && now < activeUntil
      if (!isActive && activeUntil !== null) {
        activeUntil = null
      }

      const currentInsideBallIndices = new Set<number>()
      for (const ball of balls) {
        const distance = Math.hypot(
          ball.body.position.x - placement.x,
          ball.body.position.y - placement.y,
        )
        if (distance > influenceRadius) continue

        currentInsideBallIndices.add(ball.ballIndex)
        if (!isActive && !insideBallIndices.has(ball.ballIndex)) {
          const passiveIsActive = passiveUntil !== null && now < passiveUntil
          if (!passiveIsActive) passiveStartedAt = now
          passiveUntil = Math.max(passiveUntil ?? -Infinity, now + PASSIVE_SPIN_DURATION_MS)
          passiveRotationVelocity = Math.max(
            passiveRotationVelocity,
            PASSIVE_SPIN_MAX_ANGULAR_VELOCITY,
          )
        }
      }
      insideBallIndices.clear()
      for (const ballIndex of currentInsideBallIndices) insideBallIndices.add(ballIndex)

      if (isActive && activeUntil !== null) {
        // 残り時間だけで角速度を決めるので、再タップは必ず角速度を上限へ戻し、
        // 決して減速させない。
        const remaining = activeUntil - now
        rotationVelocity =
          SPINNER_MAX_ANGULAR_VELOCITY * clamp(remaining / SPINNER_SPIN_DOWN_MS, 0, 1)
      } else if (passiveUntil !== null && passiveStartedAt !== null && now < passiveUntil) {
        const passiveDuration = Math.max(PASSIVE_SPIN_DURATION_MS, passiveUntil - passiveStartedAt)
        const progress = clamp((now - passiveStartedAt) / passiveDuration, 0, 1)
        const easedVelocity = PASSIVE_SPIN_MAX_ANGULAR_VELOCITY * (1 - progress)
        passiveRotationVelocity = Math.min(passiveRotationVelocity, easedVelocity)
        rotationVelocity = passiveRotationVelocity
      } else {
        rotationVelocity = 0
        passiveRotationVelocity = 0
        passiveUntil = null
        passiveStartedAt = null
      }

      if (rotationVelocity !== 0 && dt !== 0) {
        const nextAngle = spinnerBody.angle + rotationVelocity * (dt / STEP_MS)
        Body.setAngle(spinnerBody, nextAngle)
      }
      // 静的BodyはEngine.updateの積分対象外だが、衝突計算はanglePrevとの差を速度として使う。
      Body.setAngularVelocity(spinnerBody, rotationVelocity)

      for (const ball of balls) {
        const distance = Math.hypot(
          ball.body.position.x - placement.x,
          ball.body.position.y - placement.y,
        )
        if (distance > influenceRadius) continue

        if (rotationVelocity !== 0) {
          setCappedVelocity(ball.body)
        }
        if (!isActive || speedOf(ball.body) >= SPINNER_STALL_SPEED_THRESHOLD) continue

        const lastNudge = lastNudgeAt.get(ball.ballIndex) ?? -Infinity
        if (now - lastNudge < SPINNER_NUDGE_COOLDOWN_MS) continue

        const offsetX = ball.body.position.x - placement.x
        const offsetY = ball.body.position.y - placement.y
        const distanceForTangent = Math.hypot(offsetX, offsetY)
        const tangent =
          distanceForTangent < 0.001
            ? { x: 1, y: 0 }
            : { x: -offsetY / distanceForTangent, y: offsetX / distanceForTangent }
        Body.setVelocity(ball.body, {
          x: tangent.x * SPINNER_NUDGE_SPEED,
          y: tangent.y * SPINNER_NUDGE_SPEED,
        })
        lastNudgeAt.set(ball.ballIndex, now)
      }

      const pulseElapsed = lastPulseAt === null ? PULSE_DURATION_MS : Math.max(0, now - lastPulseAt)
      visual.pulse = 1 - clamp(pulseElapsed / PULSE_DURATION_MS, 0, 1)
      visual.active = isActive
      visual.spinRad = spinnerBody.angle
    },
    readVisualState() {
      visual.spinRad = spinnerBody.angle
      return visual
    },
  }
}
