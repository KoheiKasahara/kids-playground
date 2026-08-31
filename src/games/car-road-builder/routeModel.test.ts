import { describe, expect, test } from 'vitest'
import { createInitialBoard, placePartAt, removePart } from './boardModel'
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
    board = placePartAt(removePart(board, { row: 0, col: 0 }), 0, 0, createPlacedPart('start', 2))
    board = placePartAt(board, 0, 1, createPlacedPart('straight', 0))
    expect(buildRoute(board).stopReason).toBe('mismatch')
    board = placePartAt(removePart(board, { row: 0, col: 0 }), 0, 0, createPlacedPart('start', 7))
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
})

function routePolylineFirst(route: ReturnType<typeof buildRoute>) {
  const segment = route.segments[0]!
  return { x: segment.col + 0.5 + segment.path.sample(0).x, y: segment.row + 0.5 + segment.path.sample(0).y }
}
