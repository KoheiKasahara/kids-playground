// うごくぬりえの題材（ぬりえ）データ。
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
const ROBOT: PaintMotionRef = { group: 'robot' }
const ROBOT_ARM_LEFT: PaintMotionRef = { group: 'robot', part: 'robotArmLeft' }
const ROBOT_ARM_RIGHT: PaintMotionRef = { group: 'robot', part: 'robotArmRight' }
const ROBOT_ANTENNA: PaintMotionRef = { group: 'robot', part: 'robotAntenna' }
const ROCKET: PaintMotionRef = { group: 'rocket' }
const ROCKET_FLAME: PaintMotionRef = { group: 'rocket', part: 'rocketFlame' }
// ほしはロケットと一緒に飛ばず、そらに残ってチカチカするので group には入れない。
const ROCKET_STARS: PaintMotionRef = { part: 'rocketStars' }
const DINO: PaintMotionRef = { group: 'dino' }
const DINO_TAIL: PaintMotionRef = { group: 'dino', part: 'dinoTail' }
const DINO_HEAD: PaintMotionRef = { group: 'dino', part: 'dinoHead' }

// 全題材で共通の、画面いっぱいのラウンド角矩形（背景=そら/みず）。
const BACKDROP_PATH =
  'M 6,2 L 94,2 C 96.2,2 98,3.8 98,6 L 98,94 C 98,96.2 96.2,98 94,98 L 6,98 C 3.8,98 2,96.2 2,94 L 2,6 C 2,3.8 3.8,2 6,2 Z'

// 地面に立つ題材（くるま・ロボット・きょうりゅう）で共通の、画面下の帯。
// 元デザインは 'M 2,84 L 98,84 ...'（高さ14単位）だったが、MIN_TAP_SIZE_UNITS(16)を
// 満たすために上端を84→82へ2単位だけ引き上げている（幅・見た目はそのまま）。
const GROUND_PATH =
  'M 2,82 L 98,82 L 98,94 C 98,96.2 96.2,98 94,98 L 6,98 C 3.8,98 2,96.2 2,94 Z'

// くるま ------------------------------------------------------------------

const carAreas: readonly PaintArea[] = [
  { id: 'sky', label: 'そら', shape: { kind: 'path', d: BACKDROP_PATH } },
  { id: 'ground', label: 'じめん', shape: { kind: 'path', d: GROUND_PATH } },
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
      // まどの外側に塗った色が十分見える太さで残るよう、キャビンは大きめにとる。
      d: 'M 31,46 L 35,26 C 36,23 37,22 39,22 L 65,22 C 67,22 68,23 69,26 L 73,46 Z',
    },
    motion: CAR,
  },
  {
    id: 'window',
    label: 'まど',
    // やねの内側に重ねて塗れるエリアとして描く（MIN_TAP_SIZE_UNITSを満たすよう、
    // 元の装飾より上下に少し広げている）。やねとの間に枠が十分残るよう、内側にとどめる。
    shape: { kind: 'path', d: 'M 38,44 L 42,25 L 62,25 L 66,44 Z' },
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

// ロボット ---------------------------------------------------------------

const robotAreas: readonly PaintArea[] = [
  { id: 'sky', label: 'そら', shape: { kind: 'path', d: BACKDROP_PATH } },
  { id: 'ground', label: 'じめん', shape: { kind: 'path', d: GROUND_PATH } },
  // うで・あしは、どうたいより先に描いて付け根を隠す（＝どうたいの下に差し込む）。
  {
    id: 'armLeft',
    label: 'ひだりの うで',
    shape: {
      kind: 'path',
      d: 'M 14,48 L 26,48 C 30,48 32,51 32,54 L 32,60 C 32,63 30,66 26,66 L 14,66 C 11,66 8,63 8,60 L 8,54 C 8,51 11,48 14,48 Z',
    },
    motion: ROBOT_ARM_LEFT,
  },
  {
    id: 'armRight',
    label: 'みぎの うで',
    shape: {
      kind: 'path',
      d: 'M 74,48 L 86,48 C 89,48 92,51 92,54 L 92,60 C 92,63 89,66 86,66 L 74,66 C 70,66 68,63 68,60 L 68,54 C 68,51 70,48 74,48 Z',
    },
    motion: ROBOT_ARM_RIGHT,
  },
  {
    id: 'legLeft',
    label: 'ひだりの あし',
    shape: {
      kind: 'path',
      d: 'M 30,72 L 47,72 L 47,84 C 47,87 45,89 42,89 L 35,89 C 32,89 30,87 30,84 Z',
    },
    motion: ROBOT,
  },
  {
    id: 'legRight',
    label: 'みぎの あし',
    shape: {
      kind: 'path',
      d: 'M 53,72 L 70,72 L 70,84 C 70,87 68,89 65,89 L 58,89 C 55,89 53,87 53,84 Z',
    },
    motion: ROBOT,
  },
  {
    id: 'body',
    label: 'ロボットの からだ',
    shape: {
      kind: 'path',
      d: 'M 36,46 L 64,46 C 68,46 72,50 72,54 L 72,68 C 72,72 68,76 64,76 L 36,76 C 32,76 28,72 28,68 L 28,54 C 28,50 32,46 36,46 Z',
    },
    motion: ROBOT,
  },
  {
    id: 'head',
    label: 'あたま',
    shape: {
      kind: 'path',
      // かおを内側に重ねるので、まわりに塗れる枠が十分残る大きさにしている。
      d: 'M 37,10 L 63,10 C 67,10 71,14 71,18 L 71,35 C 71,39 67,43 63,43 L 37,43 C 33,43 29,39 29,35 L 29,18 C 29,14 33,10 37,10 Z',
    },
    motion: ROBOT,
  },
  {
    id: 'face',
    label: 'かお',
    // あたまの内側に重ねる。まわりに枠がじゅうぶん残る大きさにしている。
    shape: {
      kind: 'path',
      d: 'M 40,18 L 60,18 C 62,18 64,20 64,22 L 64,33 C 64,35 62,37 60,37 L 40,37 C 38,37 36,35 36,33 L 36,22 C 36,20 38,18 40,18 Z',
    },
    motion: ROBOT,
  },
  {
    id: 'chest',
    label: 'むねの ボタン',
    shape: { kind: 'circle', cx: 50, cy: 59, r: 8.5 },
    motion: ROBOT,
  },
]

const robotDetails: readonly PaintDetail[] = [
  // アンテナ。棒はからだと一緒に動き、先の玉だけがその場で光る。
  {
    shape: { kind: 'path', d: 'M 50,10 L 50,6' },
    stroke: OUTLINE_COLOR,
    strokeWidth: 2,
    motion: ROBOT,
  },
  {
    shape: { kind: 'circle', cx: 50, cy: 4, r: 3.2 },
    fill: '#ff8787',
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.2,
    motion: ROBOT_ANTENNA,
  },
  { shape: { kind: 'circle', cx: 42, cy: 26, r: 4.6 }, fill: '#ffffff', motion: ROBOT },
  { shape: { kind: 'circle', cx: 42, cy: 26, r: 2.2 }, fill: OUTLINE_COLOR, motion: ROBOT },
  { shape: { kind: 'circle', cx: 58, cy: 26, r: 4.6 }, fill: '#ffffff', motion: ROBOT },
  { shape: { kind: 'circle', cx: 58, cy: 26, r: 2.2 }, fill: OUTLINE_COLOR, motion: ROBOT },
  {
    shape: { kind: 'path', d: 'M 44,32 C 47,35 53,35 56,32' },
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.6,
    motion: ROBOT,
  },
  // くび。あたまとどうたいのすき間をつなぐ2本の線。
  {
    shape: { kind: 'path', d: 'M 44,43 L 44,47 M 56,43 L 56,47' },
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.6,
    motion: ROBOT,
  },
  {
    shape: { kind: 'circle', cx: 50, cy: 59, r: 3.6 },
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.4,
    motion: ROBOT,
  },
]

// ロケット ---------------------------------------------------------------

const rocketAreas: readonly PaintArea[] = [
  { id: 'sky', label: 'そら', shape: { kind: 'path', d: BACKDROP_PATH } },
  // はね・ほのおはボディより先に描いて、付け根をボディで隠す。
  {
    id: 'finLeft',
    label: 'ひだりの はね',
    shape: {
      kind: 'path',
      d: 'M 36,50 L 36,70 L 18,78 C 16,79 14,77 15,74 L 22,56 C 23,52 26,50 30,50 Z',
    },
    motion: ROCKET,
  },
  {
    id: 'finRight',
    label: 'みぎの はね',
    shape: {
      kind: 'path',
      d: 'M 64,50 L 64,70 L 82,78 C 84,79 86,77 85,74 L 78,56 C 77,52 74,50 70,50 Z',
    },
    motion: ROCKET,
  },
  {
    id: 'flame',
    label: 'ほのお',
    shape: {
      kind: 'path',
      // ボディの下端と同じ幅から外へふくらみ、下は2つのまるい舌に分かれる炎の形。
      // 単純な三角だと「とがった尾」に見え、舌を増やすと1つ1つが細くなって塗りにくいので、
      // ふとい舌2つ＋浅い谷にしている。
      d: 'M 43,72 C 38,80 39,87 45,92 C 47,89 48,86 50,86 C 52,86 53,89 55,92 C 61,87 62,80 57,72 Z',
    },
    motion: ROCKET_FLAME,
  },
  {
    id: 'body',
    label: 'ロケットの ボディ',
    shape: {
      kind: 'path',
      d: 'M 36,34 L 64,34 L 64,68 C 64,72 61,74 57,74 L 43,74 C 39,74 36,72 36,68 Z',
    },
    motion: ROCKET,
  },
  {
    id: 'nose',
    label: 'せんたん',
    // ボディの上に重ねて描くので、下辺（Zで閉じる線）がそのまま切りかえの線になる。
    shape: { kind: 'path', d: 'M 36,36 C 36,22 43,10 50,6 C 57,10 64,22 64,36 Z' },
    motion: ROCKET,
  },
  {
    id: 'window',
    label: 'まど',
    shape: { kind: 'circle', cx: 50, cy: 46, r: 8.5 },
    motion: ROCKET,
  },
]

const rocketDetails: readonly PaintDetail[] = [
  // ほしはロケットと一緒に飛ばず、そらに残ってチカチカする。
  {
    shape: {
      kind: 'path',
      d: 'M 18,12 L 20,18 L 26,20 L 20,22 L 18,28 L 16,22 L 10,20 L 16,18 Z',
    },
    fill: '#ffd43b',
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.2,
    motion: ROCKET_STARS,
  },
  {
    shape: {
      kind: 'path',
      d: 'M 84,26 L 85.5,30.5 L 90,32 L 85.5,33.5 L 84,38 L 82.5,33.5 L 78,32 L 82.5,30.5 Z',
    },
    fill: '#ffd43b',
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.2,
    motion: ROCKET_STARS,
  },
  { shape: { kind: 'circle', cx: 47, cy: 43, r: 2.6 }, fill: '#ffffff', motion: ROCKET },
  {
    shape: { kind: 'path', d: 'M 36,60 L 64,60' },
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.6,
    motion: ROCKET,
  },
  // 炎の芯。線を増やしすぎず、炎らしい奥行きだけ足す。
  {
    shape: { kind: 'ellipse', cx: 50, cy: 79, rx: 3.4, ry: 4.6 },
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.4,
    motion: ROCKET_FLAME,
  },
]

// きょうりゅう -------------------------------------------------------------

const dinosaurAreas: readonly PaintArea[] = [
  { id: 'sky', label: 'そら', shape: { kind: 'path', d: BACKDROP_PATH } },
  { id: 'ground', label: 'じめん', shape: { kind: 'path', d: GROUND_PATH } },
  // しっぽ・あし・せなかのトゲは、からだより先に描いて付け根をからだの塗りで隠す
  // （からだの上に描くと、おなかの中に四角い線が浮いてしまう）。
  {
    id: 'tail',
    label: 'しっぽ',
    shape: {
      kind: 'path',
      d: 'M 36,52 C 26,46 12,50 8,62 C 14,60 20,63 24,67 C 29,71 35,68 37,63 Z',
    },
    motion: DINO_TAIL,
  },
  {
    id: 'legBack',
    label: 'うしろの あし',
    shape: {
      kind: 'path',
      d: 'M 30,62 L 48,62 L 48,80 C 48,84 46,86 42,86 L 32,86 C 29,86 27,84 27,81 C 27,78 28,76 30,74 Z',
    },
    motion: DINO,
  },
  {
    id: 'legFront',
    label: 'まえの あし',
    shape: {
      kind: 'path',
      d: 'M 58,62 L 74,62 L 74,74 C 76,76 77,78 77,81 C 77,84 75,86 72,86 L 62,86 C 59,86 58,84 58,80 Z',
    },
    motion: DINO,
  },
  {
    id: 'spikes',
    label: 'せなかの トゲ',
    // まるみのある3つのコブ。下辺はからだの内側に入れて、からだの塗りで隠す。
    shape: {
      kind: 'path',
      d: 'M 30,50 C 31,18 39,18 41,35 C 43,16 50,16 52,33 C 54,17 61,20 62,44 L 62,50 Z',
    },
    motion: DINO,
  },
  {
    id: 'body',
    label: 'きょうりゅうの からだ',
    shape: { kind: 'ellipse', cx: 52, cy: 56, rx: 24, ry: 18 },
    motion: DINO,
  },
  {
    id: 'belly',
    label: 'おなか',
    shape: { kind: 'ellipse', cx: 52, cy: 64, rx: 15, ry: 9 },
    motion: DINO,
  },
  {
    id: 'head',
    label: 'あたま',
    shape: {
      kind: 'path',
      d: 'M 63,46 C 59,32 66,20 77,20 C 87,20 93,25 93,32 C 93,38 90,42 85,44 C 80,46 72,47 66,47 C 64,47 63,47 63,46 Z',
    },
    motion: DINO_HEAD,
  },
]

const dinosaurDetails: readonly PaintDetail[] = [
  { shape: { kind: 'circle', cx: 78, cy: 30, r: 4.6 }, fill: '#ffffff', motion: DINO_HEAD },
  { shape: { kind: 'circle', cx: 78, cy: 30, r: 2.2 }, fill: OUTLINE_COLOR, motion: DINO_HEAD },
  // 鼻の穴。目と同じ高さ・同じ大きさだと「目が2つ」に見えるので、小さく口寄りに置く。
  { shape: { kind: 'circle', cx: 88, cy: 34, r: 1.1 }, fill: OUTLINE_COLOR, motion: DINO_HEAD },
  {
    shape: { kind: 'path', d: 'M 79,40 C 83,43 88,42 91,38' },
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.6,
    motion: DINO_HEAD,
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
  {
    id: 'robot',
    label: 'ロボット',
    emoji: '🤖',
    viewBox: VIEW_BOX,
    areas: robotAreas,
    details: robotDetails,
  },
  {
    id: 'rocket',
    label: 'ロケット',
    emoji: '🚀',
    viewBox: VIEW_BOX,
    areas: rocketAreas,
    details: rocketDetails,
  },
  {
    id: 'dinosaur',
    label: 'きょうりゅう',
    emoji: '🦕',
    viewBox: VIEW_BOX,
    areas: dinosaurAreas,
    details: dinosaurDetails,
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
