import { BOARD_WIDTH, BOARD_HEIGHT } from '../boardLayout'
import type { CircleObstacle, CornerEscapeZone, WallSegment } from '../boardLayout'
import type { ToyPlacement } from '../toyLayout'
import type { BoardConfig, LaunchConfig } from './types'

/**
 * 海テーマ（ocean）専用の盤面配置。Phase Cで通常盤面（normalBoard）から切り離し、
 * 「波や潮に流されながら、右→左→右と大きく蛇行して落ちていく盤面」を狙って作り直した。
 * 宇宙テーマ（重力に振り回される上下運動が主役）とは違い、海テーマは
 * 「斜面を滑る→シーソーで進路が変わる→潮流toyに押される」という横方向の移動を主役にする。
 * 自由落下区間をできるだけ減らすため、盤面上部からゴール手前まで、
 * 4枚の長い斜めガイド壁（S字2枚＋シーソー下の受け2枚）でほぼ隙間なくボールを受け続ける構成にしている。
 *
 * 配置は座標を決め打ちで終わらせず、pinballSimulation.ts のヘッドレスシミュレーションを
 * 数百試行流して安全タイマーに頼らず完了することを確認しながら調整した。特に、
 * 「静的な壁同士・壁と障害物・障害物とtoyの間にボール直径ぶんの余裕（隙間64px以上）がないと、
 * 幾何学的にボールが動けなくなる一点が生まれる」という罠が、斜めガイド壁の端点同士や
 * 壁の端点と外壁の間、押し出しtoyと外壁の間など、盤面のあちこちで再現した。
 * 通常盤面のCORNER_ESCAPE_ZONES（射出ガイド壁と外壁の隅）と同種の問題で、
 * ここでは壁の座標そのものを調整して隙間を作ることで解決している。
 */

// --- 障害物（バンパー・ピン） -----------------------------------------------

const PEG_RADIUS = 9
const PEG_RESTITUTION = 0.85

/**
 * 通常盤面（34個）よりずっと少ない8個に絞る。海テーマは「密なピンで散らす」のではなく
 * 「斜面＋シーソー＋潮流toyで流れそのものを変える」ことを主役にするため、障害物は
 * 「同じ経路に固定させないための軽い散らし役」に留める（宇宙盤面と同じ考え方）。
 * 斜めガイド壁・外壁・他の障害物との間隔は oceanBoard.test.ts で検証する。
 */
const OBSTACLES: readonly CircleObstacle[] = [
  // 上部: 斜めガイドA（y=183〜277）へ乗る前に軽く散らす2本のピン。
  { id: 'peg-ocean-top-left', kind: 'peg', x: 170, y: 118, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-ocean-top-right', kind: 'peg', x: 340, y: 150, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },

  // 上〜中央: 斜めガイドAの終点付近とガイドBの起点付近のあいだの空間にあるピン1本。
  // 流れを少し崩し、「毎回同じルートで滑るだけ」にならないようにする。
  // バンパーにすると外壁・斜めガイド双方への必要間隔（64px）を同時に満たせなかったため、
  // 半径の小さいピンにしている。
  { id: 'peg-ocean-upper-right', kind: 'peg', x: 388, y: 265, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },

  // 中央: 斜めガイドAとガイドBのどちらからも十分離れた散らしピン1本。シーソーへ乗る位置を
  // 毎回変える。
  { id: 'peg-ocean-mid', kind: 'peg', x: 170, y: 340, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },

  // シーソーの右下、斜めガイドBから十分離れた位置にあるピン1本。潮流toy(右向き)の近くで
  // 軽く流れを崩す役目。左側対称の位置は壁際の狭いポケットで挟まりの罠を作りやすいことが
  // 実機シミュレーションで分かったため、対になるピンは置かず斜めガイドCと外壁だけで受ける。
  { id: 'peg-ocean-lower-right', kind: 'peg', x: 445, y: 570, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },

  // ゴール手前: 軽い千鳥ピンで最終的な着地位置を散らす（5得点ゾーンすべてに届かせる）。
  // 斜めガイドC（左右ともy<=690付近まで）より下、ゾーン仕切り(ZONE_DIVIDERS、y>=ZONE_TOP=875)
  // より十分上に置く。ピンのすぐそばで静止したボールの下端がゾーン仕切りへ届いて挟まる罠を
  // 作らないよう、y + radius + BALL_RADIUS*2 < 875 を満たす y<=818 の範囲に収めてある。
  { id: 'peg-ocean-goal-1', kind: 'peg', x: 240, y: 810, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-ocean-goal-2', kind: 'peg', x: 150, y: 810, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-ocean-goal-3', kind: 'peg', x: 330, y: 810, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
]

// --- 壁 --------------------------------------------------------------------

const WALL_THICKNESS = 30
const GUIDE_WALL_THICKNESS = 16
const GUIDE_WALL_LENGTH = 180
const GUIDE_WALL_ANGLE = 0.45
const WALL_RESTITUTION = 0.65

/**
 * S字を作る4枚の長い斜めガイド壁。通常盤面の千鳥ピンの代わりに、この4枚で
 * 「右→左→(シーソーで再分岐)→右」の大きな横断を作り、自由落下区間を減らす。
 * 隣り合う壁同士・壁の端点と外壁は、ボール直径ぶん以上の間隔を空け、
 * 2枚（または壁と壁）が交わる鋭角の隙間（挟まりの罠）を作らない
 * （宇宙盤面のRAMP A/Bと同じ考え方。oceanBoard.test.ts で検証）。
 */
const RAMP_THICKNESS = 16
const RAMP_A_LENGTH = 240
const RAMP_B_LENGTH = 230
const RAMP_C_LEFT_LENGTH = 110
const RAMP_C_RIGHT_LENGTH = 110
const RAMP_RESTITUTION = 0.55

const WALLS: readonly WallSegment[] = [
  // 外壁・上壁・射出ガイド壁は通常盤面と同じ（安定動作が確認済みの形状のため変更しない）。
  { id: 'wall-left', x: 0, y: BOARD_HEIGHT / 2, width: WALL_THICKNESS, height: BOARD_HEIGHT, angle: 0, restitution: WALL_RESTITUTION },
  { id: 'wall-right', x: BOARD_WIDTH, y: BOARD_HEIGHT / 2, width: WALL_THICKNESS, height: BOARD_HEIGHT, angle: 0, restitution: WALL_RESTITUTION },
  { id: 'wall-top', x: BOARD_WIDTH / 2, y: 0, width: BOARD_WIDTH, height: WALL_THICKNESS, angle: 0, restitution: WALL_RESTITUTION },
  { id: 'wall-guide-left', x: 110, y: 105, width: GUIDE_WALL_LENGTH, height: GUIDE_WALL_THICKNESS, angle: -GUIDE_WALL_ANGLE, restitution: WALL_RESTITUTION },
  { id: 'wall-guide-right', x: BOARD_WIDTH - 110, y: 105, width: GUIDE_WALL_LENGTH, height: GUIDE_WALL_THICKNESS, angle: GUIDE_WALL_ANGLE, restitution: WALL_RESTITUTION },
  { id: 'wall-bottom', x: BOARD_WIDTH / 2, y: BOARD_HEIGHT, width: BOARD_WIDTH, height: WALL_THICKNESS, angle: 0, restitution: WALL_RESTITUTION },

  // 斜めガイドA（"\"形）: 射出直後、盤面の左寄りから右下へ大きく渡す（1回目の横断: 右へ）。
  // 端点は概ね(89.5,183.3)〜(310.5,276.7)。
  { id: 'wall-ocean-ramp-a', x: 200, y: 230, width: RAMP_A_LENGTH, height: RAMP_THICKNESS, angle: 0.4, restitution: RAMP_RESTITUTION },
  // 斜めガイドB（"/"形）: Aで右へ渡ったボールを左下へ戻す（2回目の横断: 左へ）。
  // 端点は概ね(179.5,449.9)〜(386.5,350.1)。シーソーの左寄りへ落ちるよう終点を合わせている。
  { id: 'wall-ocean-ramp-b', x: 283, y: 400, width: RAMP_B_LENGTH, height: RAMP_THICKNESS, angle: -0.45, restitution: RAMP_RESTITUTION },
  // 斜めガイドC-左（"\"形）: シーソーの左側から抜けたボールを受け、右下へ送る。
  // 端点は概ね(99.3,678.6)〜(200.7,721.4)。
  { id: 'wall-ocean-ramp-c-left', x: 150, y: 700, width: RAMP_C_LEFT_LENGTH, height: RAMP_THICKNESS, angle: 0.4, restitution: RAMP_RESTITUTION },
  // 斜めガイドC-右（"/"形）: シーソーの右側から抜けたボールを受け、左下へ送る（3回目の横断: 左へ）。
  // C-左とはxもyもずらし、2枚の端点同士が接近しないよう十分離す
  // （oceanBoard.test.ts で2枚の最短距離を検証）。
  // 端点は概ね(289.3,721.4)〜(390.7,678.6)。
  { id: 'wall-ocean-ramp-c-right', x: 340, y: 700, width: RAMP_C_RIGHT_LENGTH, height: RAMP_THICKNESS, angle: -0.4, restitution: RAMP_RESTITUTION },
]

/** 射出ガイド壁と外壁が挟む隅は通常盤面と同じ壁形状のまま残るため、同じ座標のすり抜けゾーンを使う。 */
const CORNER_ESCAPE_ZONES: readonly CornerEscapeZone[] = [
  { x: 38.8, y: 104, radius: 14, toX: 55, toY: 170 },
  { x: BOARD_WIDTH - 38.8, y: 104, radius: 14, toX: BOARD_WIDTH - 55, toY: 170 },
]

// --- おもちゃ ----------------------------------------------------------------

/**
 * シーソーtoy。海テーマの見せ場として盤面中央付近（斜めガイドBの終点付近）に置く。
 * 左右どちらから来たボールも板の上に乗って傾き、反対方向または下方向へ送り出す。
 * 半長95（板全長190）は、外壁からも他の障害物からも十分な間隔を確保できる値
 * （oceanBoard.test.ts で全障害物・壁との間隔を検証）。
 */
const SEESAW_RADIUS = 95
const SEESAW_TAP_RADIUS = 110

/**
 * 押し出しtoy（launcher）を「潮流」として2個配置する。タップされたときだけ働く点は
 * 他テーマと同じだが、launcherTide設定により上向きの勢いを弱め、横方向の勢いを強めて
 * 「打ち上げる」感触ではなく「押し流す」感触にしている（通常テーマのlauncherToy挙動には
 * launcherTideが未指定のときは一切影響しない）。
 * 潮流A（右向き）は斜めガイドBの下・シーソーの右上に置き、シーソーへ向かう／右へ抜けた
 * ボールをさらに右へ後押しする。潮流B（左向き）はその左右対称の位置に置き、逆向きに
 * 後押しする。どちらも100%その方向へ押すわけではなく、当たり方やタイミングによって
 * 潮に乗る／外れる の両方が起こる（launcherToy.tsのTIDE_BIAS_PROBABILITY参照）。
 *
 * upSpeedScaleを0.15まで弱めているのは、100ms間隔の連打を480試行規模で繰り返し
 * ヘッドレスシミュレーションした結果。0.5前後だと、常時「発動中」になったtoyの
 * 作用範囲にボールが戻ってくるたびに何度も打ち上げられ、斜めガイドA/Bの間を
 * 行ったり来たりし続けて安全タイマーに達する試行がまれに（1%未満だが通常・宇宙盤面の
 * 同条件での発生率よりはっきり高く）発生した。上向きを弱め、代わりに
 * horizontalSpeedScaleを4.0まで上げて毎回のタップで横方向へしっかり逃がすことで、
 * 発生率を通常・宇宙盤面と同程度（480試行中0件）まで下げている。
 */
const TIDE_LAUNCHER_RADIUS = 16
const TIDE_LAUNCHER_TAP_RADIUS = 58

const TOYS: readonly ToyPlacement[] = [
  {
    id: 'toy-ocean-seesaw',
    kind: 'seesaw',
    x: BOARD_WIDTH / 2,
    y: 570,
    radius: SEESAW_RADIUS,
    tapRadius: SEESAW_TAP_RADIUS,
    labelJa: 'シーソー おもちゃ',
  },
  {
    id: 'toy-ocean-tide-right',
    kind: 'launcher',
    x: 383,
    y: 460,
    radius: TIDE_LAUNCHER_RADIUS,
    tapRadius: TIDE_LAUNCHER_TAP_RADIUS,
    labelJa: 'しおの ながれ（みぎむき）',
    launcherTide: { biasDirection: 1, upSpeedScale: 0.15, horizontalSpeedScale: 4.0 },
  },
  {
    id: 'toy-ocean-tide-left',
    kind: 'launcher',
    x: 97,
    y: 460,
    radius: TIDE_LAUNCHER_RADIUS,
    tapRadius: TIDE_LAUNCHER_TAP_RADIUS,
    labelJa: 'しおの ながれ（ひだりむき）',
    launcherTide: { biasDirection: -1, upSpeedScale: 0.15, horizontalSpeedScale: 4.0 },
  },
]

// --- 射出パラメータ ----------------------------------------------------------

/**
 * 射出口・初速レンジは通常盤面と同じにする。海テーマの横方向の動きは
 * 盤面配置（斜めガイド・シーソー・潮流toy）だけで作るため、射出の時点で差を付けない。
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

export const oceanBoard: BoardConfig = {
  obstacles: OBSTACLES,
  walls: WALLS,
  cornerEscapeZones: CORNER_ESCAPE_ZONES,
  toys: TOYS,
  launch: LAUNCH,
}
