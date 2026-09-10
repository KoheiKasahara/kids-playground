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
const SHIP: PaintMotionRef = { group: 'ship' }
const SHIP_FLAG: PaintMotionRef = { group: 'ship', part: 'shipFlag' }
// なみはふねと一緒に進まず、その場で揺れるのでgroupには入れない。
const SHIP_WAVE: PaintMotionRef = { part: 'shipWave' }

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

// でんしゃ -----------------------------------------------------------------

// パンタグラフ・両開きドア・前面窓で、身近な電車の形にする。
const trainAreas: readonly PaintArea[] = [
  {
    id: 'sky',
    label: 'そら',
    shape: { kind: 'path', d: BACKDROP_PATH },
  },
  {
    id: 'ground',
    label: 'じめん',
    shape: { kind: 'path', d: GROUND_PATH },
  },
  {
    id: 'body',
    label: 'でんしゃの ボディ',
    shape: { kind: 'path', d: 'M 9,38 Q 9,30 17,30 L 73,30 Q 85,30 89,43 L 94,63 L 94,75 L 9,75 Z' },
    motion: { group: 'train' },
  },
  {
    id: 'window',
    label: 'きゃくせきの まど',
    shape: { kind: 'path', d: 'M 15,39 L 34,39 L 34,56 L 15,56 Z' },
    motion: { group: 'train' },
  },
  {
    id: 'door',
    label: 'りょうびらきの ドア',
    shape: { kind: 'path', d: 'M 41,38 L 62,38 L 62,72 L 41,72 Z' },
    motion: { group: 'train' },
  },
  {
    id: 'front',
    label: 'うんてんせきの まど',
    shape: { kind: 'path', d: 'M 70,38 L 80,38 Q 83,39 85,46 L 88,56 L 70,56 Z' },
    motion: { group: 'train' },
  },
  {
    id: 'wheelBack',
    label: 'うしろの しゃりん',
    shape: { kind: 'circle', cx: 25, cy: 78, r: 8 },
    motion: { group: 'train', part: 'trainWheelBack' },
  },
  {
    id: 'wheelFront',
    label: 'まえの しゃりん',
    shape: { kind: 'circle', cx: 77, cy: 78, r: 8 },
    motion: { group: 'train', part: 'trainWheelFront' },
  },
]

const trainDetails: readonly PaintDetail[] = [
  {
    shape: { kind: 'path', d: 'M 24,30 L 24,26 L 16,20 L 27,13 L 38,20 L 30,26 L 30,30 M 17,12 L 37,12' },
    stroke: OUTLINE_COLOR,
    strokeWidth: 2,
    motion: { group: 'train' },
  },
  {
    shape: { kind: 'path', d: 'M 24.5,40 L 24.5,55 M 51.5,39 L 51.5,71 M 10,64 L 40,64 M 63,64 L 93,64' },
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.8,
    motion: { group: 'train' },
  },
  {
    shape: { kind: 'path', d: 'M 45,42 L 48,42 L 48,53 L 45,53 Z M 55,42 L 58,42 L 58,53 L 55,53 Z' },
    fill: '#dff4ff',
    stroke: OUTLINE_COLOR,
    strokeWidth: 1,
    motion: { group: 'train' },
  },
  {
    shape: { kind: 'path', d: 'M 72,69 L 87,69' },
    stroke: OUTLINE_COLOR,
    strokeWidth: 2,
    motion: { group: 'train' },
  },
  {
    shape: { kind: 'path', d: 'M 19,78 L 31,78 M 25,72 L 25,84' },
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.5,
    motion: { group: 'train', part: 'trainWheelBack' },
  },
  {
    shape: { kind: 'circle', cx: 25, cy: 78, r: 2.5 },
    fill: '#495057',
    motion: { group: 'train', part: 'trainWheelBack' },
  },
  {
    shape: { kind: 'path', d: 'M 71,78 L 83,78 M 77,72 L 77,84' },
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.5,
    motion: { group: 'train', part: 'trainWheelFront' },
  },
  {
    shape: { kind: 'circle', cx: 77, cy: 78, r: 2.5 },
    fill: '#495057',
    motion: { group: 'train', part: 'trainWheelFront' },
  },
  {
    shape: { kind: 'circle', cx: 90, cy: 61, r: 2 },
    fill: '#ffd43b',
    motion: { group: 'train' },
  },
]

// ひこうき -------------------------------------------------------------

// 奥の主翼と尾翼 → 胴体 → 手前の主翼の順に重ねる。
const airplaneAreas: readonly PaintArea[] = [
  {
    id: 'sky',
    label: 'そら',
    shape: { kind: 'path', d: BACKDROP_PATH },
  },
  {
    id: 'farWing',
    label: 'おくの しゅよく',
    shape: { kind: 'path', d: 'M 40,43 L 29,17 Q 28,14 32,14 L 46,14 Q 49,14 51,18 L 66,43 Z' },
    motion: { group: 'plane' },
  },
  {
    id: 'tailWing',
    label: 'びよく',
    shape: { kind: 'path', d: 'M 14,47 L 11,26 Q 11,23 15,23 L 23,23 L 34,47 Z' },
    motion: { group: 'plane' },
  },
  {
    id: 'body',
    label: 'ひこうきの どうたい',
    shape: { kind: 'path', d: 'M 14,42 L 65,42 Q 79,42 90,50 Q 97,56 90,60 Q 80,65 63,65 L 26,65 Q 18,65 15,59 L 10,47 Q 8,42 14,42 Z' },
    motion: { group: 'plane' },
  },
  {
    id: 'window',
    label: 'きゃくせきの まど',
    shape: { kind: 'path', d: 'M 29,45 L 61,45 Q 64,45 64,49 L 64,57 Q 64,61 61,61 L 29,61 Q 26,61 26,57 L 26,49 Q 26,45 29,45 Z' },
    motion: { group: 'plane' },
  },
  {
    id: 'mainWing',
    label: 'てまえの しゅよく',
    shape: { kind: 'path', d: 'M 49,62 L 70,62 L 52,85 Q 50,88 46,88 L 28,88 Q 24,88 28,83 Z' },
    motion: { group: 'plane' },
  },
]

const airplaneDetails: readonly PaintDetail[] = [
  {
    shape: { kind: 'path', d: 'M 37,48 L 37,58 M 48,48 L 48,58 M 59,48 L 59,58' },
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.5,
    motion: { group: 'plane' },
  },
  {
    shape: { kind: 'path', d: 'M 75,46 Q 82,47 87,51 L 76,52 Z' },
    fill: '#dff4ff',
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.2,
    motion: { group: 'plane' },
  },
  {
    shape: { kind: 'path', d: 'M 34,80 L 50,80' },
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.1,
    motion: { group: 'plane' },
  },
  {
    shape: { kind: 'path', d: 'M 17,17 C 12,17 12,11 17,11 C 17,4 27,4 28,10 C 35,8 38,17 32,17 Z' },
    fill: '#ffffff',
    stroke: OUTLINE_COLOR,
    strokeWidth: 1,
    motion: { part: 'planeClouds' },
  },
  {
    shape: { kind: 'path', d: 'M 70,27 C 65,27 65,21 70,21 C 70,14 80,14 81,20 C 88,18 91,27 85,27 Z' },
    fill: '#ffffff',
    stroke: OUTLINE_COLOR,
    strokeWidth: 1,
    motion: { part: 'planeClouds' },
  },
]

// ふね ---------------------------------------------------------------------

const shipAreas: readonly PaintArea[] = [
  { id: 'sky', label: 'そら', shape: { kind: 'path', d: BACKDROP_PATH } },
  // 水面はGROUND_PATH（画面下の帯）をそのまま「うみ」として再利用する。
  { id: 'water', label: 'うみ', shape: { kind: 'path', d: GROUND_PATH } },
  {
    id: 'hull',
    label: 'ふねの せんたい',
    shape: {
      kind: 'path',
      d: 'M 14,62 L 86,62 L 78,84 C 76,87 72,88 66,88 L 34,88 C 28,88 24,87 22,84 Z',
    },
    motion: SHIP,
  },
  {
    id: 'funnel',
    label: 'えんとつ',
    // デッキより先に描き、付け根をデッキの塗りで隠す。
    shape: {
      kind: 'path',
      d: 'M 46,20 L 62,20 C 64,20 65,22 65,25 L 65,40 L 43,40 L 43,25 C 43,22 44,20 46,20 Z',
    },
    motion: SHIP,
  },
  {
    id: 'deck',
    label: 'じょうぶ',
    shape: {
      kind: 'path',
      d: 'M 34,38 L 66,38 C 69,38 71,40 71,43 L 71,64 L 29,64 L 29,43 C 29,40 31,38 34,38 Z',
    },
    motion: SHIP,
  },
  {
    id: 'window',
    label: 'まど',
    // じょうぶ内側の横長エリア。仕切り線で3つのまどに見せる。
    shape: {
      kind: 'path',
      d: 'M 36,45 L 64,45 C 66,45 67,46 67,48 L 67,58 C 67,60 66,61 64,61 L 36,61 C 34,61 33,60 33,58 L 33,48 C 33,46 34,45 36,45 Z',
    },
    motion: SHIP,
  },
]

const shipDetails: readonly PaintDetail[] = [
  // まどの縦仕切り線。
  {
    shape: { kind: 'path', d: 'M 44,47 L 44,59 M 56,47 L 56,59' },
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.4,
    motion: SHIP,
  },
  // マストの線は船体と一緒に動くだけ（groupのみ）にする。SHIP_FLAGに入れて旗と
  // 一緒に振ると、マストの足元（デッキ上面 y=38）まで左右にずれてデッキから浮いてしまうため。
  {
    shape: { kind: 'path', d: 'M 36,10 L 36,38' },
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.6,
    motion: SHIP,
  },
  // はた（三角形）だけをSHIP_FLAGにする。付け根＝旗自身のbboxの左端(x=36)を軸に
  // 小さくはためく（マストは動かないので、旗だけが竿の先で揺れて見える）。
  {
    shape: { kind: 'path', d: 'M 36,10 L 44,13 L 36,16 Z' },
    fill: '#ff8787',
    stroke: OUTLINE_COLOR,
    strokeWidth: 1,
    motion: SHIP_FLAG,
  },
  // なみ。ふねの手前（下）に描く波線2本。ふねと一緒に進まず、その場で揺れる。
  {
    shape: {
      kind: 'path',
      d: 'M 6,90 C 16,86 26,94 36,90 C 46,86 56,94 66,90 C 76,86 86,94 94,90',
    },
    stroke: '#1c7ed6',
    strokeWidth: 1.6,
    motion: SHIP_WAVE,
  },
  {
    shape: {
      kind: 'path',
      d: 'M 6,95 C 16,91 26,99 36,95 C 46,91 56,99 66,95 C 76,91 86,99 94,95',
    },
    stroke: '#1c7ed6',
    strokeWidth: 1.6,
    motion: SHIP_WAVE,
  },
]

// いえ・かえる・おばけ -----------------------------------------------------

const houseAreas: readonly PaintArea[] = [
  {
    id: 'sky',
    label: 'そら',
    shape: { kind: 'path', d: BACKDROP_PATH },
  },
  {
    id: 'ground',
    label: 'じめん',
    shape: { kind: 'path', d: GROUND_PATH },
  },
  {
    id: 'wall',
    label: 'いえの かべ',
    shape: { kind: 'path', d: 'M 20,41 L 80,41 L 80,84 L 20,84 Z' },
    motion: { group: 'house' },
  },
  {
    id: 'roof',
    label: 'さんかくの やね',
    shape: { kind: 'path', d: 'M 12,43 L 48,14 Q 50,12 52,14 L 88,43 Z' },
    motion: { group: 'house' },
  },
  {
    id: 'window',
    label: 'まど',
    shape: { kind: 'path', d: 'M 28,51 L 47,51 L 47,70 L 28,70 Z' },
    motion: { group: 'house' },
  },
  {
    id: 'door',
    label: 'ドア',
    shape: { kind: 'path', d: 'M 56,52 L 73,52 L 73,83 L 56,83 Z' },
    motion: { group: 'house', part: 'houseDoor' },
  },
]

const houseDetails: readonly PaintDetail[] = [
  {
    shape: { kind: 'path', d: 'M 37.5,52 L 37.5,69 M 29,60.5 L 46,60.5' },
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.4,
    motion: { group: 'house' },
  },
  {
    shape: { kind: 'circle', cx: 68, cy: 68, r: 1.8 },
    fill: '#ffd43b',
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.4,
    motion: { group: 'house', part: 'houseDoor' },
  },
  {
    shape: { kind: 'circle', cx: 50, cy: 33, r: 4 },
    fill: '#fff4c2',
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.4,
    motion: { group: 'house' },
  },
]

const frogAreas: readonly PaintArea[] = [
  {
    id: 'sky',
    label: 'そら',
    shape: { kind: 'path', d: BACKDROP_PATH },
  },
  {
    id: 'ground',
    label: 'じめん',
    shape: { kind: 'path', d: GROUND_PATH },
  },
  {
    id: 'legLeft',
    label: 'ひだりの あし',
    shape: { kind: 'ellipse', cx: 25, cy: 73, rx: 16, ry: 12 },
    motion: { group: 'frog' },
  },
  {
    id: 'legRight',
    label: 'みぎの あし',
    shape: { kind: 'ellipse', cx: 75, cy: 73, rx: 16, ry: 12 },
    motion: { group: 'frog' },
  },
  {
    id: 'body',
    label: 'かえるの からだ',
    shape: { kind: 'ellipse', cx: 50, cy: 64, rx: 24, ry: 23 },
    motion: { group: 'frog' },
  },
  {
    id: 'belly',
    label: 'おなか',
    shape: { kind: 'ellipse', cx: 50, cy: 68, rx: 15, ry: 16 },
    motion: { group: 'frog', part: 'frogBelly' },
  },
  {
    id: 'head',
    label: 'かえるの かお',
    shape: { kind: 'path', d: 'M 22,36 C 15,14 39,11 42,28 Q 50,25 58,28 C 61,11 85,14 78,36 C 90,48 76,59 50,59 C 24,59 10,48 22,36 Z' },
    motion: { group: 'frog' },
  },
]

const frogDetails: readonly PaintDetail[] = [
  {
    shape: { kind: 'ellipse', cx: 31, cy: 30, rx: 5, ry: 7 },
    fill: '#ffffff',
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.4,
    motion: { group: 'frog' },
  },
  {
    shape: { kind: 'ellipse', cx: 69, cy: 30, rx: 5, ry: 7 },
    fill: '#ffffff',
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.4,
    motion: { group: 'frog' },
  },
  {
    shape: { kind: 'circle', cx: 32, cy: 31, r: 2.5 },
    fill: '#2b2b2b',
    motion: { group: 'frog' },
  },
  {
    shape: { kind: 'circle', cx: 68, cy: 31, r: 2.5 },
    fill: '#2b2b2b',
    motion: { group: 'frog' },
  },
  {
    shape: { kind: 'path', d: 'M 30,44 Q 50,58 70,44' },
    stroke: OUTLINE_COLOR,
    strokeWidth: 2,
    motion: { group: 'frog' },
  },
  {
    shape: { kind: 'path', d: 'M 14,77 L 21,74 M 86,77 L 79,74' },
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.4,
    motion: { group: 'frog' },
  },
  {
    shape: { kind: 'ellipse', cx: 25, cy: 43, rx: 4, ry: 2.5 },
    fill: '#ffb3c1',
    motion: { group: 'frog' },
  },
  {
    shape: { kind: 'ellipse', cx: 75, cy: 43, rx: 4, ry: 2.5 },
    fill: '#ffb3c1',
    motion: { group: 'frog' },
  },
]

const ghostAreas: readonly PaintArea[] = [
  {
    id: 'sky',
    label: 'そら',
    shape: { kind: 'path', d: BACKDROP_PATH },
  },
  {
    id: 'armLeft',
    label: 'ひだりの て',
    shape: { kind: 'path', d: 'M 32,45 Q 17,34 13,42 Q 10,54 31,63 Z' },
    motion: { group: 'ghost', part: 'ghostArmLeft' },
  },
  {
    id: 'armRight',
    label: 'みぎの て',
    shape: { kind: 'path', d: 'M 68,45 Q 83,34 87,42 Q 90,54 69,63 Z' },
    motion: { group: 'ghost', part: 'ghostArmRight' },
  },
  {
    id: 'body',
    label: 'おばけの からだ',
    shape: { kind: 'path', d: 'M 25,43 C 25,8 75,8 75,43 L 78,76 Q 80,87 71,82 L 62,77 Q 57,90 50,80 Q 43,91 37,79 L 27,84 Q 20,87 23,75 Z' },
    motion: { group: 'ghost' },
  },
  {
    id: 'hat',
    label: 'ぼうし',
    shape: { kind: 'path', d: 'M 39,31 L 37,12 L 60,12 L 62,31 Z' },
    motion: { group: 'ghost' },
  },
]

const ghostDetails: readonly PaintDetail[] = [
  {
    shape: { kind: 'ellipse', cx: 39, cy: 47, rx: 3, ry: 5 },
    fill: '#2b2b2b',
    motion: { group: 'ghost' },
  },
  {
    shape: { kind: 'ellipse', cx: 61, cy: 47, rx: 3, ry: 5 },
    fill: '#2b2b2b',
    motion: { group: 'ghost' },
  },
  {
    shape: { kind: 'path', d: 'M 41,59 Q 50,70 59,59 Z' },
    fill: '#ffb3c1',
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.4,
    motion: { group: 'ghost' },
  },
  {
    shape: { kind: 'path', d: 'M 34,32 L 66,32 M 39,25 L 60,25' },
    stroke: OUTLINE_COLOR,
    strokeWidth: 2,
    motion: { group: 'ghost' },
  },
  {
    shape: { kind: 'ellipse', cx: 31, cy: 57, rx: 4, ry: 2.5 },
    fill: '#ffb3c1',
    motion: { group: 'ghost' },
  },
  {
    shape: { kind: 'ellipse', cx: 69, cy: 57, rx: 4, ry: 2.5 },
    fill: '#ffb3c1',
    motion: { group: 'ghost' },
  },
]

// ユーフォー ---------------------------------------------------------------

// ビーム → えんばん → ドーム → ライトの順に重ね、ビームとドームの付け根を
// えんばんの塗りで隠す。
const ufoAreas: readonly PaintArea[] = [
  {
    id: 'sky',
    label: 'そら',
    shape: { kind: 'path', d: BACKDROP_PATH },
  },
  {
    id: 'beam',
    label: 'したむきの ひかり',
    // 下へひろがる台形。上端はえんばんの内側に入れて、付け根を隠す。
    shape: { kind: 'path', d: 'M 38,60 L 62,60 L 78,94 L 22,94 Z' },
    motion: { group: 'ufo', part: 'ufoBeam' },
  },
  {
    id: 'body',
    label: 'ユーフォーの えんばん',
    shape: { kind: 'ellipse', cx: 50, cy: 56, rx: 36, ry: 13 },
    motion: { group: 'ufo' },
  },
  {
    id: 'dome',
    label: 'まるい まど',
    // えんばんの上に重ねて描くので、下辺（Zで閉じる線）がそのまま切りかえの線になる。
    shape: { kind: 'path', d: 'M 30,45 C 30,26 70,26 70,45 Z' },
    motion: { group: 'ufo' },
  },
  {
    id: 'lightLeft',
    label: 'ひだりの ライト',
    shape: { kind: 'circle', cx: 32, cy: 68, r: 8.5 },
    motion: { group: 'ufo', part: 'ufoLightLeft' },
  },
  {
    id: 'lightRight',
    label: 'みぎの ライト',
    shape: { kind: 'circle', cx: 68, cy: 68, r: 8.5 },
    motion: { group: 'ufo', part: 'ufoLightRight' },
  },
]

const ufoDetails: readonly PaintDetail[] = [
  { shape: { kind: 'ellipse', cx: 41, cy: 36, rx: 5, ry: 3.5 }, fill: '#ffffff', motion: { group: 'ufo' } },
  // えんばんのふち。まるい板が立体に見える1本だけの線。
  {
    shape: { kind: 'path', d: 'M 16,52 C 32,62 68,62 84,52' },
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.6,
    motion: { group: 'ufo' },
  },
  { shape: { kind: 'circle', cx: 44, cy: 61, r: 2.2 }, fill: '#ffd43b', motion: { group: 'ufo' } },
  { shape: { kind: 'circle', cx: 56, cy: 61, r: 2.2 }, fill: '#ffd43b', motion: { group: 'ufo' } },
  // ライトの芯。それぞれのライトと一緒にチカチカする。
  {
    shape: { kind: 'circle', cx: 32, cy: 68, r: 3.4 },
    fill: '#fff4c2',
    motion: { group: 'ufo', part: 'ufoLightLeft' },
  },
  {
    shape: { kind: 'circle', cx: 68, cy: 68, r: 3.4 },
    fill: '#fff4c2',
    motion: { group: 'ufo', part: 'ufoLightRight' },
  },
]

// ヘリコプター -------------------------------------------------------------

// しっぽの ぼう → うしろの はね → どうたい → まど → うえの はね の順に重ね、
// はねの付け根をどうたい・ぼうの塗りで隠す。
const helicopterAreas: readonly PaintArea[] = [
  {
    id: 'sky',
    label: 'そら',
    shape: { kind: 'path', d: BACKDROP_PATH },
  },
  {
    id: 'tailBoom',
    label: 'しっぽの ぼう',
    // ぼうだけだと高さがMIN_TAP_SIZE_UNITSに足りないので、後ろの立ちばねまで
    // ひとつのエリアにして、幼児の指で押せる大きさにしている。
    shape: { kind: 'path', d: 'M 60,48 L 74,52 L 74,38 C 74,35 77,35 79,38 L 84,52 L 84,58 L 60,60 Z' },
    motion: { group: 'heli' },
  },
  {
    id: 'tailRotor',
    label: 'うしろの はね',
    // 2枚の羽をXに組んだ形（うえの はねと同じ作り）。同じ向きに閉じた2つの
    // サブパスなので、交差部分も穴にならず1枚に塗れる。
    shape: { kind: 'path', d: 'M 75,33 L 93,45 L 93,50 L 75,38 Z M 75,45 L 93,33 L 93,38 L 75,50 Z' },
    motion: { group: 'heli', part: 'heliTailRotor' },
  },
  {
    id: 'body',
    label: 'ヘリコプターの どうたい',
    shape: {
      kind: 'path',
      d: 'M 30,42 L 54,42 C 62,42 68,48 68,56 C 68,66 60,72 48,72 L 34,72 C 24,72 18,65 18,56 C 18,48 22,42 30,42 Z',
    },
    motion: { group: 'heli' },
  },
  {
    id: 'window',
    label: 'コックピットの まど',
    shape: { kind: 'ellipse', cx: 34, cy: 56, rx: 11, ry: 9 },
    motion: { group: 'heli' },
  },
  {
    id: 'mainRotor',
    label: 'うえの はね',
    // まっすぐな羽2枚をXに組む。まるい形にすると回しても見た目が変わらないので、
    // 「羽が回っている」ことが幼児にも分かるようこの形にしている。
    // 回すと図形は自分の対角線を半径とする円を掃くので、その円（中心(50,22)・半径約20）が
    // 紙の内側に収まる長さにしている（長い羽にすると回った瞬間に紙からはみ出す）。
    shape: { kind: 'path', d: 'M 32,13 L 68,25 L 68,31 L 32,19 Z M 32,25 L 68,13 L 68,19 L 32,31 Z' },
    motion: { group: 'heli', part: 'heliMainRotor' },
  },
]

const helicopterDetails: readonly PaintDetail[] = [
  // ローターの軸。どうたいと一緒に飛ぶだけで、回らない。
  {
    shape: { kind: 'path', d: 'M 50,26 L 50,44' },
    stroke: OUTLINE_COLOR,
    strokeWidth: 2.4,
    motion: { group: 'heli' },
  },
  // 羽の中心。回転の軸そのものなので、羽と一緒に回さずその場に置く。
  { shape: { kind: 'circle', cx: 50, cy: 22, r: 3 }, fill: '#495057', motion: { group: 'heli' } },
  { shape: { kind: 'circle', cx: 84, cy: 41.5, r: 2.4 }, fill: '#495057', motion: { group: 'heli' } },
  // 着地脚（スキッド）。
  {
    shape: { kind: 'path', d: 'M 24,78 L 60,78 M 32,71 L 30,78 M 52,71 L 54,78' },
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.8,
    motion: { group: 'heli' },
  },
  { shape: { kind: 'ellipse', cx: 30, cy: 51, rx: 3.6, ry: 2.4 }, fill: '#ffffff', motion: { group: 'heli' } },
  { shape: { kind: 'circle', cx: 66, cy: 60, r: 2.2 }, fill: '#ffd43b', motion: { group: 'heli' } },
]

// いぬ ---------------------------------------------------------------------

// しっぽ・あし → からだ → みみ → あたま の順に重ね、しっぽとみみの付け根を
// からだ・あたまの塗りで隠す。
const dogAreas: readonly PaintArea[] = [
  {
    id: 'sky',
    label: 'そら',
    shape: { kind: 'path', d: BACKDROP_PATH },
  },
  {
    id: 'ground',
    label: 'じめん',
    shape: { kind: 'path', d: GROUND_PATH },
  },
  {
    id: 'tail',
    label: 'しっぽ',
    shape: { kind: 'path', d: 'M 18,58 C 10,52 6,40 13,36 C 19,39 21,48 26,54 Z' },
    motion: { group: 'dog', part: 'dogTail' },
  },
  {
    id: 'legs',
    label: 'あし',
    // 前あし・後ろあしをまとめて1エリアにする（1本ずつに分けると、どちらも
    // 幼児の指で押せる太さにならない）。
    shape: {
      kind: 'path',
      d: 'M 22,64 L 34,64 L 34,80 C 34,83 32,84 28,84 C 24,84 22,83 22,80 Z M 46,64 L 58,64 L 58,80 C 58,83 56,84 52,84 C 48,84 46,83 46,80 Z',
    },
    motion: { group: 'dog' },
  },
  {
    id: 'body',
    label: 'いぬの からだ',
    shape: { kind: 'ellipse', cx: 38, cy: 60, rx: 22, ry: 14 },
    motion: { group: 'dog' },
  },
  {
    id: 'earLeft',
    label: 'ひだりの みみ',
    shape: { kind: 'path', d: 'M 56,26 C 44,22 38,30 40,42 C 42,52 52,52 56,44 Z' },
    motion: { group: 'dog', part: 'dogEarLeft' },
  },
  {
    id: 'earRight',
    label: 'みぎの みみ',
    shape: { kind: 'path', d: 'M 76,26 C 88,22 94,30 92,42 C 90,52 80,52 76,44 Z' },
    motion: { group: 'dog', part: 'dogEarRight' },
  },
  {
    id: 'head',
    label: 'いぬの あたま',
    shape: {
      kind: 'path',
      d: 'M 50,40 C 50,28 58,22 66,22 C 76,22 82,29 82,38 C 82,47 75,53 66,53 C 56,53 50,48 50,40 Z',
    },
    motion: { group: 'dog' },
  },
]

const dogDetails: readonly PaintDetail[] = [
  { shape: { kind: 'circle', cx: 60, cy: 32, r: 4.4 }, fill: '#ffffff', motion: { group: 'dog' } },
  { shape: { kind: 'circle', cx: 60, cy: 32, r: 2.1 }, fill: OUTLINE_COLOR, motion: { group: 'dog' } },
  { shape: { kind: 'circle', cx: 72, cy: 32, r: 4.4 }, fill: '#ffffff', motion: { group: 'dog' } },
  { shape: { kind: 'circle', cx: 72, cy: 32, r: 2.1 }, fill: OUTLINE_COLOR, motion: { group: 'dog' } },
  // マズル（はなさき）。塗った色が透けるよう線だけで描き、いぬの横がおに見せる。
  {
    shape: { kind: 'ellipse', cx: 74, cy: 44, rx: 8.5, ry: 6.5 },
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.4,
    motion: { group: 'dog' },
  },
  // はな。マズルの上に置く。
  { shape: { kind: 'circle', cx: 78, cy: 40, r: 3.2 }, fill: OUTLINE_COLOR, motion: { group: 'dog' } },
  {
    shape: { kind: 'path', d: 'M 70,45 C 73,49 78,48 80,44' },
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.6,
    motion: { group: 'dog' },
  },
  // からだのもよう。
  {
    shape: { kind: 'circle', cx: 30, cy: 58, r: 6.5 },
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.4,
    motion: { group: 'dog' },
  },
  // あしのつめ。
  {
    shape: { kind: 'path', d: 'M 24,80 L 32,80 M 48,80 L 56,80' },
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.4,
    motion: { group: 'dog' },
  },
]

// ねこ ---------------------------------------------------------------------

// しっぽ → からだ → みみ → あたま の順に重ねる（いぬと同じ考え方）。
const catAreas: readonly PaintArea[] = [
  {
    id: 'sky',
    label: 'そら',
    shape: { kind: 'path', d: BACKDROP_PATH },
  },
  {
    id: 'ground',
    label: 'じめん',
    shape: { kind: 'path', d: GROUND_PATH },
  },
  {
    id: 'tail',
    label: 'しっぽ',
    // からだの右うしろから立ち上がって、先が内へ巻くしっぽ。
    shape: {
      kind: 'path',
      d: 'M 56,78 C 74,80 84,70 82,54 C 80,45 71,43 68,50 C 73,52 76,56 74,63 C 71,71 64,72 56,70 Z',
    },
    motion: { group: 'cat', part: 'catTail' },
  },
  {
    id: 'body',
    label: 'ねこの からだ',
    // おすわりのかたち。下がひろく、じめんに座って見えるようにする。
    shape: {
      kind: 'path',
      d: 'M 34,54 C 46,54 58,64 58,80 C 58,84 56,85 52,85 L 26,85 C 22,85 20,84 20,80 C 20,64 26,54 34,54 Z',
    },
    motion: { group: 'cat' },
  },
  {
    id: 'earLeft',
    label: 'ひだりの みみ',
    shape: { kind: 'path', d: 'M 24,32 L 20,13 L 38,24 Z' },
    motion: { group: 'cat' },
  },
  {
    id: 'earRight',
    label: 'みぎの みみ',
    shape: { kind: 'path', d: 'M 54,32 L 58,13 L 40,24 Z' },
    motion: { group: 'cat' },
  },
  {
    id: 'head',
    label: 'ねこの かお',
    shape: { kind: 'circle', cx: 39, cy: 40, r: 17 },
    motion: { group: 'cat' },
  },
]

const catDetails: readonly PaintDetail[] = [
  // みみの内側。
  { shape: { kind: 'path', d: 'M 26,29 L 24,19 L 33,25 Z' }, fill: '#ffb3c1', motion: { group: 'cat' } },
  { shape: { kind: 'path', d: 'M 52,29 L 54,19 L 45,25 Z' }, fill: '#ffb3c1', motion: { group: 'cat' } },
  { shape: { kind: 'ellipse', cx: 32, cy: 38, rx: 4.5, ry: 5.5 }, fill: '#ffffff', motion: { group: 'cat' } },
  { shape: { kind: 'ellipse', cx: 32, cy: 38, rx: 2, ry: 3.6 }, fill: OUTLINE_COLOR, motion: { group: 'cat' } },
  { shape: { kind: 'ellipse', cx: 46, cy: 38, rx: 4.5, ry: 5.5 }, fill: '#ffffff', motion: { group: 'cat' } },
  { shape: { kind: 'ellipse', cx: 46, cy: 38, rx: 2, ry: 3.6 }, fill: OUTLINE_COLOR, motion: { group: 'cat' } },
  { shape: { kind: 'path', d: 'M 36,46 L 42,46 L 39,50 Z' }, fill: '#ffb3c1', motion: { group: 'cat' } },
  {
    shape: { kind: 'path', d: 'M 33,52 C 36,55 42,55 45,52' },
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.6,
    motion: { group: 'cat' },
  },
  // ひげ。左右に3本ずつだと線が多くなるので2本ずつにしている。
  {
    shape: { kind: 'path', d: 'M 14,42 L 26,45 M 14,50 L 26,48' },
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.4,
    motion: { group: 'cat' },
  },
  {
    shape: { kind: 'path', d: 'M 64,42 L 52,45 M 64,50 L 52,48' },
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.4,
    motion: { group: 'cat' },
  },
  // まえあし。
  {
    shape: { kind: 'path', d: 'M 27,85 C 27,81 33,81 33,85 M 45,85 C 45,81 51,81 51,85' },
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.4,
    motion: { group: 'cat' },
  },
]

// ミツバチ -----------------------------------------------------------------

// はね2枚 → からだ → あたま の順に重ね、はねの付け根をからだの塗りで隠す。
const beeAreas: readonly PaintArea[] = [
  {
    id: 'sky',
    label: 'そら',
    shape: { kind: 'path', d: BACKDROP_PATH },
  },
  {
    id: 'wingBack',
    label: 'うしろの はね',
    shape: { kind: 'path', d: 'M 44,44 C 34,26 18,20 14,30 C 10,40 24,50 40,50 Z' },
    motion: { group: 'bee', part: 'beeWingBack' },
  },
  {
    id: 'wingFront',
    label: 'まえの はね',
    shape: { kind: 'path', d: 'M 52,44 C 54,24 66,18 72,27 C 76,35 66,46 52,48 Z' },
    motion: { group: 'bee', part: 'beeWingFront' },
  },
  {
    id: 'body',
    label: 'ミツバチの からだ',
    shape: { kind: 'ellipse', cx: 46, cy: 58, rx: 24, ry: 17 },
    motion: { group: 'bee' },
  },
  {
    id: 'head',
    label: 'ミツバチの あたま',
    shape: { kind: 'circle', cx: 78, cy: 50, r: 12 },
    motion: { group: 'bee' },
  },
]

const beeDetails: readonly PaintDetail[] = [
  // しま模様。塗った色の上に太い線を3本のせて、はちのしまに見せる。
  {
    shape: { kind: 'path', d: 'M 26,52 C 24,56 24,60 26,64' },
    stroke: OUTLINE_COLOR,
    strokeWidth: 4,
    motion: { group: 'bee' },
  },
  {
    shape: { kind: 'path', d: 'M 34,47 C 31,54 31,62 34,69' },
    stroke: OUTLINE_COLOR,
    strokeWidth: 4,
    motion: { group: 'bee' },
  },
  {
    shape: { kind: 'path', d: 'M 48,45 C 45,54 45,64 48,72' },
    stroke: OUTLINE_COLOR,
    strokeWidth: 4,
    motion: { group: 'bee' },
  },
  // はり。からだの左のはしに小さくつける。
  { shape: { kind: 'path', d: 'M 24,54 L 13,58 L 24,62 Z' }, fill: OUTLINE_COLOR, motion: { group: 'bee' } },
  { shape: { kind: 'circle', cx: 82, cy: 46, r: 4.4 }, fill: '#ffffff', motion: { group: 'bee' } },
  { shape: { kind: 'circle', cx: 82, cy: 46, r: 2.1 }, fill: OUTLINE_COLOR, motion: { group: 'bee' } },
  {
    shape: { kind: 'path', d: 'M 80,59 C 83,61 86,59 87,56' },
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.6,
    motion: { group: 'bee' },
  },
  // しょっかく。
  {
    shape: { kind: 'path', d: 'M 76,39 C 76,31 80,27 85,27 M 82,40 C 84,33 88,31 92,32' },
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.6,
    motion: { group: 'bee' },
  },
  { shape: { kind: 'circle', cx: 85, cy: 27, r: 2 }, fill: OUTLINE_COLOR, motion: { group: 'bee' } },
  { shape: { kind: 'circle', cx: 92, cy: 32, r: 2 }, fill: OUTLINE_COLOR, motion: { group: 'bee' } },
  // はねのすじ。それぞれのはねと一緒にはばたく。
  {
    shape: { kind: 'path', d: 'M 20,29 C 26,35 32,41 38,46' },
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.2,
    motion: { group: 'bee', part: 'beeWingBack' },
  },
  {
    shape: { kind: 'path', d: 'M 68,26 C 64,33 58,41 52,45' },
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.2,
    motion: { group: 'bee', part: 'beeWingFront' },
  },
]

// てんとうむし -------------------------------------------------------------

// からだ（中の羽） → 左右のはね（甲羅） → あたま の順に重ねる。
// 甲羅がひらくと、下のからだが見える。
const ladybugAreas: readonly PaintArea[] = [
  {
    id: 'sky',
    label: 'そら',
    shape: { kind: 'path', d: BACKDROP_PATH },
  },
  {
    id: 'ground',
    label: 'じめん',
    shape: { kind: 'path', d: GROUND_PATH },
  },
  {
    id: 'body',
    label: 'てんとうむしの からだ',
    shape: { kind: 'ellipse', cx: 50, cy: 60, rx: 27, ry: 21 },
    motion: { group: 'ladybug' },
  },
  {
    id: 'shellLeft',
    label: 'ひだりの はね',
    shape: { kind: 'path', d: 'M 50,38 C 34,38 25,48 25,60 C 25,73 36,80 50,80 Z' },
    motion: { group: 'ladybug', part: 'ladybugShellLeft' },
  },
  {
    id: 'shellRight',
    label: 'みぎの はね',
    shape: { kind: 'path', d: 'M 50,38 C 66,38 75,48 75,60 C 75,73 64,80 50,80 Z' },
    motion: { group: 'ladybug', part: 'ladybugShellRight' },
  },
  {
    id: 'head',
    label: 'てんとうむしの あたま',
    shape: { kind: 'circle', cx: 50, cy: 32, r: 13 },
    motion: { group: 'ladybug' },
  },
]

const ladybugDetails: readonly PaintDetail[] = [
  // 水玉もよう。それぞれの甲羅と一緒にひらくよう、左右のpartへ入れる。
  {
    shape: { kind: 'circle', cx: 35, cy: 53, r: 3.6 },
    fill: OUTLINE_COLOR,
    motion: { group: 'ladybug', part: 'ladybugShellLeft' },
  },
  {
    shape: { kind: 'circle', cx: 43, cy: 66, r: 3.2 },
    fill: OUTLINE_COLOR,
    motion: { group: 'ladybug', part: 'ladybugShellLeft' },
  },
  {
    shape: { kind: 'circle', cx: 33, cy: 68, r: 2.8 },
    fill: OUTLINE_COLOR,
    motion: { group: 'ladybug', part: 'ladybugShellLeft' },
  },
  {
    shape: { kind: 'circle', cx: 65, cy: 53, r: 3.6 },
    fill: OUTLINE_COLOR,
    motion: { group: 'ladybug', part: 'ladybugShellRight' },
  },
  {
    shape: { kind: 'circle', cx: 57, cy: 66, r: 3.2 },
    fill: OUTLINE_COLOR,
    motion: { group: 'ladybug', part: 'ladybugShellRight' },
  },
  {
    shape: { kind: 'circle', cx: 67, cy: 68, r: 2.8 },
    fill: OUTLINE_COLOR,
    motion: { group: 'ladybug', part: 'ladybugShellRight' },
  },
  { shape: { kind: 'circle', cx: 44, cy: 30, r: 4 }, fill: '#ffffff', motion: { group: 'ladybug' } },
  { shape: { kind: 'circle', cx: 44, cy: 30, r: 2 }, fill: OUTLINE_COLOR, motion: { group: 'ladybug' } },
  { shape: { kind: 'circle', cx: 56, cy: 30, r: 4 }, fill: '#ffffff', motion: { group: 'ladybug' } },
  { shape: { kind: 'circle', cx: 56, cy: 30, r: 2 }, fill: OUTLINE_COLOR, motion: { group: 'ladybug' } },
  // しょっかく。
  {
    shape: { kind: 'path', d: 'M 44,22 C 42,16 38,13 34,13 M 56,22 C 58,16 62,13 66,13' },
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.6,
    motion: { group: 'ladybug' },
  },
  { shape: { kind: 'circle', cx: 34, cy: 13, r: 2 }, fill: OUTLINE_COLOR, motion: { group: 'ladybug' } },
  { shape: { kind: 'circle', cx: 66, cy: 13, r: 2 }, fill: OUTLINE_COLOR, motion: { group: 'ladybug' } },
  // あし。甲羅ではなくからだから出るので、group側（甲羅と一緒にひらかない）に入れる。
  {
    shape: { kind: 'path', d: 'M 27,48 L 15,42 M 24,60 L 12,60 M 27,72 L 18,82' },
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.8,
    motion: { group: 'ladybug' },
  },
  {
    shape: { kind: 'path', d: 'M 73,48 L 85,42 M 76,60 L 88,60 M 73,72 L 82,82' },
    stroke: OUTLINE_COLOR,
    strokeWidth: 1.8,
    motion: { group: 'ladybug' },
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
  {
    id: 'train',
    label: 'でんしゃ',
    emoji: '🚃',
    viewBox: VIEW_BOX,
    areas: trainAreas,
    details: trainDetails,
  },
  {
    id: 'airplane',
    label: 'ひこうき',
    emoji: '✈️',
    viewBox: VIEW_BOX,
    areas: airplaneAreas,
    details: airplaneDetails,
  },
  {
    id: 'ship',
    label: 'ふね',
    emoji: '🚢',
    viewBox: VIEW_BOX,
    areas: shipAreas,
    details: shipDetails,
  },
  { id: 'house', label: 'いえ', emoji: '🏠', viewBox: VIEW_BOX, areas: houseAreas, details: houseDetails },
  { id: 'frog', label: 'かえる', emoji: '🐸', viewBox: VIEW_BOX, areas: frogAreas, details: frogDetails },
  { id: 'ghost', label: 'おばけ', emoji: '👻', viewBox: VIEW_BOX, areas: ghostAreas, details: ghostDetails },
  { id: 'ufo', label: 'ユーフォー', emoji: '🛸', viewBox: VIEW_BOX, areas: ufoAreas, details: ufoDetails },
  {
    id: 'helicopter',
    label: 'ヘリコプター',
    emoji: '🚁',
    viewBox: VIEW_BOX,
    areas: helicopterAreas,
    details: helicopterDetails,
  },
  { id: 'dog', label: 'いぬ', emoji: '🐶', viewBox: VIEW_BOX, areas: dogAreas, details: dogDetails },
  { id: 'cat', label: 'ねこ', emoji: '🐱', viewBox: VIEW_BOX, areas: catAreas, details: catDetails },
  { id: 'bee', label: 'ミツバチ', emoji: '🐝', viewBox: VIEW_BOX, areas: beeAreas, details: beeDetails },
  {
    id: 'ladybug',
    label: 'てんとうむし',
    emoji: '🐞',
    viewBox: VIEW_BOX,
    areas: ladybugAreas,
    details: ladybugDetails,
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
