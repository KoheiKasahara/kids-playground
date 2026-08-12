import type { TravelRegion } from '../types'

/** 地域選択と地図の初期表示で共有する設定。経度は日付変更線をまたいでも連続する値を許可する。 */
export type TravelRegionInfo = {
  id: TravelRegion
  title: string
  emoji: string
  description: string
  mapFrame: readonly [minLongitude: number, minLatitude: number, maxLongitude: number, maxLatitude: number]
}

export const travelRegions: readonly TravelRegionInfo[] = [
  { id: 'asiaOceania', title: 'アジア・オセアニア', emoji: '🗾', description: 'アジア から たいへいようへ', mapFrame: [55, -55, 230, 68] },
  { id: 'europe', title: 'ヨーロッパ', emoji: '🏰', description: 'いろいろな くにを めぐろう', mapFrame: [-16, 33, 43, 72] },
  { id: 'africa', title: 'アフリカ', emoji: '🦁', description: 'さばく や そうげんを たびしよう', mapFrame: [-20, -37, 55, 39] },
  { id: 'americas', title: '南北アメリカ', emoji: '🗽', description: 'きた から みなみへ たびしよう', mapFrame: [-170, -58, -30, 76] },
]

export const travelRegionById = new Map(travelRegions.map((region) => [region.id, region]))
