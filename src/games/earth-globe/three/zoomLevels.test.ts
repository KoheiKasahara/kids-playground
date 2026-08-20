import { describe, expect, it } from 'vitest'
import {
  cameraDistanceForZoom,
  easeOutCubic,
  GLOBE_RADIUS,
} from './zoomLevels'

describe('earth-globe zoom levels', () => {
  it('uses progressively shorter camera distances', () => {
    expect(GLOBE_RADIUS).toBe(100)
    expect(cameraDistanceForZoom(0)).toBe(300)
    expect(cameraDistanceForZoom(1)).toBe(230)
    expect(cameraDistanceForZoom(2)).toBe(175)
    expect(cameraDistanceForZoom(3)).toBe(145)
  })

  it('clamps and eases the animation progress', () => {
    expect(easeOutCubic(-1)).toBe(0)
    expect(easeOutCubic(0)).toBe(0)
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875)
    expect(easeOutCubic(1)).toBe(1)
    expect(easeOutCubic(2)).toBe(1)
  })
})
