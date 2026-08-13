import { describe, expect, test } from 'vitest'
import { worldFeatures } from '../data/worldFeatures'
import { antimeridianClippedRings, boundsForGeometry, cameraForBounds, cameraForCountryBounds, longitudeNear, MAP_HEIGHT, MAP_WIDTH, pathForGeometryNear, primaryBounds, project, quadraticBezier, shortestLongitudeBounds, shortestLongitudePath, type Geometry, type Position } from './geometry'

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
  test('小さい国ほど拡大し、通常サイズの国は従来の倍率を保つ', () => {
    const boundsFor = (id: number, fitMode: 'primary' | 'all' = 'primary') => {
      const geometry = worldFeatures.find((item) => item.id === id)?.geometry
      expect(geometry).toBeDefined()
      return fitMode === 'all' ? boundsForGeometry(geometry!) : primaryBounds(geometry!)
    }
    const singapore = cameraForCountryBounds(boundsFor(702))
    const netherlands = cameraForCountryBounds(boundsFor(528))
    const japanBounds = boundsFor(392, 'all')
    const japan = cameraForCountryBounds(japanBounds)
    const brazilBounds = boundsFor(76)
    const brazil = cameraForCountryBounds(brazilBounds)

    expect(singapore.scale).toBeLessThanOrEqual(4.8)
    expect(singapore.scale).toBeGreaterThanOrEqual(netherlands.scale)
    expect(netherlands.scale).toBeLessThanOrEqual(4.8)
    expect(japan.scale).toBeGreaterThan(1)
    expect(brazil.scale).toBeGreaterThan(1)
  })
  test.each([[44, 'バハマ'], [242, 'フィジー'], [548, 'バヌアツ'], [776, 'トンガ'], [882, 'サモア'], [583, 'ミクロネシア'], [584, 'マーシャルしょとう']] as const)('%s (%s) は周辺を残す上限内で拡大できる', (id, name) => {
    const geometry = worldFeatures.find((item) => item.id === id)?.geometry
    expect(geometry, name).toBeDefined()
    const camera = cameraForCountryBounds(primaryBounds(geometry!))
    expect(camera.scale).toBeGreaterThan(1)
    expect(camera.scale).toBeLessThanOrEqual(4.8)
  })
  test('日付変更線をまたぐ移動は短い方向に連続化する', () => {
    expect(longitudeNear(-170, 170)).toBe(190)
    expect(longitudeNear(170, -170)).toBe(-190)
    const path = shortestLongitudePath([[170, -18], [-172, -14], [-175, -21], [178, -18]])
    expect(path.map(([longitude]) => longitude)).toEqual([170, 188, 185, 178])
    expect(path.slice(1).every((point, index) => Math.abs(point[0] - path[index][0]) <= 180)).toBe(true)
  })
  test.each([
    [[130, 140, 150], [130, 150]],
    [[170, 175, -175], [170, 185]],
    [[-170, -175, 175], [175, 190]],
  ] as const)('最短経度bounds %o は %o として連続化する', (longitudes, [minimum, maximum]) => {
    const bounds = shortestLongitudeBounds(longitudes)
    expect(bounds.minLongitude).toBeCloseTo(minimum)
    expect(bounds.maxLongitude).toBeCloseTo(maximum)
    expect(bounds.maxLongitude - bounds.minLongitude).toBeLessThan(30)
  })
  test('日付変更線をまたぐ国境は太平洋側の同じ座標帯へ描画できる', () => {
    const path = pathForGeometryNear({
      type: 'Polygon',
      coordinates: [[[170, 10], [-170, 10], [-170, -10], [170, -10], [170, 10]]],
    }, 180)
    const xValues = [...path.matchAll(/[ML]([\d.-]+)\s/g)].map((match) => Number(match[1]))
    expect(xValues.length).toBeGreaterThan(3)
    expect(Math.max(...xValues) - Math.min(...xValues)).toBeLessThan(MAP_WIDTH / 10)
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
