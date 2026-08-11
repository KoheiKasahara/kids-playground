import { describe, expect, test } from 'vitest'
import type { RegionId } from './prefectures'
import { numberedPrefecturesForRegion, prefectureNumberInRegion, prefecturesForRegion } from './regions'

const REGION_COUNTS: readonly [RegionId, number][] = [
  ['hokkaido', 1], ['tohoku', 6], ['kanto', 7], ['chubu', 9],
  ['kinki', 7], ['chugoku', 5], ['shikoku', 4], ['kyushuOkinawa', 8],
]

describe('numberedPrefecturesForRegion', () => {
  test.each(REGION_COUNTS)('%sの番号は1..%iの連番で重複なく、県数と一致する', (region, count) => {
    const numbered = numberedPrefecturesForRegion(region)
    expect(numbered).toHaveLength(count)
    expect(numbered.map((entry) => entry.number)).toEqual(Array.from({ length: count }, (_, index) => index + 1))
    expect(new Set(numbered.map((entry) => entry.prefecture.id)).size).toBe(count)
  })

  test.each(REGION_COUNTS.map(([region]) => region))('%sの番号は都道府県コード順に固定される', (region) => {
    const numbered = numberedPrefecturesForRegion(region)
    const expectedOrder = prefecturesForRegion(region).map((prefecture) => prefecture.id).slice().sort()
    expect(numbered.map((entry) => entry.prefecture.id)).toEqual(expectedOrder)
  })

  test('同じ地方を2回呼んでも県と番号の対応が同一（固定である）', () => {
    const first = numberedPrefecturesForRegion('chubu')
    const second = numberedPrefecturesForRegion('chubu')
    expect(first.map((entry) => [entry.prefecture.id, entry.number])).toEqual(second.map((entry) => [entry.prefecture.id, entry.number]))
  })

  test('prefectureNumberInRegionはnumberedPrefecturesForRegionと同じ番号を返す', () => {
    for (const [region] of REGION_COUNTS) {
      for (const { prefecture, number } of numberedPrefecturesForRegion(region)) {
        expect(prefectureNumberInRegion(prefecture)).toBe(number)
      }
    }
  })
})
