import { BOARD_WIDTH, BOARD_HEIGHT } from '../boardLayout'
import type { CircleObstacle, CornerEscapeZone, WallSegment } from '../boardLayout'
import type { ToyPlacement } from '../toyLayout'
import type { BoardConfig, LaunchConfig } from './types'

/**
 * 宇宙テーマ（space）専用の盤面配置。Phase Bで通常盤面（normalBoard）から切り離し、
 * 「重力に振り回されながら惑星や人工衛星の間を飛び回る」体感を狙って作り直した。
 * 通常テーマの千鳥ピンで少しずつ散らす配置とは違い、宇宙盤面は
 * 少数の大きな斜めガイド（惑星間の航路）・回転する人工衛星（回転おもちゃ）・
 * ジャンプ台（ロケット発射台）で、上下・左右に大きくボールを運ぶ配置にしている。
 * 障害物の総数はあえて通常盤面（34個）よりずっと少なくし、密なピンで
 * ボールが挟まって止まる事故を避けている。
 */

// --- 障害物（バンパー・ピン） -----------------------------------------------

const BUMPER_RADIUS = 26
const BUMPER_RESTITUTION = 0.98
const PEG_RADIUS = 9
const BOTTOM_PEG_RADIUS = 8
const PEG_RESTITUTION = 0.9
/** ゴール直前の小型バンパー（1000点ゾーンの真上）の半径。惑星バンパーより小さく、隙間を残す。 */
const GOAL_BUMPER_RADIUS = 16

/**
 * 上部の構成は「中央の振り分けピン→左右の惑星バンパー」の順に当たるよう、
 * 振り分けピンをバンパーより上（yが小さい）に置く。中央付近を落ちてきたボールは
 * まずこのピンで弱く左右へ振られ、そのまま外側へ流れた先に大きな惑星バンパーが
 * 待っていて、はっきりと左右へ弾き返す（「上部：左右へ散らす」の主役）。
 */
const OBSTACLES: readonly CircleObstacle[] = [
  { id: 'peg-space-splitter', kind: 'peg', x: BOARD_WIDTH / 2, y: 140, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },

  // xは外壁から十分離す（大きな半径のバンパーを外壁へ寄せすぎると、壁とバンパーの間の
  // くぼみにボールが挟まって停滞ナッジでも抜けられなくなる罠ができるため。実機シミュレーション
  // でx=80付近に置いたところ安全タイマーに到達する停滞が再現したため、x=110へ離してある）。
  { id: 'bumper-space-left', kind: 'bumper', x: 110, y: 210, radius: BUMPER_RADIUS, restitution: BUMPER_RESTITUTION },
  { id: 'bumper-space-right', kind: 'bumper', x: BOARD_WIDTH - 110, y: 210, radius: BUMPER_RADIUS, restitution: BUMPER_RESTITUTION },

  /**
   * ゴール手前の軽い千鳥配置（2段）。実測でボールが盤面左寄りへ集まりやすく、
   * 中央(1000)・右側(300/100)の得点ゾーンへほとんど到達しなかったため、下部だけを
   * 調整した。通常テーマの密なピンボールにはせず、ピッチを広く（約140〜160px）取って
   * 宇宙盤面らしい空間を残しつつ、ゴール直前でも横位置が変わる余地を作っている。
   */
  // 左端寄り(x<130程度)にy=700〜750あたりのピンを置くと、外壁と斜めガイドAの根元
  // （高い側の端が壁のすぐ内側(17,313)にある）が作る上部のポケットへボールを跳ね返し、
  // 得点ゾーンへ落ちずに上下を往復し続けるループが実機シミュレーションで再現したため、
  // 1段目は中央〜右寄りだけに置いている（左側は2段目・端のピンで受け止める）。
  { id: 'peg-space-lower-1', kind: 'peg', x: 250, y: 730, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-space-lower-2', kind: 'peg', x: 390, y: 730, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-space-lower-3', kind: 'peg', x: 150, y: 795, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-space-lower-4', kind: 'peg', x: 330, y: 795, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },

  // x=70/410は通常盤面のpeg-row-8と同じ値（外壁からの距離が実績のある安全な配置）。
  // ここを外壁へさらに寄せると、外壁とピンの間にボールが挟まる罠ができることが
  // 実機シミュレーションで再現したため、通常盤面と同じ座標に揃えてある。
  { id: 'peg-space-edge-left', kind: 'peg', x: 70, y: 825, radius: BOTTOM_PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-space-edge-right', kind: 'peg', x: BOARD_WIDTH - 70, y: 825, radius: BOTTOM_PEG_RADIUS, restitution: PEG_RESTITUTION },

  /**
   * 1000点ゾーンのすぐ上に置く小型バンパー。中央へ来たボールが毎回そのまま1000点へ
   * 直進するのではなく、左右の300点ゾーンへ弾かれる可能性を作る。反発係数は他の
   * バンパーと同じ0.98のままにし、宇宙テーマらしい強い跳ね返りを保っている
   * （半径だけを16と小さくし、1000点ゾーンへ抜けられる隙間も残す）。
   */
  { id: 'bumper-space-goal', kind: 'bumper', x: BOARD_WIDTH / 2, y: 825, radius: GOAL_BUMPER_RADIUS, restitution: BUMPER_RESTITUTION },
]

// --- 壁 --------------------------------------------------------------------

const WALL_THICKNESS = 30
const GUIDE_WALL_THICKNESS = 16
const GUIDE_WALL_LENGTH = 180
const GUIDE_WALL_ANGLE = 0.45
const WALL_RESTITUTION = 0.65

/** 斜めガイド（惑星間の航路）の厚み・長さ・角度。通常盤面のピン千鳥配置の代わりに、
 * この2枚の長い斜め壁で「中央→右→中央→左」の大きな横断を作る。 */
const RAMP_THICKNESS = 16
const RAMP_LENGTH = 260
const RAMP_ANGLE = 0.5
const RAMP_RESTITUTION = 0.6

const WALLS: readonly WallSegment[] = [
  // 外壁・上壁・射出ガイド壁は通常盤面と同じ（安定動作が確認済みの形状のため変更しない）。
  { id: 'wall-left', x: 0, y: BOARD_HEIGHT / 2, width: WALL_THICKNESS, height: BOARD_HEIGHT, angle: 0, restitution: WALL_RESTITUTION },
  { id: 'wall-right', x: BOARD_WIDTH, y: BOARD_HEIGHT / 2, width: WALL_THICKNESS, height: BOARD_HEIGHT, angle: 0, restitution: WALL_RESTITUTION },
  { id: 'wall-top', x: BOARD_WIDTH / 2, y: 0, width: BOARD_WIDTH, height: WALL_THICKNESS, angle: 0, restitution: WALL_RESTITUTION },
  { id: 'wall-guide-left', x: 110, y: 105, width: GUIDE_WALL_LENGTH, height: GUIDE_WALL_THICKNESS, angle: -GUIDE_WALL_ANGLE, restitution: WALL_RESTITUTION },
  { id: 'wall-guide-right', x: BOARD_WIDTH - 110, y: 105, width: GUIDE_WALL_LENGTH, height: GUIDE_WALL_THICKNESS, angle: GUIDE_WALL_ANGLE, restitution: WALL_RESTITUTION },
  { id: 'wall-bottom', x: BOARD_WIDTH / 2, y: BOARD_HEIGHT, width: BOARD_WIDTH, height: WALL_THICKNESS, angle: 0, restitution: WALL_RESTITUTION },

  // 斜めガイドA（左寄り・"\"形）: 左上から右下へ、盤面の左半分から右半分へボールを渡す。
  { id: 'wall-space-ramp-a', x: 150, y: 340, width: RAMP_LENGTH, height: RAMP_THICKNESS, angle: RAMP_ANGLE, restitution: RAMP_RESTITUTION },
  // 斜めガイドB（右寄り・"/"形）: 右上から左下へ、Aで右へ渡ったボールを再び左半分へ戻す。
  // AとBは高さ(y)も中心xも大きくずらしてあり、2枚が交わる鋭角の隙間（挟まりの罠）を作らない。
  { id: 'wall-space-ramp-b', x: 330, y: 560, width: RAMP_LENGTH, height: RAMP_THICKNESS, angle: -RAMP_ANGLE, restitution: RAMP_RESTITUTION },
]

/** 射出ガイド壁と外壁が挟む隅は通常盤面と同じ壁形状のまま残るため、同じ座標のすり抜けゾーンを使う。 */
const CORNER_ESCAPE_ZONES: readonly CornerEscapeZone[] = [
  { x: 38.8, y: 104, radius: 14, toX: 55, toY: 170 },
  { x: BOARD_WIDTH - 38.8, y: 104, radius: 14, toX: BOARD_WIDTH - 55, toY: 170 },
]

// --- おもちゃ ----------------------------------------------------------------

/**
 * 回転おもちゃ1個を「人工衛星」として、斜めガイドBの下側・ジャンプ台の上側に置く。
 * 斜めガイドAで右へ渡ったボールが、この衛星に当たってさらにかき混ぜられてから
 * 斜めガイドBで左へ戻る、という経路上の要にしている。
 * 通常盤面のように左右対称2個は置かず1個だけにして、宇宙盤面の障害物総数を抑えている。
 */
const SPINNER_RADIUS = 36
const SPINNER_TAP_RADIUS = 56

/**
 * ジャンプ台（ロケット発射台）。斜めガイドBの下、下部収束ピンの上に置き、
 * 一度沈んだボールを上へ戻す「戻る動き」の起点にする。座標は、真下の収束ピン・
 * 斜めガイドB・回転おもちゃのいずれからも必要な間隔を確保できる位置を探索して決めている
 * （spaceBoard.test.ts で全障害物・壁との間隔を検証）。
 * 盤面中央寄りの候補も試したが、実際のボールの流れ（斜めガイドBを抜けたボールは
 * 盤面の左寄りに集まりやすい）から外れてしまい、シミュレーションでジャンプ台へ
 * ほとんど当たらなかった。現在の位置は実測でボールの主要な経路上に乗るよう調整してある。
 */
const JUMPPAD_RADIUS = 32
const JUMPPAD_TAP_RADIUS = 58

const TOYS: readonly ToyPlacement[] = [
  {
    id: 'toy-spinner-station',
    kind: 'spinner',
    x: 300,
    y: 460,
    radius: SPINNER_RADIUS,
    tapRadius: SPINNER_TAP_RADIUS,
    labelJa: 'くるくる じんこうえいせい',
  },
  {
    id: 'toy-jumppad-rocket',
    kind: 'jumppad',
    x: 170,
    y: 656,
    radius: JUMPPAD_RADIUS,
    tapRadius: JUMPPAD_TAP_RADIUS,
    labelJa: 'ロケット はっしゃだい',
  },
]

// --- 射出パラメータ ----------------------------------------------------------

/**
 * 通常盤面より横方向の初速レンジを広げ（-5〜5 → -8〜8）、振り分けピンで左右どちらの
 * 惑星バンパー側へも寄りやすくする。これにより「上部：左右へ散らす」がより毎回はっきり出る。
 */
const LAUNCH: LaunchConfig = {
  x: BOARD_WIDTH / 2,
  y: 70,
  jitterX: 30,
  minVx: -8,
  maxVx: 8,
  minVy: 6,
  maxVy: 10,
}

export const spaceBoard: BoardConfig = {
  obstacles: OBSTACLES,
  walls: WALLS,
  cornerEscapeZones: CORNER_ESCAPE_ZONES,
  toys: TOYS,
  launch: LAUNCH,
}
