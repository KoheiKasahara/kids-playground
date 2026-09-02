// いろぬりパズルの題材（ぬりえ）データ。
// 座標はすべて viewBox '0 0 100 100' の絶対座標で、path の d は絶対座標の
// M / L / C / Q / Z のみで構成する（shapeBounds.ts の制約と一致させる）。
import type { PaintShape } from './shapeBounds'

export type PaintAreaId = string

/** 塗れるエリア。label は読み上げ・aria-label用の日本語（例: 「くるまの ボディ」）。 */
export type PaintArea = {
  id: PaintAreaId
  label: string
  shape: PaintShape
}

/** areasの上に描く、塗れない装飾（目・ホイールの中心・もよう等）。 */
export type PaintDetail = {
  shape: PaintShape
  fill?: string
  stroke?: string
  strokeWidth?: number
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
  },
  {
    id: 'roof',
    label: 'やね',
    shape: {
      kind: 'path',
      // まど（装飾）の外側に塗った色が十分見える太さで残るよう、キャビンは大きめにとる。
      d: 'M 31,46 L 35,26 C 36,23 37,22 39,22 L 65,22 C 67,22 68,23 69,26 L 73,46 Z',
    },
  },
  // いちばん小さいエリア。狭い縦画面でも押しやすいよう、半径9（=18単位）の丸にしている。
  { id: 'light', label: 'ライト', shape: { kind: 'circle', cx: 82, cy: 57, r: 9 } },
  { id: 'wheelBack', label: 'うしろの タイヤ', shape: { kind: 'circle', cx: 28, cy: 75, r: 9 } },
  { id: 'wheelFront', label: 'まえの タイヤ', shape: { kind: 'circle', cx: 72, cy: 75, r: 9 } },
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
  },
  { shape: { kind: 'circle', cx: 28, cy: 75, r: 3.6 }, fill: '#495057' },
  { shape: { kind: 'circle', cx: 72, cy: 75, r: 3.6 }, fill: '#495057' },
  {
    shape: { kind: 'path', d: 'M 50,48 L 50,74' },
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.6,
  },
]

// さかな ------------------------------------------------------------------

const fishAreas: readonly PaintArea[] = [
  { id: 'water', label: 'みず', shape: { kind: 'path', d: BACKDROP_PATH } },
  { id: 'body', label: 'さかなの からだ', shape: { kind: 'ellipse', cx: 48, cy: 54, rx: 30, ry: 22 } },
  {
    id: 'tail',
    label: 'おびれ',
    // 右端は枠線(x=98)に触れないよう x=92 までにする（枠と同化して切れて見えるため）。
    shape: {
      kind: 'path',
      d: 'M 74,54 L 90,36 C 91,35.2 92,35.8 92,37 L 92,71 C 92,72.2 91,72.8 90,72 Z',
    },
  },
  {
    id: 'dorsalFin',
    label: 'せびれ',
    // 付け根がからだの上辺(y≒32)に沿うようにして、帽子のように浮いて見えないようにする。
    shape: { kind: 'path', d: 'M 32,36 C 38,18 48,13 55,17 C 59,20 61,27 61,33 Z' },
  },
  {
    id: 'bellyFin',
    label: 'はらびれ',
    shape: { kind: 'path', d: 'M 36,72 C 40,86 48,90 54,86 C 58,83 59,78 58,74 Z' },
  },
  { id: 'bubbleBig', label: 'おおきな あわ', shape: { kind: 'circle', cx: 22, cy: 22, r: 9 } },
  { id: 'bubbleSmall', label: 'ちいさな あわ', shape: { kind: 'circle', cx: 40, cy: 15, r: 8 } },
]

const fishDetails: readonly PaintDetail[] = [
  { shape: { kind: 'circle', cx: 30, cy: 48, r: 5.5 }, fill: '#ffffff' },
  { shape: { kind: 'circle', cx: 30, cy: 48, r: 2.6 }, fill: OUTLINE_COLOR },
  {
    shape: { kind: 'path', d: 'M 19,58 C 22,61 26,61 29,59' },
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.6,
  },
  { shape: { kind: 'circle', cx: 44, cy: 50, r: 5 }, stroke: OUTLINE_COLOR, strokeWidth: 1.4 },
  { shape: { kind: 'circle', cx: 58, cy: 48, r: 4 }, stroke: OUTLINE_COLOR, strokeWidth: 1.4 },
  { shape: { kind: 'circle', cx: 50, cy: 62, r: 4.5 }, stroke: OUTLINE_COLOR, strokeWidth: 1.4 },
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
  },
  {
    id: 'wingUpperRight',
    label: 'みぎの うえばね',
    shape: {
      kind: 'path',
      d: 'M 56,42 C 66,20 82,12 90,22 C 97,31 92,46 76,52 C 68,55 60,52 56,48 Z',
    },
  },
  {
    id: 'wingLowerLeft',
    label: 'ひだりの したばね',
    shape: {
      kind: 'path',
      d: 'M 44,54 C 36,58 22,60 18,70 C 14,80 24,90 34,86 C 42,83 46,70 46,60 Z',
    },
  },
  {
    id: 'wingLowerRight',
    label: 'みぎの したばね',
    shape: {
      kind: 'path',
      d: 'M 56,54 C 64,58 78,60 82,70 C 86,80 76,90 66,86 C 58,83 54,70 54,60 Z',
    },
  },
  { id: 'body', label: 'からだ', shape: { kind: 'ellipse', cx: 50, cy: 56, rx: 8.5, ry: 28 } },
]

const butterflyDetails: readonly PaintDetail[] = [
  {
    shape: { kind: 'path', d: 'M 46,30 C 42,20 38,16 34,14' },
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.6,
  },
  {
    shape: { kind: 'path', d: 'M 54,30 C 58,20 62,16 66,14' },
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.6,
  },
  { shape: { kind: 'circle', cx: 34, cy: 14, r: 2 }, fill: OUTLINE_COLOR },
  { shape: { kind: 'circle', cx: 66, cy: 14, r: 2 }, fill: OUTLINE_COLOR },
  { shape: { kind: 'circle', cx: 46, cy: 46, r: 2.6 }, fill: '#ffffff' },
  { shape: { kind: 'circle', cx: 46, cy: 46, r: 1.2 }, fill: OUTLINE_COLOR },
  { shape: { kind: 'circle', cx: 54, cy: 46, r: 2.6 }, fill: '#ffffff' },
  { shape: { kind: 'circle', cx: 54, cy: 46, r: 1.2 }, fill: OUTLINE_COLOR },
  { shape: { kind: 'circle', cx: 26, cy: 32, r: 5 }, stroke: OUTLINE_COLOR, strokeWidth: 1.4 },
  { shape: { kind: 'circle', cx: 28, cy: 70, r: 4 }, stroke: OUTLINE_COLOR, strokeWidth: 1.4 },
  { shape: { kind: 'circle', cx: 74, cy: 32, r: 5 }, stroke: OUTLINE_COLOR, strokeWidth: 1.4 },
  { shape: { kind: 'circle', cx: 72, cy: 70, r: 4 }, stroke: OUTLINE_COLOR, strokeWidth: 1.4 },
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
