/**
 * 盤面は論理座標 400×600（縦2:3）で固定する。
 * 実機の画面サイズは知らず、拡縮は表示側（CSS transform）の責務にする。
 * こうすることで、物理パラメータ（反発係数・初速など）をこの1つの座標系だけで
 * 一度調整すれば、どの端末でも同じ挙動になる。
 */
export const BOARD_WIDTH = 400
export const BOARD_HEIGHT = 600

/** 国旗ボールの半径（論理座標） */
export const BALL_RADIUS = 18

/** ピン／バンパー。中心座標と半径で表す静的な円 */
export type CircleObstacle = {
  readonly id: string
  /** bumper: 大きくよく弾む丸 / peg: 小さめのピン */
  readonly kind: 'bumper' | 'peg'
  readonly x: number
  readonly y: number
  readonly radius: number
  readonly restitution: number
}

/** 壁。x,y は中心座標、angle はラジアン（時計回り正） */
export type WallSegment = {
  readonly id: string
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly angle: number
  readonly restitution: number
}

/** 最下部の得点ゾーン */
export type ScoreZone = {
  readonly id: string
  /** 左から 0..4 */
  readonly index: number
  readonly score: number
  /** ゾーン左端の x と幅 */
  readonly x: number
  readonly width: number
}

// --- 得点ゾーン -----------------------------------------------------------

/** 得点ゾーンの数。盤面幅を等分する基準になる */
const ZONE_COUNT = 5
/** 1ゾーンあたりの幅。盤面全体を隙間なく等分する */
const ZONE_WIDTH = BOARD_WIDTH / ZONE_COUNT
/** 左から中央が最も高得点になるよう、中央から外側へ向けて単調非増加にしてある */
const ZONE_SCORES: readonly number[] = [100, 300, 1000, 300, 100]

/** 得点ゾーンの上端 y。ここから下がゾーン領域（高さ約80） */
export const ZONE_TOP = 520
/** ゾーンを仕切る壁の厚み */
export const ZONE_DIVIDER_WIDTH = 8

export const SCORE_ZONES: readonly ScoreZone[] = ZONE_SCORES.map((score, index) => ({
  id: `zone-${index}`,
  index,
  score,
  x: index * ZONE_WIDTH,
  width: ZONE_WIDTH,
}))

/**
 * x座標から得点ゾーンを求める。
 * 盤面外の x（マイナス、BOARD_WIDTH超）は左右端のゾーンに丸める。
 * これは主にボール停止判定の fallback（センサーを取りこぼした場合の救済）に使う。
 */
export function zoneAtX(x: number): ScoreZone {
  const rawIndex = Math.floor(x / ZONE_WIDTH)
  const clampedIndex = Math.min(ZONE_COUNT - 1, Math.max(0, rawIndex))
  return SCORE_ZONES[clampedIndex]
}

// --- 障害物（バンパー・ピン） -----------------------------------------------

const BUMPER_RADIUS = 28
const BUMPER_RESTITUTION = 0.75
const PEG_RADIUS = 11
const PEG_RESTITUTION = 0.6

/**
 * バンパー3個・ピン6個の合計9個。中央上寄りにバンパー1個、その左右下にバンパー2個を置き、
 * ピンはその間を上下2段（合計3段構成のうち残り2段）で埋めて、左右対称でスカスカにも
 * ゴチャゴチャにもならない密度にしている。
 * 障害物同士は中心距離が「半径の和 + ボール直径」以上離れており、ボールが必ず通り抜けられる。
 */
export const OBSTACLES: readonly CircleObstacle[] = [
  { id: 'bumper-center', kind: 'bumper', x: BOARD_WIDTH / 2, y: 250, radius: BUMPER_RADIUS, restitution: BUMPER_RESTITUTION },
  { id: 'bumper-left', kind: 'bumper', x: 100, y: 375, radius: BUMPER_RADIUS, restitution: BUMPER_RESTITUTION },
  { id: 'bumper-right', kind: 'bumper', x: 300, y: 375, radius: BUMPER_RADIUS, restitution: BUMPER_RESTITUTION },

  { id: 'peg-top-left', kind: 'peg', x: 90, y: 150, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-top-right', kind: 'peg', x: 310, y: 150, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },

  { id: 'peg-mid-left', kind: 'peg', x: 140, y: 305, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-mid-right', kind: 'peg', x: 260, y: 305, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },

  { id: 'peg-low-left', kind: 'peg', x: 160, y: 460, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-low-right', kind: 'peg', x: 240, y: 460, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
]

// --- 壁 --------------------------------------------------------------------

/** 外壁の厚み。板の外側に半分はみ出させて配置し、高速なボールがすり抜けないようにする */
const WALL_THICKNESS = 30
/** 射出口から盤面へ導く上部の斜め壁の厚み・長さ */
const GUIDE_WALL_THICKNESS = 16
const GUIDE_WALL_LENGTH = 160
/** 上部斜め壁の傾き（ラジアン）。左右対称に内向きへ倒す */
const GUIDE_WALL_ANGLE = 0.5
const WALL_RESTITUTION = 0.3

export const WALLS: readonly WallSegment[] = [
  // 左右の外壁: 中心を盤面の端(x=0 / x=BOARD_WIDTH)に置き、厚みの半分を外側にはみ出させる
  { id: 'wall-left', x: 0, y: BOARD_HEIGHT / 2, width: WALL_THICKNESS, height: BOARD_HEIGHT, angle: 0, restitution: WALL_RESTITUTION },
  { id: 'wall-right', x: BOARD_WIDTH, y: BOARD_HEIGHT / 2, width: WALL_THICKNESS, height: BOARD_HEIGHT, angle: 0, restitution: WALL_RESTITUTION },
  // 上壁も同様に、中心を y=0 に置いて半分を外側にはみ出させる
  { id: 'wall-top', x: BOARD_WIDTH / 2, y: 0, width: BOARD_WIDTH, height: WALL_THICKNESS, angle: 0, restitution: WALL_RESTITUTION },
  // 射出口(LAUNCH)から出たボールを盤面中央側へ導く斜め壁。左右対称に内向きへ倒す
  { id: 'wall-guide-left', x: 90, y: 90, width: GUIDE_WALL_LENGTH, height: GUIDE_WALL_THICKNESS, angle: -GUIDE_WALL_ANGLE, restitution: WALL_RESTITUTION },
  { id: 'wall-guide-right', x: BOARD_WIDTH - 90, y: 90, width: GUIDE_WALL_LENGTH, height: GUIDE_WALL_THICKNESS, angle: GUIDE_WALL_ANGLE, restitution: WALL_RESTITUTION },
  // 盤面の底。得点ゾーンで止まるための床がないとボールが盤外へ落ち続けてしまう。
  // 左右・上壁と同じく中心を盤面の端(y=BOARD_HEIGHT)に置き、厚みの半分を外側にはみ出させる
  { id: 'wall-bottom', x: BOARD_WIDTH / 2, y: BOARD_HEIGHT, width: BOARD_WIDTH, height: WALL_THICKNESS, angle: 0, restitution: WALL_RESTITUTION },
]

// --- 得点ゾーンの仕切り ------------------------------------------------------

/**
 * 得点ゾーンどうしを仕切る壁。SCORE_ZONES の境界（内側の4本。両端の外壁は wall-left/right が兼ねる）
 * から導出し、ゾーンの得点や幅をここに書き写さない。
 * ZONE_TOP から盤面下端までの高さを持ち、ボールが誤って隣のゾーンへ転がり込むのを防ぐ。
 */
export const ZONE_DIVIDERS: readonly WallSegment[] = SCORE_ZONES.slice(1).map((zone, index) => ({
  id: `zone-divider-${index}`,
  x: zone.x,
  y: (ZONE_TOP + BOARD_HEIGHT) / 2,
  width: ZONE_DIVIDER_WIDTH,
  height: BOARD_HEIGHT - ZONE_TOP,
  angle: 0,
  restitution: WALL_RESTITUTION,
}))

// --- 射出パラメータ ----------------------------------------------------------

/**
 * 射出パラメータ。毎回同じ軌道にならないよう位置と初速に微小な揺らぎを持たせる。
 * y は上壁(厚みぶん盤面内側は約 WALL_THICKNESS/2)より少し下に置く。
 */
export const LAUNCH = {
  x: BOARD_WIDTH / 2,
  y: 50,
  jitterX: 6,
  minVx: -1.2,
  maxVx: 1.2,
  minVy: 2,
  maxVy: 4,
}

/**
 * 3球を少しずつ時間差で射出するための遅延(ms)。
 * 途中で3球が同時に動いている状態を作るため、1球分の落下時間より短い間隔にしてある。
 */
export const LAUNCH_DELAYS_MS: readonly number[] = [0, 350, 700]
