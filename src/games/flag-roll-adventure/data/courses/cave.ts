import * as P from '../../adventurePhysics'
import { floorRamp } from '../courseKit'
import { slide, funnel } from '../flowKit'
import type { AdventureArea } from '../../types'

const ENTRY_Y = P.AREA_ENTRY_CLEARANCE + P.BALL_RADIUS
const EXIT_Y = P.AREA_HEIGHT - P.EXIT_CENTER_OFFSET_FROM_BOTTOM
const PORTAL_SIZE = { width: P.EXIT_WIDTH, height: P.EXIT_SENSOR_HEIGHT }
const exitGuides = [
  floorRamp({
    id: 'cave-exit-guide-left',
    side: 'left',
    openingEdgeX: 240 - P.EXIT_WIDTH / 2,
    floorTop: P.AREA_HEIGHT - P.PORTAL_FLOOR_HEIGHT,
    rise: 100,
    restitution: 0.12,
  }),
  floorRamp({
    id: 'cave-exit-guide-right',
    side: 'right',
    openingEdgeX: 240 + P.EXIT_WIDTH / 2,
    floorTop: P.AREA_HEIGHT - P.PORTAL_FLOOR_HEIGHT,
    rise: 100,
    restitution: 0.12,
  }),
]

export const caveArea: AdventureArea = {
  id: 'cave',
  nameJa: 'どうくつ',
  theme: 'cave',
  gravityScale: 1,
  origin: { x: 0, y: 2 * P.AREA_HEIGHT },
  entries: [{ id: 'cave-entry', kind: 'tunnel', x: P.AREA_WIDTH / 2, y: ENTRY_Y }],
  objects: [
    ...funnel('cave-cannon-approach', 210),
    slide('cave-landing-slide', 12, 395, 310, 515),
    ...exitGuides,
  ],
  toys: [],
  zones: [
    {
      kind: 'cannon',
      id: 'cave-cannon-center-approach',
      x: 240,
      y: 280,
      radius: 46,
      angle: -0.65,
      power: 13,
      holdMs: 320,
    },
  ],
  exits: [
    {
      id: 'cave-to-cloud',
      kind: 'pipe',
      x: P.AREA_WIDTH / 2,
      y: EXIT_Y,
      ...PORTAL_SIZE,
      to: 'cloud',
      toEntry: 'cloud-entry-left',
    },
  ],
}
