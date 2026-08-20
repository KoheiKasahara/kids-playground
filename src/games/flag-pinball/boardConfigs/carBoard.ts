import { BOARD_WIDTH, BOARD_HEIGHT } from '../boardLayout'
import type { CircleObstacle, CornerEscapeZone, WallSegment } from '../boardLayout'
import type { ToyPlacement } from '../toyLayout'
import type { BoardConfig, LaunchConfig } from './types'

/**
 * くるまテーマ（car）専用の盤面配置。Phase Fで通常盤面（normalBoard）から切り離し、
 * 「道路を左右に走る車にボールがぶつかり、横方向へ大きく進路を変えられる盤面」を狙って
 * 作った。宇宙（上下運動）・海（斜面・シーソーの蛇行）・おかし（密な障害物とハンマー）・
 * 空（風に流される滞空）とは違い、くるまテーマは「移動する物体（車toy）との物理衝突で
 * 横方向へ運ばれる」ことを主役にする。
 *
 * 車toy（toy-car-road、y=460）が往復する区間には、あえて物理的な床（壁）を置いていない。
 * そうすることで、
 *   - 車が当たらなかったボールは道路の高さをそのまま素通りして下段へ抜ける
 *     （「車を避けて落下するケースもある」を、特別な分岐なしに自然に実現できる）
 *   - 車の下や車と壁の間にボールが物理的に挟まる隙間そのものが存在しない
 *     （床がないので「車体下へ入り込んで止まる」「車と壁に挟まれる」が構造的に起こらない）
 * という2つの安全性を、盤面設計だけで同時に満たせる。車の可動範囲（CAR_LEFT_X〜CAR_RIGHT_X）
 * も外壁から十分離してあり（片側75px以上、ボール直径48pxの安全マージンREQUIRED_CLEARANCE
 * 相当を上回る）、車が壁ぎりぎりまで寄ることもない。
 *
 * 「道路」の見た目（グレーの帯・白い中央線）はcarTheme.module.cssのrenderBackdropが
 * 純粋な装飾として描く（当たり判定は持たない）。
 */

// --- 障害物（バンパー・ピン） -----------------------------------------------

const PEG_RADIUS = 9
const PEG_RESTITUTION = 0.85
const SMALL_BUMPER_RADIUS = 17
const SIGNAL_BUMPER_RADIUS = 24
const BUMPER_RESTITUTION = 0.95

/**
 * 障害物は12個。通常盤面（34個）よりずっと少なく、海・空盤面と同じく「密なピンで散らす」
 * のではなく「車toyとの遭遇そのものを主役にする」ため、障害物は上部の軽い散らし・
 * 道路の上下を再分岐させる役目に留める。
 */
const OBSTACLES: readonly CircleObstacle[] = [
  // 上部（発射直後）: 軽く左右へ散らす2本のピンと、中央の信号機っぽいバンパー。
  { id: 'peg-car-upper-left', kind: 'peg', x: 130, y: 150, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-car-upper-right', kind: 'peg', x: 350, y: 175, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'bumper-car-signal', kind: 'bumper', x: BOARD_WIDTH / 2, y: 210, radius: SIGNAL_BUMPER_RADIUS, restitution: BUMPER_RESTITUTION },

  // 上〜中央: 道路（y=460）へ入る前にもう一段散らす2本のピン。中央寄りに置くことで、
  // ここで外側へ弾かれたボールは道路の可動範囲（90〜390）の外まで逃げ、車に一切当たらず
  // 下段へ抜けるルートになる。
  { id: 'peg-car-pre-road-left', kind: 'peg', x: 100, y: 365, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-car-pre-road-right', kind: 'peg', x: 380, y: 375, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },

  // [ 道路・車toyは y=460 付近。物理的な床は置かない（上のコメント参照） ]

  // 道路の下: 車に弾かれた／車を避けて落ちたボールを、もう一度中央寄りへ受け戻す
  // 短い坂道（wall-car-guide-lower-*）の手前で軽く散らす役目は坂道自身が持つため、
  // ここには置かない。
  { id: 'bumper-car-cone-left', kind: 'bumper', x: 105, y: 660, radius: SMALL_BUMPER_RADIUS, restitution: BUMPER_RESTITUTION },
  { id: 'bumper-car-cone-right', kind: 'bumper', x: 375, y: 660, radius: SMALL_BUMPER_RADIUS, restitution: BUMPER_RESTITUTION },
  { id: 'peg-car-recenter', kind: 'peg', x: BOARD_WIDTH / 2, y: 670, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },

  // ゴール手前: 軽い千鳥ピンで最終的な着地位置を散らし、5得点ゾーンすべてに届かせる
  // （他テーマと同じ考え方）。y + radius + ボール直径 < ZONE_TOP(875) を満たす高さに置き、
  // 静止したボールの下端がゾーン仕切りへ届いて挟まる罠を作らないようにしてある。
  { id: 'peg-car-goal-left', kind: 'peg', x: 150, y: 810, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-car-goal-right', kind: 'peg', x: 330, y: 810, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-car-goal-center', kind: 'peg', x: BOARD_WIDTH / 2, y: 760, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
]

// --- 壁 --------------------------------------------------------------------

const WALL_THICKNESS = 30
const GUIDE_WALL_THICKNESS = 16
const GUIDE_WALL_LENGTH = 180
const GUIDE_WALL_ANGLE = 0.45
const WALL_RESTITUTION = 0.65

/**
 * 短い坂道4枚。上の2枚（"＼   ／"）は発射直後のボールをゆるく道路側へ寄せ、
 * 下の2枚（"＼   ／"、下向きに寄せる向きは上と逆）は車に当たらなかった／弾かれた
 * ボールを再び中央寄りへ戻す。宇宙・海テーマの長い斜めガイド壁と違い、
 * 「1本でルートを固定する」ほど長くはせず、あくまで軽い誘導に留めてある。
 */
const SHORT_GUIDE_THICKNESS = 14
const SHORT_GUIDE_UPPER_LENGTH = 100
const SHORT_GUIDE_LOWER_LENGTH = 140
const SHORT_GUIDE_UPPER_ANGLE = 0.5
const SHORT_GUIDE_LOWER_ANGLE = 0.42
const SHORT_GUIDE_RESTITUTION = 0.6

const WALLS: readonly WallSegment[] = [
  // 外壁・上壁・射出ガイド壁は通常盤面と同じ（安定動作が確認済みの形状のため変更しない）。
  { id: 'wall-left', x: 0, y: BOARD_HEIGHT / 2, width: WALL_THICKNESS, height: BOARD_HEIGHT, angle: 0, restitution: WALL_RESTITUTION },
  { id: 'wall-right', x: BOARD_WIDTH, y: BOARD_HEIGHT / 2, width: WALL_THICKNESS, height: BOARD_HEIGHT, angle: 0, restitution: WALL_RESTITUTION },
  { id: 'wall-top', x: BOARD_WIDTH / 2, y: 0, width: BOARD_WIDTH, height: WALL_THICKNESS, angle: 0, restitution: WALL_RESTITUTION },
  { id: 'wall-guide-left', x: 110, y: 105, width: GUIDE_WALL_LENGTH, height: GUIDE_WALL_THICKNESS, angle: -GUIDE_WALL_ANGLE, restitution: WALL_RESTITUTION },
  { id: 'wall-guide-right', x: BOARD_WIDTH - 110, y: 105, width: GUIDE_WALL_LENGTH, height: GUIDE_WALL_THICKNESS, angle: GUIDE_WALL_ANGLE, restitution: WALL_RESTITUTION },
  { id: 'wall-bottom', x: BOARD_WIDTH / 2, y: BOARD_HEIGHT, width: BOARD_WIDTH, height: WALL_THICKNESS, angle: 0, restitution: WALL_RESTITUTION },

  // 上部の短い坂道（"＼   ／"）。内向きに倒し、道路（車の可動範囲）へ入りやすくする。
  { id: 'wall-car-guide-upper-left', x: 140, y: 300, width: SHORT_GUIDE_UPPER_LENGTH, height: SHORT_GUIDE_THICKNESS, angle: SHORT_GUIDE_UPPER_ANGLE, restitution: SHORT_GUIDE_RESTITUTION },
  { id: 'wall-car-guide-upper-right', x: 340, y: 300, width: SHORT_GUIDE_UPPER_LENGTH, height: SHORT_GUIDE_THICKNESS, angle: -SHORT_GUIDE_UPPER_ANGLE, restitution: SHORT_GUIDE_RESTITUTION },

  // 下部の短い坂道（"＼   ／"）。道路を抜けたボールを中央寄りへ戻す。
  { id: 'wall-car-guide-lower-left', x: 140, y: 575, width: SHORT_GUIDE_LOWER_LENGTH, height: SHORT_GUIDE_THICKNESS, angle: SHORT_GUIDE_LOWER_ANGLE, restitution: SHORT_GUIDE_RESTITUTION },
  { id: 'wall-car-guide-lower-right', x: 340, y: 575, width: SHORT_GUIDE_LOWER_LENGTH, height: SHORT_GUIDE_THICKNESS, angle: -SHORT_GUIDE_LOWER_ANGLE, restitution: SHORT_GUIDE_RESTITUTION },
]

/** 射出ガイド壁と外壁が挟む隅は通常盤面と同じ壁形状のまま残るため、同じ座標のすり抜けゾーンを使う。 */
const CORNER_ESCAPE_ZONES: readonly CornerEscapeZone[] = [
  { x: 38.8, y: 104, radius: 14, toX: 55, toY: 170 },
  { x: BOARD_WIDTH - 38.8, y: 104, radius: 14, toX: BOARD_WIDTH - 55, toY: 170 },
]

// --- おもちゃ ----------------------------------------------------------------

/**
 * 車toy。placement.x/yは初期位置（道路の左端）で、実際の可動範囲・速度・向きは
 * car設定（CarConfig）が持つ。radius=60は見た目のtoyVisualボックス(120×120)の基準で、
 * carToy.tsの複合Collider（胴体幅100・屋根幅56）とほぼ同じ比率になるよう
 * carTheme.module.cssの.carBody/.carCabinを作ってある。
 *
 * 可動範囲(140〜340)は、車の胴体半幅50を足した実際の可動フットプリント(90〜390)が
 * 外壁の内側面(x=15/465)からそれぞれ75px以上離れるように選んである
 * （ボール直径48px+16pxの安全マージンより広い。carBoard.test.tsで検証）。
 * 道路には物理的な床を置かないため、車と壁の間にボールが挟まる隙間自体が存在しない。
 */
const CAR_RADIUS = 60
const CAR_TAP_RADIUS = 70
const CAR_Y = 460
const CAR_LEFT_X = 140
const CAR_RIGHT_X = 340
const CAR_SPEED = 2.0

const TOYS: readonly ToyPlacement[] = [
  {
    id: 'toy-car-road',
    kind: 'car',
    x: CAR_LEFT_X,
    y: CAR_Y,
    radius: CAR_RADIUS,
    tapRadius: CAR_TAP_RADIUS,
    labelJa: 'はしる くるま',
    car: { leftX: CAR_LEFT_X, rightX: CAR_RIGHT_X, speed: CAR_SPEED, initialDirection: 1 },
  },
]

// --- 射出パラメータ ----------------------------------------------------------

/**
 * 射出口・初速レンジは通常盤面と同じにする。くるまテーマらしさは盤面配置（車toy・
 * 道路・坂道）だけで作るため、射出の時点で差を付けない。
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

export const carBoard: BoardConfig = {
  obstacles: OBSTACLES,
  walls: WALLS,
  cornerEscapeZones: CORNER_ESCAPE_ZONES,
  toys: TOYS,
  launch: LAUNCH,
}
