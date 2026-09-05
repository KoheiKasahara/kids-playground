// 「ぷかぷかレスキュー」のステージ座標系と定義の型。
//
// 座標は左上原点・Y下向き（SVGのviewBoxと同じ向き）の2Dステージ座標で統一する。
// 表示だけを2.5D風にする場合も、ここで扱う値は常に2Dのゲーム座標のままにする。
// 単位はステージ座標の1マス（STAGE_WIDTH=100を横幅とする相対値）で、px換算はしない。

export type Rect = {
  x: number
  y: number
  width: number
  height: number
}

/** 見た目の描き分けだけに使う固定物の種類（当たり判定はどれも同じ矩形）。 */
export type SolidKind = 'wall' | 'floor' | 'divider' | 'platform'

export type SolidDefinition = Rect & {
  id: string
  kind: SolidKind
}

export type WaterBodyId = string

/**
 * 水域（水槽ひとつ分）の定義。
 *
 * 画面全体を1枚の水面として決め打ちにせず「水域」を単位にすることで、
 * 上段水槽・下段水槽・排水先など複数水域を後から足すときに
 * 定義を1件増やすだけで済むようにしている（#515〜#517を想定）。
 *
 * 水域は矩形で、幅は高さによらず一定。水量(volume)と水位(level)は
 * `waterModel.ts` の `volume = level * width` で相互に変換する。
 */
export type WaterBodyDefinition = {
  id: WaterBodyId
  /** 将来のUI（どの水槽を操作しているかの表示）に使う日本語ラベル。 */
  label: string
  /** 水域の左端X。 */
  left: number
  /** 水域の右端X。 */
  right: number
  /** 水域の底のY（この位置が水位0）。 */
  floorY: number
  /** 満水時の水面Y（これより上には増えない）。 */
  ceilingY: number
  /** ステージ開始時・やりなおし時の水位。 */
  initialLevel: number
}

/** Phase 1で実装する浮遊物はアヒルのみ。ボート・浮き輪は#518で足す。 */
export type FloaterKind = 'duck'

export type FloaterDefinition = {
  id: string
  kind: FloaterKind
  /** 当たり判定・浮力計算に使う半径（見た目はこれより少し大きく描いてよい）。 */
  radius: number
  startX: number
  startY: number
}

export type GoalDefinition = {
  /** ゴール判定領域。中心がこの矩形に入ったらクリア。 */
  area: Rect
  /** ゴールへ運ぶ対象の浮遊物ID。 */
  floaterId: string
}

export type StageDefinition = {
  id: string
  name: string
  /** ステージ座標の幅・高さ（SVGのviewBoxと一致させる）。 */
  width: number
  height: number
  solids: readonly SolidDefinition[]
  waterBodies: readonly WaterBodyDefinition[]
  floaters: readonly FloaterDefinition[]
  goal: GoalDefinition
  /** 幼児向けの短い1行ヒント。 */
  hint: string
}

export function rectContainsPoint(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height
}
