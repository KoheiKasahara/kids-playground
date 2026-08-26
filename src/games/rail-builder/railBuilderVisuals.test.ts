import { describe, expect, test } from 'vitest'
import {
  getRailBuilderDevicePixelRatio,
  getRailBuilderShadowMapSize,
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
})
