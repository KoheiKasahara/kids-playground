import { describe, expect, test } from 'vitest'
import { prefectures } from './prefectures'
import { REGION_INSET_IDS, prefecturesForRegion } from './regions'

describe('prefectures', () => {
  test('JIS順の47都道府県を重複なく持つ', () => {
    expect(prefectures).toHaveLength(47)
    expect(prefectures.map((prefecture) => prefecture.id)).toEqual(
      Array.from({ length: 47 }, (_, index) => String(index + 1).padStart(2, '0')),
    )
    expect(new Set(prefectures.map((prefecture) => prefecture.nameKanji)).size).toBe(47)
    expect(prefectures.every((prefecture) => prefecture.mapFeatureName === prefecture.nameKanji)).toBe(true)
  })

  test('8地域の内訳が正しい', () => {
    const count = (region: string) => prefectures.filter((prefecture) => prefecture.region === region).length
    expect([count('hokkaido'), count('tohoku'), count('kanto'), count('chubu'), count('kinki'), count('chugoku'), count('shikoku'), count('kyushuOkinawa')]).toEqual([1, 6, 7, 9, 7, 5, 4, 8])
  })

  test('地方候補・insetの所属が明示的で正しい', () => {
    expect(prefecturesForRegion('kyushuOkinawa').map((prefecture) => prefecture.id)).toEqual(['40', '41', '42', '43', '44', '45', '46', '47'])
    expect(REGION_INSET_IDS.kyushuOkinawa).toEqual(['47'])
  })
})
