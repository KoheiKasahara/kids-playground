import { isSpinnerPart, partDefinition, type PartTypeId, type SpinnerTypeId } from './partTypes'
import type { Point } from './grid'

/**
 * 1マスの回転盤の角速度(rad/step)。画面座標と同じく時計回りが正。
 * 羽根の先の速さ（角速度 × 半径）が、ボールを弾く強さになる。
 */
export const SPINNER_ANGULAR_VELOCITY = 0.08
/** 2×2の回転盤。半径が約2倍なので、羽根の先の速さが1マス版とそろうまで角速度を落とす。 */
export const LARGE_SPINNER_ANGULAR_VELOCITY = 0.04

/** 回転盤のそばでボールへ許す速度上限(px/step)。弾かれた球を見失わせない。 */
export const SPINNER_BALL_SPEED_CAP = 11
/** 羽根の外側どこまでを回転盤の影響下とみなすかの余白(px)。 */
export const SPINNER_INFLUENCE_MARGIN = 8
/** 羽根の上で止まりかけたとみなす速度(px/step)と、そのとき与える接線方向の一押し。 */
export const SPINNER_STALL_SPEED = 0.3
export const SPINNER_NUDGE_SPEED = 2.2
/** 同じボールを押し続けないための間隔(ms)。 */
export const SPINNER_NUDGE_COOLDOWN_MS = 220

/** 回る向きは種類IDだけで決まる。逆回しは符号だけが反転した同じ速さ。 */
const SPINNER_ANGULAR_VELOCITIES: Readonly<Record<SpinnerTypeId, number>> = {
  spinner: SPINNER_ANGULAR_VELOCITY,
  spinnerReverse: -SPINNER_ANGULAR_VELOCITY,
  spinnerLarge: LARGE_SPINNER_ANGULAR_VELOCITY,
  spinnerLargeReverse: -LARGE_SPINNER_ANGULAR_VELOCITY,
}

export type SpinnerSpec = {
  /** 羽根の長さの半分 */
  readonly radius: number
  readonly bladeThickness: number
  /** アンカーセル中心から見た回転軸。2×2版は占有する4マスの中心へ寄る。 */
  readonly center: Point
  /** 角速度(rad/step)。正は時計回り、負は逆回し。 */
  readonly angularVelocity: number
}

/**
 * 回転盤の物理パラメータ。羽根の寸法と回転軸はパーツ定義の見た目から読み、
 * 見た目・当たり判定・回転アニメーションが1つの形から外れないようにする。
 */
export function spinnerSpec(typeId: PartTypeId): SpinnerSpec {
  if (!isSpinnerPart(typeId)) throw new Error(`flag-roll-puzzle: 回転盤ではありません: ${typeId}`)
  const blades = partDefinition(typeId).segments.filter((segment) => segment.role === 'blade')
  // 横向きの羽根の長さが直径、短辺が羽根の太さにあたる。
  const horizontal = blades.find((segment) => segment.width >= segment.height)
  if (!horizontal) throw new Error(`flag-roll-puzzle: 回転盤の羽根定義がありません: ${typeId}`)
  return {
    radius: horizontal.width / 2,
    bladeThickness: horizontal.height,
    center: { x: horizontal.offsetX, y: horizontal.offsetY },
    angularVelocity: SPINNER_ANGULAR_VELOCITIES[typeId],
  }
}
