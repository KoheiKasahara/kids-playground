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
  { id: 'north-america-a', region: 'northAmerica', name: '北から中米、カリブ海へ', countryIds: ['ca', 'us', 'mx', 'gt', 'cr', 'pa', 'cu', 'jm', 'do', 'bs'] },
  { id: 'north-america-b', region: 'northAmerica', name: 'カリブ海からパナマへ', countryIds: ['bs', 'us', 'ca', 'mx', 'gt', 'cr', 'pa', 'cu', 'jm', 'do'] },
  { id: 'north-america-c', region: 'northAmerica', name: '北アメリカを南へ', countryIds: ['ca', 'us', 'bs', 'do', 'jm', 'cu', 'mx', 'gt', 'cr', 'pa'] },
  { id: 'south-america-a', region: 'southAmerica', name: '北から南アメリカを縦断', countryIds: ['ve', 'co', 'ec', 'pe', 'cl', 'ar', 'uy', 'br', 'py', 'bo'] },
  { id: 'south-america-b', region: 'southAmerica', name: '大西洋からアンデスへ', countryIds: ['co', 've', 'br', 'uy', 'ar', 'cl', 'pe', 'ec', 'bo', 'py'] },
  { id: 'south-america-c', region: 'southAmerica', name: 'アマゾンから南の海へ', countryIds: ['ve', 'co', 'ec', 'pe', 'bo', 'py', 'br', 'uy', 'ar', 'cl'] },
  { id: 'oceania-a', region: 'oceania', name: '太平洋の島々からオーストラリアへ', countryIds: ['ws', 'to', 'fj', 'vu', 'sb', 'pg', 'au', 'nz', 'fm', 'mh'] },
  { id: 'oceania-b', region: 'oceania', name: '南の海をめぐる旅', countryIds: ['nz', 'au', 'pg', 'sb', 'vu', 'fj', 'to', 'ws', 'fm', 'mh'] },
  { id: 'oceania-c', region: 'oceania', name: '島から島へ、太平洋横断', countryIds: ['mh', 'fm', 'pg', 'sb', 'vu', 'fj', 'to', 'ws', 'nz', 'au'] },
]

export function coursesForRegion(region: TravelRegion): readonly TravelCourse[] {
  return travelCourses.filter((course) => course.region === region)
}
