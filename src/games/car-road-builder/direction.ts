/**
 * Directions used by the road game.
 *
 * Keeping this table in one place is intentional: board neighbours, road
 * geometry and the car route walker must agree on both clockwise order and
 * the meaning of a diagonal port.
 */
export const DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const
export type Direction = (typeof DIRECTIONS)[number]

export const DIRECTION_ORDER = DIRECTIONS
export const ROTATION_STEPS = 8

export type DirectionDelta = Readonly<{ row: number; col: number }>

export const DIRECTION_DELTAS: Readonly<Record<Direction, DirectionDelta>> = {
  N: { row: -1, col: 0 },
  NE: { row: -1, col: 1 },
  E: { row: 0, col: 1 },
  SE: { row: 1, col: 1 },
  S: { row: 1, col: 0 },
  SW: { row: 1, col: -1 },
  W: { row: 0, col: -1 },
  NW: { row: -1, col: -1 },
} as const

export const OPPOSITE_DIRECTIONS: Readonly<Record<Direction, Direction>> = {
  N: 'S',
  NE: 'SW',
  E: 'W',
  SE: 'NW',
  S: 'N',
  SW: 'NE',
  W: 'E',
  NW: 'SE',
} as const

export const OPPOSITE_DIRECTION = OPPOSITE_DIRECTIONS

export function normalizeRotationStep(step: number): number {
  const normalized = Math.trunc(step) % ROTATION_STEPS
  return normalized < 0 ? normalized + ROTATION_STEPS : normalized
}

/** Rotate a port clockwise by 45° increments. */
export function rotateDirection(direction: Direction, rotationStep: number): Direction {
  const index = DIRECTIONS.indexOf(direction)
  return DIRECTIONS[(index + normalizeRotationStep(rotationStep)) % ROTATION_STEPS]!
}

export const rotate = rotateDirection

export function oppositeDirection(direction: Direction): Direction {
  return OPPOSITE_DIRECTIONS[direction]
}

export const getOppositeDirection = oppositeDirection
export const opposite = oppositeDirection

export function directionDelta(direction: Direction): DirectionDelta {
  return DIRECTION_DELTAS[direction]
}

/** Alias kept descriptive at call sites that need to calculate a neighbour. */
export const getDirectionDelta = directionDelta
export const delta = directionDelta

export function directionIndex(direction: Direction): number {
  return DIRECTIONS.indexOf(direction)
}

export function directionFromRotation(rotationStep: number): Direction {
  return rotateDirection('N', rotationStep)
}

export function isCardinalDirection(direction: Direction): boolean {
  return direction === 'N' || direction === 'E' || direction === 'S' || direction === 'W'
}

export function isDiagonalDirection(direction: Direction): boolean {
  return !isCardinalDirection(direction)
}

/** Angle in screen coordinates, where N points up and E points right. */
export function directionAngle(direction: Direction): number {
  return (directionIndex(direction) * Math.PI) / 4 - Math.PI / 2
}
