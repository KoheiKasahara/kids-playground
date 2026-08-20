import type { ZoomLevel } from '../types'

/** three-globeの地球半径(100)に合わせた、カメラ距離の目安。 */
export const GLOBE_RADIUS = 100

const CAMERA_DISTANCE_BY_ZOOM: Readonly<Record<ZoomLevel, number>> = {
  0: 300,
  1: 230,
  2: 175,
  3: 145,
}

// 縦画面の最小表示だけは、地球の左右の輪郭が見える距離まで引く。
const PORTRAIT_MIN_CAMERA_DISTANCE = 400

const ROTATE_SPEED_BY_ZOOM: Readonly<Record<ZoomLevel, number>> = {
  0: 1,
  1: 0.76,
  2: 0.48,
  3: 0.28,
}

export const ZOOM_ANIMATION_DURATION_MS = 320

export function cameraDistanceForZoom(level: ZoomLevel, isPortrait = false): number {
  return level === 0 && isPortrait
    ? PORTRAIT_MIN_CAMERA_DISTANCE
    : CAMERA_DISTANCE_BY_ZOOM[level]
}

export function rotateSpeedForZoom(level: ZoomLevel): number {
  return ROTATE_SPEED_BY_ZOOM[level]
}

export function easeOutCubic(progress: number): number {
  const clamped = Math.min(1, Math.max(0, progress))
  return 1 - (1 - clamped) ** 3
}
