import { BOARD_WIDTH, BOARD_HEIGHT } from '../boardLayout'
import type { CircleObstacle, CornerEscapeZone, WallSegment } from '../boardLayout'
import type { ToyPlacement } from '../toyLayout'
import type { BoardConfig, LaunchConfig } from './types'

/**
 * おかしテーマ（candy）専用の盤面配置。Phase Dで通常盤面（normalBoard）から切り離し、
 * 「お菓子の遊園地みたいに、いろいろなものに当たりながら方向が次々変わる盤面」を狙って
 * 作り直した。宇宙テーマ（重力に振り回される大ジャンプ中心）・海テーマ（大きく蛇行する
 * 横方向の動き中心）とは違い、おかしテーマは「ピンに当たる→バンパーに弾かれる→
 * 回転toyに巻き込まれる→ハンマーtoyに叩かれる→短いガイド板で進路が変わる」という
 * 細かい方向転換が何度も起こることを主役にする。
 *
 * 障害物そのものの個数（19個）は通常盤面（34個）より少ないが、バンパー7個（通常盤面は3個）・
 * 短いガイド板4枚（通常盤面は0枚）・toy2個（ハンマー＋回転）を組み合わせることで、
 * 「1回あたりの当たり方の種類・強さの多さ」で通常・宇宙・海より賑やかな体感を作っている。
 * 当初はピンをもっと多く（30個超）詰め込む案で作り始めたが、pinballSimulation.ts の
 * ヘッドレスシミュレーションで大量の停滞（安全タイマー到達）が再現し、原因を追うと
 * 「バンパー・ピンを外壁へ寄せすぎると、壁との間のくぼみにボールが挟まって停滞ナッジでも
 * 抜けられなくなる罠ができる」という、宇宙盤面の設計時に見つかったのと同種の問題だった
 * （詳しくは各障害物近くのコメントを参照）。密度よりもこの罠を避けることを優先し、
 * 障害物同士は通常盤面と同じ「半径の和 + ボール直径 + 16px」以上の余裕を確保しつつ
 * （candyBoard.test.ts で検証）、外壁に近い障害物はこの最小余裕よりさらに離してある。
 */

// --- 障害物（バンパー・ピン） -----------------------------------------------

const BUMPER_RADIUS = 22
const SMALL_BUMPER_RADIUS = 17
const BUMPER_RESTITUTION = 0.98
const PEG_RADIUS = 8
const PEG_RESTITUTION = 0.9
/** ゴール直上バンパーの半径。中央の1000点ゾーンへ抜ける隙間を残すため、他のバンパーより小さくする。 */
const GOAL_BUMPER_RADIUS = 14

const OBSTACLES: readonly CircleObstacle[] = [
  // 上部（y≈175）: ドーナツ風の中央バンパー。射出直後のボールを弱く左右へ振り分ける。
  { id: 'bumper-candy-donut', kind: 'bumper', x: BOARD_WIDTH / 2, y: 175, radius: BUMPER_RADIUS, restitution: BUMPER_RESTITUTION },

  // 上〜中央（y≈295〜345）: 短いガイド板（wall-candy-guide-top-*）で中央へ寄せたボールを、
  // 中央バンパー(◎)と左右のピンで再び弾き散らす「少しカオスなエリア」。
  { id: 'peg-candy-upper-left', kind: 'peg', x: 95, y: 295, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'bumper-candy-center', kind: 'bumper', x: BOARD_WIDTH / 2, y: 305, radius: BUMPER_RADIUS, restitution: BUMPER_RESTITUTION },
  { id: 'peg-candy-upper-right', kind: 'peg', x: 385, y: 295, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },

  // 回転toy（🍭、y≈415）の左右。回転している羽根に巻き込まれつつ、外へ抜けたボールを受ける。
  { id: 'peg-candy-spinner-left', kind: 'peg', x: 95, y: 400, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-candy-spinner-right', kind: 'peg', x: 385, y: 400, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },

  // 回転toyの下、ハンマー(🔨、y≈565)の上。左右のバンパーで、
  // ハンマーへ入る前にもう一度方向をばらつかせる。xは外壁から十分離してある
  // （半径17のバンパーをx=60付近まで外壁へ寄せたところ、壁とバンパーの間のくぼみに
  // ボールがはまり込み、停滞ナッジでも抜けられなくなる罠が実機シミュレーションで再現した。
  // spaceBoardの惑星バンパーと同じ問題で、x=100まで離すことで解消している）。
  { id: 'bumper-candy-mid-left', kind: 'bumper', x: 100, y: 505, radius: SMALL_BUMPER_RADIUS, restitution: BUMPER_RESTITUTION },
  { id: 'bumper-candy-mid-right', kind: 'bumper', x: 380, y: 505, radius: SMALL_BUMPER_RADIUS, restitution: BUMPER_RESTITUTION },

  // ハンマーの左右（y≈600）。ハンマーへ当たらなかったボールを軽く受けて、次の段へ渡す。
  { id: 'peg-candy-hammer-left', kind: 'peg', x: 110, y: 600, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-candy-hammer-right', kind: 'peg', x: 370, y: 600, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },

  // ハンマーの下（y≈705）。短いガイド板（wall-candy-guide-lower-*）の手前で、
  // もう一度左右へ散らす。
  { id: 'peg-candy-lower-left', kind: 'peg', x: 190, y: 705, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-candy-lower-right', kind: 'peg', x: 290, y: 705, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  // 上のbumper-candy-midと同じ理由で外壁から十分離してある。
  { id: 'bumper-candy-lower-left', kind: 'bumper', x: 110, y: 758, radius: SMALL_BUMPER_RADIUS, restitution: BUMPER_RESTITUTION },
  { id: 'bumper-candy-lower-right', kind: 'bumper', x: 370, y: 758, radius: SMALL_BUMPER_RADIUS, restitution: BUMPER_RESTITUTION },

  // ゴール手前（y≈810〜866）。ゴール直上バンパー(◎)と軽い千鳥ピンで最終的な着地位置を散らし、
  // 5ゾーンすべてに現実的な到達経路を作る。外側の2本（row2-left/right）も同じ理由で
  // 外壁からの距離を確保している（ピンでも半径8+ボール直径48の分だけ外壁に近いと同様の罠になる）。
  { id: 'bumper-candy-goal', kind: 'bumper', x: BOARD_WIDTH / 2, y: 810, radius: GOAL_BUMPER_RADIUS, restitution: BUMPER_RESTITUTION },
  { id: 'peg-candy-goal-row2-left', kind: 'peg', x: 78, y: 866, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-candy-goal-row2-mid-left', kind: 'peg', x: 165, y: 866, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-candy-goal-row2-mid-right', kind: 'peg', x: 315, y: 866, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-candy-goal-row2-right', kind: 'peg', x: 402, y: 866, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
]

// --- 壁 --------------------------------------------------------------------

const WALL_THICKNESS = 30
const GUIDE_WALL_THICKNESS = 16
const GUIDE_WALL_LENGTH = 180
const GUIDE_WALL_ANGLE = 0.45
const WALL_RESTITUTION = 0.65

/**
 * 短いガイド板（4枚）。宇宙・海テーマの長い斜めガイド壁とは違い、盤面を大きく横断させる
 * ためではなく、「当たった位置によって左右どちらにも進みうる」細かい方向転換を作るための
 * 短い板にしてある。上の2枚は内向き（中央バンパーへ寄せる）、下の2枚は外向き
 * （中央から左右へ再び散らす）で、互いに十分離してあり交わる隙間（挟まりの罠）を作らない。
 */
const SHORT_GUIDE_THICKNESS = 14
const SHORT_GUIDE_LENGTH = 90
const SHORT_GUIDE_ANGLE = 0.55
const SHORT_GUIDE_RESTITUTION = 0.6

const WALLS: readonly WallSegment[] = [
  // 外壁・上壁・射出ガイド壁は通常盤面と同じ（安定動作が確認済みの形状のため変更しない）。
  { id: 'wall-left', x: 0, y: BOARD_HEIGHT / 2, width: WALL_THICKNESS, height: BOARD_HEIGHT, angle: 0, restitution: WALL_RESTITUTION },
  { id: 'wall-right', x: BOARD_WIDTH, y: BOARD_HEIGHT / 2, width: WALL_THICKNESS, height: BOARD_HEIGHT, angle: 0, restitution: WALL_RESTITUTION },
  { id: 'wall-top', x: BOARD_WIDTH / 2, y: 0, width: BOARD_WIDTH, height: WALL_THICKNESS, angle: 0, restitution: WALL_RESTITUTION },
  { id: 'wall-guide-left', x: 110, y: 105, width: GUIDE_WALL_LENGTH, height: GUIDE_WALL_THICKNESS, angle: -GUIDE_WALL_ANGLE, restitution: WALL_RESTITUTION },
  { id: 'wall-guide-right', x: BOARD_WIDTH - 110, y: 105, width: GUIDE_WALL_LENGTH, height: GUIDE_WALL_THICKNESS, angle: GUIDE_WALL_ANGLE, restitution: WALL_RESTITUTION },
  { id: 'wall-bottom', x: BOARD_WIDTH / 2, y: BOARD_HEIGHT, width: BOARD_WIDTH, height: WALL_THICKNESS, angle: 0, restitution: WALL_RESTITUTION },

  // 上部の短いガイド板（"＼   ／"）。内向きに倒し、外側へ広がったボールを中央バンパーへ寄せる。
  { id: 'wall-candy-guide-top-left', x: 130, y: 230, width: SHORT_GUIDE_LENGTH, height: SHORT_GUIDE_THICKNESS, angle: SHORT_GUIDE_ANGLE, restitution: SHORT_GUIDE_RESTITUTION },
  { id: 'wall-candy-guide-top-right', x: BOARD_WIDTH - 130, y: 230, width: SHORT_GUIDE_LENGTH, height: SHORT_GUIDE_THICKNESS, angle: -SHORT_GUIDE_ANGLE, restitution: SHORT_GUIDE_RESTITUTION },

  // 下部の短いガイド板（"／   ＼"）。外向きに倒し、ハンマー下を抜けたボールを再び左右へ散らす。
  { id: 'wall-candy-guide-lower-left', x: 130, y: 690, width: SHORT_GUIDE_LENGTH, height: SHORT_GUIDE_THICKNESS, angle: -SHORT_GUIDE_ANGLE, restitution: SHORT_GUIDE_RESTITUTION },
  { id: 'wall-candy-guide-lower-right', x: BOARD_WIDTH - 130, y: 690, width: SHORT_GUIDE_LENGTH, height: SHORT_GUIDE_THICKNESS, angle: SHORT_GUIDE_ANGLE, restitution: SHORT_GUIDE_RESTITUTION },
]

/** 射出ガイド壁と外壁が挟む隅は通常盤面と同じ壁形状のまま残るため、同じ座標のすり抜けゾーンを使う。 */
const CORNER_ESCAPE_ZONES: readonly CornerEscapeZone[] = [
  { x: 38.8, y: 104, radius: 14, toX: 55, toY: 170 },
  { x: BOARD_WIDTH - 38.8, y: 104, radius: 14, toX: BOARD_WIDTH - 55, toY: 170 },
]

// --- おもちゃ ----------------------------------------------------------------

/**
 * 回転おもちゃ1個を「ペロペロキャンディ」として、上部のカオスエリアとハンマーの間に置く。
 * 通常盤面のように左右対称2個は置かず、ハンマーを主役にするため1個だけにする
 * （宇宙盤面が人工衛星を1個だけにしたのと同じ考え方）。
 */
const SPINNER_RADIUS = 36
const SPINNER_TAP_RADIUS = 56

/**
 * ハンマーtoy。おかしテーマの見せ場として盤面中央、回転toyとゴール手前のちょうど中間に置く。
 * 上から落ちてきたボールが遭遇しやすい位置だが、短いガイド板やピンで左右へ逃げた
 * ボールはハンマーに当たらずに通過することもある（全ルートを強制しない）。
 */
const HAMMER_RADIUS = 50
const HAMMER_TAP_RADIUS = 66

const TOYS: readonly ToyPlacement[] = [
  {
    id: 'toy-candy-spinner',
    kind: 'spinner',
    x: BOARD_WIDTH / 2,
    y: 415,
    radius: SPINNER_RADIUS,
    tapRadius: SPINNER_TAP_RADIUS,
    labelJa: 'ペロペロキャンディ おもちゃ',
  },
  {
    id: 'toy-candy-hammer',
    kind: 'hammer',
    x: BOARD_WIDTH / 2,
    y: 565,
    radius: HAMMER_RADIUS,
    tapRadius: HAMMER_TAP_RADIUS,
    labelJa: 'キャンディハンマー おもちゃ',
  },
]

// --- 射出パラメータ ----------------------------------------------------------

/**
 * 射出口・初速レンジは通常盤面と同じにする。おかしテーマの「わちゃわちゃ感」は
 * 盤面配置（密な障害物・短いガイド・ハンマー）だけで作るため、射出の時点で差を付けない。
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

export const candyBoard: BoardConfig = {
  obstacles: OBSTACLES,
  walls: WALLS,
  cornerEscapeZones: CORNER_ESCAPE_ZONES,
  toys: TOYS,
  launch: LAUNCH,
}
