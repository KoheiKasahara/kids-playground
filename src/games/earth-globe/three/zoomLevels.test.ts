import { describe, expect, it } from 'vitest'
import {
  CAMERA_FAR,
  CAMERA_NEAR,
  cameraDistanceForZoom,
  easeOutCubic,
  GLOBE_RADIUS,
  rotateSpeedForZoom,
} from './zoomLevels'
import { BASE_BORDER_RADIUS } from './globeBorderLines'

// 大気シェル(altitude 0.08)まで含めた、カメラが近づける限界の地球側の半径。
const ATMOSPHERE_RADIUS = GLOBE_RADIUS * 1.08
const DEPTH_BUFFER_BITS = 24
const LAND_CAP_RADIUS = 100.8

/** 距離distanceにおける深度バッファの分解能(world unit)。 */
function depthResolutionAt(distance: number): number {
  return (distance ** 2 * (CAMERA_FAR - CAMERA_NEAR))
    / (CAMERA_FAR * CAMERA_NEAR * (2 ** DEPTH_BUFFER_BITS - 1))
}

describe('earth-globe zoom levels', () => {
  it('uses progressively shorter camera distances', () => {
    expect(GLOBE_RADIUS).toBe(100)
    expect(cameraDistanceForZoom(0)).toBe(300)
    expect(cameraDistanceForZoom(1)).toBe(230)
    expect(cameraDistanceForZoom(2)).toBe(175)
    expect(cameraDistanceForZoom(3)).toBe(145)
    expect(cameraDistanceForZoom(0, true)).toBe(400)
  })

  it('changes only the minimum zoom distance for portrait screens', () => {
    expect(cameraDistanceForZoom(0, true)).toBeGreaterThan(cameraDistanceForZoom(0))
    expect(cameraDistanceForZoom(1, true)).toBe(cameraDistanceForZoom(1))
    expect(cameraDistanceForZoom(2, true)).toBe(cameraDistanceForZoom(2))
    expect(cameraDistanceForZoom(3, true)).toBe(cameraDistanceForZoom(3))
  })

  it('uses progressively lower rotation sensitivity at closer zooms', () => {
    const speeds = [
      rotateSpeedForZoom(0),
      rotateSpeedForZoom(1),
      rotateSpeedForZoom(2),
      rotateSpeedForZoom(3),
    ]

    expect(speeds.every((speed) => speed > 0)).toBe(true)
    expect(speeds[0]).toBeGreaterThan(speeds[1])
    expect(speeds[1]).toBeGreaterThan(speeds[2])
    expect(speeds[2]).toBeGreaterThan(speeds[3])
    expect(speeds[0]).toBe(1)
    expect(speeds[3]).toBeLessThanOrEqual(0.3)
  })

  it('keeps the whole globe between the near and far planes', () => {
    const closestCameraDistance = cameraDistanceForZoom(3) - 10
    const farthestCameraDistance = cameraDistanceForZoom(0, true)

    expect(CAMERA_NEAR).toBeLessThan(closestCameraDistance - ATMOSPHERE_RADIUS)
    expect(CAMERA_FAR).toBeGreaterThan(farthestCameraDistance + ATMOSPHERE_RADIUS)
  })

  it('keeps the depth buffer finer than the gap between the land and its border line', () => {
    // nearが小さすぎると、いちばん引いた縦画面で地表と国境線が同じ深度に丸められ、
    // 線が地面に食われて途切れて見える。
    const borderGap = BASE_BORDER_RADIUS - LAND_CAP_RADIUS
    const farthestSurfaceDistance = cameraDistanceForZoom(0, true) - GLOBE_RADIUS

    expect(depthResolutionAt(farthestSurfaceDistance)).toBeLessThan(borderGap / 10)
  })

  it('clamps and eases the animation progress', () => {
    expect(easeOutCubic(-1)).toBe(0)
    expect(easeOutCubic(0)).toBe(0)
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875)
    expect(easeOutCubic(1)).toBe(1)
    expect(easeOutCubic(2)).toBe(1)
  })
})
