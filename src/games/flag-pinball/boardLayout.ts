import type { PinballMode } from './types'

/**
 * 盤面は論理座標 480×1000（縦横比0.48）で固定する。
 * 実機の画面サイズは知らず、拡縮は表示側（CSS transform）の責務にする。
 * こうすることで、物理パラメータ（反発係数・初速など）をこの1つの座標系だけで
 * 一度調整すれば、どの端末でも同じ挙動になる。
 */
export const BOARD_WIDTH = 480
export const BOARD_HEIGHT = 1000

/**
 * 国旗ボールの半径（論理座標）。
 * 直径48pxは盤面幅の1割で、4〜5歳が3球を同時に目で追え、転がっている国旗の
 * 模様まで見分けられる大きさを、障害物間の余白より優先している。
 */
export const BALL_RADIUS = 24

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

/** 得点ゾーンの上端 y。ここから下がゾーン領域（高さ125） */
export const ZONE_TOP = 875
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
export const OBSTACLES: readonly CircleObstacle[] = [
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

export const WALLS: readonly WallSegment[] = [
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

/** 隅ですり抜けさせるボールの逃がし先。真下・外壁から離れる向きへ寄せる。 */
export type CornerEscapeZone = {
  readonly x: number
  readonly y: number
  readonly radius: number
  readonly toX: number
  readonly toY: number
}

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
export const CORNER_ESCAPE_ZONES: readonly CornerEscapeZone[] = [
  { x: 38.8, y: 104, radius: 14, toX: 55, toY: 170 },
  { x: BOARD_WIDTH - 38.8, y: 104, radius: 14, toX: BOARD_WIDTH - 55, toY: 170 },
]

/** (x,y) がCORNER_ESCAPE_ZONESのいずれかに入っていれば、そのゾーンを返す。 */
export function findCornerEscapeZone(x: number, y: number): CornerEscapeZone | null {
  for (const zone of CORNER_ESCAPE_ZONES) {
    if (Math.hypot(x - zone.x, y - zone.y) <= zone.radius) return zone
  }
  return null
}

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
 * 射出パラメータ。毎回同じ軌道にならないよう位置と初速に揺らぎを持たせる。
 * y は上壁（厚みぶん盤面内側は約 WALL_THICKNESS/2）より十分下に置く。
 */
export const LAUNCH = {
  x: BOARD_WIDTH / 2,
  y: 70,
  jitterX: 30,
  minVx: -5,
  maxVx: 5,
  minVy: 6,
  maxVy: 10,
}

/**
 * 3球を少しずつ時間差で射出するための遅延(ms)。
 * 途中で3球が同時に動いている状態を作るため、1球分の落下時間より短い間隔にしてある。
 */
export const LAUNCH_DELAYS_MS: readonly number[] = [0, 350, 700]

/**
 * 全射出モードで1球ずつ射出する間隔(ms)。
 * 1球が射出から得点ゾーン通過まで約9秒（pinballSimulation の実測）かかるため、
 * この間隔だと盤面上に常時10球前後が散らばる。射出口(LAUNCH)からは1球あたり
 * 300px以上進んでから次が出るので、盤面上部に密集しない。
 */
export const ALL_FLAGS_LAUNCH_INTERVAL_MS = 800

/** モードごとの射出タイミング(ms)。通常モードは既存の LAUNCH_DELAYS_MS をそのまま使う */
export function launchDelaysMs(mode: PinballMode, ballCount: number): number[] {
  if (mode === 'normal') return LAUNCH_DELAYS_MS.slice(0, ballCount)
  return Array.from({ length: ballCount }, (_, index) => index * ALL_FLAGS_LAUNCH_INTERVAL_MS)
}

/**
 * モードごとの壁。全射出モードは得点ゾーンを通過したボールをそのまま画面外へ
 * 落として消すため、床(wall-bottom)を置かない。
 */
export function wallsForMode(mode: PinballMode): readonly WallSegment[] {
  if (mode === 'normal') return WALLS
  return WALLS.filter((wall) => wall.id !== 'wall-bottom')
}
