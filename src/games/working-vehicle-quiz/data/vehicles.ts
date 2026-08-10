import { LEVEL_RANK } from '../../quiz-core/types'
import type { QuizLevel } from '../../quiz-core/types'
import type { Vehicle } from '../types'

export const vehicles: readonly Vehicle[] = [
  { id: 'ambulance', nameJa: 'きゅうきゅうしゃ', nameEn: 'Ambulance', photo: 'vehicles/ambulance.webp', level: 'easy' },
  { id: 'fire-engine', nameJa: 'しょうぼうしゃ', nameEn: 'Fire engine', photo: 'vehicles/fire-engine.webp', level: 'easy' },
  { id: 'police-car', nameJa: 'パトカー', nameEn: 'Police car', photo: 'vehicles/police-car.webp', level: 'easy' },
  { id: 'route-bus', nameJa: 'ろせんバス', nameEn: 'Route bus', photo: 'vehicles/route-bus.webp', level: 'easy' },
  { id: 'taxi', nameJa: 'タクシー', nameEn: 'Taxi', photo: 'vehicles/taxi.webp', level: 'easy' },
  { id: 'garbage-truck', nameJa: 'ごみしゅうしゅうしゃ', nameEn: 'Garbage truck', photo: 'vehicles/garbage-truck.webp', level: 'easy' },
  { id: 'excavator', nameJa: 'ショベルカー', nameEn: 'Excavator', photo: 'vehicles/excavator.webp', level: 'easy' },
  { id: 'bulldozer', nameJa: 'ブルドーザー', nameEn: 'Bulldozer', photo: 'vehicles/bulldozer.webp', level: 'easy' },
  { id: 'dump-truck', nameJa: 'ダンプカー', nameEn: 'Dump truck', photo: 'vehicles/dump-truck.webp', level: 'easy' },
  { id: 'concrete-mixer', nameJa: 'ミキサーしゃ', nameEn: 'Concrete mixer truck', photo: 'vehicles/concrete-mixer.webp', level: 'easy' },
  { id: 'truck', nameJa: 'トラック', nameEn: 'Truck', photo: 'vehicles/truck.webp', level: 'easy' },
  { id: 'tractor', nameJa: 'トラクター', nameEn: 'Tractor', photo: 'vehicles/tractor.webp', level: 'easy' },

  { id: 'ladder-truck', nameJa: 'はしごしゃ', nameEn: 'Aerial ladder truck', photo: 'vehicles/ladder-truck.webp', level: 'normal' },
  { id: 'mobile-crane', nameJa: 'クレーンしゃ', nameEn: 'Mobile crane', photo: 'vehicles/mobile-crane.webp', level: 'normal' },
  { id: 'forklift', nameJa: 'フォークリフト', nameEn: 'Forklift', photo: 'vehicles/forklift.webp', level: 'normal' },
  { id: 'road-roller', nameJa: 'ロードローラー', nameEn: 'Road roller', photo: 'vehicles/road-roller.webp', level: 'normal' },
  { id: 'aerial-work-platform', nameJa: 'こうしょさぎょうしゃ', nameEn: 'Aerial work platform truck', photo: 'vehicles/aerial-work-platform.webp', level: 'normal' },
  { id: 'tow-truck', nameJa: 'レッカーしゃ', nameEn: 'Tow truck', photo: 'vehicles/tow-truck.webp', level: 'normal' },

  { id: 'tanker-truck', nameJa: 'タンクローリー', nameEn: 'Tanker truck', photo: 'vehicles/tanker-truck.webp', level: 'hard' },
  { id: 'water-truck', nameJa: 'きゅうすいしゃ', nameEn: 'Water truck', photo: 'vehicles/water-truck.webp', level: 'hard' },
  { id: 'snowplow', nameJa: 'じょせつしゃ', nameEn: 'Snowplow', photo: 'vehicles/snowplow.webp', level: 'hard' },
  { id: 'concrete-pump', nameJa: 'コンクリートポンプしゃ', nameEn: 'Concrete pump truck', photo: 'vehicles/concrete-pump.webp', level: 'hard' },
  { id: 'container-truck', nameJa: 'コンテナトラック', nameEn: 'Container truck', photo: 'vehicles/container-truck.webp', level: 'hard' },
  { id: 'food-truck', nameJa: 'いどうはんばいしゃ', nameEn: 'Food truck', photo: 'vehicles/food-truck.webp', level: 'hard' },
]

/** 指定したむずかしさ以下を累積した出題プールを返す。 */
export function vehiclesForLevel(level: QuizLevel): readonly Vehicle[] {
  return vehicles.filter((vehicle) => LEVEL_RANK[vehicle.level] <= LEVEL_RANK[level])
}
