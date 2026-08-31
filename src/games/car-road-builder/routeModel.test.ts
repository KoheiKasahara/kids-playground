import { describe, expect, test } from 'vitest'
import { createInitialBoard, placePartAt } from './boardModel'
import { createPlacedPart } from './partDefinitions'
import { buildRoute } from './routeModel'

function lineBoard(exitRotation = 2) {
  let board = createInitialBoard()
  board = placePartAt(board, 1, 0, createPlacedPart('start', exitRotation))
  board = placePartAt(board, 1, 1, createPlacedPart('straight', 2))
  board = placePartAt(board, 1, 2, createPlacedPart('goal'))
  return board
}

describe('car road route', () => {
  test('follows reciprocal straight and reaches goal', () => {
    const route = buildRoute(lineBoard())
    expect(route.reachedGoal).toBe(true)
    expect(route.stopReason).toBe('goal')
    expect(route.segments.map((segment) => segment.kind)).toEqual(['start', 'straight', 'goal'])
    expect(route.startPose).toEqual({ cellId: 'cell-1-0', row: 1, col: 0 })
    expect(route.segments[0]!.path.sample(0)).toEqual({ x: 0, y: 0 })
    expect(routePolylineFirst(route)).toEqual({ x: 0.5, y: 1.5 })
  })

  test('stops at empty, mismatch and edge instead of warping', () => {
    let board = createInitialBoard()
    board = placePartAt(board, 0, 0, createPlacedPart('start', 0))
    board = placePartAt(board, 3, 3, createPlacedPart('goal'))
    expect(buildRoute(board).stopReason).toBe('edge')
    board = createInitialBoard()
    board = placePartAt(board, 0, 0, createPlacedPart('start', 2))
    board = placePartAt(board, 3, 3, createPlacedPart('goal'))
    board = placePartAt(board, 0, 1, createPlacedPart('straight', 0))
    expect(buildRoute(board).stopReason).toBe('mismatch')
    board = createInitialBoard()
    board = placePartAt(board, 0, 0, createPlacedPart('start', 7))
    board = placePartAt(board, 3, 3, createPlacedPart('goal'))
    expect(buildRoute(board).stopReason).toBe('edge')
  })

  test('follows a gentle curve into a diagonal neighbour and reaches the goal', () => {
    let board = createInitialBoard()
    board = placePartAt(board, 1, 0, createPlacedPart('start', 2))
    board = placePartAt(board, 1, 1, createPlacedPart('gentle-curve', 3))
    board = placePartAt(board, 2, 2, createPlacedPart('goal'))

    const route = buildRoute(board)
    expect(route.reachedGoal).toBe(true)
    expect(route.stopReason).toBe('goal')
    expect(route.segments.map((segment) => segment.kind)).toEqual(['start', 'gentle-curve', 'goal'])
    expect(route.segments[1]).toMatchObject({ entryPort: 'W', exitPort: 'SE' })
    expect(route.segments[1]!.path.sample(0)).toEqual({ x: -0.5, y: 0 })
    expect(route.segments[1]!.path.sample(1)).toEqual({ x: 0.5, y: 0.5 })
  })

  test('requires a reciprocal diagonal port before entering a gentle curve', () => {
    let board = createInitialBoard()
    board = placePartAt(board, 0, 0, createPlacedPart('start', 3))
    board = placePartAt(board, 1, 1, createPlacedPart('gentle-curve', 0))
    board = placePartAt(board, 3, 3, createPlacedPart('goal'))

    const route = buildRoute(board)
    expect(route.reachedGoal).toBe(false)
    expect(route.stopReason).toBe('mismatch')
    expect(route.segments).toHaveLength(0)
  })

  test.each([
    ['N', 0, 1, 1, 1, 2, 1, 'N', 'S'],
    ['S', 3, 1, 2, 1, 1, 1, 'S', 'N'],
    ['E', 1, 3, 1, 2, 1, 1, 'E', 'W'],
    ['W', 1, 0, 1, 1, 1, 2, 'W', 'E'],
  ] as const)('crossroad travels straight from %s to its opposite', (_name, startRow, startCol, crossRow, crossCol, goalRow, goalCol, entryPort, exitPort) => {
    const startDirection = entryPort === 'N' ? 4 : entryPort === 'S' ? 0 : entryPort === 'E' ? 6 : 2
    let board = createInitialBoard()
    board = placePartAt(board, startRow, startCol, createPlacedPart('start', startDirection))
    board = placePartAt(board, crossRow, crossCol, createPlacedPart('crossroad', 0))
    board = placePartAt(board, goalRow, goalCol, createPlacedPart('goal'))

    const route = buildRoute(board)
    expect(route.reachedGoal).toBe(true)
    expect(route.segments.map((segment) => segment.kind)).toEqual(['start', 'crossroad', 'goal'])
    expect(route.segments[1]).toMatchObject({ entryPort, exitPort })
    expect(route.segments[1]!.path.sample(0.5)).toEqual({ x: 0, y: 0 })
  })

  test('crossroad can continue straight when its other pair is unconnected', () => {
    let board = createInitialBoard()
    board = placePartAt(board, 0, 1, createPlacedPart('start', 4))
    board = placePartAt(board, 1, 1, createPlacedPart('crossroad'))
    board = placePartAt(board, 2, 1, createPlacedPart('goal'))

    const route = buildRoute(board)
    expect(route.reachedGoal).toBe(true)
    expect(route.segments[1]).toMatchObject({ entryPort: 'N', exitPort: 'S' })
  })

  test.each([
    ['NW to SE', 0, 0, 3, 2, 2, 'NW', 'SE'],
    ['SE to NW', 2, 2, 7, 0, 0, 'SE', 'NW'],
    ['NE to SW', 0, 2, 5, 2, 0, 'NE', 'SW'],
    ['SW to NE', 2, 0, 1, 0, 2, 'SW', 'NE'],
  ] as const)('xroad travels diagonally straight from %s', (_name, startRow, startCol, startRotation, goalRow, goalCol, entryPort, exitPort) => {
    const startDirection = startRotation
    let board = createInitialBoard()
    board = placePartAt(board, startRow, startCol, createPlacedPart('start', startDirection))
    board = placePartAt(board, 1, 1, createPlacedPart('xroad'))
    board = placePartAt(board, goalRow, goalCol, createPlacedPart('goal'))

    const route = buildRoute(board)
    expect(route.reachedGoal).toBe(true)
    expect(route.segments.map((segment) => segment.kind)).toEqual(['start', 'xroad', 'goal'])
    expect(route.segments[1]).toMatchObject({ entryPort, exitPort })
    expect(route.segments[1]!.path.sample(0.5)).toEqual({ x: 0, y: 0 })
  })

  test('xroad can continue through a gentle curve without changing its diagonal pair', () => {
    let board = createInitialBoard()
    board = placePartAt(board, 0, 0, createPlacedPart('start', 3))
    board = placePartAt(board, 1, 1, createPlacedPart('xroad'))
    board = placePartAt(board, 2, 2, createPlacedPart('gentle-curve', 7))
    board = placePartAt(board, 2, 3, createPlacedPart('goal'))

    const route = buildRoute(board)
    expect(route.reachedGoal).toBe(true)
    expect(route.segments[1]).toMatchObject({ entryPort: 'NW', exitPort: 'SE' })
    expect(route.segments[2]).toMatchObject({ entryPort: 'NW', exitPort: 'E' })
  })

  test.each([
    ['NW', 0, 0, 3, 2, 2],
    ['SE', 2, 2, 7, 0, 0],
    ['NE', 0, 2, 5, 2, 0],
    ['SW', 2, 0, 1, 0, 2],
  ] as const)('xroad stops when its %s exit lacks a reciprocal port', (_entryPort, startRow, startCol, startRotation, blockedRow, blockedCol) => {
    let board = createInitialBoard()
    board = placePartAt(board, startRow, startCol, createPlacedPart('start', startRotation))
    board = placePartAt(board, 1, 1, createPlacedPart('xroad'))
    board = placePartAt(board, blockedRow, blockedCol, createPlacedPart('straight', 0))
    board = placePartAt(board, 3, 3, createPlacedPart('goal'))

    const route = buildRoute(board)
    expect(route.stopReason).toBe('mismatch')
    expect(route.segments[1]?.kind).toBe('xroad')
  })

  test('xroad does not switch to the other diagonal at the crossing', () => {
    let board = createInitialBoard()
    board = placePartAt(board, 0, 0, createPlacedPart('start', 3))
    board = placePartAt(board, 1, 1, createPlacedPart('xroad'))
    board = placePartAt(board, 2, 0, createPlacedPart('goal'))
    board = placePartAt(board, 2, 2, createPlacedPart('straight', 0))

    const route = buildRoute(board)
    expect(route.reachedGoal).toBe(false)
    expect(route.stopReason).toBe('mismatch')
    expect(route.segments[1]).toMatchObject({ entryPort: 'NW', exitPort: 'SE' })
  })

  test('double curve follows the entered curve pair and reaches a perpendicular goal', () => {
    let board = createInitialBoard()
    board = placePartAt(board, 1, 0, createPlacedPart('start', 2))
    board = placePartAt(board, 1, 1, createPlacedPart('double-curve'))
    board = placePartAt(board, 2, 1, createPlacedPart('goal'))

    const route = buildRoute(board)
    expect(route.reachedGoal).toBe(true)
    expect(route.segments.map((segment) => segment.kind)).toEqual(['start', 'double-curve', 'goal'])
    expect(route.segments[1]).toMatchObject({ entryPort: 'W', exitPort: 'S' })
    expect(route.segments[1]!.path.start).toEqual({ x: -0.5, y: 0 })
    expect(route.segments[1]!.path.end).toEqual({ x: 0, y: 0.5 })
  })

  test('double curve does not switch to its other curve when the entered pair is blocked', () => {
    let board = createInitialBoard()
    board = placePartAt(board, 1, 0, createPlacedPart('start', 2))
    board = placePartAt(board, 1, 1, createPlacedPart('double-curve'))
    // The other curve points north at the goal, but the entered W-S curve is
    // blocked by the empty cell to the south and must not switch paths.
    board = placePartAt(board, 0, 1, createPlacedPart('goal'))

    const route = buildRoute(board)
    expect(route.reachedGoal).toBe(false)
    expect(route.stopReason).toBe('empty')
    expect(route.segments[1]).toMatchObject({ entryPort: 'W', exitPort: 'S' })
  })

  test.each([
    [0, 1, 1, 1, 2, 1, 2, 4, 3, 3],
    [3, 1, 2, 1, 1, 1, 2, 0, 3, 3],
    [1, 3, 1, 2, 1, 1, 0, 6, 0, 3],
    [1, 0, 1, 1, 1, 2, 0, 2, 0, 3],
  ] as const)('stops when the crossroad exit has no reciprocal connection', (startRow, startCol, crossRow, crossCol, blockedRow, blockedCol, blockedRotation, startRotation, goalRow, goalCol) => {
    let board = createInitialBoard()
    board = placePartAt(board, startRow, startCol, createPlacedPart('start', startRotation))
    board = placePartAt(board, crossRow, crossCol, createPlacedPart('crossroad'))
    board = placePartAt(board, blockedRow, blockedCol, createPlacedPart('straight', blockedRotation))
    board = placePartAt(board, goalRow, goalCol, createPlacedPart('goal'))

    expect(buildRoute(board).stopReason).toBe('mismatch')
  })
})

function routePolylineFirst(route: ReturnType<typeof buildRoute>) {
  const segment = route.segments[0]!
  return { x: segment.col + 0.5 + segment.path.sample(0).x, y: segment.row + 0.5 + segment.path.sample(0).y }
}
