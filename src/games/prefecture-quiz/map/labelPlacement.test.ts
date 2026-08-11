import { describe, expect, test } from 'vitest'
import { prefectures } from '../data/prefectures'
import type { RegionId } from '../data/prefectures'
import { prefecturesForRegion, REGION_INSET_IDS } from '../data/regions'
import { createProjection, mergeBounds, primaryProjectedBounds } from './geometry'
import { displayPiecesForPrefecture } from './features'
import { labelPositionsFor } from './labelPlacement'

const REGIONS: readonly RegionId[] = ['hokkaido', 'tohoku', 'kanto', 'chubu', 'kinki', 'chugoku', 'shikoku', 'kyushuOkinawa']

/** PrefectureMapが地方主図で使う投影と同じ考え方でlocalProjectを作る（inset県は除く）。 */
function projectForRegion(region: RegionId) {
  const insetIds = REGION_INSET_IDS[region] ?? []
  const mainItems = prefecturesForRegion(region).filter((prefecture) => !insetIds.includes(prefecture.id))
  // PrefectureMap.tsxのlocalBoundsと同じく、離島に引っ張られないよう本土（最大polygon）基準でfitする。
  const bounds = mergeBounds(mainItems.map((prefecture) => primaryProjectedBounds(displayPiecesForPrefecture(prefecture).main)))
  return { mainItems, project: createProjection(bounds, 360, 218, 14) }
}

describe('labelPositionsFor', () => {
  test.each(REGIONS)('%sの全県ぶんの座標が返り、viewBox内に収まる', (region) => {
    const { mainItems, project } = projectForRegion(region)
    const positions = labelPositionsFor(mainItems, project)
    expect(positions.size).toBe(mainItems.length)
    for (const prefecture of mainItems) {
      const position = positions.get(prefecture.id)
      expect(position).toBeDefined()
      const [x, y] = position!
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThanOrEqual(360)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(280)
    }
  })

  test.each(REGIONS)('%sの地方ではバッジ同士が近すぎない', (region) => {
    const { mainItems, project } = projectForRegion(region)
    const positions = labelPositionsFor(mainItems, project)
    const points = [...positions.values()]
    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        const [ax, ay] = points[i]
        const [bx, by] = points[j]
        const distance = Math.hypot(ax - bx, ay - by)
        expect(distance).toBeGreaterThanOrEqual(20)
      }
    }
  })

  test('同じ入力なら同じ出力になる（決定的）', () => {
    const { mainItems, project } = projectForRegion('chubu')
    const first = labelPositionsFor(mainItems, project)
    const second = labelPositionsFor(mainItems, project)
    expect([...first.entries()]).toEqual([...second.entries()])
  })

  test('全県マスタのidが47件ぶんすべて何らかの地方で扱われる', () => {
    const coveredIds = new Set(REGIONS.flatMap((region) => prefecturesForRegion(region).map((prefecture) => prefecture.id)))
    expect(coveredIds.size).toBe(prefectures.length)
  })
})
