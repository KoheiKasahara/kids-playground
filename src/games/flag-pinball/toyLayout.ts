import { BOARD_WIDTH } from './boardLayout'

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
  /** 読み上げ用のラベル（例: 'くるくる おもちゃ（ひだり）'） */
  readonly labelJa: string
}

/**
 * 回転おもちゃの見た目・当たり判定の半径（論理座標）。左右で同じ値を使うことで、
 * サイズだけでなく性能（角速度・効果時間など、この半径から間接的に影響する範囲判定も含む）
 * に差を付けない。
 * peg-row-4（y=480, x=112.5/367.5）との中心距離が左右のおもちゃに対して最も近い障害物になり、
 * これ以上大きくすると「障害物との中心距離にボール直径ぶんの余裕がある」制約を割り込む
 * （toyLayout.test.ts で検証）。
 */
const SPINNER_RADIUS = 37
/** 回転おもちゃのタップ判定半径。既存のまま（見た目より広く、4〜5歳でも押しやすい大きさ） */
const SPINNER_TAP_RADIUS = 56
/** 回転おもちゃの中心y。左右で共通にし、水平対称な配置にする。 */
const SPINNER_Y = 385
/** 左の回転おもちゃの中心x。中央バンパー(240,385)の左側に置く既存位置。 */
const SPINNER_LEFT_X = 110

/**
 * おもちゃの配置は論理座標で固定する。テーマや物理の実装が変わっても、
 * 配置だけは同じ接続点を使い続けられるように、ここへ集約する。
 */
export const TOYS: readonly ToyPlacement[] = [
  {
    id: 'toy-spinner-left',
    kind: 'spinner',
    x: SPINNER_LEFT_X,
    y: SPINNER_Y,
    radius: SPINNER_RADIUS,
    tapRadius: SPINNER_TAP_RADIUS,
    labelJa: 'くるくる おもちゃ（ひだり）',
  },
  {
    // BOARD_WIDTHの中心を挟んで左Toyと鏡写しになるxに置き、盤面の左右対称感を作る。
    id: 'toy-spinner-right',
    kind: 'spinner',
    x: BOARD_WIDTH - SPINNER_LEFT_X,
    y: SPINNER_Y,
    radius: SPINNER_RADIUS,
    tapRadius: SPINNER_TAP_RADIUS,
    labelJa: 'くるくる おもちゃ（みぎ）',
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
