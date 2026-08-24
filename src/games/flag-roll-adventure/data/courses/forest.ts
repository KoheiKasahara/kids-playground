import {
  AREA_COLUMN_STEP,
  AREA_ENTRY_CLEARANCE,
  AREA_HEIGHT,
  AREA_WIDTH,
  BALL_RADIUS,
  EXIT_CENTER_OFFSET_FROM_BOTTOM,
  EXIT_SENSOR_HEIGHT,
  FOREST_EXIT_WIDTH,
  FOREST_LEFT_EXIT_X,
  FOREST_RIGHT_EXIT_X,
  PORTAL_FLOOR_HEIGHT,
  WALL_RESTITUTION,
} from '../../adventurePhysics'
import { floorRamp } from '../courseKit'
import type { AdventureArea } from '../../types'

const ENTRY_Y = AREA_ENTRY_CLEARANCE + BALL_RADIUS
const EXIT_Y = AREA_HEIGHT - EXIT_CENTER_OFFSET_FROM_BOTTOM
const PORTAL_SIZE = { width: FOREST_EXIT_WIDTH, height: EXIT_SENSOR_HEIGHT }
// 丸太の重さは残しつつ、真上で速度を失った球がピンの頂点に留まらない反発にする。
const FOREST_PIN_RESTITUTION = 0.82


/** 森の基礎帯。後段で枝板と分岐前の署名障害物を足して左右の選択を強める。 */
const gridObjects = [
  // 80pxピッチの千鳥骨格。壁ぎわは蹴り出し板が受け持ち、素通りの縦帯を残さない。
  { kind: 'wall' as const, id: 'forest-r1-kl', x: 45.597, y: 152, width: 84, height: 12, angle: 0.34 },
  { kind: 'pin' as const, id: 'forest-r1-1', x: 156, y: 152, radius: 9, restitution: FOREST_PIN_RESTITUTION },
  { kind: 'pin' as const, id: 'forest-r1-2', x: 234, y: 152, radius: 9, restitution: FOREST_PIN_RESTITUTION },
  { kind: 'pin' as const, id: 'forest-r1-3', x: 312, y: 152, radius: 9, restitution: FOREST_PIN_RESTITUTION },
  { kind: 'wall' as const, id: 'forest-r1-kr', x: 434.403, y: 152, width: 84, height: 12, angle: -0.34 },
  { kind: 'pin' as const, id: 'forest-r2-1', x: 117, y: 232, radius: 9, restitution: FOREST_PIN_RESTITUTION },
  { kind: 'pin' as const, id: 'forest-r2-2', x: 195, y: 232, radius: 9, restitution: FOREST_PIN_RESTITUTION },
  { kind: 'pin' as const, id: 'forest-r2-3', x: 273, y: 232, radius: 9, restitution: FOREST_PIN_RESTITUTION },
  { kind: 'pin' as const, id: 'forest-r2-4', x: 351, y: 232, radius: 9, restitution: FOREST_PIN_RESTITUTION },
  { kind: 'wall' as const, id: 'forest-r3-kl', x: 45.597, y: 312, width: 84, height: 12, angle: 0.34 },
  { kind: 'pin' as const, id: 'forest-r3-1', x: 156, y: 312, radius: 9, restitution: FOREST_PIN_RESTITUTION },
  { kind: 'pin' as const, id: 'forest-r3-2', x: 234, y: 312, radius: 9, restitution: FOREST_PIN_RESTITUTION },
  { kind: 'pin' as const, id: 'forest-r3-3', x: 312, y: 312, radius: 9, restitution: FOREST_PIN_RESTITUTION },
  { kind: 'wall' as const, id: 'forest-r3-kr', x: 434.403, y: 312, width: 84, height: 12, angle: -0.34 },
  { kind: 'pin' as const, id: 'forest-r4-1', x: 117, y: 392, radius: 9, restitution: FOREST_PIN_RESTITUTION },
  { kind: 'pin' as const, id: 'forest-r4-2', x: 195, y: 392, radius: 9, restitution: FOREST_PIN_RESTITUTION },
  { kind: 'pin' as const, id: 'forest-r4-3', x: 273, y: 392, radius: 9, restitution: FOREST_PIN_RESTITUTION },
  { kind: 'pin' as const, id: 'forest-r4-4', x: 351, y: 392, radius: 9, restitution: FOREST_PIN_RESTITUTION },
  { kind: 'wall' as const, id: 'forest-r5-kl', x: 45.597, y: 472, width: 84, height: 12, angle: 0.34 },
  { kind: 'pin' as const, id: 'forest-r5-1', x: 156, y: 472, radius: 9, restitution: FOREST_PIN_RESTITUTION },
  { kind: 'pin' as const, id: 'forest-r5-3', x: 312, y: 472, radius: 9, restitution: FOREST_PIN_RESTITUTION },
  { kind: 'wall' as const, id: 'forest-r5-kr', x: 434.403, y: 472, width: 84, height: 12, angle: -0.34 },
  { kind: 'pin' as const, id: 'forest-r6-1', x: 117, y: 552, radius: 9, restitution: FOREST_PIN_RESTITUTION },
  { kind: 'pin' as const, id: 'forest-r6-4', x: 351, y: 552, radius: 9, restitution: FOREST_PIN_RESTITUTION },
  { kind: 'pin' as const, id: 'forest-r7-1', x: 156, y: 632, radius: 9, restitution: FOREST_PIN_RESTITUTION },
  { kind: 'pin' as const, id: 'forest-patch-1', x: 320, y: 625, radius: 10, restitution: FOREST_PIN_RESTITUTION },
  { kind: 'pin' as const, id: 'forest-patch-2', x: 12, y: 560, radius: 10, restitution: FOREST_PIN_RESTITUTION },
  { kind: 'pin' as const, id: 'forest-patch-3', x: 464, y: 560, radius: 10, restitution: FOREST_PIN_RESTITUTION },
  // 左右の外側の床帯は出口開口へ下り、中央の床帯は二つの出口の間の尾根として残す。
  floorRamp({ id: 'forest-left-exit-guide', side: 'left', openingEdgeX: FOREST_LEFT_EXIT_X - FOREST_EXIT_WIDTH / 2, floorTop: AREA_HEIGHT - PORTAL_FLOOR_HEIGHT, rise: 44, restitution: WALL_RESTITUTION }),
  floorRamp({ id: 'forest-right-exit-guide', side: 'right', openingEdgeX: FOREST_RIGHT_EXIT_X + FOREST_EXIT_WIDTH / 2, floorTop: AREA_HEIGHT - PORTAL_FLOOR_HEIGHT, rise: 44, restitution: WALL_RESTITUTION }),
]

export const forestArea: AdventureArea = {
  id: 'forest',
  nameJa: 'もり',
  theme: 'forest',
  gravityScale: 1,
  origin: { x: AREA_COLUMN_STEP, y: AREA_HEIGHT },
  entries: [{ id: 'forest-entry', kind: 'hole', x: AREA_WIDTH / 2, y: ENTRY_Y }],
  objects: gridObjects,
  toys: [
    {
      kind: 'lifter',
      id: 'forest-mushroom-spring',
      x: 240,
      // 直上の千鳥列から落ちる球を拾えるよう、確定値から5pxだけ上へ寄せる。
      y: 560,
      // 木の実列の間隔を保ったまま、落下球を拾う面だけを1px広げる。
      radius: 33,
      upSpeed: 10.5,
      cooldownMs: 900,
    },
  ],
  exits: [
    {
      id: 'forest-to-cave',
      kind: 'tunnel',
      x: 130,
      y: EXIT_Y,
      ...PORTAL_SIZE,
      to: 'cave',
      toEntry: 'cave-entry',
    },
    {
      id: 'forest-to-river',
      kind: 'hole',
      x: 350,
      y: EXIT_Y,
      ...PORTAL_SIZE,
      to: 'river',
      toEntry: 'river-entry',
    },
  ],
}
