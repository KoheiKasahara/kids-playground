import type { CircleObstacle, CornerEscapeZone, WallSegment } from '../boardLayout'
import type { ToyPlacement } from '../toyLayout'

/** 射出口の位置と初速の範囲。毎回同じ軌道にならないよう位置と初速に揺らぎを持たせる。 */
export type LaunchConfig = {
  readonly x: number
  readonly y: number
  readonly jitterX: number
  readonly minVx: number
  readonly maxVx: number
  readonly minVy: number
  readonly maxVy: number
}

/**
 * テーマ1つぶんの盤面レイアウト。ピン・バンパー・壁・おもちゃなど、テーマごとに
 * 変わりうる配置データをまとめたもの。盤面の論理サイズ・得点ゾーン・物理定数・
 * ゲーム状態管理など全テーマ共通のものはここに含めない（boardLayout.ts / pinballPhysics.ts
 * のまま共通で持つ）。
 */
export type BoardConfig = {
  readonly obstacles: readonly CircleObstacle[]
  readonly walls: readonly WallSegment[]
  readonly cornerEscapeZones: readonly CornerEscapeZone[]
  readonly toys: readonly ToyPlacement[]
  readonly launch: LaunchConfig
}
