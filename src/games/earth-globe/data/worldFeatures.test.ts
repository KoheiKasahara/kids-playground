import { describe, expect, it } from 'vitest'
import { worldFeatures } from './worldFeatures'

type Point = readonly [number, number]
type Ring = readonly Point[]
type PolygonCoordinates = readonly Ring[]

// Keep this in sync with build-earth-globe-data.mjs: four degrees keeps the
// spherical chord sag far below the 0.8-unit altitude of the land polygons.
const maxArcAngleDegrees = 4
const degreesToRadians = Math.PI / 180

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
              .toBeLessThanOrEqual(maxArcAngleDegrees)
          }
        }
      }
    }
  })

  it('座標数が元データより十分に少ない', () => {
    expect(totalCoordinateCount()).toBeLessThan(60_000)
  })
})
