import {
  AREA_COLUMN_STEP,
  AREA_ENTRY_CLEARANCE,
  AREA_HEIGHT,
  AREA_WIDTH,
  BALL_RADIUS,
  BOOST_MAX_SPEED,
  EXIT_SENSOR_HEIGHT,
  EXIT_WIDTH,
  PORTAL_FLOOR_HEIGHT,
  RIVER_JUMP_POWER,
  WALL_RESTITUTION,
} from '../../adventurePhysics'
import { floorRamp } from '../courseKit'
import type { AdventureArea } from '../../types'

const ENTRY_Y = AREA_ENTRY_CLEARANCE + BALL_RADIUS
const PORTAL_SIZE = { width: EXIT_WIDTH, height: EXIT_SENSOR_HEIGHT }
const RIVER_PIN_RESTITUTION = 0.65


const gridObjects = [
  // 80pxピッチの千鳥骨格。壁ぎわは蹴り出し板が受け持ち、素通りの縦帯を残さない。
  { kind: 'wall' as const, id: 'river-r1-kl', x: 45.597, y: 152, width: 84, height: 12, angle: 0.34 },
  { kind: 'pin' as const, id: 'river-r1-1', x: 156, y: 152, radius: 9, restitution: RIVER_PIN_RESTITUTION },
  { kind: 'pin' as const, id: 'river-r1-2', x: 234, y: 152, radius: 9, restitution: RIVER_PIN_RESTITUTION },
  { kind: 'pin' as const, id: 'river-r1-3', x: 312, y: 152, radius: 9, restitution: RIVER_PIN_RESTITUTION },
  { kind: 'wall' as const, id: 'river-r1-kr', x: 434.403, y: 152, width: 84, height: 12, angle: -0.34 },
  { kind: 'pin' as const, id: 'river-r2-1', x: 117, y: 232, radius: 9, restitution: RIVER_PIN_RESTITUTION },
  { kind: 'pin' as const, id: 'river-r2-4', x: 351, y: 232, radius: 9, restitution: RIVER_PIN_RESTITUTION },
  { kind: 'wall' as const, id: 'river-r3-kl', x: 45.597, y: 312, width: 84, height: 12, angle: 0.34 },
  { kind: 'pin' as const, id: 'river-r3-1', x: 156, y: 312, radius: 9, restitution: RIVER_PIN_RESTITUTION },
  { kind: 'pin' as const, id: 'river-r3-3', x: 312, y: 312, radius: 9, restitution: RIVER_PIN_RESTITUTION },
  { kind: 'wall' as const, id: 'river-r3-kr', x: 434.403, y: 312, width: 84, height: 12, angle: -0.34 },
  { kind: 'pin' as const, id: 'river-r4-1', x: 117, y: 392, radius: 9, restitution: RIVER_PIN_RESTITUTION },
  { kind: 'pin' as const, id: 'river-r4-4', x: 351, y: 392, radius: 9, restitution: RIVER_PIN_RESTITUTION },
  { kind: 'wall' as const, id: 'river-r5-kl', x: 45.597, y: 472, width: 84, height: 12, angle: 0.34 },
  { kind: 'pin' as const, id: 'river-r5-1', x: 156, y: 472, radius: 9, restitution: RIVER_PIN_RESTITUTION },
  { kind: 'pin' as const, id: 'river-r5-3', x: 312, y: 472, radius: 9, restitution: RIVER_PIN_RESTITUTION },
  { kind: 'wall' as const, id: 'river-r5-kr', x: 434.403, y: 472, width: 84, height: 12, angle: -0.34 },
  { kind: 'pin' as const, id: 'river-r6-1', x: 117, y: 552, radius: 9, restitution: RIVER_PIN_RESTITUTION },
  { kind: 'pin' as const, id: 'river-patch-1', x: 392, y: 565, radius: 10, restitution: RIVER_PIN_RESTITUTION },
  // 上下2枚のジャンプ台は、川エリアらしい大きな跳ね上げとしてそのまま残す。
  { kind: 'jump' as const, id: 'river-jump-upper', x: 240, y: 232, width: 84, height: 6, angle: -0.34, launchAngle: -2.2, power: RIVER_JUMP_POWER },
  { kind: 'jump' as const, id: 'river-jump-end', x: 240, y: 542, width: 84, height: 6, angle: 0.22, launchAngle: -2.2, power: RIVER_JUMP_POWER },
  // 川の出口は右寄りなので、左右の床をその開口端へ集める。
  floorRamp({ id: 'river-exit-guide-left', side: 'left', openingEdgeX: AREA_WIDTH - 160 - EXIT_WIDTH / 2, floorTop: AREA_HEIGHT - PORTAL_FLOOR_HEIGHT, rise: 48, restitution: WALL_RESTITUTION }),
  floorRamp({ id: 'river-exit-guide-right', side: 'right', openingEdgeX: AREA_WIDTH - 160 + EXIT_WIDTH / 2, floorTop: AREA_HEIGHT - PORTAL_FLOOR_HEIGHT, rise: 48, restitution: WALL_RESTITUTION }),
]

/** 水車・水しぶき、boost、jumpは既存の水エリアの遊び方として維持する。 */
export const riverArea: AdventureArea = {
  id: 'river',
  nameJa: 'かわ',
  theme: 'river',
  origin: { x: 2 * AREA_COLUMN_STEP, y: 2 * AREA_HEIGHT },
  entries: [{ id: 'river-entry', kind: 'hole', x: AREA_WIDTH / 2, y: ENTRY_Y }],
  objects: gridObjects,
  toys: [
    {
      kind: 'spinner',
      id: 'river-wheel',
      x: 240,
      y: 392,
      radius: 28,
      angularVelocity: -0.12,
    },
    {
      kind: 'lifter',
      id: 'river-splash',
      // 下段ジャンプと出口スロープの両方から60px以上離し、Toy同士のポケットを作らない。
      x: 320,
      y: 630,
      radius: 24,
      upSpeed: 9,
      cooldownMs: 900,
    },
  ],
  zones: [
    {
      kind: 'boost',
      id: 'river-upper-surge',
      x: 240,
      y: 240,
      width: 380,
      height: 56,
      angle: 0,
      force: 0.05,
      maxSpeed: BOOST_MAX_SPEED,
    },
    {
      kind: 'boost',
      id: 'river-lower-surge',
      x: 240,
      y: 546,
      width: 380,
      height: 56,
      angle: 0,
      force: 0.05,
      maxSpeed: BOOST_MAX_SPEED,
    },
    {
      kind: 'boost',
      id: 'river-sweep-boost',
      x: 340,
      y: 400,
      width: 240,
      height: 80,
      angle: -0.28,
      force: 0.1,
      maxSpeed: BOOST_MAX_SPEED,
    },
  ],
  exits: [
    {
      id: 'river-to-cloud',
      kind: 'hole',
      x: AREA_WIDTH - 160,
      y: AREA_HEIGHT - 200,
      ...PORTAL_SIZE,
      to: 'cloud',
      toEntry: 'cloud-entry-right',
    },
  ],
}
