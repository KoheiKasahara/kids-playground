import * as P from '../../adventurePhysics'
import { floorRamp } from '../courseKit'
import { slide, funnel } from '../flowKit'
import type { AdventureArea } from '../../types'

const ENTRY_Y = P.AREA_ENTRY_CLEARANCE + P.BALL_RADIUS
const PORTAL_SIZE = { width: P.EXIT_WIDTH, height: P.EXIT_SENSOR_HEIGHT }
const exitGuides = [
  floorRamp({
    id: 'river-exit-guide-left',
    side: 'left',
    openingEdgeX: 320 - P.EXIT_WIDTH / 2,
    floorTop: P.AREA_HEIGHT - P.PORTAL_FLOOR_HEIGHT,
    rise: 100,
    restitution: 0.12,
  }),
  floorRamp({
    id: 'river-exit-guide-right',
    side: 'right',
    openingEdgeX: 320 + P.EXIT_WIDTH / 2,
    floorTop: P.AREA_HEIGHT - P.PORTAL_FLOOR_HEIGHT,
    rise: 100,
    restitution: 0.12,
  }),
]

export const riverArea: AdventureArea = {
  id: 'river',
  nameJa: 'かわ',
  theme: 'river',
  gravityScale: 1.1,
  origin: { x: 2 * P.AREA_COLUMN_STEP, y: 2 * P.AREA_HEIGHT },
  entries: [{ id: 'river-entry', kind: 'hole', x: P.AREA_WIDTH / 2, y: ENTRY_Y }],
  objects: [
    slide('river-water-slide', 12, 155, 320, 295),
    ...funnel('river-jump-approach', 440, 320),
    {
      kind: 'jump',
      id: 'river-jump-end',
      x: 320,
      y: 540,
      width: 100,
      height: 12,
      angle: 0.35,
      launchAngle: -2.2,
      power: 12,
    },
    ...exitGuides,
  ],
  toys: [],
  zones: [
    {
      kind: 'boost',
      id: 'river-upper-surge',
      x: 205,
      y: 220,
      width: 290,
      height: 80,
      angle: 0.43,
      force: 0.3,
      maxSpeed: 14,
    },
  ],
  exits: [
    {
      id: 'river-to-cloud',
      kind: 'hole',
      x: P.AREA_WIDTH - 160,
      y: P.AREA_HEIGHT - P.EXIT_CENTER_OFFSET_FROM_BOTTOM,
      ...PORTAL_SIZE,
      to: 'cloud',
      toEntry: 'cloud-entry-right',
    },
  ],
}
