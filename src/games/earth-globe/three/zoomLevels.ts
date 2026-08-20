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

/**
 * 深度バッファの精度は near に強く依存し、距離zでの分解能は
 * z^2 * (far - near) / (far * near * (2^24 - 1)) になる。
 * near=0.1 だと縦画面の最小ズーム（カメラ距離400・地表までz=300）で約0.054 world unit
 * となり、地表のすぐ上0.01を通す国境線が地面と同じ深度に丸められて途切れて見える。
 * カメラは地球中心から135未満へは寄らないため、nearを手前の余白ぎりぎりまで上げて
 * 分解能を約200倍にする。
 */
export const CAMERA_NEAR = 20
export const CAMERA_FAR = 1000

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
