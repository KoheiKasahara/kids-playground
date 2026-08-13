import { LEVEL_RANK } from '../../quiz-core/types'
import type { QuizLevel } from '../../quiz-core/types'
import type { Vehicle } from '../types'

export const vehicles: readonly Vehicle[] = [
  { id: 'ambulance', nameJa: 'きゅうきゅうしゃ', nameEn: 'Ambulance', photo: 'images/working-vehicles/ambulance.png', level: 'easy' },
  { id: 'police-car', nameJa: 'パトカー', nameEn: 'Police car', photo: 'images/working-vehicles/police-car.png', level: 'easy' },
  { id: 'route-bus', nameJa: 'ろせんバス', nameEn: 'Route bus', photo: 'images/working-vehicles/route-bus.png', level: 'easy' },
  { id: 'garbage-truck', nameJa: 'ごみしゅうしゅうしゃ', nameEn: 'Garbage truck', photo: 'images/working-vehicles/garbage-truck.png', level: 'easy' },
  { id: 'dump-truck', nameJa: 'ダンプカー', nameEn: 'Dump truck', photo: 'images/working-vehicles/dump-truck.png', level: 'easy' },
  { id: 'bulldozer', nameJa: 'ブルドーザー', nameEn: 'Bulldozer', photo: 'images/working-vehicles/bulldozer.png', level: 'easy' },
  { id: 'wheel-loader', nameJa: 'ホイールローダー', nameEn: 'Wheel loader', photo: 'images/working-vehicles/wheel-loader.png', level: 'easy' },
  { id: 'road-roller', nameJa: 'ロードローラー', nameEn: 'Road roller', photo: 'images/working-vehicles/road-roller.png', level: 'easy' },
  { id: 'crane-truck', nameJa: 'クレーンしゃ', nameEn: 'Crane truck', photo: 'images/working-vehicles/crane-truck.png', level: 'easy' },
  { id: 'container-trailer', nameJa: 'トレーラー', nameEn: 'Container trailer', photo: 'images/working-vehicles/container-trailer.png', level: 'easy' },

  { id: 'aerial-work-platform', nameJa: 'こうしょさぎょうしゃ', nameEn: 'Aerial work platform truck', photo: 'images/working-vehicles/aerial-work-platform.png', level: 'normal' },
]

/** 指定したむずかしさ以下を累積した出題プールを返す。 */
export function vehiclesForLevel(level: QuizLevel): readonly Vehicle[] {
  return vehicles.filter((vehicle) => LEVEL_RANK[vehicle.level] <= LEVEL_RANK[level])
}
