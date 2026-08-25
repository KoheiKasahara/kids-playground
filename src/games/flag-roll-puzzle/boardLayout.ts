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
export const GRID_COLS = 8
/**
 * 配置グリッドの行数。
 * 増やすほどコースは長くなるが、そのぶんスマホ縦画面では1マスが小さくなり
 * （盤面全体が画面の高さに合わせて縮むため）指で狙いにくくなる。
 */
export const GRID_ROWS = 10

/** グリッドの左端x。今は盤面の左端と同じだが、意味が違うので別の名前で持つ */
export const GRID_LEFT = 0
/** スタート帯の高さ ＝ グリッドの上端y */
export const GRID_TOP = 72

export const GRID_WIDTH = GRID_COLS * CELL_SIZE
export const GRID_HEIGHT = GRID_ROWS * CELL_SIZE
export const GRID_BOTTOM = GRID_TOP + GRID_HEIGHT

/** ゴール帯の高さ */
export const GOAL_HEIGHT = 68

/** ステージごとに変えられるゴール帯。論理座標は盤面座標で持つ。 */
export type GoalArea = {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

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
export const GOAL_AREA: GoalArea = {
  x: GRID_LEFT,
  y: GRID_BOTTOM,
  width: CELL_SIZE * 2,
  height: GOAL_HEIGHT,
} as const

/**
 * ゴールの出口側（右端）。物理側ではこの直後に見えない縦壁を置き、
 * ゴールへ入ったボールが通常の床エリアへ戻らないようにする。
 */
export const GOAL_EXIT_WALL_X = GOAL_AREA.x + GOAL_AREA.width

/**
 * ゴール出口を塞ぐ見えない縦壁。
 *
 * CSS のゴール右端線（3px）と見た目の差が出ないよう 4px に留め、壁の左面を
 * GOAL_EXIT_WALL_X へぴったり揃える。つまり、プレイエリア側（左側）へは
 * まったく食い込ませない。ボールは最大16px/stepに制限しているため、この厚みでも
 * 1ステップで壁を通り抜けない。
 */
export const GOAL_EXIT_WALL_THICKNESS = 4
export const GOAL_EXIT_WALL = {
  x: GOAL_EXIT_WALL_X + GOAL_EXIT_WALL_THICKNESS / 2,
  y: GOAL_AREA.y + GOAL_AREA.height / 2,
  width: GOAL_EXIT_WALL_THICKNESS,
  height: GOAL_AREA.height,
} as const

/**
 * ステージ固有ゴールの左右境界壁。盤面の外周と共有する側は追加しない。
 * 壁の中心を返すため、ゴール内側の面は常にゴール境界へ一致する。
 */
export function goalBoundaryWallsForArea(goalArea: GoalArea): GoalArea[] {
  const walls: GoalArea[] = []
  if (goalArea.x > GRID_LEFT) {
    walls.push({
      x: goalArea.x - GOAL_EXIT_WALL_THICKNESS / 2,
      y: goalArea.y + goalArea.height / 2,
      width: GOAL_EXIT_WALL_THICKNESS,
      height: goalArea.height,
    })
  }
  if (goalArea.x + goalArea.width < BOARD_WIDTH) {
    walls.push({
      x: goalArea.x + goalArea.width + GOAL_EXIT_WALL_THICKNESS / 2,
      y: goalArea.y + goalArea.height / 2,
      width: GOAL_EXIT_WALL_THICKNESS,
      height: goalArea.height,
    })
  }
  return walls
}

/** 旧API互換の右側出口壁。右端ゴールではnullになる。 */
export function goalExitWallForArea(goalArea: GoalArea): GoalArea | null {
  return goalBoundaryWallsForArea(goalArea).find(
    (wall) => wall.x > goalArea.x + goalArea.width / 2,
  ) ?? null
}

/** 盤外へ逸脱させないための外周壁の厚み。壁は盤面の外側に置く */
export const WALL_THICKNESS = 40
