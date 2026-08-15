export type ToyKind = 'spinner' | 'launcher'

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
  /** 読み上げ用のラベル（例: 'くるくる おもちゃ'） */
  readonly labelJa: string
}

/**
 * おもちゃの配置は論理座標で固定する。テーマや物理の実装が変わっても、
 * 配置だけは同じ接続点を使い続けられるように、ここへ集約する。
 */
export const TOYS: readonly ToyPlacement[] = [
  {
    id: 'toy-spinner',
    kind: 'spinner',
    x: 110,
    y: 385,
    radius: 34,
    tapRadius: 56,
    labelJa: 'くるくる おもちゃ',
  },
  {
    id: 'toy-launcher',
    kind: 'launcher',
    x: 240,
    y: 645,
    radius: 30,
    tapRadius: 56,
    labelJa: 'ぽーん おもちゃ',
  },
]

// idを重複させると登録先のDOMやランタイムが上書きされるため、モジュール読込時にも検査する。
const toyIds = TOYS.map((toy) => toy.id)
if (new Set(toyIds).size !== toyIds.length) {
  throw new Error('flag-pinball: おもちゃのidが重複しています')
}
