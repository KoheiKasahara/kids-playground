import type { FloaterDefinition, Rect } from './types'

// 浮遊物（Phase 1はアヒル1体）の動きだけを持つモジュール。
//
// 方針: 正確な浮力計算はしない。「水にどれだけ浸かっているか」に比例した上向きの力と、
// 水中での強めの減衰だけで、幼児が見て「浮いている」と感じるばね的な上下動をつくる。
// 減衰を弱めにしてあるため、水位が動いたあと数回ゆれてから落ち着く（＝ぷかぷか）。

export type FloaterState = {
  readonly id: string
  readonly x: number
  readonly y: number
  readonly vx: number
  readonly vy: number
  /** 0（完全に水の上）〜1（完全に水中）。表示のしぶき量と水平移動の強さに使う。 */
  readonly submergedRatio: number
}

/** 重力加速度（ステージ座標 / 秒^2）。 */
export const GRAVITY = 220
/** 完全に沈んだときに受ける浮力を重力の何倍にするか。1/この値 が浮いたときの沈み込み割合になる。 */
export const BUOYANCY_RATIO = 2.5
/** 水中での上下方向の減衰。大きいほど早く落ち着く（＝ぷかぷかが短い）。 */
export const WATER_VERTICAL_DRAG = 4
/** 空中でのわずかな空気抵抗。落下が暴れないようにするだけの値。 */
export const AIR_VERTICAL_DRAG = 0.2
/** 水に触れているときにゴール方向へ流される速さ（ステージ座標 / 秒）。 */
export const DRIFT_SPEED = 24
/** 流れに乗るまでの追従の速さ。 */
export const DRIFT_RESPONSE = 2.2
/** 速度の上限。極端な dt や連続衝突でも吹き飛ばないようにする保険。 */
export const MAX_SPEED = 240

export type FloatStepContext = {
  /** 浮遊物がいる水域の水面Y。水域の外なら undefined（＝浮力なし）。 */
  readonly surfaceY: number | undefined
  readonly solids: readonly Rect[]
  readonly bounds: { readonly width: number; readonly height: number }
  /** 水に触れているときに流される向き（+1で右）。 */
  readonly driftDirection: number
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

export function createFloaterState(definition: FloaterDefinition): FloaterState {
  return {
    id: definition.id,
    x: definition.startX,
    y: definition.startY,
    vx: 0,
    vy: 0,
    submergedRatio: 0,
  }
}

/**
 * 円が矩形にめり込んでいたら、いちばん浅い向きへ押し出した結果を返す。
 * 重なっていなければ null。
 */
export function resolveCircleAgainstRect(
  x: number,
  y: number,
  radius: number,
  rect: Rect,
): { x: number; y: number; normalX: number; normalY: number } | null {
  const left = rect.x
  const right = rect.x + rect.width
  const top = rect.y
  const bottom = rect.y + rect.height

  const nearestX = clamp(x, left, right)
  const nearestY = clamp(y, top, bottom)
  const dx = x - nearestX
  const dy = y - nearestY
  const distanceSquared = dx * dx + dy * dy

  if (distanceSquared > radius * radius) return null

  if (distanceSquared > 0) {
    const distance = Math.sqrt(distanceSquared)
    const normalX = dx / distance
    const normalY = dy / distance
    const push = radius - distance
    return { x: x + normalX * push, y: y + normalY * push, normalX, normalY }
  }

  // 中心が矩形の内側まで入ってしまった場合は、4辺のうちいちばん浅い側へ出す。
  const toLeft = x - left + radius
  const toRight = right - x + radius
  const toTop = y - top + radius
  const toBottom = bottom - y + radius
  const minimum = Math.min(toLeft, toRight, toTop, toBottom)

  if (minimum === toTop) return { x, y: top - radius, normalX: 0, normalY: -1 }
  if (minimum === toBottom) return { x, y: bottom + radius, normalX: 0, normalY: 1 }
  if (minimum === toLeft) return { x: left - radius, y, normalX: -1, normalY: 0 }
  return { x: right + radius, y, normalX: 1, normalY: 0 }
}

/**
 * 浮遊物を1ステップ進める。deltaSeconds は呼び出し側で固定値にする前提
 * （`pukupukaGame.ts` が 1/60 秒に固定して呼ぶ）。
 */
export function stepFloater(
  definition: FloaterDefinition,
  state: FloaterState,
  context: FloatStepContext,
  deltaSeconds: number,
): FloaterState {
  const radius = definition.radius
  const { surfaceY } = context

  // 水面からどれだけ沈んでいるかを0〜1で見る。これが浮力・流れ・しぶきの共通の指標。
  const submergedRatio =
    surfaceY === undefined ? 0 : clamp((state.y + radius - surfaceY) / (radius * 2), 0, 1)

  let vy = state.vy + (GRAVITY - GRAVITY * BUOYANCY_RATIO * submergedRatio) * deltaSeconds
  vy -= vy * (AIR_VERTICAL_DRAG + WATER_VERTICAL_DRAG * submergedRatio) * deltaSeconds

  const driftTarget = DRIFT_SPEED * submergedRatio * context.driftDirection
  let vx = state.vx + (driftTarget - state.vx) * DRIFT_RESPONSE * deltaSeconds

  vx = clamp(vx, -MAX_SPEED, MAX_SPEED)
  vy = clamp(vy, -MAX_SPEED, MAX_SPEED)

  let x = state.x + vx * deltaSeconds
  let y = state.y + vy * deltaSeconds

  // 固定物へのめり込みを解消する。押し出した向きへ入っていく速度成分だけを消し、
  // 壁ぞいに滑る動き（＝しきりに沿って浮き上がる）は残す。
  for (const solid of context.solids) {
    const hit = resolveCircleAgainstRect(x, y, radius, solid)
    if (!hit) continue
    x = hit.x
    y = hit.y
    const into = vx * hit.normalX + vy * hit.normalY
    if (into < 0) {
      vx -= into * hit.normalX
      vy -= into * hit.normalY
    }
  }

  // ステージ外へ出ないための最終的な保険。
  x = clamp(x, radius, context.bounds.width - radius)
  y = clamp(y, radius, context.bounds.height - radius)

  return { id: state.id, x, y, vx, vy, submergedRatio }
}
