import * as Matter from 'matter-js'
import { BALL_RADIUS } from './boardLayout'
import { OBSTACLE_FRICTION, STEP_MS } from './pinballPhysics'
import type { ToyPlacement } from './toyLayout'
import type { ToyRuntime, ToyVisualState } from './toyRuntime'

const { Body, Bodies } = Matter

/**
 * シーソーtoy。横長の板が中心（placement.x, placement.y）を支点として回転する、
 * 海テーマ専用の新しいおもちゃ。
 *
 * 他のtoy（回転・押し出し・ジャンプ台）と同じく、実際の質量やジョイントによる力学は使わず、
 * 「板の上に乗っているボールの位置」から目標角度を毎フレーム計算し、その角度へ一定の速さで
 * 近づける（spinnerToy.tsが角度を直接操作する方式と同じ考え方）。Matterのconstraintで
 * 関節として実装する案も検討したが、3球同時載荷や連続衝突での発散・脱調のリスクを避け、
 * 「最大角度を絶対に超えない」を構造で保証するため、角度を完全に管理下に置けるこの方式にした。
 */

/** 板の厚み（論理座標）。壁やガイド壁より厚くし、高速なボールが貫通しないようにする。 */
const PLANK_THICKNESS = 22
/**
 * 最大傾斜角(rad)。約18度。「乗ったら板がガタンと動いた」と分かる大きさを確保しつつ、
 * ボールを盤外まで吹き飛ばすほど急な斜面にはしない。sin(0.32rad)≒0.31なので、
 * 重力0.55px/stepの3割程度が斜面方向の加速度になり、乗ったボールは自然に転がり落ちる。
 */
const MAX_ANGLE = 0.32
/** 目標角度へ近づく速さ(rad/ms)。0→MAX_ANGLEを約240msで駆け抜け、「ガタン」と分かる速さにする。 */
const ANGLE_SLEW_RATE = MAX_ANGLE / 240
/** 板の上のボールを検出する範囲（板の半長方向）。半長にボール半径の半分ぶんの余裕を足す。 */
const CONTACT_X_MARGIN = BALL_RADIUS * 0.5
/** 板面に沿っていると判定する高さ方向の許容範囲。ボール半径＋余裕。 */
const CONTACT_Y_MARGIN = BALL_RADIUS + 14
/** 1回のupdateで進めるdtの上限(ms)。タブ復帰直後の一気の追いつきを防ぐ（spinnerToyと同じ考え方）。 */
const MAX_UPDATE_DT_MS = 100
/** 板そのものの反発。跳ねすぎず、かつ止まりすぎない中間の値。 */
const PLANK_RESTITUTION = 0.5
/** 端の丸め半径。四角い角にボールが引っかからないようにする（spinnerToyの羽根と同じ考え方）。 */
const PLANK_CHAMFER_RADIUS = PLANK_THICKNESS / 2
/** タップ演出のパルス時間。実際の傾きには影響しない（見た目だけの手応え）。 */
const PULSE_DURATION_MS = 260
/** 既存の障害物・得点ゾーン・ball-N と衝突せず、盤面側の特殊処理を発火させない名前にする。 */
const SEESAW_BODY_LABEL = 'toy-seesaw-plank'

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function createSeesawBody(placement: ToyPlacement): Matter.Body {
  const plankLength = placement.radius * 2
  return Bodies.rectangle(placement.x, placement.y, plankLength, PLANK_THICKNESS, {
    chamfer: { radius: PLANK_CHAMFER_RADIUS },
    friction: OBSTACLE_FRICTION,
    isStatic: true,
    label: SEESAW_BODY_LABEL,
    restitution: PLANK_RESTITUTION,
  })
}

/**
 * ボールが板面に沿っている（乗っている）とみなせる位置にあれば、支点からの符号付き距離を
 * plankHalfLength で正規化した値（-1..1、範囲外はクランプ）を返す。範囲外はnull。
 * 現在の板の角度で回転させたローカル座標で判定するため、傾いた状態でも
 * 「板のどちら側に、どれくらい乗っているか」を正しく求められる。
 */
function localOffsetOnPlank(
  ballBody: Matter.Body,
  placement: ToyPlacement,
  currentAngle: number,
  plankHalfLength: number,
): number | null {
  const dx = ballBody.position.x - placement.x
  const dy = ballBody.position.y - placement.y
  const cos = Math.cos(currentAngle)
  const sin = Math.sin(currentAngle)
  const localX = dx * cos + dy * sin
  const localY = -dx * sin + dy * cos
  if (Math.abs(localX) > plankHalfLength + CONTACT_X_MARGIN) return null
  if (Math.abs(localY) > PLANK_THICKNESS / 2 + CONTACT_Y_MARGIN) return null
  return clamp(localX / plankHalfLength, -1, 1)
}

export function createSeesawToy(placement: ToyPlacement): ToyRuntime {
  const plankBody = createSeesawBody(placement)
  const plankHalfLength = placement.radius
  let currentAngle = 0
  let lastUpdateAt: number | null = null
  let lastPulseAt: number | null = null
  const visual: ToyVisualState = {
    spinRad: 0,
    pulse: 0,
    active: false,
    scale: 1,
  }

  return {
    placement,
    bodies: [plankBody],
    activate(now) {
      // タップは見た目のパルスだけを起こす。実際の傾きは常にボールの位置から決まるため、
      // タップで角度を直接操作すると「乗ることで自然に傾く」という要件から外れてしまう。
      lastPulseAt = now
      visual.pulse = 1
    },
    update(now, balls) {
      const rawDt = lastUpdateAt === null ? 0 : now - lastUpdateAt
      const dt = clamp(Math.max(0, rawDt), 0, MAX_UPDATE_DT_MS)
      lastUpdateAt = now

      let netOffset = 0
      let ballsOnPlank = 0
      for (const ball of balls) {
        const offset = localOffsetOnPlank(ball.body, placement, currentAngle, plankHalfLength)
        if (offset === null) continue
        netOffset += offset
        ballsOnPlank += 1
      }

      // 複数球が同じ側に乗っても目標角度はMAX_ANGLEで頭打ちにする（3球同時でも発散しない）。
      const targetAngle = ballsOnPlank === 0 ? 0 : clamp(netOffset, -1, 1) * MAX_ANGLE
      const maxStep = ANGLE_SLEW_RATE * dt
      if (currentAngle < targetAngle) {
        currentAngle = Math.min(currentAngle + maxStep, targetAngle)
      } else if (currentAngle > targetAngle) {
        currentAngle = Math.max(currentAngle - maxStep, targetAngle)
      }
      // 念のため、計算上の誤差があっても最大角度を絶対に超えないようクランプする
      // （360度回転や異常回転を構造的に防ぐ最後の砦）。
      currentAngle = clamp(currentAngle, -MAX_ANGLE, MAX_ANGLE)

      const previousAngle = plankBody.angle
      const angularVelocity = dt > 0 ? (currentAngle - previousAngle) / (dt / STEP_MS) : 0
      Body.setAngle(plankBody, currentAngle)
      // 静的BodyはEngine.updateの積分対象外だが、衝突計算はangleの変化を速度として使う
      // （spinnerToy.tsと同じ理由）。
      Body.setAngularVelocity(plankBody, angularVelocity)

      const pulseElapsed = lastPulseAt === null ? PULSE_DURATION_MS : Math.max(0, now - lastPulseAt)
      visual.pulse = 1 - clamp(pulseElapsed / PULSE_DURATION_MS, 0, 1)
      visual.active = ballsOnPlank > 0
      visual.spinRad = currentAngle
    },
    readVisualState() {
      visual.spinRad = plankBody.angle
      return visual
    },
  }
}
