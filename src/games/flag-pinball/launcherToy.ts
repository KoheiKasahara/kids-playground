import * as Matter from 'matter-js'
import { MAX_SPEED, OBSTACLE_FRICTION } from './pinballPhysics'
import type { ToyPlacement } from './toyLayout'
import type { ToyRuntime, ToyVisualState } from './toyRuntime'

const { Body, Bodies } = Matter

/** タップ後にボールを待ち受ける有効時間。 */
export const LAUNCHER_ARMED_DURATION_MS = 2000
/** 有効中に見た目と物理へ同じ倍率を適用し、押した手応えを分かりやすくする。 */
export const LAUNCHER_ARMED_SCALE = 1.15
/** タップ直後の手応えだけを見せるパルスの時間。有効時間とは分離する。 */
const PULSE_DURATION_MS = 300
/** 同じボールを何度も救い続けないようにし、別のボールには同じタップ機会を残す。 */
const BALL_PHYSICS_COOLDOWN_MS = 1200
/**
 * 有効時間で待てるため、離れた球を拾う不自然さを減らして96pxに絞る。
 * 拡大時のおもちゃ半径34.5pxとボール半径24pxを足した接触距離58.5pxに十分な余裕があり、
 * 「触れたら跳ねる」に近い範囲を保つ。
 */
export const LAUNCHER_INFLUENCE_RADIUS = 96
/** おもちゃの中心より30px上までは救えるが、それより上の浮遊中の球は追わない。 */
const UPPER_TARGET_MARGIN = 30
/**
 * 重力0.55px/stepでの上昇量は11.5^2/(2*0.55)≒120pxとなり、ボール直径約48pxの2.5個分だけ上へ戻す。
 */
const LAUNCH_UP_SPEED = 11.5
/** 横方向の速度を小さく抑え、真上へ固定せず盤面中央を狙い続けないようにする。 */
const MAX_HORIZONTAL_SPEED = 4
/** 左右の散らしを最低限残し、タップごとに同じ得点帯へ寄らないようにする。 */
const RANDOM_HORIZONTAL_MIN_SPEED = 0.8
/** 横成分をこの値以下にし、斜め上への補助が盤外へ飛ばす力にならないようにする。 */
const RANDOM_HORIZONTAL_MAX_SPEED = 1.8
/**
 * placement.launcherTide が設定されているときに、指定した向き(biasDirection)へ
 * 実際に押し出す確率。100%固定にすると「決まったルートへ強制する」ことになってしまうため、
 * 一定確率で逆向きにも散らし、「潮に乗る／外れる」の両方が起こる余地を残す。
 */
const TIDE_BIAS_PROBABILITY = 0.75
/**
 * 上向き11.5と横最大4の合成速度約12.2が通常運用で頭打ちにならず、全体上限24px/stepの半分強に留める安全弁にする。
 */
const LAUNCH_SPEED_CAP = Math.min(MAX_SPEED * 0.55, 13)
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
  const isWithinInfluenceRange = Math.hypot(offsetX, offsetY) <= LAUNCHER_INFLUENCE_RADIUS
  const isLowEnough = body.position.y >= placement.y - UPPER_TARGET_MARGIN
  const isAlreadyRising = body.velocity.y <= -LAUNCH_UP_SPEED
  if (!isWithinInfluenceRange || !isLowEnough || isAlreadyRising) return false

  // 海テーマなど launcherTide が設定された配置だけ、上向き主体から横向き主体（潮流）へ
  // 倍率で振る舞いを変える。未指定なら両方とも1のままで、既存の挙動から一切変わらない。
  const tide = placement.launcherTide
  const upSpeedScale = tide?.upSpeedScale ?? 1
  const horizontalSpeedScale = tide?.horizontalSpeedScale ?? 1
  const maxHorizontalSpeed = MAX_HORIZONTAL_SPEED * horizontalSpeedScale

  // 既存の横速度は少しだけ残し、そこへ左右ランダムの小さな散らしを足す。
  const dampedHorizontalVelocity = clamp(
    body.velocity.x * 0.25,
    -maxHorizontalSpeed,
    maxHorizontalSpeed,
  )
  // tideが未指定なら従来どおり完全ランダムな向き。指定されていれば、その向きへ
  // TIDE_BIAS_PROBABILITY の確率で偏らせつつ、残りの確率では逆向きにも散らす
  // （「潮に乗る」「潮を外れる」の両方が起こる余地を残すため、100%固定にはしない）。
  const randomHorizontalDirection =
    tide === undefined
      ? Math.random() < 0.5
        ? -1
        : 1
      : Math.random() < TIDE_BIAS_PROBABILITY
        ? tide.biasDirection
        : -tide.biasDirection
  const randomHorizontalSpeed =
    (RANDOM_HORIZONTAL_MIN_SPEED +
      Math.random() * (RANDOM_HORIZONTAL_MAX_SPEED - RANDOM_HORIZONTAL_MIN_SPEED)) *
    horizontalSpeedScale
  const horizontalVelocity = clamp(
    dampedHorizontalVelocity + randomHorizontalDirection * randomHorizontalSpeed,
    -maxHorizontalSpeed,
    maxHorizontalSpeed,
  )
  const verticalVelocity = -LAUNCH_UP_SPEED * upSpeedScale
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
  let armedUntil: number | null = null
  let lastPulseAt: number | null = null
  let appliedScale = 1
  const lastBallPhysicsActivationAt = new Map<number, number>()
  const visual: ToyVisualState = {
    spinRad: 0,
    pulse: 0,
    active: false,
    scale: 1,
  }

  function applyScaleIfNeeded(targetScale: number): void {
    if (targetScale === appliedScale) return
    Body.scale(launcherBody, targetScale / appliedScale, targetScale / appliedScale)
    appliedScale = targetScale
    visual.scale = targetScale
  }

  return {
    placement,
    bodies: [launcherBody],
    activate(now) {
      // 終了時刻を「現在時刻から2000ms」の最大値にするため、連打しても有効時間が積み上がらず暴走しない。
      armedUntil = Math.max(armedUntil ?? -Infinity, now + LAUNCHER_ARMED_DURATION_MS)
      lastPulseAt = now
      visual.active = true
      visual.pulse = 1
      applyScaleIfNeeded(LAUNCHER_ARMED_SCALE)
    },
    update(now, balls) {
      const isArmed = armedUntil !== null && now < armedUntil
      if (!isArmed && armedUntil !== null) {
        armedUntil = null
      }
      visual.active = isArmed
      applyScaleIfNeeded(isArmed ? LAUNCHER_ARMED_SCALE : 1)

      if (isArmed) {
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
      }

      const pulseElapsed = lastPulseAt === null ? PULSE_DURATION_MS : Math.max(0, now - lastPulseAt)
      visual.pulse = 1 - clamp(pulseElapsed / PULSE_DURATION_MS, 0, 1)
      visual.spinRad = 0
    },
    readVisualState() {
      return visual
    },
  }
}
