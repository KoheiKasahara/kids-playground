/**
 * こっきコロコロパズルの盤面。論理座標だけで組み立て、実機サイズへの拡縮は
 * 表示側（useBoardScale が返す CSS transform）の責務にする。こうすることで
 * 重力や反発係数などの物理パラメータを、この1つの座標系で一度調整すれば
 * どの端末でも同じ挙動になる。
 *
 * 盤面は縦に3つの帯で構成する（スマホ縦画面が基本）。
 *
 *   0                        ← 盤面上端
 *   |  スタート帯（国旗ボールの開始位置。パーツは置けない）
 *   GRID_TOP
 *   |  配置グリッド（GRID_COLS × GRID_ROWS のマス目。ここだけがパーツ配置領域）
 *   GRID_BOTTOM
 *   |  ゴール帯（左寄りにゴール。残りは床）
 *   BOARD_HEIGHT             ← 盤面下端
 *
 * グリッドの列数・行数・マスの大きさを変えれば盤面全体の寸法が追従するよう、
 * 寸法はすべてこの3つの基本値から導出する。
 */

/** 1マスの1辺（論理px）。パーツの大きさとドラッグの吸着間隔の基準になる */
export const CELL_SIZE = 60
/** 配置グリッドの列数。盤面の幅はこの値から決まる */
export const GRID_COLS = 6
/**
 * 配置グリッドの行数。
 * 増やすほどコースは長くなるが、そのぶんスマホ縦画面では1マスが小さくなり
 * （盤面全体が画面の高さに合わせて縮むため）指で狙いにくくなる。
 * 8行は、iPhone相当の縦画面で1マスが50px前後を保てる上限として選んだ。
 */
export const GRID_ROWS = 8

/** グリッドの左端x。今は盤面の左端と同じだが、意味が違うので別の名前で持つ */
export const GRID_LEFT = 0
/** スタート帯の高さ ＝ グリッドの上端y */
export const GRID_TOP = 72

export const GRID_WIDTH = GRID_COLS * CELL_SIZE
export const GRID_HEIGHT = GRID_ROWS * CELL_SIZE
export const GRID_BOTTOM = GRID_TOP + GRID_HEIGHT

/** ゴール帯の高さ */
export const GOAL_HEIGHT = 68

export const BOARD_WIDTH = GRID_LEFT + GRID_WIDTH
export const BOARD_HEIGHT = GRID_BOTTOM + GOAL_HEIGHT

/** 国旗ボールの半径。マスより十分小さく、かつ模様が見分けられる大きさにする */
export const BALL_RADIUS = 20

/**
 * 国旗ボールの開始位置（スタート帯の上部中央付近）。
 *
 * xを盤面のちょうど中央にすると、列数が偶数のとき列と列の境目の真上になり、
 * 真下のマスへ置いた板の「端」にばかり当たって当たり方が読みにくくなる。
 * そこで中央に最も近い列の中心へ寄せ、真下のマスへ板を置けば必ずその板の
 * 真ん中に乗るようにしてある（幼児が結果を予想できることを優先する）。
 */
export const BALL_START_COL = Math.floor(GRID_COLS / 2)
export const BALL_START = {
  x: GRID_LEFT + BALL_START_COL * CELL_SIZE + CELL_SIZE / 2,
  y: GRID_TOP / 2,
} as const

/**
 * ゴール領域（盤面下端の左寄り2マスぶん）。
 * 盤面いっぱいのゴールにすると、ボールがまっすぐ落ちるだけで到達してしまい
 * 「ななめ板で進む向きを変える」という遊びが成立しない。開始位置（上部中央）の
 * 真下から外した位置に置くことで、最小構成でもパーツを置く意味が生まれる。
 * 一方で失敗の概念は作らないため、外れたボールは床に残るだけにしてある。
 */
export const GOAL_AREA = {
  x: GRID_LEFT,
  y: GRID_BOTTOM,
  width: CELL_SIZE * 2,
  height: GOAL_HEIGHT,
} as const

/**
 * ゴールの右端に置く小さなスロープ（受け皿のふち）。
 *
 * ゴールへ入ったボールはその場で止めず物理挙動を続けるため、何も無いと
 * 転がってゴールの外へ出てしまう。そこで、ゴールの右端から右下へ下る
 * 板を1枚置いて“ふち”にする。
 *
 * 向きに意味がある。ゴール側（左）が高く、外側（右）へ下っているので、
 * - 外から左へ勢いよく転がってきたボールは、坂を駆け上がってゴールへ入れる
 * - ゴールの中で遅くなったボールは、左側の段差を越えられずに中で止まる
 * という「入りやすく、出にくい」受け皿になる。
 *
 * 位置は「左上端がゴールの右端(x)、右下端が床(y)に接する」ように決める。
 */
const GOAL_RAMP_ANGLE_RAD = (30 * Math.PI) / 180
const GOAL_RAMP_LENGTH = 28
const GOAL_RAMP_THICKNESS = 8

export const GOAL_RAMP = {
  /** 中心の論理座標。描画も物理Bodyもこの中心＋角度で置く */
  x: GOAL_AREA.x + GOAL_AREA.width + (GOAL_RAMP_LENGTH / 2) * Math.cos(GOAL_RAMP_ANGLE_RAD),
  y:
    BOARD_HEIGHT -
    (GOAL_RAMP_LENGTH / 2) * Math.sin(GOAL_RAMP_ANGLE_RAD) -
    (GOAL_RAMP_THICKNESS / 2) * Math.cos(GOAL_RAMP_ANGLE_RAD),
  length: GOAL_RAMP_LENGTH,
  thickness: GOAL_RAMP_THICKNESS,
  angleDeg: 30,
} as const

/** ゴール側（左端）の高さ。床から何px盛り上がっているか */
export const GOAL_RAMP_PEAK =
  (GOAL_RAMP_LENGTH / 2) * Math.sin(GOAL_RAMP_ANGLE_RAD) +
  (GOAL_RAMP_THICKNESS / 2) * Math.cos(GOAL_RAMP_ANGLE_RAD)

/** 盤外へ逸脱させないための外周壁の厚み。壁は盤面の外側に置く */
export const WALL_THICKNESS = 40
