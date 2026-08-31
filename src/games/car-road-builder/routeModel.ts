import { oppositeDirection, type Direction } from './direction'
import { connectionsForPart, exitPortForPart, type PartKind, type PlacedPart } from './partDefinitions'
import { cellAt, findPartCell, getCellPart, neighborCell, type Board, type BoardCell } from './boardModel'
import {
  getPathSpec,
  type PathSpec,
  type Point,
  type Vector,
} from './roadGeometry'

export type RouteStopReason =
  | 'goal'
  | 'missing-start'
  | 'missing-goal'
  | 'empty'
  | 'edge'
  | 'mismatch'
  | 'loop'
  | 'max-steps'

export type RouteSegment = Readonly<{
  cellId: string
  row: number
  col: number
  kind: PartKind
  entryPort: Direction | null
  exitPort: Direction | null
  path: PathSpec
  pathSpec: PathSpec
}>

export type CarRoute = Readonly<{
  segments: readonly RouteSegment[]
  reachedGoal: boolean
  goalReached: boolean
  stopReason: RouteStopReason
  /** Friendly aliases for callers that use status/reason terminology. */
  status: RouteStopReason
  reason: RouteStopReason
  totalLength: number
  /** Start centre is available even when the first connection is blocked. */
  startPose: Readonly<{ cellId: string; row: number; col: number }> | null
  startDirection: Direction | null
  /** Number of cells considered, including a blocking target when present. */
  steps: number
}>

export type RouteResult = CarRoute

export type RouteOptions = Readonly<{
  startCellId?: string
  goalCellId?: string
  maxSteps?: number
}>

function segmentFor(cell: BoardCell, part: PlacedPart, entryPort: Direction | null, exitPort: Direction | null): RouteSegment {
  let path: PathSpec
  if (part.kind === 'start') path = getPathSpec(part)
  else if (part.kind === 'goal') path = getPathSpec(part, entryPort ?? undefined)
  else path = getPathSpec(part, entryPort ?? undefined)
  return { cellId: cell.id, row: cell.row, col: cell.col, kind: part.kind, entryPort, exitPort, path, pathSpec: path }
}

function otherPort(part: PlacedPart, entryPort: Direction): Direction | null {
  return exitPortForPart(part, entryPort)
}

function routeResult(
  segments: RouteSegment[],
  stopReason: RouteStopReason,
  steps: number,
  startPose: Readonly<{ cellId: string; row: number; col: number }> | null = null,
  startDirection: Direction | null = null,
): CarRoute {
  return {
    segments,
    reachedGoal: stopReason === 'goal',
    goalReached: stopReason === 'goal',
    stopReason,
    status: stopReason,
    reason: stopReason,
    totalLength: segments.reduce((sum, segment) => sum + segment.path.length, 0),
    startPose,
    startDirection,
    steps,
  }
}

/**
 * Trace a car from start. Direction values describe movement from the current
 * cell to the next cell; the neighbouring cell consequently needs the
 * opposite port. No geometric proximity or teleporting is used.
 */
export function buildRoute(board: Board, options: RouteOptions = {}): CarRoute {
  const start = options.startCellId ? board.cells.find((cell) => cell.id === options.startCellId && cell.kind === 'start') : findPartCell(board, 'start')
  if (!start) return routeResult([], 'missing-start', 0)
  const startPose = { cellId: start.id, row: start.row, col: start.col }
  const startPart = getCellPart(start)
  const startDirection = startPart ? (connectionsForPart(startPart)[0] ?? null) : null
  const goal = options.goalCellId ? board.cells.find((cell) => cell.id === options.goalCellId && cell.kind === 'goal') : findPartCell(board, 'goal')
  if (!goal) return routeResult([], 'missing-goal', 0, startPose, startDirection)
  if (!startPart) return routeResult([], 'missing-start', 0, startPose, startDirection)

  // Do not add the start stub until its first neighbour has a reciprocal
  // connection. A blocked start therefore has a zero-length route and the car
  // can remain at the centre without pretending it travelled onto the road.
  const segments: RouteSegment[] = []
  let current = start
  let movement = connectionsForPart(startPart)[0]
  if (!movement) return routeResult(segments, 'edge', 1, startPose, startDirection)

  const visited = new Set<string>()
  const maxSteps = Math.max(1, Math.trunc(options.maxSteps ?? board.size.rows * board.size.cols * 8))

  for (let step = 0; step < maxSteps; step += 1) {
    const visitKey = `${current.id}:${movement}`
    if (visited.has(visitKey)) return routeResult(segments, 'loop', step + 1, startPose, startDirection)
    visited.add(visitKey)

    const next = neighborCell(board, current, movement)
    if (!next) return routeResult(segments, 'edge', step + 1, startPose, startDirection)
    const nextPart = getCellPart(next)
    if (!nextPart) return routeResult(segments, 'empty', step + 1, startPose, startDirection)

    const arrivalPort = oppositeDirection(movement)
    if (!connectionsForPart(nextPart).includes(arrivalPort)) return routeResult(segments, 'mismatch', step + 1, startPose, startDirection)

    if (segments.length === 0) {
      segments.push(segmentFor(start, startPart, null, movement))
    }

    if (nextPart.kind === 'goal') {
      segments.push(segmentFor(next, nextPart, arrivalPort, null))
      return routeResult(segments, 'goal', step + 1, startPose, startDirection)
    }

    const exitPort = otherPort(nextPart, arrivalPort)
    if (!exitPort) return routeResult(segments, 'mismatch', step + 1, startPose, startDirection)
    segments.push(segmentFor(next, nextPart, arrivalPort, exitPort))
    current = next
    movement = exitPort
  }
  return routeResult(segments, 'max-steps', maxSteps, startPose, startDirection)
}

export const traceRoute = buildRoute
export const buildCarRoute = buildRoute
export const routeFromBoard = buildRoute
export const playRoute = buildRoute

export type RouteSample = Readonly<{
  segmentIndex: number
  cellId: string
  row: number
  col: number
  point: Point
  tangent: Vector
  distance: number
}>

/** Sample a route by actual normalized path length, not by segment count. */
export function sampleRoute(route: CarRoute, distance: number): RouteSample | null {
  if (route.segments.length === 0) {
    if (!route.startPose) return null
    return {
      segmentIndex: -1,
      cellId: route.startPose.cellId,
      row: route.startPose.row,
      col: route.startPose.col,
      point: { x: route.startPose.col + 0.5, y: route.startPose.row + 0.5 },
      tangent: { x: 0, y: 0 },
      distance: 0,
    }
  }
  const target = Math.min(route.totalLength, Math.max(0, distance))
  let cursor = 0
  for (let index = 0; index < route.segments.length; index += 1) {
    const segment = route.segments[index]!
    const end = cursor + segment.path.length
    if (target <= end || index === route.segments.length - 1) {
      const localDistance = segment.path.length <= 1e-9 ? 0 : (target - cursor)
      const progress = segment.path.length <= 1e-9 ? 0 : localDistance / segment.path.length
      const local = segment.path.sample(progress)
      const tangent = segment.path.tangent(progress)
      return {
        segmentIndex: index,
        cellId: segment.cellId,
        row: segment.row,
        col: segment.col,
        point: { x: segment.col + 0.5 + local.x, y: segment.row + 0.5 + local.y },
        tangent,
        distance: target,
      }
    }
    cursor = end
  }
  return null
}

export function sampleRouteProgress(route: CarRoute, progress: number): RouteSample | null {
  return sampleRoute(route, route.totalLength * Math.min(1, Math.max(0, progress)))
}

export const routeSampleAtDistance = sampleRoute

export function routePolyline(route: CarRoute, samplesPerSegment = 12): Point[] {
  const points: Point[] = []
  for (const segment of route.segments) {
    const count = Math.max(1, Math.trunc(samplesPerSegment))
    for (let index = 0; index <= count; index += 1) {
      if (points.length > 0 && index === 0) continue
      const local = segment.path.sample(index / count)
      points.push({ x: segment.col + 0.5 + local.x, y: segment.row + 0.5 + local.y })
    }
  }
  return points
}

export function routeIsClear(route: CarRoute): boolean {
  return route.reachedGoal
}

export function routeStatusLabel(route: CarRoute): string {
  switch (route.stopReason) {
    case 'goal': return 'ゴールについたよ！'
    case 'empty': return 'みちが ないよ'
    case 'mismatch': return 'つなぎめを あわせてみてね'
    case 'edge': return 'そとに でちゃうよ'
    case 'loop':
    case 'max-steps': return 'ぐるぐる まわっているよ'
    case 'missing-goal': return 'ゴールを おいてみてね'
    case 'missing-start': return 'スタートを おいてみてね'
  }
}

export function isRouteTargetGoal(board: Board, cell: BoardCell): boolean {
  return cell.kind === 'goal' && Boolean(cellAt(board, cell.row, cell.col))
}
