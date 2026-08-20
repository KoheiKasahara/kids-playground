import type { ZoomLevel } from '../types'

/** three-globeの地球半径(100)に合わせた、カメラ距離の目安。 */
export const GLOBE_RADIUS = 100

const CAMERA_DISTANCE_BY_ZOOM: Readonly<Record<ZoomLevel, number>> = {
  0: 300,
  1: 230,
  2: 175,
  3: 145,
}

export const ZOOM_ANIMATION_DURATION_MS = 320

export function cameraDistanceForZoom(level: ZoomLevel): number {
  return CAMERA_DISTANCE_BY_ZOOM[level]
}

export function easeOutCubic(progress: number): number {
  const clamped = Math.min(1, Math.max(0, progress))
  return 1 - (1 - clamped) ** 3
}
