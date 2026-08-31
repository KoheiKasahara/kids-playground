import { describe, expect, it } from 'vitest'
import {
  CAMERA_ELEVATION_RAD,
  CAMERA_TARGET_Y,
  computeKomaCameraDistance,
  komaCameraSetup,
} from './komaCamera'
import { FIELD_RADIUS } from './komaStadium'

describe('computeKomaCameraDistance', () => {
  it('縦長の画面ほど遠ざかり、スタジアムが横にはみ出さない', () => {
    const portrait = computeKomaCameraDistance(390 / 720)
    const landscape = computeKomaCameraDistance(844 / 390)
    expect(portrait).toBeGreaterThan(landscape)
  })

  it('どの画面比でもスタジアム全体より遠い位置になる', () => {
    for (const aspect of [0.4, 0.54, 0.75, 1, 1.6, 2.2]) {
      expect(computeKomaCameraDistance(aspect)).toBeGreaterThan(FIELD_RADIUS)
    }
  })

  it('不正な画面比でも有限の距離を返す', () => {
    for (const aspect of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const distance = computeKomaCameraDistance(aspect)
      expect(Number.isFinite(distance)).toBe(true)
      expect(distance).toBeGreaterThan(0)
    }
  })
})

describe('komaCameraSetup', () => {
  it('スタジアム中心を斜め上から見下ろす', () => {
    const setup = komaCameraSetup(390 / 720)
    expect(setup.target).toEqual({ x: 0, y: CAMERA_TARGET_Y, z: 0 })
    // 手前(+Z)の斜め上に立つ。
    expect(setup.position.z).toBeGreaterThan(0)
    expect(setup.position.y).toBeGreaterThan(CAMERA_TARGET_Y)
    expect(setup.position.x).toBe(0)
  })

  it('見下ろす角度が設定どおりになる', () => {
    const setup = komaCameraSetup(1)
    const height = setup.position.y - CAMERA_TARGET_Y
    const horizontal = Math.hypot(setup.position.x, setup.position.z)
    expect(Math.atan2(height, horizontal)).toBeCloseTo(CAMERA_ELEVATION_RAD, 6)
  })

  it('真上や真横ではなく、盤面が立体的に見える角度にする', () => {
    expect(CAMERA_ELEVATION_RAD).toBeGreaterThan(Math.PI / 9)
    expect(CAMERA_ELEVATION_RAD).toBeLessThan(Math.PI / 3)
  })
})
