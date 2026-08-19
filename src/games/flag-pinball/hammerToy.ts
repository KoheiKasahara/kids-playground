import * as Matter from 'matter-js'
import { BALL_RADIUS } from './boardLayout'
import { MAX_SPEED, OBSTACLE_FRICTION, STEP_MS } from './pinballPhysics'
import type { ToyPlacement } from './toyLayout'
import type { ToyBall, ToyRuntime, ToyVisualState } from './toyRuntime'

const { Body, Bodies } = Matter

/**
 * ハンマーtoy。おかしテーマ専用の新しいおもちゃ。placement中心を支点に、
 * 1本の棒（キャンディハンマー）が一定角度の範囲内を自動で往復スイングし続ける
 * （タップ不要。ジャンプ台と同じ「触れたら常に作動する」系統）。
 *
 * 回転おもちゃ(spinnerToy.ts)・シーソー(seesawToy.ts)と同じく、静的Bodyの角度を
 * 毎フレーム直接計算してBody.setAngleで反映し、Body.setAngularVelocityで衝突解決へ
 * 伝える方式を踏襲する。spinnerが「一定角速度で回り続ける」・seesawが「ボールの荷重で
 * 目標角度が決まる」のに対し、ハンマーは「時間だけで角度が決まる正弦波」で
 * 一定角度内を往復させる。360度回転せず、常に同じ振幅・周期で往復するため、
 * リセット（新しいランタイム生成）のたびに角度0（水平）から同じ位相で始まる。
 *
 * 棒の中心＝支点＝placementなので、Bodies.rectangleで作る単一の矩形が
 * そのままplacementを中心に回転する（seesawのplankと同じ考え方）。棒の両端が
 * それぞれ「ヘッド」になり、どちら側に当たっても振っている方向へ弾かれる
 * （物理的に正しい剛体の両端の接線速度は常に逆向きになる）。
 *
 * 自然な衝突による跳ね返りだけでは強さが安定しないため、両端の近くにいるボールへは、
 * その瞬間の接線方向へ直接速度を設定する明確な「バコーン」を追加で与える
 * （ジャンプ台のtryLaunchと同じ考え方）。同じボールを連続で弾き続けないよう、
 * ボールごとのクールダウンを設ける。
 */

/** 棒の厚み。壁やガイド壁より薄いが、高速なボールが貫通しない程度は確保する。 */
const HAMMER_THICKNESS = 20
/** 棒の端の丸め半径。四角い角にボールが引っかからないようにする（spinner/seesawと同じ考え方）。 */
const HAMMER_CHAMFER_RADIUS = HAMMER_THICKNESS / 2
/** 棒そのものの反発。強すぎる自然弾みは「バコーン」を不安定にするため、控えめにする。 */
const HAMMER_RESTITUTION = 0.55
/**
 * 最大振れ角(rad)。約46度。水平(角度0)を中心に左右へこの角度まで振れる。
 * 360度回転や異常回転を防ぐ構造上の上限（sin関数の値域自体が[-1,1]なので、
 * この値を超えることは計算上あり得ない）。
 */
const HAMMER_MAX_ANGLE = 0.8
/** 往復1周期(ms)。振れ幅の割に速すぎず遅すぎない「わちゃわちゃ」した往復にする。 */
const HAMMER_SWING_PERIOD_MS = 1200
/** 1回のupdateで進めるdtの上限(ms)。タブ復帰直後の一気の追いつきを防ぐ（他toyと同じ考え方）。 */
const MAX_UPDATE_DT_MS = 100
/** 棒の端（ヘッド）の当たり判定に使う余白。厚みの半分＋ボール半径に少し足す。 */
const END_INFLUENCE_MARGIN = 10
/**
 * この接線速度(px/step)未満のときは「バコーン」を発動しない。振れの端（折り返し直前・直後）で
 * ほぼ止まっているタイミングにボールが触れても、弱い自然な弾みだけで済ませ、
 * 毎回強く飛ばさない・かつ「叩かれた」と感じない弱さにもしないための境目にする。
 */
const HAMMER_KICK_MIN_HEAD_SPEED = 1.2
/** 「バコーン」発動時に与える速さの目標値(px/step)。ジャンプ台(13)より明確に強くする。 */
const HAMMER_KICK_SPEED = 15
/** 合成速度の安全上限。全体上限24px/stepの範囲内に収め、毎回盤外へ飛ばす力にはしない。 */
const HAMMER_KICK_SPEED_CAP = Math.min(MAX_SPEED * 0.75, 17)
/** 既存の速度をわずかに残す（他toyの押し出しと同じ考え方）。真の方向はハンマー側が決める。 */
const HAMMER_VELOCITY_RETENTION = 0.2
/** 同じボールを連続で弾き続けないための個別クールダウン。「同じ場所で無限に弾かれ続けない」ための安全装置。 */
const HAMMER_BALL_COOLDOWN_MS = 550
/** タップ演出のパルス時間。実際のスイングは常時自動なので、タップは見た目のパルスだけを起こす。 */
const PULSE_DURATION_MS = 260
/** 実際にボールを弾いた瞬間だけ「活性化」の見た目にする短いフレア時間。 */
const FLARE_DURATION_MS = 260
/** 既存の障害物・得点ゾーン・ball-N と衝突せず、盤面側の特殊処理を発火させない名前にする。 */
const HAMMER_BODY_LABEL = 'toy-hammer-arm'

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function createHammerBody(placement: ToyPlacement): Matter.Body {
  const armLength = placement.radius * 2
  return Bodies.rectangle(placement.x, placement.y, armLength, HAMMER_THICKNESS, {
    chamfer: { radius: HAMMER_CHAMFER_RADIUS },
    friction: OBSTACLE_FRICTION,
    isStatic: true,
    label: HAMMER_BODY_LABEL,
    restitution: HAMMER_RESTITUTION,
  })
}

export function createHammerToy(placement: ToyPlacement): ToyRuntime {
  const hammerBody = createHammerBody(placement)
  const halfLength = placement.radius
  const endInfluenceRadius = HAMMER_THICKNESS / 2 + BALL_RADIUS + END_INFLUENCE_MARGIN
  let currentAngle = 0
  let elapsedMs = 0
  let lastUpdateAt: number | null = null
  let lastPulseAt: number | null = null
  let lastKickAt: number | null = null
  const lastBallKickAt = new Map<number, number>()
  const visual: ToyVisualState = {
    spinRad: 0,
    pulse: 0,
    active: false,
    scale: 1,
  }

  /**
   * 支点から見た端の位置(offsetX, offsetY)付近にいるボールへ「バコーン」を試みる。
   * 発動できたらtrueを返す。
   */
  function tryKickAtEnd(
    now: number,
    ball: ToyBall,
    offsetX: number,
    offsetY: number,
    angularVelocity: number,
  ): boolean {
    const endX = placement.x + offsetX
    const endY = placement.y + offsetY
    const dx = ball.body.position.x - endX
    const dy = ball.body.position.y - endY
    if (Math.hypot(dx, dy) > endInfluenceRadius) return false

    // 剛体の角速度から、その端(offsetX, offsetY)の接線方向の速度(v = ω × r)を求める。
    const tangentialX = -angularVelocity * offsetY
    const tangentialY = angularVelocity * offsetX
    const headSpeed = Math.hypot(tangentialX, tangentialY)
    if (headSpeed < HAMMER_KICK_MIN_HEAD_SPEED) return false

    const lastKick = lastBallKickAt.get(ball.ballIndex) ?? -Infinity
    if (now - lastKick < HAMMER_BALL_COOLDOWN_MS) return false

    const directionX = tangentialX / headSpeed
    const directionY = tangentialY / headSpeed
    const rawVx = ball.body.velocity.x * HAMMER_VELOCITY_RETENTION + directionX * HAMMER_KICK_SPEED
    const rawVy = ball.body.velocity.y * HAMMER_VELOCITY_RETENTION + directionY * HAMMER_KICK_SPEED
    const rawSpeed = Math.hypot(rawVx, rawVy)
    const speedScale = rawSpeed > HAMMER_KICK_SPEED_CAP ? HAMMER_KICK_SPEED_CAP / rawSpeed : 1

    // applyForceはdeltaの二乗で効き方が変わるため、狙った速度を直接設定する（他toyと同じ理由）。
    Body.setVelocity(ball.body, { x: rawVx * speedScale, y: rawVy * speedScale })
    lastBallKickAt.set(ball.ballIndex, now)
    return true
  }

  return {
    placement,
    bodies: [hammerBody],
    activate(now) {
      // スイングは常時自動で行われるため、タップは見た目のパルスだけを起こす
      // （ジャンプ台のactivateと同じ考え方）。
      lastPulseAt = now
      visual.pulse = 1
    },
    update(now, balls) {
      const rawDt = lastUpdateAt === null ? 0 : now - lastUpdateAt
      const dt = clamp(Math.max(0, rawDt), 0, MAX_UPDATE_DT_MS)
      lastUpdateAt = now
      elapsedMs += dt

      const previousAngle = hammerBody.angle
      currentAngle = HAMMER_MAX_ANGLE * Math.sin((2 * Math.PI * elapsedMs) / HAMMER_SWING_PERIOD_MS)
      const angularVelocity = dt > 0 ? (currentAngle - previousAngle) / (dt / STEP_MS) : 0
      Body.setAngle(hammerBody, currentAngle)
      // 静的BodyはEngine.updateの積分対象外だが、衝突計算はangleの変化を速度として使う
      // （spinnerToy.ts / seesawToy.tsと同じ理由）。
      Body.setAngularVelocity(hammerBody, angularVelocity)

      const offsetAx = halfLength * Math.cos(currentAngle)
      const offsetAy = halfLength * Math.sin(currentAngle)

      let kicked = false
      for (const ball of balls) {
        if (tryKickAtEnd(now, ball, offsetAx, offsetAy, angularVelocity)) kicked = true
        if (tryKickAtEnd(now, ball, -offsetAx, -offsetAy, angularVelocity)) kicked = true
      }
      if (kicked) lastKickAt = now

      const pulseElapsed = lastPulseAt === null ? PULSE_DURATION_MS : Math.max(0, now - lastPulseAt)
      visual.pulse = 1 - clamp(pulseElapsed / PULSE_DURATION_MS, 0, 1)
      const fireElapsed = lastKickAt === null ? FLARE_DURATION_MS : Math.max(0, now - lastKickAt)
      visual.active = fireElapsed < FLARE_DURATION_MS
      visual.spinRad = currentAngle
    },
    readVisualState() {
      visual.spinRad = hammerBody.angle
      return visual
    },
  }
}
