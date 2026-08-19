import { BOARD_WIDTH, BOARD_HEIGHT } from '../boardLayout'
import type { CircleObstacle, CornerEscapeZone, WallSegment } from '../boardLayout'
import type { ToyPlacement } from '../toyLayout'
import type { BoardConfig, LaunchConfig } from './types'

/**
 * 空テーマ（sky）専用の盤面配置。Phase Eで通常盤面（normalBoard）から切り離し、
 * 「雲の間を、風に流されながらふわふわ落ちていく」体感を狙って作った。
 * 宇宙（重力に振り回される上下運動）・海（斜面とシーソーで蛇行する横移動）・
 * おかし（密な障害物とハンマーでわちゃわちゃ方向転換）とは違い、空テーマは
 * 「強い衝突・激しい跳ね返りを主役にせず、風toy（wind）の中にいる間だけ弱い力を
 * 受け続けて少しずつ横へ運ばれる」ことを主役にする。障害物は他テーマよりさらに
 * 少なくし、盤面の広さ・滞空感そのものを感じられる空間を優先している。
 */

// --- 障害物（バンパー・ピン） -----------------------------------------------
// バンパー・ピンは新しい形を作らず、既存の丸い見た目のまま「雲」として使う
// （色・グラデーションはskyTheme.module.cssが受け持つ）。反発係数は他テーマの
// バンパーより少し控えめにし、「弾む楽しさは残しつつ主役にはしない」を狙っている。

const CLOUD_BUMPER_RADIUS = 27
const CLOUD_BUMPER_SMALL_RADIUS = 25
const CLOUD_BUMPER_RESTITUTION = 0.9
const CLOUD_PEG_RADIUS = 12
const CLOUD_PEG_RESTITUTION = 0.9

const OBSTACLES: readonly CircleObstacle[] = [
  // 上部の雲（射出直後、左右へ軽く振り分ける）。y・xともにずらして左右非対称にし、
  // 「必ず同じルートを通る」固定感を避ける。
  { id: 'bumper-sky-cloud-upper-left', kind: 'bumper', x: 130, y: 175, radius: CLOUD_BUMPER_RADIUS, restitution: CLOUD_BUMPER_RESTITUTION },
  { id: 'bumper-sky-cloud-upper-right', kind: 'bumper', x: 350, y: 205, radius: CLOUD_BUMPER_RADIUS, restitution: CLOUD_BUMPER_RESTITUTION },

  // 上の風エリア（右向き）に入る手前で軽く散らす小さな雲ピン2個。
  { id: 'peg-sky-pre-wind-upper-left', kind: 'peg', x: 185, y: 275, radius: CLOUD_PEG_RADIUS, restitution: CLOUD_PEG_RESTITUTION },
  { id: 'peg-sky-pre-wind-upper-right', kind: 'peg', x: 275, y: 290, radius: CLOUD_PEG_RADIUS, restitution: CLOUD_PEG_RESTITUTION },

  // 上の風エリアを抜けたあと、プロペラtoyへ向かう手前で軽く散らす小さな雲。
  { id: 'peg-sky-cloud-mid-left', kind: 'peg', x: 140, y: 430, radius: CLOUD_PEG_RADIUS, restitution: CLOUD_PEG_RESTITUTION },
  { id: 'peg-sky-cloud-mid-right', kind: 'peg', x: 345, y: 415, radius: CLOUD_PEG_RADIUS, restitution: CLOUD_PEG_RESTITUTION },

  // プロペラtoyを抜けたあと、中央の風エリア（左向き）に入る手前で軽く散らす小さな雲。
  { id: 'peg-sky-pre-wind-middle-left', kind: 'peg', x: 165, y: 570, radius: CLOUD_PEG_RADIUS, restitution: CLOUD_PEG_RESTITUTION },
  { id: 'peg-sky-pre-wind-middle-right', kind: 'peg', x: 335, y: 580, radius: CLOUD_PEG_RADIUS, restitution: CLOUD_PEG_RESTITUTION },

  // 下部の雲2個。中央の下の風エリア（弱い右上向き）へ入る前に、もう一度左右へ散らす。
  { id: 'bumper-sky-cloud-lower-left', kind: 'bumper', x: 105, y: 710, radius: CLOUD_BUMPER_SMALL_RADIUS, restitution: CLOUD_BUMPER_RESTITUTION },
  { id: 'bumper-sky-cloud-lower-right', kind: 'bumper', x: 375, y: 720, radius: CLOUD_BUMPER_SMALL_RADIUS, restitution: CLOUD_BUMPER_RESTITUTION },

  // ゴール手前、複数の小さな雲ピンで最終的な着地位置を散らし、5ゾーンすべてに
  // 現実的な到達経路を作る。中央寄りの雲ピン（goal-center）は、中央へ寄りがちな
  // ボールの一部をゴール直前で軽く弾き、1000点ゾーンだけに偏らないようにする役目を持つ。
  // y座標は「y + radius + ボール直径 < ZONE_TOP」を満たす高さに置き、静止したボールの
  // 下端がゾーン仕切りへ届いて挟まる罠（海盤面で見つかったのと同種の問題）を避けている。
  { id: 'peg-sky-goal-left', kind: 'peg', x: 160, y: 805, radius: CLOUD_PEG_RADIUS, restitution: CLOUD_PEG_RESTITUTION },
  { id: 'peg-sky-goal-right', kind: 'peg', x: 305, y: 800, radius: CLOUD_PEG_RADIUS, restitution: CLOUD_PEG_RESTITUTION },
  { id: 'peg-sky-goal-center', kind: 'peg', x: 240, y: 740, radius: CLOUD_PEG_RADIUS, restitution: CLOUD_PEG_RESTITUTION },
]

// --- 壁 --------------------------------------------------------------------

const WALL_THICKNESS = 30
const GUIDE_WALL_THICKNESS = 16
const GUIDE_WALL_LENGTH = 180
const GUIDE_WALL_ANGLE = 0.45
const WALL_RESTITUTION = 0.65

const WALLS: readonly WallSegment[] = [
  // 外壁・上壁・射出ガイド壁は通常盤面と同じ（安定動作が確認済みの形状のため変更しない）。
  { id: 'wall-left', x: 0, y: BOARD_HEIGHT / 2, width: WALL_THICKNESS, height: BOARD_HEIGHT, angle: 0, restitution: WALL_RESTITUTION },
  { id: 'wall-right', x: BOARD_WIDTH, y: BOARD_HEIGHT / 2, width: WALL_THICKNESS, height: BOARD_HEIGHT, angle: 0, restitution: WALL_RESTITUTION },
  { id: 'wall-top', x: BOARD_WIDTH / 2, y: 0, width: BOARD_WIDTH, height: WALL_THICKNESS, angle: 0, restitution: WALL_RESTITUTION },
  { id: 'wall-guide-left', x: 110, y: 105, width: GUIDE_WALL_LENGTH, height: GUIDE_WALL_THICKNESS, angle: -GUIDE_WALL_ANGLE, restitution: WALL_RESTITUTION },
  { id: 'wall-guide-right', x: BOARD_WIDTH - 110, y: 105, width: GUIDE_WALL_LENGTH, height: GUIDE_WALL_THICKNESS, angle: GUIDE_WALL_ANGLE, restitution: WALL_RESTITUTION },
  { id: 'wall-bottom', x: BOARD_WIDTH / 2, y: BOARD_HEIGHT, width: BOARD_WIDTH, height: WALL_THICKNESS, angle: 0, restitution: WALL_RESTITUTION },
]

/** 射出ガイド壁と外壁が挟む隅は通常盤面と同じ壁形状のまま残るため、同じ座標のすり抜けゾーンを使う。 */
const CORNER_ESCAPE_ZONES: readonly CornerEscapeZone[] = [
  { x: 38.8, y: 104, radius: 14, toX: 55, toY: 170 },
  { x: BOARD_WIDTH - 38.8, y: 104, radius: 14, toX: BOARD_WIDTH - 55, toY: 170 },
]

// --- おもちゃ ----------------------------------------------------------------

/**
 * 回転おもちゃ1個を「プロペラ」として、上の風エリアと下の風エリアのあいだに置く。
 * 宇宙盤面の人工衛星・おかし盤面のペロペロキャンディと同じ考え方で、風toyを主役にする
 * ため左右対称2個ではなく1個だけにし、障害物総数を抑える。
 */
const SPINNER_RADIUS = 36
const SPINNER_TAP_RADIUS = 56

/**
 * 風toy3個。「上部：右向き」「中央：左向き」「下部：弱い右上向き」と向きを変え、
 * 同じ方向へ固定しない（windToy.tsの説明どおり、範囲内にいる間だけ弱い力を継続的に
 * 受ける。エリアを外れれば即座に無風へ戻る）。半径・タップ半径は見た目のバッジ用で、
 * 実際に効く範囲は wind.halfWidth / halfHeight（盤面幅の大半をカバーする横長の帯）。
 */
const WIND_UPPER_RADIUS = 58
const WIND_UPPER_TAP_RADIUS = 68
const WIND_MIDDLE_RADIUS = 58
const WIND_MIDDLE_TAP_RADIUS = 68
const WIND_LOWER_RADIUS = 50
const WIND_LOWER_TAP_RADIUS = 60

const TOYS: readonly ToyPlacement[] = [
  {
    // 中心(240)よりやや左寄りに置く。下の風エリア（左向き、やや右寄り）と中心をずらす
    // ことで、「右風→左風」で毎回ぴったり打ち消し合って中央ゾーンへ収束しすぎることを防ぐ。
    id: 'toy-sky-wind-upper',
    kind: 'wind',
    x: 200,
    y: 300,
    radius: WIND_UPPER_RADIUS,
    tapRadius: WIND_UPPER_TAP_RADIUS,
    labelJa: 'かぜ（みぎむき）',
    wind: { directionX: 1, halfWidth: 170, halfHeight: 55 },
  },
  {
    id: 'toy-sky-propeller',
    kind: 'spinner',
    x: 260,
    y: 505,
    radius: SPINNER_RADIUS,
    tapRadius: SPINNER_TAP_RADIUS,
    labelJa: 'くるくる プロペラ',
  },
  {
    // 中心よりやや右寄りに置く（上の風エリアとの非対称のため。詳しくは上のコメント参照）。
    id: 'toy-sky-wind-middle',
    kind: 'wind',
    x: 280,
    y: 650,
    radius: WIND_MIDDLE_RADIUS,
    tapRadius: WIND_MIDDLE_TAP_RADIUS,
    labelJa: 'かぜ（ひだりむき）',
    wind: { directionX: -1, halfWidth: 170, halfHeight: 55 },
  },
  {
    id: 'toy-sky-wind-lower',
    kind: 'wind',
    x: BOARD_WIDTH / 2,
    y: 822,
    radius: WIND_LOWER_RADIUS,
    tapRadius: WIND_LOWER_TAP_RADIUS,
    labelJa: 'よわい かぜ（みぎうえむき）',
    wind: { directionX: 1, horizontalTargetSpeed: 1.7, upwardTargetVy: -0.7, halfWidth: 160, halfHeight: 35 },
  },
]

// --- 射出パラメータ ----------------------------------------------------------

/**
 * 射出口・初速レンジは通常盤面と同じにする。空テーマらしい「風に流される」体感は
 * 盤面配置（風toy・雲の間隔・広い空間）だけで作るため、射出の時点で差を付けない。
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

export const skyBoard: BoardConfig = {
  obstacles: OBSTACLES,
  walls: WALLS,
  cornerEscapeZones: CORNER_ESCAPE_ZONES,
  toys: TOYS,
  launch: LAUNCH,
}
