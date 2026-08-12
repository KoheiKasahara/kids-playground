import type { TravelCourse, TravelRegion } from '../types'

export const travelCourses: readonly TravelCourse[] = [
  { id: 'asia-oceania-a', region: 'asiaOceania', name: '東アジアからオーストラリアへ', countryIds: ['jp', 'kr', 'cn', 'mn', 'in', 'th', 'vn', 'id', 'pg', 'au'] },
  { id: 'asia-oceania-b', region: 'asiaOceania', name: '日本から南の島へ', countryIds: ['jp', 'tw', 'ph', 'my', 'sg', 'id', 'au', 'nz', 'fj', 'vu'] },
  { id: 'asia-oceania-c', region: 'asiaOceania', name: '東南アジアから太平洋へ', countryIds: ['in', 'th', 'vn', 'ph', 'id', 'pg', 'sb', 'vu', 'fj', 'to'] },
  { id: 'asia-oceania-d', region: 'asiaOceania', name: '太平洋の島々をめぐる旅', countryIds: ['au', 'nz', 'pg', 'sb', 'vu', 'fj', 'to', 'ws', 'fm', 'mh'] },
  { id: 'asia-oceania-e', region: 'asiaOceania', name: 'アジア・オセアニア横断', countryIds: ['mn', 'cn', 'kr', 'jp', 'tw', 'ph', 'id', 'pg', 'fm', 'mh'] },
  { id: 'europe-a', region: 'europe', name: '西ヨーロッパを一周', countryIds: ['pt', 'es', 'fr', 'gb', 'nl', 'de', 'se', 'ch', 'it', 'gr'] },
  { id: 'europe-b', region: 'europe', name: '北から地中海へ', countryIds: ['se', 'de', 'nl', 'gb', 'fr', 'ch', 'it', 'gr', 'es', 'pt'] },
  { id: 'europe-c', region: 'europe', name: 'ヨーロッパ横断', countryIds: ['gb', 'nl', 'de', 'se', 'pl', 'at', 'ch', 'fr', 'es', 'pt'] },
  { id: 'africa-a', region: 'africa', name: '北アフリカから島へ', countryIds: ['ma', 'dz', 'tn', 'eg', 'et', 'ke', 'tz', 'zw', 'za', 'mg'] },
  { id: 'africa-b', region: 'africa', name: '西アフリカから南へ', countryIds: ['sn', 'ci', 'gh', 'ng', 'cm', 'et', 'ug', 'ke', 'tz', 'za'] },
  { id: 'africa-c', region: 'africa', name: '大西洋からインド洋へ', countryIds: ['ma', 'sn', 'ci', 'gh', 'ng', 'cm', 'et', 'ke', 'tz', 'mg'] },
  { id: 'americas-a', region: 'americas', name: '北から南へ大陸縦断', countryIds: ['ca', 'us', 'mx', 'gt', 'cr', 'pa', 'co', 'ec', 'pe', 'cl'] },
  { id: 'americas-b', region: 'americas', name: '南から北へ大陸縦断', countryIds: ['cl', 'ar', 'uy', 'br', 've', 'co', 'pa', 'cr', 'mx', 'us'] },
  { id: 'americas-c', region: 'americas', name: '北米とカリブ海をめぐる旅', countryIds: ['ca', 'us', 'bs', 'cu', 'jm', 'do', 'mx', 'gt', 'cr', 'pa'] },
  { id: 'americas-d', region: 'americas', name: 'カリブ海からアンデスへ', countryIds: ['bs', 'do', 'jm', 'cu', 'mx', 'gt', 'pa', 'co', 'pe', 'bo'] },
  { id: 'americas-e', region: 'americas', name: 'アマゾンから南の海へ', countryIds: ['ve', 'co', 'ec', 'pe', 'bo', 'py', 'br', 'uy', 'ar', 'cl'] },
]

export function coursesForRegion(region: TravelRegion): readonly TravelCourse[] {
  return travelCourses.filter((course) => course.region === region)
}
