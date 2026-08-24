import {
  AREA_COLUMN_STEP,
  AREA_ENTRY_CLEARANCE,
  AREA_HEIGHT,
  AREA_WIDTH,
  BALL_RADIUS,
  CLOUD_ENTRY_LEFT_X,
  CLOUD_ENTRY_RIGHT_X,
  CLOUD_EXIT_X,
  EXIT_CENTER_OFFSET_FROM_BOTTOM,
  EXIT_SENSOR_HEIGHT,
  EXIT_WIDTH,
  MERGE_ENTRY_SPEED,
  MERGE_ENTRY_VERTICAL_SPEED,
  PORTAL_FLOOR_HEIGHT,
  WALL_RESTITUTION,
} from '../../adventurePhysics'
import { floorRamp } from '../courseKit'
import type { AdventureArea } from '../../types'

const ENTRY_Y = AREA_ENTRY_CLEARANCE + BALL_RADIUS
const EXIT_Y = AREA_HEIGHT - EXIT_CENTER_OFFSET_FROM_BOTTOM
const PORTAL_SIZE = { width: EXIT_WIDTH, height: EXIT_SENSOR_HEIGHT }
// 大きな雲バンパーは柔らかく見せるが、頂点で静止しないよう少し強く弾ませる。
const CLOUD_PIN_RESTITUTION = 0.95


const gridObjects = [
  // 80pxピッチの千鳥骨格。壁ぎわは蹴り出し板が受け持ち、素通りの縦帯を残さない。
  { kind: 'wall' as const, id: 'cloud-r1-kl', x: 45.597, y: 152, width: 84, height: 12, angle: 0.34 },
  { kind: 'pin' as const, id: 'cloud-r1-1', x: 156, y: 152, radius: 9, restitution: CLOUD_PIN_RESTITUTION },
  { kind: 'pin' as const, id: 'cloud-r1-2', x: 234, y: 152, radius: 9, restitution: CLOUD_PIN_RESTITUTION },
  { kind: 'pin' as const, id: 'cloud-r1-3', x: 312, y: 152, radius: 9, restitution: CLOUD_PIN_RESTITUTION },
  { kind: 'wall' as const, id: 'cloud-r1-kr', x: 434.403, y: 152, width: 84, height: 12, angle: -0.34 },
  { kind: 'pin' as const, id: 'cloud-r2-1', x: 117, y: 232, radius: 9, restitution: CLOUD_PIN_RESTITUTION },
  { kind: 'pin' as const, id: 'cloud-r2-2', x: 195, y: 232, radius: 9, restitution: CLOUD_PIN_RESTITUTION },
  { kind: 'pin' as const, id: 'cloud-r2-3', x: 273, y: 232, radius: 9, restitution: CLOUD_PIN_RESTITUTION },
  { kind: 'pin' as const, id: 'cloud-r2-4', x: 351, y: 232, radius: 9, restitution: CLOUD_PIN_RESTITUTION },
  { kind: 'wall' as const, id: 'cloud-r3-kl', x: 45.597, y: 312, width: 84, height: 12, angle: 0.34 },
  { kind: 'pin' as const, id: 'cloud-r3-1', x: 156, y: 312, radius: 9, restitution: CLOUD_PIN_RESTITUTION },
  { kind: 'pin' as const, id: 'cloud-r3-2', x: 234, y: 312, radius: 9, restitution: CLOUD_PIN_RESTITUTION },
  { kind: 'pin' as const, id: 'cloud-r3-3', x: 312, y: 312, radius: 9, restitution: CLOUD_PIN_RESTITUTION },
  { kind: 'wall' as const, id: 'cloud-r3-kr', x: 434.403, y: 312, width: 84, height: 12, angle: -0.34 },
  { kind: 'pin' as const, id: 'cloud-r4-1', x: 117, y: 392, radius: 9, restitution: CLOUD_PIN_RESTITUTION },
  { kind: 'pin' as const, id: 'cloud-r4-2', x: 195, y: 392, radius: 9, restitution: CLOUD_PIN_RESTITUTION },
  { kind: 'pin' as const, id: 'cloud-r4-3', x: 273, y: 392, radius: 9, restitution: CLOUD_PIN_RESTITUTION },
  { kind: 'pin' as const, id: 'cloud-r4-4', x: 351, y: 392, radius: 9, restitution: CLOUD_PIN_RESTITUTION },
  { kind: 'wall' as const, id: 'cloud-r5-kl', x: 45.597, y: 472, width: 84, height: 12, angle: 0.34 },
  { kind: 'pin' as const, id: 'cloud-r5-1', x: 156, y: 472, radius: 9, restitution: CLOUD_PIN_RESTITUTION },
  { kind: 'pin' as const, id: 'cloud-r5-3', x: 312, y: 472, radius: 9, restitution: CLOUD_PIN_RESTITUTION },
  { kind: 'wall' as const, id: 'cloud-r5-kr', x: 434.403, y: 472, width: 84, height: 12, angle: -0.34 },
  { kind: 'pin' as const, id: 'cloud-r6-1', x: 117, y: 552, radius: 9, restitution: CLOUD_PIN_RESTITUTION },
  { kind: 'pin' as const, id: 'cloud-r6-4', x: 351, y: 552, radius: 9, restitution: CLOUD_PIN_RESTITUTION },
  // 開口脇の平らな床を出口へ下るスロープに置き換え、ふわふわ落下後の静止を防ぐ。
  floorRamp({ id: 'cloud-exit-guide-left', side: 'left', openingEdgeX: AREA_WIDTH / 2 - EXIT_WIDTH / 2, floorTop: AREA_HEIGHT - PORTAL_FLOOR_HEIGHT, rise: 48, restitution: WALL_RESTITUTION }),
  floorRamp({ id: 'cloud-exit-guide-right', side: 'right', openingEdgeX: AREA_WIDTH / 2 + EXIT_WIDTH / 2, floorTop: AREA_HEIGHT - PORTAL_FLOOR_HEIGHT, rise: 48, restitution: WALL_RESTITUTION }),
]

/** 雲は大きなふわふわリフターを主役にし、後段でV字の署名板を戻す。 */
export const cloudArea: AdventureArea = {
  id: 'cloud',
  nameJa: 'くも',
  theme: 'cloud',
  // 高反発ピンとリフターへ当たる時間を残すため、強化後の基準値から少しだけ抑える。
  gravityScale: 0.96,
  origin: { x: AREA_COLUMN_STEP, y: 3 * AREA_HEIGHT },
  entries: [
    {
      id: 'cloud-entry-left',
      kind: 'pipe',
      x: CLOUD_ENTRY_LEFT_X,
      y: ENTRY_Y,
      velocity: { x: MERGE_ENTRY_SPEED, y: MERGE_ENTRY_VERTICAL_SPEED },
    },
    {
      id: 'cloud-entry-right',
      kind: 'hole',
      x: CLOUD_ENTRY_RIGHT_X,
      y: ENTRY_Y,
      velocity: { x: -MERGE_ENTRY_SPEED, y: MERGE_ENTRY_VERTICAL_SPEED },
    },
  ],
  objects: gridObjects,
  toys: [
    {
      kind: 'lifter',
      id: 'cloud-fluffy-lift',
      x: 240,
      // 外側の受けピンと60px以上離し、下段でToyとピンが挟み合わないようにする。
      y: 540,
      radius: 30,
      upSpeed: 11,
      cooldownMs: 900,
    },
  ],
  exits: [
    {
      id: 'cloud-to-goal',
      kind: 'pipe',
      x: CLOUD_EXIT_X,
      y: EXIT_Y,
      ...PORTAL_SIZE,
      to: 'goal',
      toEntry: 'goal-entry',
    },
  ],
}
