export type AreaTheme = 'sky' | 'forest' | 'cave' | 'goal' | 'river' | 'cloud'

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

/** 出入口の見た目の種類。物理には影響せず、CSSのクラス選択にだけ使う。 */
export type PortalKind = 'hole' | 'tunnel' | 'pipe' | 'cavemouth'

/** 出口。ボールがここへ入ると、接続先エリアの入口へ送られる。 */
export type AreaExit = {
  id: string
  kind: PortalKind
  x: number
  y: number
  width: number
  height: number
  /** 接続先エリアid */
  to: string
  /** 接続先エリアの入口id */
  toEntry: string
}

/** 入口。出口から送られてきたボールがここから出てくる。 */
export type AreaEntry = {
  id: string
  kind: PortalKind
  /** ボール中心を置くローカル座標 */
  x: number
  y: number
  /** 入口から出るときの初速(px/step)。省略時は出口へ入ったときの速度を引き継ぐ。 */
  velocity?: { x: number; y: number }
}

/** ゴールのゴルフ風カップ。壁・底・内部センサーは物理側で自動生成する。 */
export type AreaCup = {
  id: string
  /** カップ口の中心x（ローカル座標） */
  x: number
  /** カップ口（リム）の上端y（ローカル座標） */
  rimY: number
}

export type AdventureArea = {
  id: string
  /** 子どもに見せるエリア名（例: 「そら」） */
  nameJa: string
  theme: AreaTheme
  /** ワールド上の原点。配列位置から計算せず、分岐したエリアの配置を明示する。 */
  origin: { x: number; y: number }
  objects: readonly AreaObject[]
  entries: readonly AreaEntry[]
  exits: readonly AreaExit[]
  cup?: AreaCup
}
