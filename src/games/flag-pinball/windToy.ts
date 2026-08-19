import * as Matter from 'matter-js'
import type { ToyPlacement } from './toyLayout'
import type { ToyBall, ToyRuntime, ToyVisualState } from './toyRuntime'

const { Body } = Matter

/**
 * 風toyは、既存の押し出しtoy（launcher）やジャンプ台のように「接触した瞬間に
 * 強い速度を1回与える」仕組みとは別物にしてある。矩形の範囲（placement.wind）に
 * ボールの中心が入っている間、毎フレーム目標速度へごくわずかずつ近づけるだけの
 * 「継続的な弱い力」として実装し、エリアを出た瞬間に効力が切れる。
 *
 * タップ待ちにもしない（jumppad/hammerと同じ「自動作動」パターン）。空テーマは
 * 「風に流されながらふわふわ落ちる」体感が主役で、タップ操作を要求すると
 * その体感と矛盾するため、activate() は見た目のパルスだけを起こす。
 */

/** 横方向の目標速度の既定値(px/step)。placement.wind.horizontalTargetSpeedで上書きできる。
 * MAX_SPEED(24px/step)よりずっと小さく、「気づくと少し横へ流されている」程度に留める。 */
const DEFAULT_HORIZONTAL_TARGET_SPEED = 3.2
/**
 * 1フレームで目標速度へ近づける量(px/step)。この値を大きくするほど「すぐ横方向へ
 * 固定される」感触に近づいてしまうため小さく保ち、エリア内に長くいるボールほど
 * じわじわ流される・すぐ抜けるボールはほとんど影響を受けない、という差を作る。
 */
const HORIZONTAL_ACCEL_PER_STEP = 0.14
/** 上向き成分の1フレームあたりの近づき量。横方向よりさらに弱くし、延々と浮き続けないようにする。 */
const VERTICAL_ACCEL_PER_STEP = 0.05
/** タップ演出だけのパルス時間。実際の風力とは無関係。 */
const PULSE_DURATION_MS = 260

/**
 * currentをtargetの方向へstepぶんだけ近づける。すでにtargetを超えている場合は
 * 何もしない（既存の勢いを弱める＝壁に押し付けるような減速はしないため）。
 * target===0なら風の設定自体がない（上向き成分なしなど）とみなし何もしない。
 */
function moveToward(current: number, target: number, step: number): number {
  if (target === 0) return current
  if (target > 0) return current >= target ? current : Math.min(target, current + step)
  return current <= target ? current : Math.max(target, current - step)
}

function isWithinWindArea(body: Matter.Body, placement: ToyPlacement): boolean {
  const wind = placement.wind
  if (!wind) return false
  return (
    Math.abs(body.position.x - placement.x) <= wind.halfWidth &&
    Math.abs(body.position.y - placement.y) <= wind.halfHeight
  )
}

function applyWind(body: Matter.Body, placement: ToyPlacement): void {
  const wind = placement.wind
  if (!wind) return
  const horizontalTarget = wind.directionX * (wind.horizontalTargetSpeed ?? DEFAULT_HORIZONTAL_TARGET_SPEED)
  const nextVx = moveToward(body.velocity.x, horizontalTarget, HORIZONTAL_ACCEL_PER_STEP)
  const nextVy =
    wind.upwardTargetVy !== undefined
      ? moveToward(body.velocity.y, wind.upwardTargetVy, VERTICAL_ACCEL_PER_STEP)
      : body.velocity.y
  // applyForceはdeltaの二乗で効き方が変わるため、他のtoyと同じくsetVelocityで直接設定する。
  Body.setVelocity(body, { x: nextVx, y: nextVy })
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function createWindToy(placement: ToyPlacement): ToyRuntime {
  if (!placement.wind) {
    throw new Error(`flag-pinball: 風toy(${placement.id})にwind設定がありません`)
  }

  let lastPulseAt: number | null = null
  const visual: ToyVisualState = {
    spinRad: 0,
    pulse: 0,
    active: false,
    scale: 1,
  }

  return {
    placement,
    // 透明な当たり判定だけの矩形センサーとして振る舞い、物理的な衝突Bodyは持たない。
    // ボールを弾き返す壁にはせず、範囲内のボールへ毎フレーム直接作用する。
    bodies: [],
    activate(now) {
      // タップは見た目のパルスだけを起こす。風は常に自動で吹いているため、
      // タップの有無で力の有無やクールダウンを変えない。
      lastPulseAt = now
      visual.pulse = 1
    },
    update(now, balls: readonly ToyBall[]) {
      let anyBallInArea = false
      for (const ball of balls) {
        if (!isWithinWindArea(ball.body, placement)) continue
        anyBallInArea = true
        applyWind(ball.body, placement)
      }
      visual.active = anyBallInArea

      const pulseElapsed = lastPulseAt === null ? PULSE_DURATION_MS : Math.max(0, now - lastPulseAt)
      visual.pulse = 1 - clamp(pulseElapsed / PULSE_DURATION_MS, 0, 1)
      visual.spinRad = 0
    },
    readVisualState() {
      return visual
    },
  }
}
