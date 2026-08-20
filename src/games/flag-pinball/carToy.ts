import * as Matter from 'matter-js'
import { BALL_RADIUS } from './boardLayout'
import { OBSTACLE_FRICTION, STEP_MS } from './pinballPhysics'
import type { ToyPlacement } from './toyLayout'
import type { ToyBall, ToyRuntime, ToyVisualState } from './toyRuntime'

const { Body, Bodies } = Matter

/**
 * 車toy。くるまテーマ専用の新しいおもちゃで、他のtoy（回転・押し出し・ジャンプ台・
 * シーソー・ハンマー・風）とは違い「盤面上を実際に水平移動するCollider」を持つ。
 *
 * センサーで力を加える風toy（windToy.ts）とは根本的に方式が違う。車は
 * placement.car.leftX 〜 rightX の間を一定速度で往復する複合Body（丸みのある車体＋
 * 屋根）で、ボールとは通常の物理衝突として当たる。回転おもちゃ・シーソー・ハンマーと
 * 同じく「静的Bodyの位置を毎フレーム直接書き換え、その移動量から求めた速度を
 * Body.setVelocityで衝突解決へ伝える」方式を採る（isStaticなBodyはEngine.updateの
 * 積分対象外だが、衝突計算はBody.velocity/angularVelocityの値を使うため）。
 * この方式なら、ボールが車の前面・屋根・後部のどこに当たったかによって、
 * 通常の物理（衝突法線・車の速度）だけで自然に弾む向きが変わる。
 *
 * 車の下に隙間を作らない・端で壁との間に挟まれないための対策は、carToy.tsではなく
 * 盤面側（boardConfigs/carBoard.ts）で行う。具体的には「車が往復する道路には
 * 物理的な床を置かない（当たらなかったボールはそのまま下へ抜ける）」「leftX・rightXを
 * 外壁から十分離す」の2点で、車自身の実装はplacement.car.leftX/rightXの範囲を
 * 絶対に超えないことだけを保証すればよい。
 */

/** 1回のupdateで進めるdtの上限(ms)。タブ復帰直後の一気の追いつきを防ぐ（他toyと同じ考え方）。 */
const MAX_UPDATE_DT_MS = 100
/** 車体（下側の胴体）の半幅・半高。丸みのある車体をchamferで近似する。 */
const BODY_HALF_WIDTH = 50
const BODY_HALF_HEIGHT = 17
/** 胴体を基準にした中心からの縦オフセット（正で下）。屋根ぶん上に余裕を残す。 */
const BODY_OFFSET_Y = 8
/**
 * 屋根（上側のキャビン）は円で近似する。矩形＋chamferだと横方向の中央に必ず平らな帯が
 * 残り、真上から落ちたボールがちょうどそこへ静止できてしまう（spinnerToy.tsの羽根先端で
 * 見つかった罠と同種）。円にすれば「動かない車」でも頂点1点でしか支えられず、車自身が
 * 常に左右へ動き続けることもあって、乗ったボールは自然に転がり落ちる。
 */
const CABIN_RADIUS = 22
const CABIN_OFFSET_Y = -16
/** 角を丸め、「動く壁」に見えないようにする。厚みの半分を上限に、かなり丸くする。 */
const BODY_CHAMFER_RADIUS = 15
/** 車体そのものの反発。強すぎる吹き飛びを避けつつ、当たった手応えは残す。 */
const CAR_RESTITUTION = 0.6
/** 既存の障害物・得点ゾーン・ball-N と衝突せず、盤面側の特殊処理を発火させない名前にする。 */
const CAR_BODY_LABEL = 'toy-car-body'
/** タップ演出のパルス時間。車の往復は常時自動なので、タップは見た目のパルスだけを起こす。 */
const PULSE_DURATION_MS = 260
/** ボールが車体近くに触れてから「活性化」の見た目を保つ短い時間（ジャンプ台・ハンマーと同じ考え方）。 */
const FLARE_DURATION_MS = 260
/** 車体（胴体）へのボール接触判定に使う余白。ボール半径ぶん＋少し余裕を持たせる。 */
const CONTACT_MARGIN = 6

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function createCarBody(placement: ToyPlacement): Matter.Body {
  const options = {
    chamfer: { radius: BODY_CHAMFER_RADIUS },
    friction: OBSTACLE_FRICTION,
    label: CAR_BODY_LABEL,
    restitution: CAR_RESTITUTION,
  }
  const mainBody = Bodies.rectangle(
    placement.x,
    placement.y + BODY_OFFSET_Y,
    BODY_HALF_WIDTH * 2,
    BODY_HALF_HEIGHT * 2,
    options,
  )
  const cabin = Bodies.circle(placement.x, placement.y + CABIN_OFFSET_Y, CABIN_RADIUS, {
    friction: OBSTACLE_FRICTION,
    label: CAR_BODY_LABEL,
    restitution: CAR_RESTITUTION,
  })
  const body = Body.create({
    isStatic: true,
    label: CAR_BODY_LABEL,
    parts: [mainBody, cabin],
  })

  // Body.create({ isStatic: true }) はデフォルトの摩擦・反発を上書きするため、
  // 盤上の他toyと同じく明示的に戻す（spinnerToy.tsと同じ理由）。
  for (const part of body.parts) {
    part.friction = OBSTACLE_FRICTION
    part.frictionStatic = OBSTACLE_FRICTION
    part.restitution = CAR_RESTITUTION
    part.label = CAR_BODY_LABEL
  }
  body.friction = OBSTACLE_FRICTION
  body.frictionStatic = OBSTACLE_FRICTION
  body.restitution = CAR_RESTITUTION

  return body
}

export function createCarToy(placement: ToyPlacement): ToyRuntime {
  const car = placement.car
  if (!car) {
    throw new Error(`flag-pinball: 車toy(${placement.id})にcar設定がありません`)
  }
  if (car.leftX > car.rightX) {
    throw new Error(`flag-pinball: 車toy(${placement.id})のleftXがrightXを超えています`)
  }

  const carBody = createCarBody(placement)
  // 初期位置はplacement.xそのもの（他toyとの一貫性のため）。leftX〜rightXの範囲外を
  // 渡された場合は範囲内へ丸め、物理的な移動範囲を絶対に超えないことを構造で保証する。
  let currentX = clamp(placement.x, car.leftX, car.rightX)
  let direction: 1 | -1 = car.initialDirection
  let lastUpdateAt: number | null = null
  let lastPulseAt: number | null = null
  let lastContactAt: number | null = null
  const visual: ToyVisualState = {
    spinRad: 0,
    pulse: 0,
    active: false,
    scale: 1,
    offsetX: currentX - placement.x,
    facing: direction === 1 ? 'right' : 'left',
  }

  Body.setPosition(carBody, { x: currentX, y: placement.y })

  return {
    placement,
    bodies: [carBody],
    activate(now) {
      // 往復は常時自動で行われるため、タップは見た目のパルスだけを起こす
      // （ジャンプ台・ハンマーのactivateと同じ考え方）。
      lastPulseAt = now
      visual.pulse = 1
    },
    update(now, balls: readonly ToyBall[]) {
      const rawDt = lastUpdateAt === null ? 0 : now - lastUpdateAt
      const dt = clamp(Math.max(0, rawDt), 0, MAX_UPDATE_DT_MS)
      lastUpdateAt = now

      if (dt > 0) {
        const distance = car.speed * (dt / STEP_MS)
        let nextX = currentX + direction * distance
        if (nextX >= car.rightX) {
          nextX = car.rightX
          direction = -1
        } else if (nextX <= car.leftX) {
          nextX = car.leftX
          direction = 1
        }

        const velocityXPerStep = (nextX - currentX) / (dt / STEP_MS)
        currentX = nextX
        Body.setPosition(carBody, { x: currentX, y: placement.y })
        // 静的BodyはEngine.updateの積分対象外だが、衝突計算はBody.velocityの値を使う
        // （spinnerToy.ts / seesawToy.tsの角速度と同じ理由。今回は並進速度版）。
        Body.setVelocity(carBody, { x: velocityXPerStep, y: 0 })
      }

      const halfWidth = BODY_HALF_WIDTH + BALL_RADIUS + CONTACT_MARGIN
      const halfHeight = BODY_HALF_HEIGHT + BALL_RADIUS + CONTACT_MARGIN
      const carCenterY = placement.y + BODY_OFFSET_Y
      const touching = balls.some(
        (ball) =>
          Math.abs(ball.body.position.x - currentX) <= halfWidth &&
          Math.abs(ball.body.position.y - carCenterY) <= halfHeight,
      )
      if (touching) lastContactAt = now

      const pulseElapsed = lastPulseAt === null ? PULSE_DURATION_MS : Math.max(0, now - lastPulseAt)
      visual.pulse = 1 - clamp(pulseElapsed / PULSE_DURATION_MS, 0, 1)
      const contactElapsed = lastContactAt === null ? FLARE_DURATION_MS : Math.max(0, now - lastContactAt)
      visual.active = contactElapsed < FLARE_DURATION_MS
      visual.spinRad = 0
      visual.offsetX = currentX - placement.x
      visual.facing = direction === 1 ? 'right' : 'left'
    },
    readVisualState() {
      return visual
    },
  }
}
