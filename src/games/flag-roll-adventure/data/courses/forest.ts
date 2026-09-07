import * as P from '../../adventurePhysics'
import { floorRamp } from '../courseKit'
import { funnel } from '../flowKit'
import type { AdventureArea } from '../../types'

const ENTRY_Y = P.AREA_ENTRY_CLEARANCE + P.BALL_RADIUS
const EXIT_Y = P.AREA_HEIGHT - P.EXIT_CENTER_OFFSET_FROM_BOTTOM
const PORTAL_SIZE = { width: P.FOREST_EXIT_WIDTH, height: P.EXIT_SENSOR_HEIGHT }
const exitGuides = [
  floorRamp({
    id: 'forest-left-exit-guide',
    side: 'left',
    openingEdgeX: 40,
    floorTop: P.AREA_HEIGHT - P.PORTAL_FLOOR_HEIGHT,
    rise: 44,
    restitution: 0.12,
  }),
  floorRamp({
    id: 'forest-right-exit-guide',
    side: 'right',
    openingEdgeX: 440,
    floorTop: P.AREA_HEIGHT - P.PORTAL_FLOOR_HEIGHT,
    rise: 44,
    restitution: 0.12,
  }),
]

export const forestArea: AdventureArea = {
  id: 'forest',
  nameJa: 'もり',
  theme: 'forest',
  gravityScale: 1,
  origin: { x: P.AREA_COLUMN_STEP, y: P.AREA_HEIGHT },
  entries: [{ id: 'forest-entry', kind: 'hole', x: P.AREA_WIDTH / 2, y: ENTRY_Y }],
  objects: [...funnel('forest-spring-approach', 230), ...exitGuides],
  toys: [
    {
      kind: 'lifter',
      id: 'forest-mushroom-spring',
      x: 240,
      y: 390,
      radius: 36,
      upSpeed: 7,
      cooldownMs: 1200,
    },
  ],
  zones: [],
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
