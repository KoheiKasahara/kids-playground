import { describe, expect, it } from 'vitest'
import {
  boostThinRingForOverview,
  createOverviewLabelTexture,
  createOverviewSurfaceTexture,
} from './overviewVisual'
import { celestialBodyById } from '../data/celestialBodies'

describe('boostThinRingForOverview', () => {
  it('土星のような太い輪(セグメント幅の合計が大きい)はそのまま返す', () => {
    const saturn = celestialBodyById('saturn')
    expect(saturn.ring).toBeDefined()
    if (saturn.ring === undefined) return
    expect(boostThinRingForOverview(saturn.ring)).toEqual(saturn.ring)
  })

  it('天王星のような細い輪は幅を広げ、不透明度を底上げする', () => {
    const uranus = celestialBodyById('uranus')
    expect(uranus.ring).toBeDefined()
    if (uranus.ring === undefined) return

    const boosted = boostThinRingForOverview(uranus.ring)
    expect(boosted.segments).toHaveLength(uranus.ring.segments.length)

    const original = uranus.ring.segments[0]
    const widened = boosted.segments[0]
    const originalWidth = original.outerRadiusRatio - original.innerRadiusRatio
    const widenedWidth = widened.outerRadiusRatio - widened.innerRadiusRatio
    expect(widenedWidth).toBeGreaterThan(originalWidth)

    for (let i = 0; i < original.bands.length; i += 1) {
      expect(widened.bands[i].opacity).toBeGreaterThanOrEqual(original.bands[i].opacity)
    }
  })

  it('輪の中心位置は変えない(半径方向の位置がずれない)', () => {
    const uranus = celestialBodyById('uranus')
    if (uranus.ring === undefined) return
    const original = uranus.ring.segments[0]
    const widened = boostThinRingForOverview(uranus.ring).segments[0]
    const originalMid = (original.innerRadiusRatio + original.outerRadiusRatio) / 2
    const widenedMid = (widened.innerRadiusRatio + widened.outerRadiusRatio) / 2
    expect(widenedMid).toBeCloseTo(originalMid, 5)
  })
})

describe('createOverviewSurfaceTexture', () => {
  it('jsdom(2Dコンテキストが無い環境)では例外を投げずnullを返す(rocky/gas両方)', () => {
    const earth = celestialBodyById('earth')
    const jupiter = celestialBodyById('jupiter')
    expect(() => createOverviewSurfaceTexture(earth.surface)).not.toThrow()
    expect(createOverviewSurfaceTexture(earth.surface)).toBeNull()
    expect(() => createOverviewSurfaceTexture(jupiter.surface)).not.toThrow()
    expect(createOverviewSurfaceTexture(jupiter.surface)).toBeNull()
  })
})

describe('createOverviewLabelTexture', () => {
  it('jsdomでは例外を投げずnullを返す', () => {
    expect(() => createOverviewLabelTexture('たいよう')).not.toThrow()
    expect(createOverviewLabelTexture('たいよう')).toBeNull()
  })
})
