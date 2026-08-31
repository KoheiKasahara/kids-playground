import { describe, expect, test } from 'vitest'
import { STATION_LENGTH } from './railModel'
import {
  getRailBuilderDevicePixelRatio,
  getRailBuilderShadowMapSize,
  getRailHitAreaWidthScale,
  getRailSleeperCount,
  getRailStationSafetyLineCenterOffset,
  RAIL_STATION_VISUAL_CONFIG,
  RAIL_VISUAL_CONFIG,
  shouldReduceRailBuilderMotion,
} from './railBuilderVisuals'

describe('railBuilderVisuals', () => {
  test('small screens cap DPR at 1.5 and wide screens at 1.75', () => {
    expect(getRailBuilderDevicePixelRatio(3, 390, 844)).toBe(1.5)
    expect(getRailBuilderDevicePixelRatio(2, 1280, 900)).toBe(1.75)
    expect(getRailBuilderDevicePixelRatio(1, 320, 480)).toBe(1)
  })

  test('shadow map follows the short viewport side', () => {
    expect(getRailBuilderShadowMapSize(640, 900)).toBe(512)
    expect(getRailBuilderShadowMapSize(641, 900)).toBe(1024)
  })

  test('reduced motion is a pure boolean gate', () => {
    expect(shouldReduceRailBuilderMotion(true)).toBe(true)
    expect(shouldReduceRailBuilderMotion(false)).toBe(false)
    expect(shouldReduceRailBuilderMotion(undefined)).toBe(false)
  })

  test('hit area is wider for thin rail pieces without widening large facilities', () => {
    expect(getRailHitAreaWidthScale('straight')).toBe(2.4)
    expect(getRailHitAreaWidthScale('curve')).toBe(2.4)
    expect(getRailHitAreaWidthScale('branch')).toBe(2.4)
    expect(getRailHitAreaWidthScale('short-straight')).toBe(2.2)
    expect(getRailHitAreaWidthScale('slope')).toBe(2.2)
    expect(getRailHitAreaWidthScale('bridge')).toBe(2.0)
    expect(getRailHitAreaWidthScale('station')).toBe(1.8)
    expect(getRailHitAreaWidthScale('tunnel')).toBe(1.8)
    expect(getRailHitAreaWidthScale('depot')).toBe(1.8)
  })

  test('rail visual layers keep ties between the base and rail', () => {
    expect(RAIL_VISUAL_CONFIG.baseCenterY).toBeLessThan(RAIL_VISUAL_CONFIG.sleeperCenterY)
    expect(RAIL_VISUAL_CONFIG.sleeperCenterY).toBeLessThan(RAIL_VISUAL_CONFIG.railCenterY)
    expect(RAIL_VISUAL_CONFIG.baseHeight).toBeGreaterThan(0)
    expect(RAIL_VISUAL_CONFIG.sleeperHeight).toBeGreaterThan(0)
    expect(RAIL_VISUAL_CONFIG.railHeight).toBeGreaterThan(0)

    const baseTop = RAIL_VISUAL_CONFIG.baseCenterY + RAIL_VISUAL_CONFIG.baseHeight / 2
    const sleeperBottom = RAIL_VISUAL_CONFIG.sleeperCenterY - RAIL_VISUAL_CONFIG.sleeperHeight / 2
    const sleeperTop = RAIL_VISUAL_CONFIG.sleeperCenterY + RAIL_VISUAL_CONFIG.sleeperHeight / 2
    const railBottom = RAIL_VISUAL_CONFIG.railCenterY - RAIL_VISUAL_CONFIG.railHeight / 2
    expect(baseTop).toBeGreaterThanOrEqual(sleeperBottom)
    expect(sleeperTop).toBeGreaterThanOrEqual(railBottom)
  })

  test('sleeper dimensions and cadence fit the toy-scale gauge', () => {
    expect(RAIL_VISUAL_CONFIG.sleeperLength).toBeLessThan(RAIL_VISUAL_CONFIG.sleeperWidth)
    expect(RAIL_VISUAL_CONFIG.sleeperWidth).toBeGreaterThan(RAIL_VISUAL_CONFIG.gauge)
    expect(RAIL_VISUAL_CONFIG.sleeperSpacing).toBeGreaterThan(RAIL_VISUAL_CONFIG.sleeperLength)
    expect(RAIL_VISUAL_CONFIG.sleeperSpacing).toBeGreaterThan(0)
    expect(getRailSleeperCount(2.5)).toBe(3)
    expect(getRailSleeperCount(5)).toBe(5)
    expect(getRailSleeperCount(10)).toBe(10)
    expect(getRailSleeperCount(Number.NaN)).toBe(1)
  })

  test('station safety line stays on the track-facing platform edge', () => {
    const { platform, safetyLine } = RAIL_STATION_VISUAL_CONFIG
    const safetyLineCenter = getRailStationSafetyLineCenterOffset()
    const platformMin = platform.centerOffsetZ - platform.depth / 2
    const platformMax = platform.centerOffsetZ + platform.depth / 2
    const safetyLineMin = safetyLineCenter - safetyLine.depth / 2
    const safetyLineMax = safetyLineCenter + safetyLine.depth / 2

    expect(safetyLineMin).toBeGreaterThanOrEqual(platformMin)
    expect(safetyLineMax).toBeLessThanOrEqual(platformMax)
    expect(safetyLine.lengthRatio).toBeLessThanOrEqual(platform.lengthRatio)

    const safetyLineTop = platform.centerY + platform.height / 2 + safetyLine.height - 0.006
    const railTop = RAIL_VISUAL_CONFIG.railCenterY + RAIL_VISUAL_CONFIG.railHeight / 2
    expect(safetyLineTop).toBeGreaterThanOrEqual(railTop)
  })

  test('station platform and roof stay within the canonical station length', () => {
    const { platform, roof } = RAIL_STATION_VISUAL_CONFIG

    expect(platform.lengthRatio).toBeGreaterThan(0)
    expect(platform.lengthRatio * STATION_LENGTH).toBeLessThanOrEqual(STATION_LENGTH)
    expect(roof.lengthRatio).toBeGreaterThan(0)
    expect(roof.lengthRatio * STATION_LENGTH).toBeLessThanOrEqual(STATION_LENGTH)
  })
})
