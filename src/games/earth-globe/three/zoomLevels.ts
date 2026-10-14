import { MAX_ZOOM_LEVEL, MIN_ZOOM_LEVEL } from '../types'

/** three-globeの地球半径(100)に合わせた、カメラ距離の目安。 */
export const GLOBE_RADIUS = 100

/** 最大ズーム時のカメラ距離。国の形が識別できる近さ。 */
export const CLOSEST_CAMERA_DISTANCE = 145
// 横長画面で地球全体を表示するときのカメラ距離。縦長画面ではさらに引く。
const BASE_FARTHEST_CAMERA_DISTANCE = 300

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

// 最大ズームでの回転感度。近いほど1ドラッグあたりの回転を小さくし、国が飛び過ぎないようにする。
const MIN_ROTATE_SPEED = 0.22

export const ZOOM_ANIMATION_DURATION_MS = 320

/** 最小ズームでは縦横の狭い画角にも大気と余白が収まる距離まで引く（垂直画角45度）。 */
export function farthestCameraDistance(aspect: number): number {
  if (!Number.isFinite(aspect) || aspect <= 0) return BASE_FARTHEST_CAMERA_DISTANCE
  const halfAngle = Math.atan(Math.tan(Math.PI / 8) * Math.min(1, aspect))
  return Math.max(BASE_FARTHEST_CAMERA_DISTANCE, GLOBE_RADIUS * 1.12 / Math.sin(halfAngle))
}

function clampZoomLevel(level: number): number {
  if (!Number.isFinite(level)) return MIN_ZOOM_LEVEL
  return Math.min(MAX_ZOOM_LEVEL, Math.max(MIN_ZOOM_LEVEL, level))
}

/**
 * ズーム段階(小数も可)からカメラ距離を求める。
 * 地表の見た目の大きさは「カメラから地表までの距離」に反比例するため、
 * その距離を最遠〜最近で等比に刻み、1段ごとの拡大率をそろえる。
 * 縦長画面は最遠距離が長いぶん、1段の拡大率も自動で大きくなる。
 */
export function cameraDistanceForZoom(level: number, aspect = 1): number {
  const farGap = farthestCameraDistance(aspect) - GLOBE_RADIUS
  const nearGap = CLOSEST_CAMERA_DISTANCE - GLOBE_RADIUS
  const t = clampZoomLevel(level) / MAX_ZOOM_LEVEL
  return GLOBE_RADIUS + farGap * (nearGap / farGap) ** t
}

/** cameraDistanceForZoom の逆関数。ピンチ後の距離から現在のズーム段階(小数)を求める。 */
export function zoomLevelForDistance(distance: number, aspect = 1): number {
  const farGap = farthestCameraDistance(aspect) - GLOBE_RADIUS
  const nearGap = CLOSEST_CAMERA_DISTANCE - GLOBE_RADIUS
  const gap = distance - GLOBE_RADIUS
  if (!Number.isFinite(gap) || gap <= 0) return MAX_ZOOM_LEVEL
  return clampZoomLevel(MAX_ZOOM_LEVEL * Math.log(farGap / gap) / Math.log(farGap / nearGap))
}

/** 地表までの距離に比例させ、寄るほど回転をゆっくりにする。 */
export function rotateSpeedForDistance(distance: number): number {
  const speed = (distance - GLOBE_RADIUS) / (BASE_FARTHEST_CAMERA_DISTANCE - GLOBE_RADIUS)
  return Math.min(1, Math.max(MIN_ROTATE_SPEED, speed))
}

export function easeOutCubic(progress: number): number {
  const clamped = Math.min(1, Math.max(0, progress))
  return 1 - (1 - clamped) ** 3
}
