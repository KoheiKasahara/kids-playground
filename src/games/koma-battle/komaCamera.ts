/**
 * 斜め上からの固定カメラ。
 *
 * Phase 1では回転もズームも追従もしない。
 * 縦画面でスタジアム全体と2個のコマが常に収まることだけを目的にしている。
 */

import { FIELD_RADIUS } from './komaStadium'

/**
 * 見下ろす角度[rad]。約48度。
 *
 * 真上すぎると平面的になり、低すぎると奥のコマが手前のコマに隠れる。
 * スマホ縦画面では横幅がカメラ距離を決めるため、
 * 角度を上げてスタジアムの楕円を縦に大きく見せ、上下の余白を減らしている。
 */
export const CAMERA_ELEVATION_RAD = (48 * Math.PI) / 180

/** 注視点の高さ。床(-0.2前後)より少し上を見て、スタジアムが画面の中央にくるようにする。 */
export const CAMERA_TARGET_Y = -0.05

/** 視野角[deg]。 */
export const CAMERA_FOV = 45

/** スタジアムの外周に対する余白。壁が画面の端に貼りつかない範囲で、できるだけ大きく映す。 */
export const CAMERA_MARGIN = 1.06

/**
 * 画面比からカメラ距離を決める。
 *
 * 縦画面(aspect<1)では横方向のほうが厳しいため、水平画角で必要な距離も見て、
 * 大きいほうを採用する。これで縦でも横でもスタジアムが切れない。
 */
export function computeKomaCameraDistance(aspect: number): number {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1
  const radius = FIELD_RADIUS * CAMERA_MARGIN
  const verticalFov = (CAMERA_FOV * Math.PI) / 180
  // 垂直方向は見下ろしているぶんスタジアムが縦に潰れて見えるので、その分を掛ける。
  const verticalDistance = radius * Math.sin(CAMERA_ELEVATION_RAD) / Math.tan(verticalFov / 2)
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * safeAspect)
  const horizontalDistance = radius / Math.tan(horizontalFov / 2)
  return Math.max(verticalDistance, horizontalDistance)
}

export type KomaCameraSetup = {
  position: { x: number; y: number; z: number }
  target: { x: number; y: number; z: number }
}

/** カメラの位置と注視点。常にスタジアム中心を手前斜め上から見る。 */
export function komaCameraSetup(aspect: number): KomaCameraSetup {
  const distance = computeKomaCameraDistance(aspect)
  return {
    position: {
      x: 0,
      y: CAMERA_TARGET_Y + distance * Math.sin(CAMERA_ELEVATION_RAD),
      z: distance * Math.cos(CAMERA_ELEVATION_RAD),
    },
    target: { x: 0, y: CAMERA_TARGET_Y, z: 0 },
  }
}
