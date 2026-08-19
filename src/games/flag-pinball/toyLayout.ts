export type ToyKind = 'spinner' | 'launcher' | 'jumppad' | 'seesaw'

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
}
