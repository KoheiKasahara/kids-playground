import type { CelestialBody, ZoomLevel } from '../types'
import { MAX_ZOOM_LEVEL } from '../types'
import { ringOuterRadiusRatio } from './planetRing'

export const CAMERA_FOV_DEGREES = 40
export const CAMERA_NEAR = 10
export const CAMERA_FAR = 3000
export const ZOOM_ANIMATION_DURATION_MS = 320

function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/** 天体を画面に収めるのに必要な半径。輪を持つ天体は輪の最外周のセグメントまで含める。 */
export function viewRadiusOf(body: CelestialBody): number {
  if (body.ring === undefined) return body.radius
  return body.radius * ringOuterRadiusRatio(body.ring)
}

/**
 * 半径 viewRadius の球がちょうど画面に収まるカメラ距離。
 * 縦画面では横方向のFOVのほうが狭くなるため、垂直・水平のうち小さい方(=より厳しい制約)を使う。
 */
export function fitDistance(
  viewRadius: number,
  aspect: number,
  fovDegrees: number = CAMERA_FOV_DEGREES,
): number {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1

  const verticalFov = degToRad(fovDegrees)
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * safeAspect)
  const limitingFov = Math.min(verticalFov, horizontalFov)

  return viewRadius / Math.sin(limitingFov / 2)
}

/**
 * ズーム段階ごとのカメラ距離。既存の0→3は outMargin→inMargin を等比で補間し、
 * -1/-2は同じ比率をズームアウト側へそのまま延長する。
 */
export function cameraDistanceForZoom(
  body: CelestialBody,
  level: ZoomLevel,
  aspect: number,
): number {
  const t = level / MAX_ZOOM_LEVEL
  const { outMargin, inMargin } = body.zoom
  const margin = outMargin * (inMargin / outMargin) ** t

  return fitDistance(viewRadiusOf(body), aspect) * margin
}

export function easeOutCubic(progress: number): number {
  const clamped = Math.min(1, Math.max(0, progress))
  return 1 - (1 - clamped) ** 3
}

/**
 * 天体を切り替えた直後に必ず戻す既定の視点方向（天体中心→カメラ、正規化前）。
 *
 * 真正面(0,0,1)から見ると、軸傾きをZ軸まわりで表している輪（`planetRing.axialTiltRotationZ`）の
 * 平面に視線が含まれてしまい、土星の輪が線に潰れて見える。少し横と上へずらすことで、
 * 輪が開いて見え、球も真横からの平面的な見え方にならないようにする。
 * この視点で輪が潰れないことは `planetRing.test.ts` の回帰テストで保証する。
 */
export const DEFAULT_VIEW_DIRECTION = { x: 0.32, y: 0.3, z: 0.9 } as const

/**
 * 天体ごとの視点方向。`body.viewDirection` を持つ天体(土星など、輪をより開いて
 * 見せたい天体)だけそれを使い、それ以外は `DEFAULT_VIEW_DIRECTION` を使う。
 */
export function viewDirectionOf(body: CelestialBody): { x: number; y: number; z: number } {
  return body.viewDirection ?? DEFAULT_VIEW_DIRECTION
}


export type SatelliteFit = Pick<import('../types').SatelliteSpec, 'orbitRadius' | 'displayScale' | 'barycenter'>

export function viewRadiusWithSatellites(
  body: CelestialBody,
  satellites: readonly SatelliteFit[] = [],
  showSatellites = true,
): number {
  if (!showSatellites || satellites.length === 0) return viewRadiusOf(body)
  let radius = viewRadiusOf(body)
  for (const satellite of satellites) {
    radius = Math.max(radius, satellite.orbitRadius + body.radius * satellite.displayScale)
    const barycenterOffset = satellite.barycenter === undefined
      ? 0
      : body.radius * satellite.barycenter.parentOffsetRatio
    radius = Math.max(radius, barycenterOffset + body.radius)
  }
  return radius
}

export function cameraDistanceForZoomWithSatellites(
  body: CelestialBody,
  level: ZoomLevel,
  aspect: number,
  satellites: readonly SatelliteFit[] = [],
  showSatellites = true,
): number {
  const t = level / MAX_ZOOM_LEVEL
  const { outMargin, inMargin } = body.zoom
  const margin = outMargin * (inMargin / outMargin) ** t
  return fitDistance(viewRadiusWithSatellites(body, satellites, showSatellites), aspect) * margin
}
