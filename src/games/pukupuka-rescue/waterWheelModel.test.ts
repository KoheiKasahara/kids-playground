import { describe, expect, test } from 'vitest'
import {
  WATER_WHEEL_SPIN_THRESHOLD,
  createWaterWheelState,
  isWaterWheelSpinningAt,
  stepWaterWheel,
  waterWheelSpinSpeedDeg,
  waterWheelSubmergedRatio,
} from './waterWheelModel'
import type { WaterWheelDefinition } from './types'

const wheel: WaterWheelDefinition = { id: 'wheel', cx: 20, cy: 70, radius: 10 }

describe('waterWheelModel: 沈み込み割合', () => {
  test('水面が届いていなければ0', () => {
    expect(waterWheelSubmergedRatio(wheel, 100)).toBe(0)
  })

  test('水域の外(undefined)なら0', () => {
    expect(waterWheelSubmergedRatio(wheel, undefined)).toBe(0)
  })

  test('完全に浸かっていれば1', () => {
    expect(waterWheelSubmergedRatio(wheel, 60)).toBe(1)
  })

  test('半分浸かっていれば0.5', () => {
    expect(waterWheelSubmergedRatio(wheel, 70)).toBeCloseTo(0.5, 5)
  })
})

describe('waterWheelModel: 回転開始/停止のしきい値', () => {
  test('しきい値以下では回っているとみなさない', () => {
    expect(isWaterWheelSpinningAt(WATER_WHEEL_SPIN_THRESHOLD)).toBe(false)
    expect(isWaterWheelSpinningAt(0)).toBe(false)
  })

  test('しきい値を超えると回っているとみなす', () => {
    expect(isWaterWheelSpinningAt(WATER_WHEEL_SPIN_THRESHOLD + 0.01)).toBe(true)
    expect(isWaterWheelSpinningAt(1)).toBe(true)
  })

  test('回転の速さは、しきい値未満では0、しきい値を超えると流れの向きに応じた一定値になる', () => {
    expect(waterWheelSpinSpeedDeg(0.1, 1)).toBe(0)
    expect(waterWheelSpinSpeedDeg(0.5, 1)).toBeGreaterThan(0)
    expect(waterWheelSpinSpeedDeg(0.5, -1)).toBeLessThan(0)
  })
})

describe('waterWheelModel: 回転の積分', () => {
  test('初期状態は角度0', () => {
    expect(createWaterWheelState().angleDeg).toBe(0)
  })

  test('速さ0なら同じ状態を返す（再描画を増やさない）', () => {
    const state = createWaterWheelState()
    expect(stepWaterWheel(state, 0, 1 / 60)).toBe(state)
  })

  test('回っているあいだ角度が進み、0〜360の範囲に収まる', () => {
    let state = createWaterWheelState()
    for (let index = 0; index < 600; index += 1) {
      state = stepWaterWheel(state, 260, 1 / 60)
    }
    expect(state.angleDeg).toBeGreaterThanOrEqual(0)
    expect(state.angleDeg).toBeLessThan(360)
  })

  test('逆向きに回っても角度が0〜360の範囲に収まる', () => {
    let state = createWaterWheelState()
    for (let index = 0; index < 5; index += 1) {
      state = stepWaterWheel(state, -260, 1 / 60)
    }
    expect(state.angleDeg).toBeGreaterThanOrEqual(0)
    expect(state.angleDeg).toBeLessThan(360)
  })
})
