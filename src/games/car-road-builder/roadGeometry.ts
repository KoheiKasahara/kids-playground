import { isCardinalDirection, oppositeDirection, type Direction } from './direction'
import { connectionsForPart, exitPortForPart, type PartKind, type PlacedPart } from './partDefinitions'

export type Point = Readonly<{ x: number; y: number }>
export type Vector = Point

export const CELL_HALF_SIZE = 0.5
export const CELL_CENTER: Point = { x: 0, y: 0 }

const EPSILON = 1e-9

/** Normalized point at the edge midpoint or corner represented by a port. */
export function portPoint(direction: Direction): Point {
  switch (direction) {
    case 'N': return { x: 0, y: -CELL_HALF_SIZE }
    case 'NE': return { x: CELL_HALF_SIZE, y: -CELL_HALF_SIZE }
    case 'E': return { x: CELL_HALF_SIZE, y: 0 }
    case 'SE': return { x: CELL_HALF_SIZE, y: CELL_HALF_SIZE }
    case 'S': return { x: 0, y: CELL_HALF_SIZE }
    case 'SW': return { x: -CELL_HALF_SIZE, y: CELL_HALF_SIZE }
    case 'W': return { x: -CELL_HALF_SIZE, y: 0 }
    case 'NW': return { x: -CELL_HALF_SIZE, y: -CELL_HALF_SIZE }
  }
}

export const directionPoint = portPoint

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y }
}

function scale(a: Point, factor: number): Point {
  return { x: a.x * factor, y: a.y * factor }
}

type LineSegment = Readonly<{ kind: 'line'; from: Point; to: Point; length: number }>
type QuadraticSegment = Readonly<{
  kind: 'quadratic'
  from: Point
  control: Point
  to: Point
  length: number
  /** Cumulative arc-length lookup table used for uniform-speed sampling. */
  lut: readonly QuadraticLutPoint[]
}>
type Segment = LineSegment | QuadraticSegment

type QuadraticLutPoint = Readonly<{ t: number; length: number }>

function quadraticPoint(segment: QuadraticSegment, t: number): Point {
  const oneMinus = 1 - t
  return add(add(scale(segment.from, oneMinus * oneMinus), scale(segment.control, 2 * oneMinus * t)), scale(segment.to, t * t))
}

function quadraticTangent(segment: QuadraticSegment, t: number): Vector {
  return {
    x: 2 * ((1 - t) * (segment.control.x - segment.from.x) + t * (segment.to.x - segment.control.x)),
    y: 2 * ((1 - t) * (segment.control.y - segment.from.y) + t * (segment.to.y - segment.control.y)),
  }
}

function lineTangent(segment: LineSegment): Vector {
  return { x: segment.to.x - segment.from.x, y: segment.to.y - segment.from.y }
}

function segmentPoint(segment: Segment, t: number): Point {
  return segment.kind === 'line' ? lerp(segment.from, segment.to, t) : quadraticPoint(segment, t)
}

function segmentTangent(segment: Segment, t: number): Vector {
  if (segment.kind === 'line') return lineTangent(segment)
  return quadraticTangent(segment, t)
}

function quadraticArcLengthLut(from: Point, control: Point, to: Point): { length: number; lut: readonly QuadraticLutPoint[] } {
  // The same deterministic LUT is used both to measure a bend and to invert
  // distance back to its quadratic parameter. This avoids visibly speeding
  // up near the centre of a curve.
  const sampleCount = 64
  const lut: QuadraticLutPoint[] = [{ t: 0, length: 0 }]
  let length = 0
  let previous = from
  for (let index = 1; index <= sampleCount; index += 1) {
    const t = index / sampleCount
    const current = quadraticPoint({ kind: 'quadratic', from, control, to, length: 0, lut: [] }, t)
    length += distance(previous, current)
    lut.push({ t, length })
    previous = current
  }
  return { length, lut }
}

function lineSegment(from: Point, to: Point): LineSegment {
  return { kind: 'line', from, to, length: distance(from, to) }
}

function quadraticSegment(from: Point, control: Point, to: Point): QuadraticSegment {
  const measured = quadraticArcLengthLut(from, control, to)
  return { kind: 'quadratic', from, control, to, length: measured.length, lut: measured.lut }
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function segmentParameterAtDistance(segment: Segment, targetDistance: number): number {
  if (segment.length <= EPSILON) return 0
  if (segment.kind === 'line') return clampUnit(targetDistance / segment.length)
  const target = Math.min(segment.length, Math.max(0, targetDistance))
  const lut = segment.lut
  for (let index = 1; index < lut.length; index += 1) {
    const previous = lut[index - 1]!
    const current = lut[index]!
    if (target <= current.length || index === lut.length - 1) {
      const span = current.length - previous.length
      const fraction = span <= EPSILON ? 0 : (target - previous.length) / span
      return clampUnit(previous.t + (current.t - previous.t) * fraction)
    }
  }
  return 1
}

export type PathSpec = Readonly<{
  kind: PartKind | 'connector'
  start: Point
  end: Point
  length: number
  /** Arc-length normalized point (0=start, 1=end). */
  sample: (progress: number) => Point
  /** Unit-ish tangent in path travel direction. */
  tangent: (progress: number) => Vector
  /** Aliases useful to SVG/canvas callers. */
  pointAt: (progress: number) => Point
  tangentAt: (progress: number) => Vector
  segments: readonly Segment[]
}>

function createPathSpec(kind: PathSpec['kind'], segments: readonly Segment[]): PathSpec {
  const length = segments.reduce((sum, segment) => sum + segment.length, 0)
  const sample = (progress: number): Point => {
    if (segments.length === 0) return CELL_CENTER
    const target = clampUnit(progress) * length
    let cursor = 0
    for (const segment of segments) {
      const next = cursor + segment.length
      if (target <= next + EPSILON || segment === segments[segments.length - 1]) {
        const localDistance = segment.length <= EPSILON ? 0 : target - cursor
        return segmentPoint(segment, segmentParameterAtDistance(segment, localDistance))
      }
      cursor = next
    }
    return segmentPoint(segments[segments.length - 1]!, 1)
  }
  const tangent = (progress: number): Vector => {
    if (segments.length === 0) return { x: 0, y: 0 }
    const target = clampUnit(progress) * length
    let cursor = 0
    for (const segment of segments) {
      const next = cursor + segment.length
      if (target <= next + EPSILON || segment === segments[segments.length - 1]) {
        const localDistance = segment.length <= EPSILON ? 0 : target - cursor
        const raw = segmentTangent(segment, segmentParameterAtDistance(segment, localDistance))
        const magnitude = Math.hypot(raw.x, raw.y)
        return magnitude <= EPSILON ? { x: 0, y: 0 } : { x: raw.x / magnitude, y: raw.y / magnitude }
      }
      cursor = next
    }
    return { x: 0, y: 0 }
  }
  return {
    kind,
    start: segments[0]?.from ?? CELL_CENTER,
    end: segments.at(-1)?.to ?? CELL_CENTER,
    length,
    sample,
    tangent,
    pointAt: sample,
    tangentAt: tangent,
    segments,
  }
}

/** A straight or centre-to-port connector, represented in normalized cell units. */
export function createConnectorPath(start: Point, end: Point): PathSpec {
  return createPathSpec('connector', [lineSegment(start, end)])
}

function partPathBetweenPorts(kind: PartKind, from: Direction, to: Direction): PathSpec {
  const start = portPoint(from)
  const end = portPoint(to)
  if (kind === 'curve' || kind === 'gentle-curve' || kind === 'double-curve') {
    // A single quadratic keeps the tangent continuous through the bend. The
    // control point at the centre also makes all rotations use exactly the
    // same, shared geometry for drawing and driving.
    return createPathSpec(kind, [quadraticSegment(start, CELL_CENTER, end)])
  }
  return createPathSpec(kind, [lineSegment(start, end)])
}

/**
 * Shared path specification used by both road rendering and route walking.
 * `entryPort` is the port on the current cell where the car arrived.
 */
export function getPathSpec(part: PlacedPart, entryPort?: Direction): PathSpec {
  const ports = connectionsForPart(part)
  if (part.kind === 'start') {
    return createConnectorPath(CELL_CENTER, portPoint(ports[0]!))
  }
  if (part.kind === 'goal') {
    const port = entryPort ?? ports[0]!
    return createConnectorPath(portPoint(port), CELL_CENTER)
  }
  const from = entryPort && ports.includes(entryPort) ? entryPort : ports[0]!
  const to = exitPortForPart(part, from) ?? from
  return partPathBetweenPorts(part.kind, from, to)
}

export const pathSpecForPart = getPathSpec
export const buildPathSpec = getPathSpec

export function pathFromCenterToPort(direction: Direction): PathSpec {
  return createConnectorPath(CELL_CENTER, portPoint(direction))
}

export function pathFromPortToCenter(direction: Direction): PathSpec {
  return createConnectorPath(portPoint(direction), CELL_CENTER)
}

/** SVG path data for the normalized spec, primarily useful for lightweight UI. */
export function pathSpecToSvgPath(spec: PathSpec): string {
  const pieces: string[] = [`M ${spec.start.x} ${spec.start.y}`]
  for (const segment of spec.segments) {
    if (segment.kind === 'line') pieces.push(`L ${segment.to.x} ${segment.to.y}`)
    else pieces.push(`Q ${segment.control.x} ${segment.control.y} ${segment.to.x} ${segment.to.y}`)
  }
  return pieces.join(' ')
}

export const svgPathForSpec = pathSpecToSvgPath

export function portIsOnEdge(direction: Direction): boolean {
  return isCardinalDirection(direction)
}

export { oppositeDirection }
