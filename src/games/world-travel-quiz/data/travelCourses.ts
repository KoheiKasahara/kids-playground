import type { TravelCourse, TravelRegion } from '../types'

export const travelCourses: readonly TravelCourse[] = [
  { id: 'asia-a', region: 'asia', name: '東アジアから東南アジアへ', countryIds: ['jp', 'kr', 'cn', 'mn', 'in', 'th', 'vn', 'ph', 'id', 'sg'] },
  { id: 'asia-b', region: 'asia', name: 'モンゴルから赤道へ', countryIds: ['mn', 'cn', 'kr', 'jp', 'tw', 'ph', 'vn', 'th', 'my', 'sg'] },
  { id: 'asia-c', region: 'asia', name: 'インド洋から日本へ', countryIds: ['in', 'th', 'vn', 'my', 'sg', 'id', 'ph', 'tw', 'kr', 'jp'] },
  { id: 'europe-a', region: 'europe', name: '西ヨーロッパを一周', countryIds: ['pt', 'es', 'fr', 'gb', 'nl', 'de', 'se', 'ch', 'it', 'gr'] },
  { id: 'europe-b', region: 'europe', name: '北から地中海へ', countryIds: ['se', 'de', 'nl', 'gb', 'fr', 'ch', 'it', 'gr', 'es', 'pt'] },
  { id: 'europe-c', region: 'europe', name: 'ヨーロッパ横断', countryIds: ['gb', 'nl', 'de', 'se', 'pl', 'at', 'ch', 'fr', 'es', 'pt'] },
  { id: 'africa-a', region: 'africa', name: '北アフリカから島へ', countryIds: ['ma', 'dz', 'tn', 'eg', 'et', 'ke', 'tz', 'zw', 'za', 'mg'] },
  { id: 'africa-b', region: 'africa', name: '西アフリカから南へ', countryIds: ['sn', 'ci', 'gh', 'ng', 'cm', 'et', 'ug', 'ke', 'tz', 'za'] },
  { id: 'africa-c', region: 'africa', name: '大西洋からインド洋へ', countryIds: ['ma', 'sn', 'ci', 'gh', 'ng', 'cm', 'et', 'ke', 'tz', 'mg'] },
]

export function coursesForRegion(region: TravelRegion): readonly TravelCourse[] {
  return travelCourses.filter((course) => course.region === region)
}
