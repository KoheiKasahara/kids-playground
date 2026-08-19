export type ToyKind = 'spinner' | 'launcher'

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
}
