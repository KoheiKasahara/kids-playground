import { BALL_RADIUS } from './boardLayout'
import { MAX_SPEED, OBSTACLE_FRICTION } from './pinballPhysics'
import { createLifterCore } from '../shared/toys/lifterCore'
import type { ToyPlacement } from './toyLayout'
import type { RandomSource, ToyRuntime, ToyVisualState } from './toyRuntime'

/**
 * ジャンプ台は他のおもちゃと違い、タップで発動する仕掛けではなく、
 * ボールが触れるだけで常に作動する障害物として振る舞う。
 */

/** 接触判定に使う余白。おもちゃ半径＋ボール半径に少しだけ足し、「触れたら跳ねる」に近い範囲にする。 */
const INFLUENCE_MARGIN = 10
/** 重力0.55px/stepでの上昇量が約154pxとなる、押し上げおもちゃより強めの初速。 */
const JUMPPAD_LAUNCH_UP_SPEED = 13
/** 横方向の速度を大きめに残し、宇宙盤面らしい大きな左右移動を作る。 */
const MAX_HORIZONTAL_SPEED = 9
/** 左右ランダムに与える散らしの最低限。真上へ固定せず斜めへ飛ばす。 */
const RANDOM_HORIZONTAL_MIN_SPEED = 3
const RANDOM_HORIZONTAL_MAX_SPEED = 7
/** 既存の横速度は少しだけ残す。 */
const HORIZONTAL_VELOCITY_RETENTION = 0.3
/** 合成速度の安全上限。全体上限24px/stepの半分強に留める。 */
const JUMPPAD_SPEED_CAP = Math.min(MAX_SPEED * 0.65, 15)
/** 同じボールを連続で打ち上げ続けないための個別クールダウン。 */
const BALL_COOLDOWN_MS = 800
/** タップ・自動発火のどちらでも見た目のパルスは短く共通にする。 */
const PULSE_DURATION_MS = 260
/** 実際にボールを打ち上げた瞬間だけ「噴射中」の見た目にする短いフレア時間。 */
const FLARE_DURATION_MS = 260
/** 静的パッドそのものの反発。直接の速度上書きに加え、触れた瞬間の弾みも少し持たせる。 */
const JUMPPAD_RESTITUTION = 0.5
/** 既存の障害物・得点ゾーン・ball-N と衝突せず、盤面側の特殊処理を発火させない名前にする。 */
const JUMPPAD_BODY_LABEL = 'toy-jumppad-pad'

export function createJumppadToy(placement: ToyPlacement, random: RandomSource = Math.random): ToyRuntime {
  const lifterCore = createLifterCore({
    x: placement.x,
    y: placement.y,
    radius: placement.radius,
    friction: OBSTACLE_FRICTION,
    restitution: JUMPPAD_RESTITUTION,
    label: JUMPPAD_BODY_LABEL,
    ballRadius: BALL_RADIUS,
    influenceMargin: INFLUENCE_MARGIN,
    upSpeed: JUMPPAD_LAUNCH_UP_SPEED,
    maxHorizontalSpeed: MAX_HORIZONTAL_SPEED,
    randomHorizontalMin: RANDOM_HORIZONTAL_MIN_SPEED,
    randomHorizontalMax: RANDOM_HORIZONTAL_MAX_SPEED,
    horizontalRetention: HORIZONTAL_VELOCITY_RETENTION,
    speedCap: JUMPPAD_SPEED_CAP,
    cooldownMs: BALL_COOLDOWN_MS,
  })
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
    bodies: [lifterCore.body],
    activate(now) {
      // タップは見た目のパルスだけを起こし、実際の打ち上げはupdate()の接触判定が決める。
      lastPulseAt = now
      lastFireAt = now
      visual.pulse = 1
    },
    update(now, balls) {
      for (const ball of balls) {
        if (lifterCore.tryLaunch(now, ball.ballIndex, ball.body, random)) lastFireAt = now
      }

      const pulseElapsed = lastPulseAt === null ? PULSE_DURATION_MS : Math.max(0, now - lastPulseAt)
      visual.pulse = 1 - Math.min(1, Math.max(0, pulseElapsed / PULSE_DURATION_MS))
      const fireElapsed = lastFireAt === null ? FLARE_DURATION_MS : Math.max(0, now - lastFireAt)
      visual.active = fireElapsed < FLARE_DURATION_MS
      visual.spinRad = 0
    },
    readVisualState() {
      return visual
    },
  }
}
