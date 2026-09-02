// いろぬりパズルの題材（ぬりえ）データ。
// 座標はすべて viewBox '0 0 100 100' の絶対座標で、path の d は絶対座標の
// M / L / C / Q / Z のみで構成する（shapeBounds.ts の制約と一致させる）。
import type { PaintShape } from './shapeBounds'

export type PaintAreaId = string

/**
 * 完成演出（Phase 2）で、この図形をどの入れ子`<g>`に入れて動かすかの指定。
 *
 * ColoringCanvas は areas / details を描画順のまま、この指定に従って
 * `<g data-motion-group>` → `<g data-motion-part>` の2階層にまとめる。
 * 実際の動きはCSS（ColoringCanvas.module.css）が data 属性で選んで与えるため、
 * ここは「どれとどれが一緒に動くか」だけを持つ。
 *
 * - `group` 未指定 = 背景など、完成演出でも動かさない図形（SVG直下に静止して描かれる）。
 * - `part` は `group` の中でさらに単体で動かすもの（タイヤ・おびれ・かたほうの羽など）。
 *   `part` は同じ回転中心を共有する図形どうしでのみ共有する（例: タイヤ本体・スポーク・
 *   ホイール中心は同じ `wheelFront`）。左右のタイヤのように中心が違うものは別の名前にする
 *   （まとめると2つの合成bboxの中心＝車体の真ん中を軸に回ってしまう）。
 */
export type PaintMotionRef = {
  group?: string
  part?: string
}

/** 塗れるエリア。label は読み上げ・aria-label用の日本語（例: 「くるまの ボディ」）。 */
export type PaintArea = {
  id: PaintAreaId
  label: string
  shape: PaintShape
  motion?: PaintMotionRef
}

/** areasの上に描く、塗れない装飾（目・ホイールの中心・もよう等）。 */
export type PaintDetail = {
  shape: PaintShape
  fill?: string
  stroke?: string
  strokeWidth?: number
  motion?: PaintMotionRef
}

export type PaintPicture = {
  id: string
  label: string
  emoji: string
  /** すべて '0 0 100 100'。 */
  viewBox: string
  /** 描画順＝配列順（先頭が最背面）。 */
  areas: readonly PaintArea[]
  /** areas の上に描く装飾。pointer-eventsはコンポーネント側でnoneにする。 */
  details: readonly PaintDetail[]
}

const VIEW_BOX = '0 0 100 100'
const OUTLINE_COLOR = '#2b2b2b'

// 完成演出のグループ指定（詳細はPaintMotionRefのコメントを参照）。
// group名・part名はそのままCSSのdata属性セレクタになるため、題材をまたいで重複させない。
const CAR: PaintMotionRef = { group: 'car' }
const CAR_WHEEL_BACK: PaintMotionRef = { group: 'car', part: 'wheelBack' }
const CAR_WHEEL_FRONT: PaintMotionRef = { group: 'car', part: 'wheelFront' }
const FISH: PaintMotionRef = { group: 'fish' }
const FISH_TAIL: PaintMotionRef = { group: 'fish', part: 'fishTail' }
const FISH_BELLY_FIN: PaintMotionRef = { group: 'fish', part: 'fishBellyFin' }
// あわは魚と一緒に泳がず、その場で上へのぼるので group には入れない。
const BUBBLE_BIG: PaintMotionRef = { part: 'bubbleBig' }
const BUBBLE_SMALL: PaintMotionRef = { part: 'bubbleSmall' }
const BUTTERFLY: PaintMotionRef = { group: 'butterfly' }
const BUTTERFLY_WING_LEFT: PaintMotionRef = { group: 'butterfly', part: 'wingLeft' }
const BUTTERFLY_WING_RIGHT: PaintMotionRef = { group: 'butterfly', part: 'wingRight' }

// くるま・さかな・ちょうちょで共通の、画面いっぱいのラウンド角矩形（背景=そら/みず）。
const BACKDROP_PATH =
  'M 6,2 L 94,2 C 96.2,2 98,3.8 98,6 L 98,94 C 98,96.2 96.2,98 94,98 L 6,98 C 3.8,98 2,96.2 2,94 L 2,6 C 2,3.8 3.8,2 6,2 Z'

// くるま ------------------------------------------------------------------

const carAreas: readonly PaintArea[] = [
  { id: 'sky', label: 'そら', shape: { kind: 'path', d: BACKDROP_PATH } },
  {
    id: 'ground',
    label: 'じめん',
    shape: {
      kind: 'path',
      // 元デザインは 'M 2,84 L 98,84 ...'（高さ14単位）だったが、MIN_TAP_SIZE_UNITS(16)を
      // 満たすために上端を84→82へ2単位だけ引き上げている（幅・見た目はそのまま）。
      d: 'M 2,82 L 98,82 L 98,94 C 98,96.2 96.2,98 94,98 L 6,98 C 3.8,98 2,96.2 2,94 Z',
    },
  },
  {
    id: 'body',
    label: 'くるまの ボディ',
    shape: {
      kind: 'path',
      d: 'M 15,46 L 85,46 C 89,46 92,49 92,53 L 92,69 C 92,73 89,76 85,76 L 15,76 C 11,76 8,73 8,69 L 8,53 C 8,49 11,46 15,46 Z',
    },
    motion: CAR,
  },
  {
    id: 'roof',
    label: 'やね',
    shape: {
      kind: 'path',
      // まど（装飾）の外側に塗った色が十分見える太さで残るよう、キャビンは大きめにとる。
      d: 'M 31,46 L 35,26 C 36,23 37,22 39,22 L 65,22 C 67,22 68,23 69,26 L 73,46 Z',
    },
    motion: CAR,
  },
  // いちばん小さいエリア。狭い縦画面でも押しやすいよう、半径9（=18単位）の丸にしている。
  { id: 'light', label: 'ライト', shape: { kind: 'circle', cx: 82, cy: 57, r: 9 }, motion: CAR },
  {
    id: 'wheelBack',
    label: 'うしろの タイヤ',
    shape: { kind: 'circle', cx: 28, cy: 75, r: 9 },
    motion: CAR_WHEEL_BACK,
  },
  {
    id: 'wheelFront',
    label: 'まえの タイヤ',
    shape: { kind: 'circle', cx: 72, cy: 75, r: 9 },
    motion: CAR_WHEEL_FRONT,
  },
]

const carDetails: readonly PaintDetail[] = [
  // まどは「やね」の内側に入れ子になるため、塗りエリアにはしない（内側に窓があると
  // やねの塗れる範囲が細い枠だけになり、幼児には押しにくくなる）。ガラス色の装飾として
  // 描き、まどをタップしたときは下の「やね」が塗られる。
  {
    shape: { kind: 'path', d: 'M 39,42 L 42,29 L 62,29 L 65,42 Z' },
    fill: '#e7f5ff',
    stroke: OUTLINE_COLOR,
    strokeWidth: 2,
    motion: CAR,
  },
  // タイヤのスポーク。真円のタイヤと中心の丸だけでは回転させても見た目が変わらないため、
  // 「タイヤが回っている」ことが幼児にも分かるよう放射状の線を入れている
  // （ぬりえ中も自転車のホイールらしく見えるので、Phase 1の見た目を損なわない）。
  {
    shape: {
      kind: 'path',
      d: 'M 20,75 L 36,75 M 28,67 L 28,83 M 22.3,69.3 L 33.7,80.7 M 33.7,69.3 L 22.3,80.7',
    },
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.3,
    motion: CAR_WHEEL_BACK,
  },
  { shape: { kind: 'circle', cx: 28, cy: 75, r: 3.6 }, fill: '#495057', motion: CAR_WHEEL_BACK },
  {
    shape: {
      kind: 'path',
      d: 'M 64,75 L 80,75 M 72,67 L 72,83 M 66.3,69.3 L 77.7,80.7 M 77.7,69.3 L 66.3,80.7',
    },
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.3,
    motion: CAR_WHEEL_FRONT,
  },
  { shape: { kind: 'circle', cx: 72, cy: 75, r: 3.6 }, fill: '#495057', motion: CAR_WHEEL_FRONT },
  {
    shape: { kind: 'path', d: 'M 50,48 L 50,74' },
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.6,
    motion: CAR,
  },
]

// さかな ------------------------------------------------------------------

const fishAreas: readonly PaintArea[] = [
  { id: 'water', label: 'みず', shape: { kind: 'path', d: BACKDROP_PATH } },
  {
    id: 'body',
    label: 'さかなの からだ',
    shape: { kind: 'ellipse', cx: 48, cy: 54, rx: 30, ry: 22 },
    motion: FISH,
  },
  {
    id: 'tail',
    label: 'おびれ',
    // 右端は枠線(x=98)に触れないよう x=92 までにする（枠と同化して切れて見えるため）。
    shape: {
      kind: 'path',
      d: 'M 74,54 L 90,36 C 91,35.2 92,35.8 92,37 L 92,71 C 92,72.2 91,72.8 90,72 Z',
    },
    motion: FISH_TAIL,
  },
  {
    id: 'dorsalFin',
    label: 'せびれ',
    // 付け根がからだの上辺(y≒32)に沿うようにして、帽子のように浮いて見えないようにする。
    shape: { kind: 'path', d: 'M 32,36 C 38,18 48,13 55,17 C 59,20 61,27 61,33 Z' },
    motion: FISH,
  },
  {
    id: 'bellyFin',
    label: 'はらびれ',
    shape: { kind: 'path', d: 'M 36,72 C 40,86 48,90 54,86 C 58,83 59,78 58,74 Z' },
    motion: FISH_BELLY_FIN,
  },
  {
    id: 'bubbleBig',
    label: 'おおきな あわ',
    shape: { kind: 'circle', cx: 22, cy: 22, r: 9 },
    motion: BUBBLE_BIG,
  },
  {
    id: 'bubbleSmall',
    label: 'ちいさな あわ',
    shape: { kind: 'circle', cx: 40, cy: 15, r: 8 },
    motion: BUBBLE_SMALL,
  },
]

const fishDetails: readonly PaintDetail[] = [
  { shape: { kind: 'circle', cx: 30, cy: 48, r: 5.5 }, fill: '#ffffff', motion: FISH },
  { shape: { kind: 'circle', cx: 30, cy: 48, r: 2.6 }, fill: OUTLINE_COLOR, motion: FISH },
  {
    shape: { kind: 'path', d: 'M 19,58 C 22,61 26,61 29,59' },
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.6,
    motion: FISH,
  },
  {
    shape: { kind: 'circle', cx: 44, cy: 50, r: 5 },
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.4,
    motion: FISH,
  },
  {
    shape: { kind: 'circle', cx: 58, cy: 48, r: 4 },
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.4,
    motion: FISH,
  },
  {
    shape: { kind: 'circle', cx: 50, cy: 62, r: 4.5 },
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.4,
    motion: FISH,
  },
]

// ちょうちょ ---------------------------------------------------------------

const butterflyAreas: readonly PaintArea[] = [
  { id: 'sky', label: 'そら', shape: { kind: 'path', d: BACKDROP_PATH } },
  {
    id: 'wingUpperLeft',
    label: 'ひだりの うえばね',
    shape: {
      kind: 'path',
      d: 'M 44,42 C 34,20 18,12 10,22 C 3,31 8,46 24,52 C 32,55 40,52 44,48 Z',
    },
    motion: BUTTERFLY_WING_LEFT,
  },
  {
    id: 'wingUpperRight',
    label: 'みぎの うえばね',
    shape: {
      kind: 'path',
      d: 'M 56,42 C 66,20 82,12 90,22 C 97,31 92,46 76,52 C 68,55 60,52 56,48 Z',
    },
    motion: BUTTERFLY_WING_RIGHT,
  },
  {
    id: 'wingLowerLeft',
    label: 'ひだりの したばね',
    shape: {
      kind: 'path',
      d: 'M 44,54 C 36,58 22,60 18,70 C 14,80 24,90 34,86 C 42,83 46,70 46,60 Z',
    },
    motion: BUTTERFLY_WING_LEFT,
  },
  {
    id: 'wingLowerRight',
    label: 'みぎの したばね',
    shape: {
      kind: 'path',
      d: 'M 56,54 C 64,58 78,60 82,70 C 86,80 76,90 66,86 C 58,83 54,70 54,60 Z',
    },
    motion: BUTTERFLY_WING_RIGHT,
  },
  {
    id: 'body',
    label: 'からだ',
    shape: { kind: 'ellipse', cx: 50, cy: 56, rx: 8.5, ry: 28 },
    motion: BUTTERFLY,
  },
]

const butterflyDetails: readonly PaintDetail[] = [
  {
    shape: { kind: 'path', d: 'M 46,30 C 42,20 38,16 34,14' },
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.6,
    motion: BUTTERFLY,
  },
  {
    shape: { kind: 'path', d: 'M 54,30 C 58,20 62,16 66,14' },
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.6,
    motion: BUTTERFLY,
  },
  { shape: { kind: 'circle', cx: 34, cy: 14, r: 2 }, fill: OUTLINE_COLOR, motion: BUTTERFLY },
  { shape: { kind: 'circle', cx: 66, cy: 14, r: 2 }, fill: OUTLINE_COLOR, motion: BUTTERFLY },
  { shape: { kind: 'circle', cx: 46, cy: 46, r: 2.6 }, fill: '#ffffff', motion: BUTTERFLY },
  { shape: { kind: 'circle', cx: 46, cy: 46, r: 1.2 }, fill: OUTLINE_COLOR, motion: BUTTERFLY },
  { shape: { kind: 'circle', cx: 54, cy: 46, r: 2.6 }, fill: '#ffffff', motion: BUTTERFLY },
  { shape: { kind: 'circle', cx: 54, cy: 46, r: 1.2 }, fill: OUTLINE_COLOR, motion: BUTTERFLY },
  // 羽のもようは、それぞれの羽と一緒に羽ばたくよう左右の羽グループへ入れる。
  {
    shape: { kind: 'circle', cx: 26, cy: 32, r: 5 },
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.4,
    motion: BUTTERFLY_WING_LEFT,
  },
  {
    shape: { kind: 'circle', cx: 28, cy: 70, r: 4 },
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.4,
    motion: BUTTERFLY_WING_LEFT,
  },
  {
    shape: { kind: 'circle', cx: 74, cy: 32, r: 5 },
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.4,
    motion: BUTTERFLY_WING_RIGHT,
  },
  {
    shape: { kind: 'circle', cx: 72, cy: 70, r: 4 },
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.4,
    motion: BUTTERFLY_WING_RIGHT,
  },
]

export const PAINT_PICTURES: readonly PaintPicture[] = [
  { id: 'car', label: 'くるま', emoji: '🚗', viewBox: VIEW_BOX, areas: carAreas, details: carDetails },
  { id: 'fish', label: 'さかな', emoji: '🐟', viewBox: VIEW_BOX, areas: fishAreas, details: fishDetails },
  {
    id: 'butterfly',
    label: 'ちょうちょ',
    emoji: '🦋',
    viewBox: VIEW_BOX,
    areas: butterflyAreas,
    details: butterflyDetails,
  },
]

export const DEFAULT_PICTURE_ID = 'car'

export function findPaintPicture(id: string): PaintPicture | undefined {
  return PAINT_PICTURES.find((picture) => picture.id === id)
}

/**
 * タップ領域として許容する最小サイズ（viewBox単位）。
 * 100単位=最小想定キャンバス幅300pxとして、16単位≒48px
 * （規約の補助操作44px以上を満たす）。
 */
export const MIN_TAP_SIZE_UNITS = 16
