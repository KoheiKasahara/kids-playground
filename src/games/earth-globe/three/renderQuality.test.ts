import { describe, expect, it } from 'vitest'
import {
  MAX_RENDER_PIXEL_RATIO,
  renderPixelRatioForDevice,
  shouldRenderGlobeFrame,
} from './renderQuality'

describe('globe render quality', () => {
  it('keeps standard-density displays at their native pixel ratio', () => {
    expect(renderPixelRatioForDevice(1)).toBe(1)
    expect(renderPixelRatioForDevice(1.5)).toBe(1.5)
  })

  it('caps high-density mobile displays to balance smoothness and GPU cost', () => {
    expect(renderPixelRatioForDevice(2)).toBe(MAX_RENDER_PIXEL_RATIO)
    expect(renderPixelRatioForDevice(3)).toBe(MAX_RENDER_PIXEL_RATIO)
  })

  it('falls back safely when the reported pixel ratio is invalid', () => {
    expect(renderPixelRatioForDevice(0)).toBe(1)
    expect(renderPixelRatioForDevice(Number.NaN)).toBe(1)
  })

  it('stops expensive rendering while a ready globe is idle', () => {
    expect(shouldRenderGlobeFrame({
      ready: true,
      renderRequested: false,
      renderThrough: 100,
      now: 100,
      controlsChanged: false,
      animationsActive: false,
    })).toBe(false)
  })

  it.each([
    { ready: false },
    { renderRequested: true },
    { renderThrough: 101 },
    { controlsChanged: true },
    { animationsActive: true },
  ])('keeps rendering for active globe work: $case', (override) => {
    expect(shouldRenderGlobeFrame({
      ready: true,
      renderRequested: false,
      renderThrough: 100,
      now: 100,
      controlsChanged: false,
      animationsActive: false,
      ...override,
    })).toBe(true)
  })
})
