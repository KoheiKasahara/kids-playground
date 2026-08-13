import { describe, expect, test } from 'vitest'
import { project } from './geometry'
import { routePointsForCountryIds } from './WorldTravelMap'

describe('WorldTravelMap route coordinates', () => {
  test('通常のコースは経度を連続化してから投影し、マレーシアを正しい位置へ置く', () => {
    const route = routePointsForCountryIds(['jp', 'tw', 'ph', 'my', 'sg', 'id', 'au', 'nz', 'fj', 'vu'])

    expect(route[3][0]).toBeCloseTo(project([102, 4])[0])
    expect(route[3][0]).toBeGreaterThan(700)
  })

  test('日付変更線をまたぐコースも隣り合う座標として投影する', () => {
    const route = routePointsForCountryIds(['fj', 'to', 'ws', 'fm', 'mh'])

    expect(route.slice(1).every((point, index) => Math.abs(point[0] - route[index][0]) < 100)).toBe(true)
  })
})
