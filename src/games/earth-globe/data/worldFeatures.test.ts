import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import ConicPolygonGeometry from 'three-conic-polygon-geometry'
import { worldFeatures } from './worldFeatures'

type Point = readonly [number, number]
type Ring = readonly Point[]
type PolygonCoordinates = readonly Ring[]

// Keep this in sync with build-earth-globe-data.mjs: 0.5 degrees keeps the
// spherical chord sag far below the 0.8-unit altitude of the land polygons.
const maxArcAngleDegrees = 0.5
// coordinateDecimals=4 can increase a rounded edge by a few ten-thousandths.
const maxArcAngleTestToleranceDegrees = 0.005
const degreesToRadians = Math.PI / 180
const landRadius = 100
// 最大のポリゴン(ロシア本土)でも球面積の約3%しか覆わない。日付変更線をまたぐ
// リングの座標を平均するなどして経度が一周すると、capが全球を覆ってしまう。
const maxCapSurfaceArea = 4 * Math.PI * landRadius ** 2 * 0.08

const expectedIsoNumericIds = [
  4, 8, 10, 12, 16, 20, 24, 28, 31, 32, 36, 36, 40, 44, 48, 50, 51,
  52, 56, 60, 64, 68, 70, 72, 76, 84, 86, 90, 92, 96, 100, 104, 108,
  112, 116, 120, 124, 132, 136, 140, 144, 148, 152, 156, 158, 170, 174,
  178, 180, 184, 188, 191, 192, 196, 203, 204, 208, 212, 214, 218, 222,
  226, 231, 232, 233, 234, 238, 239, 242, 246, 248, 250, 258, 260, 262,
  266, 268, 270, 275, 276, 288, 296, 300, 304, 308, 316, 320, 324, 328,
  332, 334, 336, 340, 344, 348, 352, 356, 360, 364, 368, 372, 376, 380,
  384, 388, 392, 398, 400, 404, 408, 410, 414, 417, 418, 422, 426, 428,
  430, 434, 438, 440, 442, 446, 450, 454, 458, 462, 466, 470, 478, 480,
  484, 492, 496, 498, 499, 500, 504, 508, 512, 516, 520, 524, 528, 531,
  533, 534, 540, 548, 554, 558, 562, 566, 570, 574, 578, 580, 583, 584,
  585, 586, 591, 598, 600, 604, 608, 612, 616, 620, 624, 626, 630, 634,
  642, 643, 646, 652, 654, 659, 660, 662, 663, 666, 670, 674, 678, 682,
  686, 688, 690, 694, 702, 703, 704, 705, 706, 710, 716, 724, 728, 729,
  732, 740, 748, 752, 756, 760, 762, 764, 768, 776, 780, 784, 788, 792,
  795, 796, 800, 804, 807, 818, 826, 831, 832, 833, 834, 840, 850, 854,
  858, 860, 862, 876, 882, 887, 894,
]

const requiredNumericIds = [
  392, 410, 156, 643, 840, 124, 76, 250, 276, 356, 352, 388, 426, 470, 702,
]

function polygonsOf(feature: (typeof worldFeatures)[number]): readonly PolygonCoordinates[] {
  return feature.geometry.type === 'Polygon'
    ? [feature.geometry.coordinates as PolygonCoordinates]
    : feature.geometry.coordinates as readonly PolygonCoordinates[]
}

function totalCoordinateCount(): number {
  return worldFeatures.reduce(
    (total, worldFeature) => total + polygonsOf(worldFeature)
      .flatMap((polygon) => polygon)
      .reduce((polygonTotal, ring) => polygonTotal + ring.length, 0),
    0,
  )
}

function greatCircleAngleDegrees(start: Point, end: Point): number {
  const [startLongitude, startLatitude] = start.map((value) => value * degreesToRadians)
  const [endLongitude, endLatitude] = end.map((value) => value * degreesToRadians)
  const cosine = Math.sin(startLatitude) * Math.sin(endLatitude)
    + Math.cos(startLatitude) * Math.cos(endLatitude)
      * Math.cos(endLongitude - startLongitude)

  return Math.acos(Math.min(1, Math.max(-1, cosine))) / degreesToRadians
}

function planarRingArea(ring: Ring): number {
  let area = 0

  for (let index = 0, previousIndex = ring.length - 1; index < ring.length; index += 1) {
    const previous = ring[previousIndex]
    const current = ring[index]
    area += previous[0] * current[1] - current[0] * previous[1]
    previousIndex = index
  }

  return Math.abs(area / 2)
}

function longitudeWidth(points: readonly Point[]): number {
  const longitudes = points.map(([longitude]) => longitude)
  return Math.max(...longitudes) - Math.min(...longitudes)
}

function inversePolar2Cartesian(x: number, y: number, z: number): Point {
  const radius = Math.hypot(x, y, z)
  const latitude = Math.asin(y / radius) / degreesToRadians
  const longitude = 90 - Math.atan2(z, x) / degreesToRadians
  const normalizedLongitude = ((longitude + 180) % 360 + 360) % 360 - 180

  return [normalizedLongitude, latitude]
}

/**
 * 三角形分割されたcapが球面上で実際に覆っている面積（world unit^2）。
 * 経度が不連続な日付変更線付近では平面の面積が使えないため、こちらで判定する。
 */
function capSurfaceArea(polygon: PolygonCoordinates): number {
  const geometry = new ConicPolygonGeometry(
    polygon.map((ring) => ring.map(([longitude, latitude]) => [longitude, latitude])),
    0,
    landRadius,
    false,
    true,
    false,
    3,
  )
  const position = geometry.getAttribute('position')
  const index = geometry.getIndex()
  if (index === null) throw new Error('cap geometry is missing an index')

  let area = 0
  for (let offset = 0; offset < index.count; offset += 3) {
    const [first, second, third] = [0, 1, 2].map((vertexOffset) => {
      const vertexIndex = index.getX(offset + vertexOffset)
      return new Vector3(
        position.getX(vertexIndex),
        position.getY(vertexIndex),
        position.getZ(vertexIndex),
      )
    })
    area += second.sub(first).cross(third.sub(first)).length() / 2
  }

  geometry.dispose()
  return area
}

function capAreaInDegrees(polygon: PolygonCoordinates): number {
  const geometry = new ConicPolygonGeometry(
    polygon.map((ring) => ring.map(([longitude, latitude]) => [longitude, latitude])),
    0,
    landRadius,
    false,
    true,
    false,
    3,
  )
  const position = geometry.getAttribute('position')
  const index = geometry.getIndex()
  if (index === null) throw new Error('cap geometry is missing an index')

  let area = 0
  for (let offset = 0; offset < index.count; offset += 3) {
    const triangle: Point[] = []
    let isCap = true

    for (let vertexOffset = 0; vertexOffset < 3; vertexOffset += 1) {
      const vertexIndex = index.getX(offset + vertexOffset)
      const x = position.getX(vertexIndex)
      const y = position.getY(vertexIndex)
      const z = position.getZ(vertexIndex)
      if (Math.abs(Math.hypot(x, y, z) - landRadius) > 0.1) isCap = false
      triangle.push(inversePolar2Cartesian(x, y, z))
    }

    if (isCap && longitudeWidth(triangle) <= 180) area += planarRingArea(triangle)
  }

  geometry.dispose()
  return area
}

describe('worldFeatures', () => {
  it('空ではなくPolygon系geometryを持つ', () => {
    expect(worldFeatures.length).toBeGreaterThan(0)

    for (const worldFeature of worldFeatures) {
      expect(typeof worldFeature.id).toBe('number')
      expect(['Polygon', 'MultiPolygon']).toContain(worldFeature.geometry.type)
    }
  })

  it('feature idに重複がない', () => {
    const ids = worldFeatures.map((worldFeature) => worldFeature.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('ISO numeric付き236入力featureのIDをすべて含む', () => {
    const worldFeatureIds = new Set(worldFeatures.map((worldFeature) => worldFeature.id))

    // 036はAustraliaとAshmoreで重複するため、出力では1つのMultiPolygonに統合する。
    expect(expectedIsoNumericIds).toHaveLength(236)
    expect(new Set(expectedIsoNumericIds).size).toBe(235)

    for (const numericId of expectedIsoNumericIds) {
      expect(worldFeatureIds.has(numericId)).toBe(true)
    }
  })

  it('主要国と簡略化で消えやすい国を含む', () => {
    const worldFeatureIds = new Set(worldFeatures.map((worldFeature) => worldFeature.id))

    for (const numericId of requiredNumericIds) {
      expect(worldFeatureIds.has(numericId)).toBe(true)
    }
  })

  it('未定義featureを負のIDで陸地として含む', () => {
    const worldFeatureIds = new Set(worldFeatures.map((worldFeature) => worldFeature.id))

    expect([-1, -2, -3, -4, -5].every((id) => worldFeatureIds.has(id))).toBe(true)
  })

  it('全リングが4点以上で閉じている', () => {
    for (const worldFeature of worldFeatures) {
      for (const polygon of polygonsOf(worldFeature)) {
        for (const ring of polygon) {
          expect(ring.length).toBeGreaterThanOrEqual(4)
          expect(ring[0]).toEqual(ring[ring.length - 1])
        }
      }
    }
  })

  it('全ての辺が設定した最大大円角以下になっている', () => {
    for (const worldFeature of worldFeatures) {
      for (const polygon of polygonsOf(worldFeature)) {
        for (const ring of polygon) {
          for (let index = 1; index < ring.length; index += 1) {
            expect(greatCircleAngleDegrees(ring[index - 1], ring[index]))
              .toBeLessThanOrEqual(maxArcAngleDegrees + maxArcAngleTestToleranceDegrees)
          }
        }
      }
    }
  })

  it('three-conic-polygon-geometryのcapが各ポリゴンをほぼ覆う', { timeout: 30_000 }, () => {
    // 簡略化のしきい値を変えると三角形分割が破綻して陸に穴が空くため、
    // 目視確認ではなくリング面積とcap面積の差で検出する。
    let checkedPolygonCount = 0
    let maxMissingArea = 0

    for (const worldFeature of worldFeatures) {
      for (const polygon of polygonsOf(worldFeature)) {
        // three-conic-polygon-geometryは日付変更線をまたぐ平面面積を扱えない。
        if (polygon.some((ring) => longitudeWidth(ring) > 180)) continue

        const ringArea = planarRingArea(polygon[0])
          - polygon.slice(1).reduce((area, ring) => area + planarRingArea(ring), 0)
        const missingArea = ringArea - capAreaInDegrees(polygon)
        checkedPolygonCount += 1
        maxMissingArea = Math.max(maxMissingArea, missingArea)

        expect(missingArea, `feature ${worldFeature.id} のcap欠損`).toBeLessThan(0.1)
      }
    }

    expect(checkedPolygonCount).toBeGreaterThan(0)
    expect(maxMissingArea).toBeLessThan(0.1)
  })

  it('どのポリゴンのcapも地球全体を覆わない', { timeout: 30_000 }, () => {
    // 日付変更線をまたぐリングは平面座標が不連続なため、平面面積のテストでは
    // 検出できない。滑らか化などで経度を平均すると地球を一周する三角形ができる。
    let maxSurfaceArea = 0

    for (const worldFeature of worldFeatures) {
      for (const polygon of polygonsOf(worldFeature)) {
        const surfaceArea = capSurfaceArea(polygon)
        maxSurfaceArea = Math.max(maxSurfaceArea, surfaceArea)

        expect(surfaceArea, `feature ${worldFeature.id} のcapが広がりすぎている`)
          .toBeLessThan(maxCapSurfaceArea)
      }
    }

    expect(maxSurfaceArea).toBeGreaterThan(0)
  })

  it('座標数が元データより十分に少ない', () => {
    expect(totalCoordinateCount()).toBeLessThan(60_000)
  })
})
