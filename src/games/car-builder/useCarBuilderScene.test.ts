import { describe, expect, test } from 'vitest'
import { DEFAULT_CAR_CONFIG, selectCarOption } from './carConfig'
import { carBoundingRadius, computeCarDimensions } from './carDimensions'
import { fitCameraDistance, MAX_CAR_ZOOM, MIN_CAR_ZOOM } from './useCarBuilderScene'

// 3D描画そのものはjsdomで動かせないため、カメラ距離の決め方（純粋関数）だけを検証する。
describe('fitCameraDistance', () => {
  const radius = carBoundingRadius(computeCarDimensions(DEFAULT_CAR_CONFIG))

  test('車の外接球より遠い位置にカメラを置く（車が切れない）', () => {
    expect(fitCameraDistance(radius, 40, 1)).toBeGreaterThan(radius)
  })

  test('縦長（スマホ縦画面）ほど遠ざかり、車が横にはみ出さない', () => {
    const portrait = fitCameraDistance(radius, 40, 0.7)
    const square = fitCameraDistance(radius, 40, 1)
    expect(portrait).toBeGreaterThan(square)
  })

  test('横長では縦方向の必要距離が下限になる（近づきすぎない）', () => {
    const wide = fitCameraDistance(radius, 40, 3)
    const halfFov = Math.tan((40 * Math.PI) / 180 / 2)
    expect(wide).toBeGreaterThanOrEqual(radius / halfFov)
  })

  test('大きい車ほど遠ざかる（ボディやタイヤを変えても画面へ収まる）', () => {
    const bigger = carBoundingRadius(
      computeCarDimensions(selectCarOption(selectCarOption(DEFAULT_CAR_CONFIG, 'body', 'long'), 'wheel', 'big')),
    )
    expect(fitCameraDistance(bigger, 40, 0.7)).toBeGreaterThan(fitCameraDistance(radius, 40, 0.7))
  })

  test('ピンチズームの範囲は等倍をまたぐ', () => {
    expect(MIN_CAR_ZOOM).toBeLessThan(1)
    expect(MAX_CAR_ZOOM).toBeGreaterThan(1)
  })
})
