import * as P from '../../adventurePhysics'
import { floorRamp } from '../courseKit'
import { slide } from '../flowKit'
import type { AdventureArea } from '../../types'

const ENTRY_Y = P.AREA_ENTRY_CLEARANCE + P.BALL_RADIUS
const EXIT_Y = P.AREA_HEIGHT - P.EXIT_CENTER_OFFSET_FROM_BOTTOM
const PORTAL_SIZE = { width: P.EXIT_WIDTH, height: P.EXIT_SENSOR_HEIGHT }
const exitGuides = [
  floorRamp({
    id: 'sky-exit-guide-left',
    side: 'left',
    openingEdgeX: 240 - P.EXIT_WIDTH / 2,
    floorTop: P.AREA_HEIGHT - P.PORTAL_FLOOR_HEIGHT,
    rise: 48,
    restitution: 0.12,
  }),
  floorRamp({
    id: 'sky-exit-guide-right',
    side: 'right',
    openingEdgeX: 240 + P.EXIT_WIDTH / 2,
    floorTop: P.AREA_HEIGHT - P.PORTAL_FLOOR_HEIGHT,
    rise: 48,
    restitution: 0.12,
  }),
]

export const skyArea: AdventureArea = {
  id: 'sky',
  nameJa: 'そら',
  theme: 'sky',
  gravityScale: 1,
  origin: { x: P.AREA_COLUMN_STEP, y: 0 },
  entries: [{ id: 'sky-entry', kind: 'hole', x: P.AREA_WIDTH / 2, y: ENTRY_Y }],
  objects: [
    slide('sky-first-slide', 12, 300, 305, 410),
    slide('sky-return-slide', 175, 560, 468, 450),
    ...exitGuides,
  ],
  toys: [{ kind: 'spinner', id: 'sky-propeller', x: 240, y: 170, radius: 30, angularVelocity: 0.16 }],
  zones: [],
  exits: [
    {
      id: 'sky-to-forest',
      kind: 'hole',
      x: P.AREA_WIDTH / 2,
      y: EXIT_Y,
      ...PORTAL_SIZE,
      to: 'forest',
      toEntry: 'forest-entry',
    },
  ],
}
