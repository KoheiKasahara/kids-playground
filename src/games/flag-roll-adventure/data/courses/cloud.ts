import * as P from '../../adventurePhysics'
import { floorRamp } from '../courseKit'
import { funnel } from '../flowKit'
import type { AdventureArea } from '../../types'

const ENTRY_Y = P.AREA_ENTRY_CLEARANCE + P.BALL_RADIUS
const EXIT_Y = P.AREA_HEIGHT - P.EXIT_CENTER_OFFSET_FROM_BOTTOM
const PORTAL_SIZE = { width: P.EXIT_WIDTH, height: P.EXIT_SENSOR_HEIGHT }
const exitGuides = [
  floorRamp({
    id: 'cloud-exit-guide-left',
    side: 'left',
    openingEdgeX: 240 - P.EXIT_WIDTH / 2,
    floorTop: P.AREA_HEIGHT - P.PORTAL_FLOOR_HEIGHT,
    rise: 100,
    restitution: 0.12,
  }),
  floorRamp({
    id: 'cloud-exit-guide-right',
    side: 'right',
    openingEdgeX: 240 + P.EXIT_WIDTH / 2,
    floorTop: P.AREA_HEIGHT - P.PORTAL_FLOOR_HEIGHT,
    rise: 100,
    restitution: 0.12,
  }),
]

export const cloudArea: AdventureArea = {
  id: 'cloud',
  nameJa: 'くも',
  theme: 'cloud',
  gravityScale: 0.95,
  origin: { x: P.AREA_COLUMN_STEP, y: 3 * P.AREA_HEIGHT },
  entries: [
    {
      id: 'cloud-entry-left',
      kind: 'pipe',
      x: P.CLOUD_ENTRY_LEFT_X,
      y: ENTRY_Y,
      velocity: { x: P.MERGE_ENTRY_SPEED, y: P.MERGE_ENTRY_VERTICAL_SPEED },
    },
    {
      id: 'cloud-entry-right',
      kind: 'hole',
      x: P.CLOUD_ENTRY_RIGHT_X,
      y: ENTRY_Y,
      velocity: { x: -P.MERGE_ENTRY_SPEED, y: P.MERGE_ENTRY_VERTICAL_SPEED },
    },
  ],
  objects: [...funnel('cloud-bounce-approach', 240), ...exitGuides],
  toys: [
    { kind: 'lifter', id: 'cloud-fluffy-lift', x: 240, y: 410, radius: 42, upSpeed: 8, cooldownMs: 1400 },
  ],
  zones: [],
  exits: [
    {
      id: 'cloud-to-goal',
      kind: 'pipe',
      x: P.CLOUD_EXIT_X,
      y: EXIT_Y,
      ...PORTAL_SIZE,
      to: 'goal',
      toEntry: 'goal-entry',
    },
  ],
}
