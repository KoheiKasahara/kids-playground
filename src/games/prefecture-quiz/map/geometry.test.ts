import { describe, expect, test } from 'vitest'
import { prefectures } from '../data/prefectures'
import { boundsForGeometry, mergeBounds, pathForGeometry, projectedBoundsForGeometry } from './geometry'
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
})
