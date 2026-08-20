import { describe, expect, it } from 'vitest'
import {
  cameraDistanceForZoom,
  easeOutCubic,
  GLOBE_RADIUS,
  rotateSpeedForZoom,
} from './zoomLevels'

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

  it('clamps and eases the animation progress', () => {
    expect(easeOutCubic(-1)).toBe(0)
    expect(easeOutCubic(0)).toBe(0)
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875)
    expect(easeOutCubic(1)).toBe(1)
    expect(easeOutCubic(2)).toBe(1)
  })
})
