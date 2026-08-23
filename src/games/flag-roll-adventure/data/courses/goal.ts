import {
  AREA_COLUMN_STEP,
  AREA_ENTRY_CLEARANCE,
  AREA_HEIGHT,
  AREA_WIDTH,
  BALL_RADIUS,
  CUP_INNER_DEPTH,
  CUP_INNER_WIDTH,
  GOAL_CUP_BOTTOM_MARGIN,
  WALL_RESTITUTION,
} from '../../adventurePhysics'
import { floorRamp } from '../courseKit'
import type { AdventureArea } from '../../types'

const ENTRY_Y = AREA_ENTRY_CLEARANCE + BALL_RADIUS
// ゴール上段の小バンパーはカップへ送り続けるため、頂点での静止を防ぐ。
const GOAL_PIN_RESTITUTION = 0.9
/** カップのリム上端。床スロープと cup 定義で同じ値を使う。 */
const CUP_RIM_Y = AREA_HEIGHT - CUP_INNER_DEPTH - GOAL_CUP_BOTTOM_MARGIN


const gridObjects = [
  // 80pxピッチの千鳥骨格。壁ぎわは蹴り出し板が受け持ち、素通りの縦帯を残さない。
  { kind: 'wall' as const, id: 'goal-r1-kl', x: 45.597, y: 152, width: 84, height: 12, angle: 0.34 },
  { kind: 'pin' as const, id: 'goal-r1-1', x: 156, y: 152, radius: 9, restitution: GOAL_PIN_RESTITUTION },
  { kind: 'pin' as const, id: 'goal-r1-2', x: 234, y: 152, radius: 9, restitution: GOAL_PIN_RESTITUTION },
  { kind: 'pin' as const, id: 'goal-r1-3', x: 312, y: 152, radius: 9, restitution: GOAL_PIN_RESTITUTION },
  { kind: 'wall' as const, id: 'goal-r1-kr', x: 434.403, y: 152, width: 84, height: 12, angle: -0.34 },
  { kind: 'pin' as const, id: 'goal-r2-1', x: 117, y: 232, radius: 9, restitution: GOAL_PIN_RESTITUTION },
  { kind: 'pin' as const, id: 'goal-r2-2', x: 195, y: 232, radius: 9, restitution: GOAL_PIN_RESTITUTION },
  { kind: 'pin' as const, id: 'goal-r2-3', x: 273, y: 232, radius: 9, restitution: GOAL_PIN_RESTITUTION },
  { kind: 'pin' as const, id: 'goal-r2-4', x: 351, y: 232, radius: 9, restitution: GOAL_PIN_RESTITUTION },
  { kind: 'wall' as const, id: 'goal-r3-kl', x: 45.597, y: 312, width: 84, height: 12, angle: 0.34 },
  { kind: 'pin' as const, id: 'goal-r3-1', x: 156, y: 312, radius: 9, restitution: GOAL_PIN_RESTITUTION },
  { kind: 'pin' as const, id: 'goal-r3-3', x: 312, y: 312, radius: 9, restitution: GOAL_PIN_RESTITUTION },
  { kind: 'wall' as const, id: 'goal-r3-kr', x: 434.403, y: 312, width: 84, height: 12, angle: -0.34 },
  { kind: 'pin' as const, id: 'goal-r4-1', x: 117, y: 392, radius: 9, restitution: GOAL_PIN_RESTITUTION },
  { kind: 'pin' as const, id: 'goal-r4-4', x: 351, y: 392, radius: 9, restitution: GOAL_PIN_RESTITUTION },
  { kind: 'pin' as const, id: 'goal-r5-1', x: 156, y: 472, radius: 9, restitution: GOAL_PIN_RESTITUTION },
  { kind: 'pin' as const, id: 'goal-r5-3', x: 312, y: 472, radius: 9, restitution: GOAL_PIN_RESTITUTION },
  { kind: 'pin' as const, id: 'goal-patch-1', x: 24, y: 445, radius: 10, restitution: GOAL_PIN_RESTITUTION },
  { kind: 'pin' as const, id: 'goal-patch-2', x: 464, y: 445, radius: 10, restitution: GOAL_PIN_RESTITUTION },
  { kind: 'pin' as const, id: 'goal-patch-3', x: 392, y: 480, radius: 10, restitution: GOAL_PIN_RESTITUTION },
  { kind: 'pin' as const, id: 'goal-patch-4', x: 236, y: 510, radius: 10, restitution: GOAL_PIN_RESTITUTION },
  // カップ口の左右も同じ理由で、リムの高さの床へスロープを重ねてカップへ転がり込ませる。
  floorRamp({ id: 'goal-floor-left', side: 'left', openingEdgeX: AREA_WIDTH / 2 - CUP_INNER_WIDTH / 2, floorTop: CUP_RIM_Y, rise: 48, restitution: WALL_RESTITUTION }),
  floorRamp({ id: 'goal-floor-right', side: 'right', openingEdgeX: AREA_WIDTH / 2 + CUP_INNER_WIDTH / 2, floorTop: CUP_RIM_Y, rise: 48, restitution: WALL_RESTITUTION }),
]

/** ゴールはカップの上端を塞がず、中央の回転Toyから受けへ流す。 */
export const goalArea: AdventureArea = {
  id: 'goal',
  nameJa: 'ゴール',
  theme: 'goal',
  origin: { x: AREA_COLUMN_STEP, y: 4 * AREA_HEIGHT },
  entries: [{ id: 'goal-entry', kind: 'pipe', x: AREA_WIDTH / 2, y: ENTRY_Y }],
  objects: gridObjects,
  toys: [
    {
      kind: 'spinner',
      id: 'goal-spin',
      x: 240,
      y: 380,
      radius: 22,
      angularVelocity: -0.11,
    },
  ],
  exits: [],
  cup: { id: 'goal-cup', x: AREA_WIDTH / 2, rimY: CUP_RIM_Y },
}
