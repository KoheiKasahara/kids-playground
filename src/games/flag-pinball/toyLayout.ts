export type ToyKind = 'spinner' | 'launcher' | 'jumppad' | 'seesaw' | 'hammer' | 'wind'

/**
 * launcher（押し出しおもちゃ）を「潮流」寄りに振る舞わせるための任意設定。
 * 未指定（undefined）のときは launcherToy.ts の既定挙動（上向き主体・左右完全ランダム）の
 * まま変わらないため、通常・宇宙・おかしテーマの押し出しtoyには一切影響しない。
 * 海テーマだけがこの設定を持つ launcher を配置することで、「左から右へ」「右から左へ」
 * といった向きの弱い横方向の押し出し（潮流）を表現する。
 */
export type LauncherTideConfig = {
  /** 押し出す向きへ偏らせる方向。1で右向き優先、-1で左向き優先。完全固定はせず確率で偏らせる（launcherToy.ts参照） */
  readonly biasDirection: 1 | -1
  /** 上向きの勢いの倍率。既定1。海テーマでは1未満にして「打ち上げ」感を弱める */
  readonly upSpeedScale?: number
  /** 横方向の勢いの倍率。既定1。海テーマでは1より大きくして「押し流す」感を強める */
  readonly horizontalSpeedScale?: number
}

/**
 * 風toy（kind: 'wind'）が効く範囲と力を決める任意設定。
 * 風toyは接触時に一度だけ強く押す既存の押し出しtoyとは違い、この矩形範囲
 * （中心(x,y)からhalfWidth・halfHeightぶん）にボールの中心が入っている間だけ、
 * 毎フレーム弱い速度を継続的に加える「エリア」として振る舞う（windToy.ts参照）。
 * 範囲を出れば即座に効力がなくなり、状態を持ち越さない。
 */
export type WindConfig = {
  /** 横方向の目標速度の向き。1で右向き、-1で左向き */
  readonly directionX: 1 | -1
  /** 横方向の目標速度の大きさ（px/step）。省略時は windToy.ts の既定値を使う。下部など弱めたい風だけ小さい値を指定する */
  readonly horizontalTargetSpeed?: number
  /**
   * 弱い上向き成分の目標速度（px/step）。指定する場合は必ず負の値（上向き）にする。
   * 省略時は上下方向には一切作用せず、横方向だけの風になる。
   */
  readonly upwardTargetVy?: number
  /** 影響範囲（論理座標）の半幅。中心xからこの範囲内のボールだけに効く */
  readonly halfWidth: number
  /** 影響範囲（論理座標）の半高。中心yからこの範囲内のボールだけに効く */
  readonly halfHeight: number
}

/**
 * おもちゃ1個ぶんの配置データ。テーマ別のBoardConfig（boardConfigs/）が種類・個数・座標を持ち、
 * このファイルには「配置データの形」だけを置く。
 */
export type ToyPlacement = {
  readonly id: string
  readonly kind: ToyKind
  /** 論理座標の中心 */
  readonly x: number
  readonly y: number
  /** 見た目のおおよその半径（論理座標） */
  readonly radius: number
  /** タップ判定の半径。4〜5歳が押せるよう見た目より広く取る */
  readonly tapRadius: number
  /** 読み上げ用のラベル（例: 'くるくる おもちゃ（ひだり）'） */
  readonly labelJa: string
  /** kind: 'launcher' のときだけ意味を持つ任意設定。他のkindでは無視される */
  readonly launcherTide?: LauncherTideConfig
  /** kind: 'wind' のときは必須の設定。他のkindでは無視される */
  readonly wind?: WindConfig
}
