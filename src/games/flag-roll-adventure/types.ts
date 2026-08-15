export type AreaTheme = 'sky' | 'forest' | 'cave' | 'goal'

/** 静的な壁・斜めすべり台。x,y はローカル座標の中心、angle はラジアン */
export type AreaWall = {
  kind: 'wall'
  id: string
  x: number
  y: number
  width: number
  height: number
  angle: number
  restitution?: number
}

/**
 * 反射するピン／バンパー。見た目はエリアのテーマで変わる。
 * kind は物理的な役割だけを表し、森のキノコや洞窟の岩という名前は表示側で決める。
 */
export type AreaPin = {
  kind: 'pin'
  id: string
  x: number
  y: number
  radius: number
  restitution?: number
}

export type AreaObject = AreaWall | AreaPin

/**
 * 出口。Phase 1 は各エリア1つだが、配列で持つことでPhase 2の分岐を
 * エリアデータの追加だけで表現できるようにする。
 */
export type AreaExit = {
  id: string
  x: number
  y: number
  width: number
  height: number
  /** 次のエリアid。null ならゴール */
  to: string | null
}

export type AdventureArea = {
  id: string
  /** 子どもに見せるエリア名（例: 「そら」） */
  nameJa: string
  theme: AreaTheme
  /** ワールド上の原点。Phase 1でも配列位置から計算せず、将来の分岐配置に備えて明示する。 */
  origin: { x: number; y: number }
  objects: readonly AreaObject[]
  exits: readonly AreaExit[]
}
