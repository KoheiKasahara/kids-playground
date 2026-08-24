import {
  AREA_ENTRY_CLEARANCE,
  AREA_HEIGHT,
  AREA_WIDTH,
  BALL_RADIUS,
  CANNON_HOLD_MS,
  CANNON_SENSOR_RADIUS,
  CAVE_CANNON_APPROACH_RADIUS,
  CAVE_CANNON_APPROACH_X,
  CAVE_CANNON_APPROACH_Y,
  CAVE_CANNON_POWER,
  EXIT_CENTER_OFFSET_FROM_BOTTOM,
  EXIT_SENSOR_HEIGHT,
  EXIT_WIDTH,
  PORTAL_FLOOR_HEIGHT,
  WALL_RESTITUTION,
} from '../../adventurePhysics'
import { floorRamp, pinRow, wallKicker } from '../courseKit'
import type { AdventureArea } from '../../types'

const ENTRY_Y = AREA_ENTRY_CLEARANCE + BALL_RADIUS
const EXIT_Y = AREA_HEIGHT - EXIT_CENTER_OFFSET_FROM_BOTTOM
const PORTAL_SIZE = { width: EXIT_WIDTH, height: EXIT_SENSOR_HEIGHT }
const CAVE_PIN_RESTITUTION = 0.78

function gridRow(
  idPrefix: string,
  y: number,
  pinStartX: number,
  pinCount: number,
  pinSpacing: number,
  withKickers: boolean,
  pinRadius = 9,
) {
  return [
    ...(withKickers
      ? [
          wallKicker({ id: `${idPrefix}-kicker-left`, side: 'left', y, restitution: WALL_RESTITUTION }),
          wallKicker({ id: `${idPrefix}-kicker-right`, side: 'right', y, restitution: WALL_RESTITUTION }),
        ]
      : []),
    ...pinRow({
      idPrefix: `${idPrefix}-pin`,
      startX: pinStartX,
      y,
      count: pinCount,
      spacing: pinSpacing,
      radius: pinRadius,
      restitution: CAVE_PIN_RESTITUTION,
    }),
  ]
}

const gridObjects = [
  ...gridRow('cave-grid-1', 152, 156, 3, 78, true),
  ...gridRow('cave-grid-2', 232, 117, 4, 78, false),
  ...gridRow('cave-grid-3', 312, 156, 2, 156, true),
  ...gridRow('cave-grid-4', 392, 117, 2, 234, false),
  ...gridRow('cave-grid-5', 472, 156, 0, 156, false),
  wallKicker({ id: 'cave-exit-kicker-left', side: 'left', y: 480, restitution: WALL_RESTITUTION }),
  wallKicker({ id: 'cave-exit-kicker-right', side: 'right', y: 480, restitution: WALL_RESTITUTION }),
  // 下段は横へ80px、次の列を40pxずらした受けにして、斜めの素通りも短くする。
  ...pinRow({ idPrefix: 'cave-lower-flow-upper', startX: 160, y: 470, count: 2, spacing: 160, radius: 9, restitution: CAVE_PIN_RESTITUTION }),
  ...pinRow({ idPrefix: 'cave-lower-flow-left', startX: 110, y: 580, count: 2, spacing: 80, radius: 9, restitution: CAVE_PIN_RESTITUTION }),
  ...pinRow({ idPrefix: 'cave-lower-flow-right', startX: 290, y: 580, count: 2, spacing: 80, radius: 9, restitution: CAVE_PIN_RESTITUTION }),
  { kind: 'pin' as const, id: 'cave-mid-lower-pin', x: 240, y: 500, radius: 9, restitution: CAVE_PIN_RESTITUTION },
  { kind: 'pin' as const, id: 'cave-mid-lower-pin-low', x: 240, y: 640, radius: 9, restitution: CAVE_PIN_RESTITUTION },
  // 下端の平らな床で勢いを失った球を中央開口へ送り、停滞ナッジに頼らない。
  floorRamp({ id: 'cave-exit-guide-left', side: 'left', openingEdgeX: AREA_WIDTH / 2 - EXIT_WIDTH / 2, floorTop: AREA_HEIGHT - PORTAL_FLOOR_HEIGHT, rise: 48, restitution: WALL_RESTITUTION }),
  floorRamp({ id: 'cave-exit-guide-right', side: 'right', openingEdgeX: AREA_WIDTH / 2 + EXIT_WIDTH / 2, floorTop: AREA_HEIGHT - PORTAL_FLOOR_HEIGHT, rise: 48, restitution: WALL_RESTITUTION }),
]

/** 大砲2基は温存し、洞窟のジグザグ板はTask 4の署名板として戻す。 */
export const caveArea: AdventureArea = {
  id: 'cave',
  nameJa: 'どうくつ',
  theme: 'cave',
  // 大砲の着地後にもピン・回転岩へ絡めるよう、従来に近い重力を維持する。
  gravityScale: 0.9,
  origin: { x: 0, y: 2 * AREA_HEIGHT },
  entries: [{ id: 'cave-entry', kind: 'tunnel', x: AREA_WIDTH / 2, y: ENTRY_Y }],
  objects: gridObjects,
  toys: [
    {
      kind: 'spinner',
      id: 'cave-rolling-rock',
      x: 240,
      y: 390,
      radius: 28,
      angularVelocity: 0.13,
    },
  ],
  zones: [
    {
      kind: 'cannon',
      id: 'cave-cannon-left-low',
      x: 120,
      y: 540,
      radius: CANNON_SENSOR_RADIUS,
      angle: -0.8,
      power: CAVE_CANNON_POWER,
      holdMs: CANNON_HOLD_MS,
    },
    {
      kind: 'cannon',
      id: 'cave-cannon-center-approach',
      x: CAVE_CANNON_APPROACH_X,
      y: CAVE_CANNON_APPROACH_Y,
      radius: CAVE_CANNON_APPROACH_RADIUS,
      angle: -2.34,
      power: CAVE_CANNON_POWER,
      holdMs: CANNON_HOLD_MS,
    },
  ],
  exits: [
    {
      id: 'cave-to-cloud',
      kind: 'pipe',
      x: AREA_WIDTH / 2,
      y: EXIT_Y,
      ...PORTAL_SIZE,
      to: 'cloud',
      toEntry: 'cloud-entry-left',
    },
  ],
}
