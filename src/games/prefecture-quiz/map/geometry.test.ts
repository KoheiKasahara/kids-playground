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

  test('遠隔離島を持つ県もpolygonを削らず主図とinsetに全て表示する', () => {
    for (const id of ['13', '46', '47']) {
      const prefecture = prefectures.find((candidate) => candidate.id === id)
      if (!prefecture) throw new Error('都道府県がありません')
      const original = polygonCount(featureForPrefecture(prefecture).geometry)
      const pieces = displayPiecesForPrefecture(prefecture)
      expect(pieces.insets).not.toHaveLength(0)
      expect(polygonCount(pieces.main) + pieces.insets.reduce((count, inset) => count + polygonCount(inset.geometry), 0)).toBe(original)
    }
  })

  test('九州・沖縄の地方主図boundsには沖縄を含めず、沖縄は専用insetとして扱う', () => {
    const region = prefecturesForRegion('kyushuOkinawa')
    const main = region.filter((prefecture) => !REGION_INSET_IDS.kyushuOkinawa?.includes(prefecture.id))
    const bounds = mergeBounds(main.map((prefecture) => projectedBoundsForGeometry(displayPiecesForPrefecture(prefecture).main)))
    const okinawa = region.find((prefecture) => prefecture.id === '47')
    if (!okinawa) throw new Error('沖縄県がありません')
    expect(projectedBoundsForGeometry(displayPiecesForPrefecture(okinawa).main).minY).toBeLessThan(bounds.minY)
    expect(displayPiecesForPrefecture(okinawa).insets).not.toHaveLength(0)
  })

  test('primaryProjectedBoundsは東京都の伊豆諸島など近い離島に引っ張られず本土だけのboundsを返す', () => {
    const tokyo = prefectures.find((prefecture) => prefecture.id === '13')
    if (!tokyo) throw new Error('東京都がありません')
    const main = displayPiecesForPrefecture(tokyo).main
    const fullBounds = projectedBoundsForGeometry(main)
    const primaryBounds = primaryProjectedBounds(main)
    // 本土＋伊豆諸島の合計bboxより、本土だけのbboxのほうが緯度方向に狭い。
    const fullHeight = fullBounds.maxY - fullBounds.minY
    const primaryHeight = primaryBounds.maxY - primaryBounds.minY
    expect(primaryHeight).toBeLessThan(fullHeight)
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
