import { describe, expect, it } from 'vitest'
import {
  CAMERA_FAR,
  CAMERA_NEAR,
  CLOSEST_CAMERA_DISTANCE,
  cameraDistanceForZoom,
  easeOutCubic,
  farthestCameraDistance,
  GLOBE_RADIUS,
  rotateSpeedForDistance,
  zoomLevelForDistance,
} from './zoomLevels'
import { MAX_ZOOM_LEVEL, MIN_ZOOM_LEVEL } from '../types'
import { BASE_BORDER_RADIUS, BASE_POLYGON_ALTITUDE } from './globeLayers'

// 大気シェル(altitude 0.08)まで含めた、カメラが近づける限界の地球側の半径。
const ATMOSPHERE_RADIUS = GLOBE_RADIUS * 1.08
const DEPTH_BUFFER_BITS = 24
const LAND_CAP_RADIUS = GLOBE_RADIUS * (1 + BASE_POLYGON_ALTITUDE)
const PORTRAIT_ASPECT = 390 / 844
const LANDSCAPE_ASPECT = 1366 / 768
const WHOLE_LEVELS = Array.from({ length: MAX_ZOOM_LEVEL + 1 }, (_, level) => level)

/** 距離distanceにおける深度バッファの分解能(world unit)。 */
function depthResolutionAt(distance: number): number {
  return (distance ** 2 * (CAMERA_FAR - CAMERA_NEAR))
    / (CAMERA_FAR * CAMERA_NEAR * (2 ** DEPTH_BUFFER_BITS - 1))
}

describe('earth-globe zoom levels', () => {
  it.each([[390, 844], [402, 874], [440, 956], [844, 390], [1366, 768]])(
    'fits the atmosphere inside both view angles at %i × %i', (width, height) => {
      const aspect = width / height
      const distance = cameraDistanceForZoom(MIN_ZOOM_LEVEL, aspect)
      const angularRadius = Math.asin(ATMOSPHERE_RADIUS / distance)
      expect(distance).toBe(farthestCameraDistance(aspect))
      expect(angularRadius).toBeLessThan(Math.PI / 8)
      expect(angularRadius).toBeLessThan(Math.atan(Math.tan(Math.PI / 8) * aspect))
      expect(distance + ATMOSPHERE_RADIUS).toBeLessThan(CAMERA_FAR)
    },
  )

  it('falls back to the landscape distance for a viewport without usable dimensions', () => {
    for (const aspect of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(cameraDistanceForZoom(MIN_ZOOM_LEVEL, aspect)).toBe(300)
    }
  })

  it.each([PORTRAIT_ASPECT, LANDSCAPE_ASPECT])(
    'magnifies the surface by the same ratio on every button step at aspect %f', (aspect) => {
      const surfaceGaps = WHOLE_LEVELS.map((level) => cameraDistanceForZoom(level, aspect) - GLOBE_RADIUS)
      const ratios = surfaceGaps.slice(1).map((gap, index) => surfaceGaps[index] / gap)

      expect(cameraDistanceForZoom(MAX_ZOOM_LEVEL, aspect)).toBeCloseTo(CLOSEST_CAMERA_DISTANCE)
      for (const ratio of ratios) {
        expect(ratio).toBeGreaterThan(1)
        expect(ratio).toBeCloseTo(ratios[0])
      }
      // 地球全体から1段目でいきなり国の拡大図にならないよう、1段の拡大は2倍未満に抑える。
      expect(ratios[0]).toBeLessThan(2)
    },
  )

  it('clamps out-of-range levels to the farthest and closest distances', () => {
    expect(cameraDistanceForZoom(-1, PORTRAIT_ASPECT)).toBe(farthestCameraDistance(PORTRAIT_ASPECT))
    expect(cameraDistanceForZoom(MAX_ZOOM_LEVEL + 1)).toBeCloseTo(CLOSEST_CAMERA_DISTANCE)
  })

  it('converts a pinched camera distance back to its zoom level', () => {
    for (const level of [0, 0.5, 1, 2.4, 3, MAX_ZOOM_LEVEL]) {
      for (const aspect of [PORTRAIT_ASPECT, LANDSCAPE_ASPECT]) {
        expect(zoomLevelForDistance(cameraDistanceForZoom(level, aspect), aspect)).toBeCloseTo(level)
      }
    }
    expect(zoomLevelForDistance(10_000, PORTRAIT_ASPECT)).toBe(MIN_ZOOM_LEVEL)
    expect(zoomLevelForDistance(GLOBE_RADIUS, PORTRAIT_ASPECT)).toBe(MAX_ZOOM_LEVEL)
  })

  it('uses progressively lower rotation sensitivity at closer zooms', () => {
    const speeds = WHOLE_LEVELS.map((level) => rotateSpeedForDistance(
      cameraDistanceForZoom(level, LANDSCAPE_ASPECT),
    ))

    expect(speeds.every((speed) => speed > 0)).toBe(true)
    expect(speeds[0]).toBe(1)
    for (let index = 1; index < speeds.length; index += 1) {
      expect(speeds[index]).toBeLessThan(speeds[index - 1])
    }
    expect(speeds[speeds.length - 1]).toBeLessThanOrEqual(0.3)
    expect(rotateSpeedForDistance(farthestCameraDistance(PORTRAIT_ASPECT))).toBe(1)
  })

  it('keeps the whole globe between the near and far planes', () => {
    const farthestDistance = farthestCameraDistance(PORTRAIT_ASPECT)

    expect(CAMERA_NEAR).toBeLessThan(CLOSEST_CAMERA_DISTANCE - ATMOSPHERE_RADIUS)
    expect(CAMERA_FAR).toBeGreaterThan(farthestDistance + ATMOSPHERE_RADIUS)
  })

  it('keeps the depth buffer finer than the gap between the land and its border line', () => {
    // nearが小さすぎると、いちばん引いた縦画面で地表と国境線が同じ深度に丸められ、
    // 線が地面に食われて途切れて見える。
    const borderGap = BASE_BORDER_RADIUS - LAND_CAP_RADIUS
    const farthestSurfaceDistance = farthestCameraDistance(PORTRAIT_ASPECT) - GLOBE_RADIUS

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
