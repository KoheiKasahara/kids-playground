import { describe, expect, test } from 'vitest'
import { prefectures } from '../data/prefectures'
import { boundsForGeometry, mergeBounds, pathForGeometry, primaryProjectedBounds, projectedBoundsForGeometry, splitPolygons } from './geometry'
import { displayPiecesForPrefecture, featureForPrefecture, polygonCount } from './features'
import { REGION_INSET_IDS, prefecturesForRegion } from '../data/regions'

describe('prefecture map geometry', () => {
  test('47県すべてに対応するGeoJSON featureと描画可能なpathがある', () => {
    prefectures.forEach((prefecture) => {
      const feature = featureForPrefecture(prefecture)
      const bounds = boundsForGeometry(feature.geometry)
      expect(bounds.maxX).toBeGreaterThan(bounds.minX)
      expect(bounds.maxY).toBeGreaterThan(bounds.minY)
      const pieces = displayPiecesForPrefecture(prefecture)
      expect(pathForGeometry(pieces.main, ([x, y]) => [x, y])).not.toBe('')
      expect(projectedBoundsForGeometry(feature.geometry).maxY).toBeGreaterThan(projectedBoundsForGeometry(feature.geometry).minY)
    })
  })

  test('画像を小さくする遠隔離島は除き、表示範囲に収まる佐渡島は残す', () => {
    const tokyo = prefectures.find((candidate) => candidate.id === '13')
    const niigata = prefectures.find((candidate) => candidate.id === '15')
    if (!tokyo || !niigata) throw new Error('都道府県がありません')

    expect(polygonCount(displayPiecesForPrefecture(tokyo).main)).toBeLessThan(polygonCount(featureForPrefecture(tokyo).geometry))
    expect(displayPiecesForPrefecture(tokyo).insets).toHaveLength(0)
    expect(polygonCount(displayPiecesForPrefecture(niigata).main)).toBe(polygonCount(featureForPrefecture(niigata).geometry))
  })

  test('九州・沖縄の地方主図boundsには沖縄を含めず、沖縄は専用insetとして扱う', () => {
    const region = prefecturesForRegion('kyushuOkinawa')
    const main = region.filter((prefecture) => !REGION_INSET_IDS.kyushuOkinawa?.includes(prefecture.id))
    const bounds = mergeBounds(main.map((prefecture) => projectedBoundsForGeometry(displayPiecesForPrefecture(prefecture).main)))
    const okinawa = region.find((prefecture) => prefecture.id === '47')
    if (!okinawa) throw new Error('沖縄県がありません')
    expect(projectedBoundsForGeometry(displayPiecesForPrefecture(okinawa).main).minY).toBeLessThan(bounds.minY)
    expect(polygonCount(displayPiecesForPrefecture(okinawa).main)).toBeLessThan(polygonCount(featureForPrefecture(okinawa).geometry))
  })

  test('primaryProjectedBoundsは最大polygonのboundsを返す', () => {
    const tokyo = prefectures.find((prefecture) => prefecture.id === '13')
    if (!tokyo) throw new Error('東京都がありません')
    const main = displayPiecesForPrefecture(tokyo).main
    const primaryBounds = primaryProjectedBounds(main)
    const largestPolygon = splitPolygons(main).reduce((largest, polygon) => {
      const bounds = projectedBoundsForGeometry(polygon)
      const largestBounds = projectedBoundsForGeometry(largest)
      const area = (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY)
      const largestArea = (largestBounds.maxX - largestBounds.minX) * (largestBounds.maxY - largestBounds.minY)
      return area > largestArea ? polygon : largest
    })
    expect(primaryBounds).toEqual(projectedBoundsForGeometry(largestPolygon))
    // 単一polygonのgeometryでは分割しても同じboundsになる。
    const single = { type: 'Polygon' as const, coordinates: [[[139, 35], [140, 35], [140, 36], [139, 35]]] }
    expect(primaryProjectedBounds(single)).toEqual(projectedBoundsForGeometry(single))
  })

  test('splitPolygonsはPolygonをそのまま1件、MultiPolygonを要素ごとのPolygonへ分割する', () => {
    const single = { type: 'Polygon' as const, coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] }
    expect(splitPolygons(single)).toEqual([single])
    const multi = { type: 'MultiPolygon' as const, coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 0]]], [[[2, 2], [3, 2], [3, 3], [2, 2]]]] }
    const parts = splitPolygons(multi)
    expect(parts).toHaveLength(2)
    expect(parts.every((part) => part.type === 'Polygon')).toBe(true)
    expect(parts.map((part) => pathForGeometry(part, ([x, y]) => [x, y]))).toEqual(multi.coordinates.map((polygon) => pathForGeometry({ type: 'Polygon', coordinates: polygon }, ([x, y]) => [x, y])))
  })
})
