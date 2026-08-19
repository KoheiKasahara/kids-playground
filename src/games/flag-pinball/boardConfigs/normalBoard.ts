import { BOARD_WIDTH, BOARD_HEIGHT } from '../boardLayout'
import type { CircleObstacle, CornerEscapeZone, WallSegment } from '../boardLayout'
import type { ToyPlacement } from '../toyLayout'
import type { BoardConfig, LaunchConfig } from './types'

/**
 * 通常テーマ（normal）の盤面配置。今後テーマごとに配置を分けていく上での基準盤面であり、
 * 他の3テーマ（宇宙・海・おかし）は Phase A の時点ではこの内容をそのままコピーして使う
 * （boardConfigs/spaceBoard.ts 等を参照）。
 * このファイルの値は、テーマ別分離を行う前の boardLayout.ts / toyLayout.ts から
 * そのまま移した値であり、通常テーマのプレイ感を変えないよう座標・個数を変更していない。
 */

// --- 障害物（バンパー・ピン） -----------------------------------------------

const BUMPER_RADIUS = 28
const BUMPER_RESTITUTION = 0.98
const PEG_RADIUS = 8
const PEG_RESTITUTION = 0.9

/**
 * バンパー3個・ピン31個の合計34個。ピンは7段の千鳥配置にして、上から下まで
 * ボールが左右へ散る機会を作る。下側のピン段はバンパーと同じyに重ねず、
 * 障害物が横一列の壁になることを避けている。
 * 障害物同士は中心距離が「半径の和 + ボール直径 + 16px」以上離れており、
 * ボールが詰まらず素直に通り抜けられる余裕を確保している。
 */
const OBSTACLES: readonly CircleObstacle[] = [
  { id: 'bumper-center', kind: 'bumper', x: BOARD_WIDTH / 2, y: 385, radius: BUMPER_RADIUS, restitution: BUMPER_RESTITUTION },
  { id: 'bumper-left', kind: 'bumper', x: 90, y: 655, radius: BUMPER_RADIUS, restitution: BUMPER_RESTITUTION },
  { id: 'bumper-right', kind: 'bumper', x: 390, y: 655, radius: BUMPER_RADIUS, restitution: BUMPER_RESTITUTION },

  // 1段目。隣の段とxを半ピッチずらす千鳥配置の基準になる。
  { id: 'peg-row-1-1', kind: 'peg', x: 70, y: 130, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-row-1-2', kind: 'peg', x: 155, y: 130, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-row-1-3', kind: 'peg', x: 240, y: 130, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-row-1-4', kind: 'peg', x: 325, y: 130, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-row-1-5', kind: 'peg', x: 410, y: 130, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },

  { id: 'peg-row-2-1', kind: 'peg', x: 112.5, y: 210, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-row-2-2', kind: 'peg', x: 197.5, y: 210, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-row-2-3', kind: 'peg', x: 282.5, y: 210, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-row-2-4', kind: 'peg', x: 367.5, y: 210, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },

  { id: 'peg-row-3-1', kind: 'peg', x: 70, y: 280, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-row-3-2', kind: 'peg', x: 155, y: 280, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-row-3-3', kind: 'peg', x: 240, y: 280, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-row-3-4', kind: 'peg', x: 325, y: 280, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-row-3-5', kind: 'peg', x: 410, y: 280, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },

  // 3段目と4段目の間は広めに取り、中央バンパーがピンの壁を作らないようにする。
  { id: 'peg-row-4-1', kind: 'peg', x: 112.5, y: 480, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-row-4-2', kind: 'peg', x: 197.5, y: 480, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-row-4-3', kind: 'peg', x: 282.5, y: 480, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-row-4-4', kind: 'peg', x: 367.5, y: 480, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },

  { id: 'peg-row-5-1', kind: 'peg', x: 70, y: 555, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-row-5-2', kind: 'peg', x: 155, y: 555, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-row-5-3', kind: 'peg', x: 240, y: 555, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-row-5-4', kind: 'peg', x: 325, y: 555, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-row-5-5', kind: 'peg', x: 410, y: 555, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },

  { id: 'peg-row-7-1', kind: 'peg', x: 155, y: 735, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-row-7-2', kind: 'peg', x: 240, y: 735, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-row-7-3', kind: 'peg', x: 325, y: 735, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },

  { id: 'peg-row-8-1', kind: 'peg', x: 70, y: 820, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-row-8-2', kind: 'peg', x: 155, y: 820, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-row-8-3', kind: 'peg', x: 240, y: 820, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-row-8-4', kind: 'peg', x: 325, y: 820, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-row-8-5', kind: 'peg', x: 410, y: 820, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
]

// --- 壁 --------------------------------------------------------------------

/** 外壁の厚み。板の外側に半分はみ出させて配置し、高速なボールがすり抜けないようにする */
const WALL_THICKNESS = 30
/** 射出口から盤面へ導く上部の斜め壁の厚み・長さ */
const GUIDE_WALL_THICKNESS = 16
const GUIDE_WALL_LENGTH = 180
/** 上部斜め壁の傾き（ラジアン）。左右対称に内向きへ倒す */
const GUIDE_WALL_ANGLE = 0.45
const WALL_RESTITUTION = 0.65

const WALLS: readonly WallSegment[] = [
  // 左右の外壁: 中心を盤面の端(x=0 / x=BOARD_WIDTH)に置き、厚みの半分を外側にはみ出させる
  { id: 'wall-left', x: 0, y: BOARD_HEIGHT / 2, width: WALL_THICKNESS, height: BOARD_HEIGHT, angle: 0, restitution: WALL_RESTITUTION },
  { id: 'wall-right', x: BOARD_WIDTH, y: BOARD_HEIGHT / 2, width: WALL_THICKNESS, height: BOARD_HEIGHT, angle: 0, restitution: WALL_RESTITUTION },
  // 上壁も同様に、中心を y=0 に置いて半分を外側にはみ出させる
  { id: 'wall-top', x: BOARD_WIDTH / 2, y: 0, width: BOARD_WIDTH, height: WALL_THICKNESS, angle: 0, restitution: WALL_RESTITUTION },
  // 射出口(LAUNCH)から出たボールを盤面中央側へ導く斜め壁。左右対称に内向きへ倒す
  { id: 'wall-guide-left', x: 110, y: 105, width: GUIDE_WALL_LENGTH, height: GUIDE_WALL_THICKNESS, angle: -GUIDE_WALL_ANGLE, restitution: WALL_RESTITUTION },
  { id: 'wall-guide-right', x: BOARD_WIDTH - 110, y: 105, width: GUIDE_WALL_LENGTH, height: GUIDE_WALL_THICKNESS, angle: GUIDE_WALL_ANGLE, restitution: WALL_RESTITUTION },
  // 盤面の底。得点ゾーンで止まるための床がないとボールが盤外へ落ち続けてしまう。
  // 左右・上壁と同じく中心を盤面の端(y=BOARD_HEIGHT)に置き、厚みの半分を外側にはみ出させる
  { id: 'wall-bottom', x: BOARD_WIDTH / 2, y: BOARD_HEIGHT, width: BOARD_WIDTH, height: WALL_THICKNESS, angle: 0, restitution: WALL_RESTITUTION },
]

/**
 * wall-guide-left/right（斜め壁）とwall-left/wall-right（外壁）が挟む隅。
 * 2直線が浅い角度で交わるため、半径24pxのボールがちょうど両方の面に同時接触できる
 * 一点（外壁側と斜め壁側から受ける力が打ち消し合い、静止摩擦なしでも動けなくなる点）
 * が幾何学的に必ず存在する。壁の形状を変えて塞ごうとすると、新しく増やした面がまた
 * 別の一点で既存の面と交わってしまい、隙間そのものをなくすことができなかった
 * （角度・厚み・丸ピン・継ぎ足し壁など複数のアプローチを多数の初期位置・速度で検証済み）。
 * 実測でこの一点は座標(38.8, 104)付近（左右対称にBOARD_WIDTH-38.8, 104）に必ず収束する
 * ため、壁の見た目は変えず、この一点だけ「すり抜け」させて盤面中央側へ逃がす。
 * usePinballEngine.ts と pinballSimulation.ts の停滞ナッジ処理から参照する。
 */
const CORNER_ESCAPE_ZONES: readonly CornerEscapeZone[] = [
  { x: 38.8, y: 104, radius: 14, toX: 55, toY: 170 },
  { x: BOARD_WIDTH - 38.8, y: 104, radius: 14, toX: BOARD_WIDTH - 55, toY: 170 },
]

// --- おもちゃ ----------------------------------------------------------------

/**
 * 回転おもちゃの見た目・当たり判定の半径（論理座標）。左右で同じ値を使うことで、
 * サイズだけでなく性能（角速度・効果時間など、この半径から間接的に影響する範囲判定も含む）
 * に差を付けない。
 * 元は37だったが、視認性向上のため1.2倍の44.4に拡大した。
 * peg-row-3（y=280）とpeg-row-4（y=480, x=112.5/367.5）に挟まれており、両者との中心距離が
 * 左右のおもちゃに対して最も近い障害物になる。SPINNER_Yを385から376へ動かして両者との
 * 距離をほぼ均等にし、これ以上大きくすると「障害物との中心距離にボール直径ぶんの余裕がある」
 * 制約を割り込む（normalBoard.test.ts で検証）。
 */
const SPINNER_RADIUS = 44.4
/** 回転おもちゃのタップ判定半径。既存のまま（見た目より広く、4〜5歳でも押しやすい大きさ） */
const SPINNER_TAP_RADIUS = 56
/**
 * 回転おもちゃの中心y。左右で共通にし、水平対称な配置にする。
 * SPINNER_RADIUS拡大に伴い、挟んでいるpeg-row-3（y=280）とpeg-row-4（y=480）への
 * 中心距離がほぼ均等になるよう385から376へ動かした。
 */
const SPINNER_Y = 376
/** 左の回転おもちゃの中心x。中央バンパー(240,385)の左側に置く既存位置。 */
const SPINNER_LEFT_X = 110

const TOYS: readonly ToyPlacement[] = [
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

// --- 射出パラメータ ----------------------------------------------------------

/**
 * 射出パラメータ。毎回同じ軌道にならないよう位置と初速に揺らぎを持たせる。
 * y は上壁（厚みぶん盤面内側は約 WALL_THICKNESS/2）より十分下に置く。
 */
const LAUNCH: LaunchConfig = {
  x: BOARD_WIDTH / 2,
  y: 70,
  jitterX: 30,
  minVx: -5,
  maxVx: 5,
  minVy: 6,
  maxVy: 10,
}

export const normalBoard: BoardConfig = {
  obstacles: OBSTACLES,
  walls: WALLS,
  cornerEscapeZones: CORNER_ESCAPE_ZONES,
  toys: TOYS,
  launch: LAUNCH,
}
