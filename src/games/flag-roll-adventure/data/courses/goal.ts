import * as P from '../../adventurePhysics'
import { floorRamp } from '../courseKit'
import { slide } from '../flowKit'
import type { AdventureArea } from '../../types'

const ENTRY_Y = P.AREA_ENTRY_CLEARANCE + P.BALL_RADIUS
const CUP_RIM_Y = P.AREA_HEIGHT - P.CUP_INNER_DEPTH - P.GOAL_CUP_BOTTOM_MARGIN
const exitGuides = [
  floorRamp({
    id: 'goal-exit-guide-left',
    side: 'left',
    openingEdgeX: 240 - P.CUP_INNER_WIDTH / 2,
    floorTop: CUP_RIM_Y,
    rise: 48,
    restitution: 0.12,
  }),
  floorRamp({
    id: 'goal-exit-guide-right',
    side: 'right',
    openingEdgeX: 240 + P.CUP_INNER_WIDTH / 2,
    floorTop: CUP_RIM_Y,
    rise: 48,
    restitution: 0.12,
  }),
]

export const goalArea: AdventureArea = {
  id: 'goal',
  nameJa: 'ゴール',
  theme: 'goal',
  gravityScale: 0.95,
  origin: { x: P.AREA_COLUMN_STEP, y: 4 * P.AREA_HEIGHT },
  entries: [{ id: 'goal-entry', kind: 'pipe', x: P.AREA_WIDTH / 2, y: ENTRY_Y }],
  objects: [
    slide('goal-victory-slide', 12, 180, 320, 310),
    slide('goal-return-slide', 170, 445, 468, 335),
    ...exitGuides,
  ],
  toys: [],
  zones: [],
  exits: [],
  cup: { id: 'goal-cup', x: P.AREA_WIDTH / 2, rimY: CUP_RIM_Y },
}
