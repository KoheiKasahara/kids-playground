import { findArea } from './data/areas'

export type CameraPosition = { x: number; y: number }

/** エリアidからワールド上のカメラ左上を求める。stageIndexではなくarea.originだけを読む。 */
export function cameraPositionForArea(areaId: string): CameraPosition {
  const area = findArea(areaId)
  if (!area) throw new Error(`flag-roll-adventure: 不明なエリアidです: ${areaId}`)
  return { x: area.origin.x, y: area.origin.y }
}

/** tを0..1へ収め、カメラが途中で行き過ぎないようにする。 */
function clampUnit(t: number): number {
  return Math.min(1, Math.max(0, t))
}

/**
 * easeInOutCubic相当のイージング。
 * 出口に触れた直後はゆっくり始まり、中央で進み、到着前にゆっくり止めることで、
 * ボールを見失わずに次のエリアへ視線を移せるようにする。
 */
export function easeInOutCubic(t: number): number {
  const progress = clampUnit(t)
  return progress < 0.5
    ? 4 * progress ** 3
    : 1 - (-2 * progress + 2) ** 3 / 2
}

/** 2つのカメラ位置をイージングしながら補間する純粋関数。 */
export function interpolateCameraPosition(
  from: CameraPosition,
  to: CameraPosition,
  t: number,
): CameraPosition {
  const eased = easeInOutCubic(t)
  return {
    x: from.x + (to.x - from.x) * eased,
    y: from.y + (to.y - from.y) * eased,
  }
}
