import { describe, expect, test } from 'vitest'
import { worldFeatures } from '../data/worldFeatures'
import { antimeridianClippedRings, cameraForBounds, MAP_HEIGHT, MAP_WIDTH, project, quadraticBezier, type Geometry, type Position } from './geometry'

function ringsFor(geometry: Geometry): unknown[] {
  return geometry.type === 'Polygon'
    ? Array.isArray(geometry.coordinates) ? geometry.coordinates : []
    : Array.isArray(geometry.coordinates) ? geometry.coordinates.flatMap((polygon) => Array.isArray(polygon) ? polygon : []) : []
}

function hasWorldSpanningEdge(ring: readonly Position[]): boolean {
  return ring.some((point, index) => {
    const next = ring[(index + 1) % ring.length]
    return Math.abs(project(point)[0] - project(next)[0]) > MAP_WIDTH / 2
  })
}

describe('world map geometry', () => {
  test('bbox camera は対象を中央に置き、倍率を安全な範囲に制限する', () => {
    const camera = cameraForBounds({ minX: 460, minY: 250, maxX: 540, maxY: 310 })
    expect(camera.scale).toBeGreaterThan(1)
    expect(camera.scale).toBeLessThanOrEqual(9)
    expect(500 * camera.scale + camera.x).toBeCloseTo(MAP_WIDTH / 2)
    expect(280 * camera.scale + camera.y).toBeCloseTo(MAP_HEIGHT / 2)
  })
  test('Bezier は両端を通り、途中では上側へ弧を描く', () => {
    expect(quadraticBezier([100, 300], [500, 300], 0)).toEqual([100, 300])
    expect(quadraticBezier([100, 300], [500, 300], 1)).toEqual([500, 300])
    expect(quadraticBezier([100, 300], [500, 300], .5)[1]).toBeLessThan(300)
  })
  test('反子午線をまたぐリングは左右端を横断する辺にしない', () => {
    const rings = antimeridianClippedRings([[170, 10], [-170, 10], [-170, -10], [170, -10], [170, 10]])
    expect(rings).toHaveLength(2)
    expect(rings.every((ring) => !hasWorldSpanningEdge(ring))).toBe(true)
  })
  test.each([[643, 'ロシア'], [242, 'フィジー']] as const)('%s (%s) は世界幅のSVG辺を持たない', (id, name) => {
    const feature = worldFeatures.find((item) => item.id === id)
    expect(feature, name).toBeDefined()
    const clipped = ringsFor(feature!.geometry).flatMap((ring) => antimeridianClippedRings(ring))
    expect(clipped.length).toBeGreaterThan(0)
    expect(clipped.every((ring) => !hasWorldSpanningEdge(ring))).toBe(true)
  })
})
