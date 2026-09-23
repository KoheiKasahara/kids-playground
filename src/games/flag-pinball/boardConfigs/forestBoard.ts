import { BOARD_WIDTH, BOARD_HEIGHT } from '../boardLayout'
import type { CircleObstacle, CornerEscapeZone, WallSegment } from '../boardLayout'
import type { ToyPlacement } from '../toyLayout'
import type { BoardConfig, LaunchConfig } from './types'

/**
 * もりテーマ（forest）専用の盤面配置。
 * 「きのこのトランポリンでぽーんと跳ねて、まるたのシーソーでごろんと転がる」森の遊び場を狙う。
 * 宇宙盤面ではジャンプ台は1個だけだったが、もり盤面では中央寄りに2個並べ、
 * 上から落ちてきたボールの多くがどちらかのきのこで跳ね上がるようにしている。
 * 跳ね上がったボールは上部のピンで散らされてから盤面中央のまるたシーソーへ落ち、
 * 傾いた板の向きで左右へ転がり分かれる。
 *
 * 外壁・上壁・射出ガイド壁は通常盤面と同じ形状のまま使い、専用の壁は追加しない
 * （斜めの動きはシーソーとジャンプ台だけで作る）。障害物同士は他盤面と同じ
 * 「半径の和 + ボール直径 + 16px」以上の余裕を確保する（forestBoard.test.ts で検証）。
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
  // 上部（y≈180）: りんごのバンパー。射出直後のボールを左右へ振り分ける。
  { id: 'bumper-forest-apple', kind: 'bumper', x: BOARD_WIDTH / 2, y: 180, radius: BUMPER_RADIUS, restitution: BUMPER_RESTITUTION },

  // 上〜中央（y≈270〜290）: 木の実のピン。きのこ（y≈400）で跳ね上がったボールもここで散らされる。
  { id: 'peg-forest-upper-left', kind: 'peg', x: 120, y: 270, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-forest-upper-center', kind: 'peg', x: BOARD_WIDTH / 2, y: 290, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-forest-upper-right', kind: 'peg', x: 360, y: 270, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },

  // シーソー（y≈600）の左右上: シーソーの外側を落ちるボールを軽く受ける。
  { id: 'peg-forest-side-left', kind: 'peg', x: 95, y: 520, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-forest-side-right', kind: 'peg', x: 385, y: 520, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },

  // シーソーの下（y≈740）: 板から転がり落ちたボールをもう一度弾く。
  { id: 'bumper-forest-lower-left', kind: 'bumper', x: 150, y: 740, radius: SMALL_BUMPER_RADIUS, restitution: BUMPER_RESTITUTION },
  { id: 'bumper-forest-lower-right', kind: 'bumper', x: 330, y: 740, radius: SMALL_BUMPER_RADIUS, restitution: BUMPER_RESTITUTION },

  // ゴール手前（y≈800〜866）: ゴール直上バンパーと千鳥ピンで着地位置を散らし、
  // 5ゾーンすべてに現実的な到達経路を作る（おかし盤面と同じ並び）。
  { id: 'bumper-forest-goal', kind: 'bumper', x: BOARD_WIDTH / 2, y: 800, radius: GOAL_BUMPER_RADIUS, restitution: BUMPER_RESTITUTION },
  { id: 'peg-forest-goal-left', kind: 'peg', x: 78, y: 866, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-forest-goal-mid-left', kind: 'peg', x: 165, y: 866, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-forest-goal-mid-right', kind: 'peg', x: 315, y: 866, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
  { id: 'peg-forest-goal-right', kind: 'peg', x: 402, y: 866, radius: PEG_RADIUS, restitution: PEG_RESTITUTION },
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
 * きのこのトランポリン（jumppad）を中央寄りに2個。触れるだけで跳ね上げる常時作動のtoyなので、
 * タップしなくても森らしい「ぽよん」とした動きが毎回起こる。
 * 当初はきのこを外壁寄り（x=130）に置き、2個の間にどんぐりバンパーを挟む案で作ったが、
 * ヘッドレスシミュレーションで「外壁とバンパーに挟まれた区画できのこへ何度も落ち直し、
 * 1回の遊びが40秒近くかかる」試行が出た。バンパーを外してきのこを中央へ寄せると、
 * 跳ね上がったボールが外側へ抜けやすくなり、他盤面と同程度の長さに収まった。
 * 2個の間はボール直径より広く空けてあり、間をすり抜けて直接シーソーへ落ちる経路も残る。
 */
const JUMPPAD_RADIUS = 32
const JUMPPAD_TAP_RADIUS = 58

/**
 * まるたのシーソー。盤面中央、きのこの下に置き、上から落ちてきたボールの重みで傾いて
 * 左右へ転がし分ける。半長95は海盤面のシーソーと同じ。
 */
const SEESAW_RADIUS = 95
const SEESAW_TAP_RADIUS = 110

const TOYS: readonly ToyPlacement[] = [
  {
    id: 'toy-forest-mushroom-left',
    kind: 'jumppad',
    x: 180,
    y: 400,
    radius: JUMPPAD_RADIUS,
    tapRadius: JUMPPAD_TAP_RADIUS,
    labelJa: 'きのこ トランポリン（ひだり）',
  },
  {
    id: 'toy-forest-mushroom-right',
    kind: 'jumppad',
    x: BOARD_WIDTH - 180,
    y: 400,
    radius: JUMPPAD_RADIUS,
    tapRadius: JUMPPAD_TAP_RADIUS,
    labelJa: 'きのこ トランポリン（みぎ）',
  },
  {
    id: 'toy-forest-log-seesaw',
    kind: 'seesaw',
    x: BOARD_WIDTH / 2,
    y: 600,
    radius: SEESAW_RADIUS,
    tapRadius: SEESAW_TAP_RADIUS,
    labelJa: 'まるたの シーソー',
  },
]

// --- 射出パラメータ ----------------------------------------------------------

/**
 * 射出口・初速レンジは通常盤面と同じにする。もりテーマの動きは
 * 盤面配置（きのこ・シーソー）だけで作るため、射出の時点で差を付けない。
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

export const forestBoard: BoardConfig = {
  obstacles: OBSTACLES,
  walls: WALLS,
  cornerEscapeZones: CORNER_ESCAPE_ZONES,
  toys: TOYS,
  launch: LAUNCH,
}
