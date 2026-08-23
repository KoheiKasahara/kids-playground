import {
  AREA_COLUMN_STEP,
  AREA_ENTRY_CLEARANCE,
  AREA_HEIGHT,
  AREA_WIDTH,
  BALL_RADIUS,
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
// 小ピンは軽快に跳ね返し、半径の小さな接触で棚のように止まらないようにする。
const SKY_PIN_RESTITUTION = 0.85

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
      restitution: SKY_PIN_RESTITUTION,
    }),
  ]
}

/** 80pxピッチの千鳥骨格で、壁際はキッカーに任せて中央の列を薄くする。 */
const gridObjects = [
  ...gridRow('sky-grid-1', 152, 160, 3, 78, true),
  ...gridRow('sky-grid-2', 232, 117, 2, 156, false),
  { kind: 'pin' as const, id: 'sky-grid-2-pin-right', x: 351, y: 232, radius: 9, restitution: SKY_PIN_RESTITUTION },
  { kind: 'pin' as const, id: 'sky-upper-flow-pin', x: 195, y: 230, radius: 9, restitution: SKY_PIN_RESTITUTION },
  ...gridRow('sky-grid-3', 312, 320, 1, 160, true, 11),
  // 左寄りの長い落下帯を一つのピンで分断し、風のしかけへ流す。
  { kind: 'pin' as const, id: 'sky-mid-flow-pin', x: 160, y: 300, radius: 9, restitution: SKY_PIN_RESTITUTION },
  ...gridRow('sky-grid-4', 392, 121, 2, 238, false, 11),
  ...gridRow('sky-grid-5', 472, 160, 2, 160, true, 11),
  ...gridRow('sky-grid-6', 552, 121, 2, 238, false, 11),
  // 最下段は床スロープにする。密度を上げると床へ着くころには勢いがなく、
  // 開口の横の平らな床でボールが止まってしまうため、必ず開口へ転がり込ませる。
  floorRamp({ id: 'sky-exit-guide-left', side: 'left', openingEdgeX: AREA_WIDTH / 2 - EXIT_WIDTH / 2, floorTop: AREA_HEIGHT - PORTAL_FLOOR_HEIGHT, rise: 48, restitution: WALL_RESTITUTION }),
  floorRamp({ id: 'sky-exit-guide-right', side: 'right', openingEdgeX: AREA_WIDTH / 2 + EXIT_WIDTH / 2, floorTop: AREA_HEIGHT - PORTAL_FLOOR_HEIGHT, rise: 48, restitution: WALL_RESTITUTION }),
]

export const skyArea: AdventureArea = {
  id: 'sky',
  nameJa: 'そら',
  theme: 'sky',
  origin: { x: AREA_COLUMN_STEP, y: 0 },
  entries: [{ id: 'sky-entry', kind: 'hole', x: AREA_WIDTH / 2, y: ENTRY_Y }],
  objects: gridObjects,
  toys: [
    {
      kind: 'spinner',
      id: 'sky-wind-gimmick',
      // 左へ流れた球の中心線へ5px寄せ、風のしかけを空振りさせない。
      x: 235,
      y: 390,
      // 中段の千鳥列を受け止めつつ、プロペラへ送り出す接触面を少し広げる。
      radius: 29,
      angularVelocity: -0.14,
    },
    {
      kind: 'spinner',
      id: 'sky-propeller',
      // 下段の左右移動を受け止め、プロペラへ入る流路を広くする。
      x: 240,
      y: 560,
      radius: 39,
      angularVelocity: 0.12,
    },
  ],
  exits: [
    {
      id: 'sky-to-forest',
      kind: 'hole',
      x: AREA_WIDTH / 2,
      y: EXIT_Y,
      ...PORTAL_SIZE,
      to: 'forest',
      toEntry: 'forest-entry',
    },
  ],
}
