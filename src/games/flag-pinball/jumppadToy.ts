import * as Matter from 'matter-js'
import { BALL_RADIUS } from './boardLayout'
import { MAX_SPEED, OBSTACLE_FRICTION } from './pinballPhysics'
import type { ToyPlacement } from './toyLayout'
import type { RandomSource, ToyRuntime, ToyVisualState } from './toyRuntime'

const { Body, Bodies } = Matter

/**
 * ジャンプ台は他の2つのおもちゃ（回転・押し上げ）と違い、タップで発動する仕掛けではなく、
 * ボールが触れるだけで常に作動する障害物として振る舞う。宇宙盤面を「重力に振り回されながら
 * 惑星や人工衛星の間を飛び回る」体感にするため、盤面のどこにボールがいてもジャンプ台へ
 * 近づけば自動で跳ね返る必要があるためタップ待ちにしていない。
 */

/** 接触判定に使う余白。おもちゃ半径＋ボール半径に少しだけ足し、「触れたら跳ねる」に近い範囲にする。 */
const INFLUENCE_MARGIN = 10
/**
 * 重力0.55px/stepでの上昇量は 13^2/(2*0.55)≒153.6px となり、ボール直径約48pxの3.2個分だけ
 * 上へ戻す。押し上げおもちゃ（11.5px/step、2.5個分）よりはっきり大きく戻すが、画面上端まで
 * 吹き飛ぶほどではない強さに留めている。
 */
const JUMPPAD_LAUNCH_UP_SPEED = 13
/** 横方向の速度を大きめに残し、宇宙盤面らしい大きな左右移動を作る（押し上げおもちゃの4px/stepより広い）。 */
const MAX_HORIZONTAL_SPEED = 9
/** 左右ランダムに与える散らしの最低限。真上へ固定せず斜めへ飛ばす。 */
const RANDOM_HORIZONTAL_MIN_SPEED = 3
const RANDOM_HORIZONTAL_MAX_SPEED = 7
/** 既存の横速度は少しだけ残す（押し出しおもちゃと同じ考え方）。 */
const HORIZONTAL_VELOCITY_RETENTION = 0.3
/** 合成速度の安全上限。全体上限24px/stepの半分強に留め、盤外へ飛ばす力にならないようにする。 */
const JUMPPAD_SPEED_CAP = Math.min(MAX_SPEED * 0.65, 15)
/** すでにこれ以上の速さで上昇中のボールは対象にせず、同じ弾みへ二重に加算しない。 */
const ALREADY_RISING_THRESHOLD = JUMPPAD_LAUNCH_UP_SPEED * 0.5
/** 同じボールを連続で打ち上げ続けないための個別クールダウン。「同じ場所で無限に跳ね続けない」ための主な安全装置。 */
const BALL_COOLDOWN_MS = 800
/** タップ・自動発火のどちらでも見た目のパルスは短く共通にする。 */
const PULSE_DURATION_MS = 260
/** 実際にボールを打ち上げた瞬間だけ「噴射中」の見た目にする短いフレア時間。 */
const FLARE_DURATION_MS = 260
/** 静的パッドそのものの反発。直接の速度上書きに加え、触れた瞬間の弾みも少し持たせる。 */
const JUMPPAD_RESTITUTION = 0.5
/** 既存の障害物・得点ゾーン・ball-N と衝突せず、盤面側の特殊処理を発火させない名前にする。 */
const JUMPPAD_BODY_LABEL = 'toy-jumppad-pad'

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function createJumppadBody(placement: ToyPlacement): Matter.Body {
  return Bodies.circle(placement.x, placement.y, placement.radius, {
    friction: OBSTACLE_FRICTION,
    isStatic: true,
    label: JUMPPAD_BODY_LABEL,
    restitution: JUMPPAD_RESTITUTION,
  })
}

/** ボールを打ち上げられれば true を返す。呼び出し側はこれを「発射した」判定に使う。 */
function tryLaunch(
  body: Matter.Body,
  placement: ToyPlacement,
  influenceRadius: number,
  random: RandomSource,
): boolean {
  const offsetX = body.position.x - placement.x
  const offsetY = body.position.y - placement.y
  if (Math.hypot(offsetX, offsetY) > influenceRadius) return false
  if (body.velocity.y <= -ALREADY_RISING_THRESHOLD) return false

  // 常にどちらから当たったかで左右を決めてしまうと、盤面側の斜めガイドが特定方向へ
  // ボールを寄せがちな場合にジャンプ台がその偏りへさらに加担してしまう
  // （実測で得点ゾーンの分布が大きく片側へ偏った）。ここでは左右をランダムに選び、
  // 盤面全体としてどちらの得点ゾーンにも届く可能性を残す。
  const randomHorizontalDirection = random() < 0.5 ? -1 : 1
  const dampedHorizontalVelocity = clamp(
    body.velocity.x * HORIZONTAL_VELOCITY_RETENTION,
    -MAX_HORIZONTAL_SPEED,
    MAX_HORIZONTAL_SPEED,
  )
  const randomHorizontalSpeed =
    RANDOM_HORIZONTAL_MIN_SPEED + random() * (RANDOM_HORIZONTAL_MAX_SPEED - RANDOM_HORIZONTAL_MIN_SPEED)
  const horizontalVelocity = clamp(
    dampedHorizontalVelocity + randomHorizontalDirection * randomHorizontalSpeed,
    -MAX_HORIZONTAL_SPEED,
    MAX_HORIZONTAL_SPEED,
  )
  const verticalVelocity = -JUMPPAD_LAUNCH_UP_SPEED
  const rawSpeed = Math.hypot(horizontalVelocity, verticalVelocity)
  const speedScale = rawSpeed > JUMPPAD_SPEED_CAP ? JUMPPAD_SPEED_CAP / rawSpeed : 1

  // applyForceはdeltaの二乗で効き方が変わるため、狙った速度を直接設定する（押し出しおもちゃと同じ理由）。
  Body.setVelocity(body, {
    x: horizontalVelocity * speedScale,
    y: verticalVelocity * speedScale,
  })
  return true
}

export function createJumppadToy(placement: ToyPlacement, random: RandomSource = Math.random): ToyRuntime {
  const jumppadBody = createJumppadBody(placement)
  const influenceRadius = placement.radius + BALL_RADIUS + INFLUENCE_MARGIN
  const lastBallLaunchAt = new Map<number, number>()
  let lastPulseAt: number | null = null
  let lastFireAt: number | null = null
  const visual: ToyVisualState = {
    spinRad: 0,
    pulse: 0,
    active: false,
    scale: 1,
  }

  return {
    placement,
    bodies: [jumppadBody],
    activate(now) {
      // タップは見た目の演出だけを起こす。実際にボールを打ち上げるかどうかは
      // 常時判定している update() のみが決める（同じボールへ二重に速度を与えないため）。
      lastPulseAt = now
      lastFireAt = now
      visual.pulse = 1
    },
    update(now, balls) {
      for (const ball of balls) {
        const lastLaunchAt = lastBallLaunchAt.get(ball.ballIndex)
        if (lastLaunchAt !== undefined && now - lastLaunchAt < BALL_COOLDOWN_MS) continue
        if (tryLaunch(ball.body, placement, influenceRadius, random)) {
          lastBallLaunchAt.set(ball.ballIndex, now)
          lastFireAt = now
        }
      }

      const pulseElapsed = lastPulseAt === null ? PULSE_DURATION_MS : Math.max(0, now - lastPulseAt)
      visual.pulse = 1 - clamp(pulseElapsed / PULSE_DURATION_MS, 0, 1)
      const fireElapsed = lastFireAt === null ? FLARE_DURATION_MS : Math.max(0, now - lastFireAt)
      visual.active = fireElapsed < FLARE_DURATION_MS
      visual.spinRad = 0
    },
    readVisualState() {
      return visual
    },
  }
}
