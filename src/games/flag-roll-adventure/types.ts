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

/** 触れると指定方向へ跳ねるソリッドな板。 */
export type AreaJumpPad = {
  kind: 'jump'
  id: string
  x: number
  y: number
  width: number
  height: number
  angle: number
  launchAngle: number
  power: number
}

export type AreaObject = AreaWall | AreaPin | AreaJumpPad

/** 常時回転する羽根。触れたボールを接線方向へ弾く。テーマ側でプロペラ／回転岩／水車に見せる。 */
export type AreaSpinner = {
  kind: 'spinner'
  id: string
  x: number
  y: number
  /** 羽根の長さの半分 */
  radius: number
  /** 角速度(rad/step)。符号が回転方向 */
  angularVelocity: number
}

/** 触れると上方向へ打ち上げるバネ。タップ不要で常時作動する。 */
export type AreaLifter = {
  kind: 'lifter'
  id: string
  x: number
  y: number
  radius: number
  /** 上向き初速(px/step) */
  upSpeed: number
  /** 同じボールを連続で打ち上げないための待ち時間(ms)。省略時は既定値 */
  cooldownMs?: number
}

export type AreaToy = AreaSpinner | AreaLifter

/** ボールを一時捕獲して指定方向へ射出するセンサー円。 */
export type AreaCannon = {
  kind: 'cannon'
  id: string
  x: number
  y: number
  radius: number
  angle: number
  power: number
  holdMs?: number
}

/** 通過中のボールを進行方向へ加速するセンサー矩形。 */
export type AreaBoostLane = {
  kind: 'boost'
  id: string
  x: number
  y: number
  width: number
  height: number
  angle: number
  force?: number
  maxSpeed?: number
}

/** 中にいる間だけ重力の一部を打ち消すセンサー矩形。 */
export type AreaFloatZone = {
  kind: 'float'
  id: string
  x: number
  y: number
  width: number
  height: number
  gravityScale: number
}

export type AreaZone = AreaCannon | AreaBoostLane | AreaFloatZone

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
  /**
   * 基準重力に掛ける係数。省略時は1。
   * 密なピンやゴール付近など、エリア固有のテンポだけを小さく調整できるようにする。
   */
  gravityScale?: number
  /** ワールド上の原点。配列位置から計算せず、分岐したエリアの配置を明示する。 */
  origin: { x: number; y: number }
  objects: readonly AreaObject[]
  toys?: readonly AreaToy[]
  zones?: readonly AreaZone[]
  entries: readonly AreaEntry[]
  exits: readonly AreaExit[]
  cup?: AreaCup
}
