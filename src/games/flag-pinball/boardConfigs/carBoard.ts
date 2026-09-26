import { BOARD_WIDTH, BOARD_HEIGHT } from '../boardLayout'
import type { CircleObstacle, CornerEscapeZone, WallSegment } from '../boardLayout'
import type { ToyPlacement } from '../toyLayout'
import type { BoardConfig, LaunchConfig } from './types'

/**
 * くるまテーマ（car）専用の盤面配置。「道路を左右に走る車にボールがぶつかり、横方向へ
 * 大きく進路を変えられる盤面」を狙っている。宇宙（上下運動）・海（斜面・シーソーの蛇行）・
 * おかし（密な障害物とハンマー）・空（風に流される滞空）とは違い、くるまテーマは
 * 「移動する物体（車toy）との物理衝突で横方向へ運ばれる」ことを主役にする。
 *
 * 道路は上・中・下の3本（CAR_ROAD_YS）で、それぞれに車が1台ずつ走る。3台は車種・速さ・
 * 最初の向きをずらしてあり、上下の車が同じタイミングで同じ場所に並ばないようにしてある。
 *
 * 車toyが往復する区間には、あえて物理的な床（壁）を置いていない。そうすることで、
 *   - 車が当たらなかったボールは道路の高さをそのまま素通りして下段へ抜ける
 *     （「車を避けて落下するケースもある」を、特別な分岐なしに自然に実現できる）
 *   - 車の下や車と壁の間にボールが物理的に挟まる隙間そのものが存在しない
 * という2つの安全性を、盤面設計だけで同時に満たせる。車の可動範囲（CAR_LEFT_X〜CAR_RIGHT_X）
 * も外壁から十分離してあり（車体の端から外壁の内側面まで64px以上、ボール直径48pxの
 * 安全マージンREQUIRED_CLEARANCE相当）、車が壁ぎりぎりまで寄ることもない。
 * また、道路と道路の間にある障害物は、車のCollider（上端: 中心y-38 / 下端: 中心y+25）から
 * 上下ともボール直径以上離し、動く車と固定物の間でボールが押しつぶされないようにしてある
 * （carBoard.test.tsで検証）。
 *
 * 「道路」の見た目はcarTheme.tsxのrenderBackdropが純粋な装飾として描く（当たり判定は持たない）。
 */

/** 3本の道路（＝車の中心y）。上から順に並ぶ。carTheme.tsxの道路の装飾もこの値を使う。 */
export const CAR_ROAD_YS = [300, 505, 712] as const

// --- 障害物（バンパー・ピン） -----------------------------------------------

const PEG_RADIUS = 9
const PEG_RESTITUTION = 0.85
const SIGNAL_BUMPER_RADIUS = 22
const BUMPER_RESTITUTION = 0.95

/**
 * 障害物は12個。通常盤面（34個）よりずっと少なく、「密なピンで散らす」のではなく
 * 「車toyとの遭遇そのものを主役にする」ため、障害物は道路と道路の間で軽く散らす役目に留める。
 * 道路の間はボール直径ぶんの隙間を上下に残す必要があるため、小さなピンだけを置く。
 */
const OBSTACLES: readonly CircleObstacle[] = [
  // 上部（発射直後）: 軽く左右へ散らす2本のピンと、中央の信号機っぽいバンパー。
  { id: 'peg-car-upper-left', kind: 'peg', x: 130, y: 150, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-car-upper-right', kind: 'peg', x: 350, y: 175, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'bumper-car-signal', kind: 'bumper', x: BOARD_WIDTH / 2, y: 175, radius: SIGNAL_BUMPER_RADIUS, restitution: BUMPER_RESTITUTION },

  // [ 上の道路（y=300） ]

  // 上の道路と中の道路の間: 3本のピンで左右へ散らし直す。
  { id: 'peg-car-mid-left', kind: 'peg', x: 110, y: 396, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-car-mid-center', kind: 'peg', x: BOARD_WIDTH / 2, y: 396, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-car-mid-right', kind: 'peg', x: 370, y: 396, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },

  // [ 中の道路（y=505） ]

  // 中の道路と下の道路の間: 上段とずらした3本のピン。
  { id: 'peg-car-lower-left', kind: 'peg', x: 150, y: 602, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-car-lower-center', kind: 'peg', x: BOARD_WIDTH / 2, y: 602, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-car-lower-right', kind: 'peg', x: 330, y: 602, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },

  // [ 下の道路（y=712） ]

  // ゴール手前: 軽い千鳥ピンで最終的な着地位置を散らし、5得点ゾーンすべてに届かせる
  // （他テーマと同じ考え方）。y + radius + ボール直径 < ZONE_TOP(875) を満たす高さに置き、
  // 静止したボールの下端がゾーン仕切りへ届いて挟まる罠を作らないようにしてある。
  { id: 'peg-car-goal-left', kind: 'peg', x: 130, y: 812, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-car-goal-center', kind: 'peg', x: BOARD_WIDTH / 2, y: 812, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-car-goal-right', kind: 'peg', x: 350, y: 812, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
]

// --- 壁 --------------------------------------------------------------------

const WALL_THICKNESS = 30
const GUIDE_WALL_THICKNESS = 16
const GUIDE_WALL_LENGTH = 180
const GUIDE_WALL_ANGLE = 0.45
const WALL_RESTITUTION = 0.65

/**
 * 道路を3本に増やしたため、以前の短い坂道は置かない（道路の間に坂道を置くと、動く車との
 * 間にボールが挟まる隙間ができてしまうため）。道路間の再分岐は障害物だけで行う。
 */
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
 * 車toy3台。placement.x/yは初期位置で、実際の可動範囲・速度・向き・車種はcar設定
 * （CarConfig）が持つ。radius=60は見た目のtoyVisualボックス(120×120)の基準で、
 * carToy.tsの複合Collider（胴体幅100・屋根幅44）とほぼ同じ輪郭になるよう
 * themes/CarToyArt.tsxのSVGを描いてある。
 *
 * 可動範囲(135〜345)は、車の胴体半幅50を足した実際の可動フットプリント(85〜395)が
 * 外壁の内側面(x=15/465)からそれぞれ70px以上離れるように選んである
 * （ボール直径48px+16pxの安全マージンより広い。carBoard.test.tsで検証）。
 * 3台は速さと最初の向き・位置をずらし、上下の車がそろって同じ動きにならないようにする。
 */
const CAR_RADIUS = 60
const CAR_TAP_RADIUS = 70
const CAR_LEFT_X = 135
const CAR_RIGHT_X = 345
const [ROAD_TOP_Y, ROAD_MIDDLE_Y, ROAD_BOTTOM_Y] = CAR_ROAD_YS

const TOYS: readonly ToyPlacement[] = [
  {
    id: 'toy-car-road',
    kind: 'car',
    x: CAR_LEFT_X,
    y: ROAD_TOP_Y,
    radius: CAR_RADIUS,
    tapRadius: CAR_TAP_RADIUS,
    labelJa: 'はしる あかい くるま',
    car: { leftX: CAR_LEFT_X, rightX: CAR_RIGHT_X, speed: 2.0, initialDirection: 1, variant: 'sedan' },
  },
  {
    id: 'toy-car-bus',
    kind: 'car',
    x: CAR_RIGHT_X,
    y: ROAD_MIDDLE_Y,
    radius: CAR_RADIUS,
    tapRadius: CAR_TAP_RADIUS,
    labelJa: 'はしる バス',
    car: { leftX: CAR_LEFT_X, rightX: CAR_RIGHT_X, speed: 1.5, initialDirection: -1, variant: 'bus' },
  },
  {
    id: 'toy-car-police',
    kind: 'car',
    x: (CAR_LEFT_X + CAR_RIGHT_X) / 2,
    y: ROAD_BOTTOM_Y,
    radius: CAR_RADIUS,
    tapRadius: CAR_TAP_RADIUS,
    labelJa: 'はしる パトカー',
    car: { leftX: CAR_LEFT_X, rightX: CAR_RIGHT_X, speed: 2.5, initialDirection: 1, variant: 'police' },
  },
]

// --- 射出パラメータ ----------------------------------------------------------

/**
 * 射出口・初速レンジは通常盤面と同じにする。くるまテーマらしさは盤面配置（車toy・
 * 道路）だけで作るため、射出の時点で差を付けない。
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
