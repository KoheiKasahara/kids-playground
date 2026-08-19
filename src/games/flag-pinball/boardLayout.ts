import type { PinballMode } from './types'

/**
 * 盤面は論理座標 480×1000（縦横比0.48）で固定する。
 * 実機の画面サイズは知らず、拡縮は表示側（CSS transform）の責務にする。
 * こうすることで、物理パラメータ（反発係数・初速など）をこの1つの座標系だけで
 * 一度調整すれば、どの端末でも同じ挙動になる。
 *
 * このファイルには「全テーマ共通」の盤面情報だけを置く。
 * ピン・バンパー・壁・おもちゃなど、テーマごとに変わりうる配置データは
 * boardConfigs/ 以下（テーマ別のBoardConfig）へ分離してある。
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

/** 隅ですり抜けさせるボールの逃がし先。真下・外壁から離れる向きへ寄せる。 */
export type CornerEscapeZone = {
  readonly x: number
  readonly y: number
  readonly radius: number
  readonly toX: number
  readonly toY: number
}

// --- 得点ゾーン -----------------------------------------------------------
// ゴール判定はテーマに関わらず共通（盤面幅から等分するだけ）。

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
/** 壁の反発係数の既定値。ゾーン仕切りなど、テーマに依存しない共通壁で使う。 */
const WALL_RESTITUTION = 0.65

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

/**
 * 得点ゾーンどうしを仕切る壁。SCORE_ZONES の境界（内側の4本。両端の外壁はテーマ別の
 * 外壁が兼ねる）から導出し、ゾーンの得点や幅をここに書き写さない。
 * ZONE_TOP から盤面下端までの高さを持ち、ボールが誤って隣のゾーンへ転がり込むのを防ぐ。
 * ゴール判定と同じく盤面幅から機械的に決まるので、全テーマ共通のまま持つ。
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

/**
 * (x,y) がテーマの CornerEscapeZone のいずれかに入っていれば、そのゾーンを返す。
 * どの隅がすり抜け対象になるかは壁の配置（テーマ別のBoardConfig）に依存するため、
 * 対象ゾーンの一覧を引数で受け取る。usePinballEngine.ts と pinballSimulation.ts の
 * 停滞ナッジ処理から参照する。
 */
export function findCornerEscapeZone(
  zones: readonly CornerEscapeZone[],
  x: number,
  y: number,
): CornerEscapeZone | null {
  for (const zone of zones) {
    if (Math.hypot(x - zone.x, y - zone.y) <= zone.radius) return zone
  }
  return null
}

// --- 射出タイミング ----------------------------------------------------------
// 「いつ何球射出するか」は遊びかた（モード）のルールであり、盤面レイアウトではないため
// テーマに関わらず共通のまま持つ。射出位置・初速の範囲（どこから出るか）はテーマ別の
// BoardConfig（launch）が持つ。

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
 * 落として消すため、床(wall-bottom)を置かない。どの壁がテーマの外壁一式かは
 * BoardConfig（walls）が持つため、対象を引数で受け取る。
 */
export function wallsForMode(walls: readonly WallSegment[], mode: PinballMode): readonly WallSegment[] {
  if (mode === 'normal') return walls
  return walls.filter((wall) => wall.id !== 'wall-bottom')
}
