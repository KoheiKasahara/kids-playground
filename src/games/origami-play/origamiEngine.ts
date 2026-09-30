/**
 * A tiny flat-folding model. Paper is a stack of convex faces (bottom → top) in model
 * coordinates; each operation folds, turns over or reshapes that stack. The result is a
 * list of states (one per step) plus the frame data the renderer needs to animate a fold.
 */
export type Point = readonly [number, number]
export type Side = 'front' | 'back'
export type Face = { id: number; points: readonly Point[]; side: Side; tags: readonly string[] }
export type FaceSpec = { points: readonly Point[]; side: Side; tags?: readonly string[] }
export type FaceFilter = (face: Face) => boolean
export type Bounds = { minX: number; minY: number; maxX: number; maxY: number }

export type FoldOp = {
  /** valley: flap lands on top. mountain: flap goes behind. reverse: flap tucks inside without turning over. */
  type: 'valley' | 'mountain' | 'reverse'
  line: readonly [Point, Point]
  /** Any point on the side of the line that moves. */
  move: Point
  select?: FaceFilter
  tag?: string
}
export type FlipOp = { type: 'flip' }
/** Squash / petal folds are too three-dimensional to simulate; swap the affected layers for their flat result. */
export type ReshapeOp = { type: 'reshape'; remove: FaceFilter; add: readonly FaceSpec[] }
export type OrigamiOp = FoldOp | FlipOp | ReshapeOp

export type FoldFrame = {
  type: FoldOp['type']
  before: readonly Face[]
  moving: ReadonlySet<number>
  axis: readonly [Point, Point]
  onTop: boolean
}
export type Frame = FoldFrame | { type: 'flip' } | { type: 'reshape'; removed: ReadonlySet<number>; added: readonly Face[] }
export type Sequence = { states: readonly (readonly Face[])[]; frames: readonly Frame[] }

const EPSILON = 1e-6

export function hasTag(tag: string): FaceFilter {
  return (face) => face.tags.includes(tag)
}

export function lacksTag(...tags: string[]): FaceFilter {
  return (face) => tags.every((tag) => !face.tags.includes(tag))
}

export function area(points: readonly Point[]) {
  let sum = 0
  points.forEach(([x, y], index) => {
    const [nx, ny] = points[(index + 1) % points.length]!
    sum += x * ny - nx * y
  })
  return Math.abs(sum) / 2
}

export function centroid(faces: readonly { points: readonly Point[] }[]): Point {
  let weight = 0
  let x = 0
  let y = 0
  for (const face of faces) {
    const faceArea = Math.max(area(face.points), EPSILON)
    const cx = face.points.reduce((sum, point) => sum + point[0], 0) / face.points.length
    const cy = face.points.reduce((sum, point) => sum + point[1], 0) / face.points.length
    weight += faceArea
    x += cx * faceArea
    y += cy * faceArea
  }
  return weight === 0 ? [0, 0] : [x / weight, y / weight]
}

export function faceCenterX(face: Face) {
  return centroid([face])[0]
}

export function bounds(faces: readonly { points: readonly Point[] }[]): Bounds {
  const result = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  for (const face of faces) {
    for (const [x, y] of face.points) {
      result.minX = Math.min(result.minX, x)
      result.minY = Math.min(result.minY, y)
      result.maxX = Math.max(result.maxX, x)
      result.maxY = Math.max(result.maxY, y)
    }
  }
  return result
}

export function reflect([x, y]: Point, [[ax, ay], [bx, by]]: readonly [Point, Point]): Point {
  const dx = bx - ax
  const dy = by - ay
  const distance = ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)
  return [2 * (ax + distance * dx) - x, 2 * (ay + distance * dy) - y]
}

function sideOf([x, y]: Point, [[ax, ay], [bx, by]]: readonly [Point, Point]) {
  const value = (bx - ax) * (y - ay) - (by - ay) * (x - ax)
  return Math.abs(value) < EPSILON ? 0 : value
}

/** Keep the part of a convex polygon where `value(point) >= 0`. */
function clip(points: readonly Point[], value: (point: Point) => number) {
  const kept: Point[] = []
  points.forEach((current, index) => {
    const next = points[(index + 1) % points.length]!
    const a = value(current)
    const b = value(next)
    if (a >= 0) kept.push(current)
    if ((a > 0 && b < 0) || (a < 0 && b > 0)) {
      const t = a / (a - b)
      kept.push([current[0] + (next[0] - current[0]) * t, current[1] + (next[1] - current[1]) * t])
    }
  })
  return area(kept) < 0.5 ? null : kept
}

function toggle(side: Side): Side {
  return side === 'front' ? 'back' : 'front'
}

export function buildSequence(start: readonly FaceSpec[], ops: readonly OrigamiOp[]): Sequence {
  let nextId = 0
  const make = (spec: FaceSpec): Face => ({ id: nextId++, points: spec.points, side: spec.side, tags: spec.tags ?? [] })
  let faces = start.map(make)
  const states: Face[][] = [faces]
  const frames: Frame[] = []

  for (const op of ops) {
    if (op.type === 'flip') {
      faces = faces.map((face) => ({ ...face, points: face.points.map(([x, y]) => [-x, y] as Point), side: toggle(face.side) })).reverse()
      frames.push({ type: 'flip' })
    } else if (op.type === 'reshape') {
      const removed = new Set(faces.filter(op.remove).map((face) => face.id))
      const added = op.add.map(make)
      faces = [...faces.filter((face) => !removed.has(face.id)), ...added]
      frames.push({ type: 'reshape', removed, added })
    } else {
      const direction = Math.sign(sideOf(op.move, op.line))
      const before: Face[] = []
      const moving = new Set<number>()
      for (const face of faces) {
        if (op.select && !op.select(face)) {
          before.push(face)
          continue
        }
        const moved = clip(face.points, (point) => direction * sideOf(point, op.line))
        if (!moved) {
          before.push(face)
          continue
        }
        const stays = clip(face.points, (point) => -direction * sideOf(point, op.line))
        const flap = stays ? { ...face, id: nextId++, points: moved } : face
        if (stays) before.push({ ...face, id: nextId++, points: stays })
        before.push(flap)
        moving.add(flap.id)
      }
      if (moving.size === 0) throw new Error(`fold ${frames.length + 1} does not move any paper`)
      // A reverse fold tucks the flap inside itself, so its layers keep their order.
      const lifted = before.filter((face) => moving.has(face.id))
      const flaps = (op.type === 'reverse' ? lifted : lifted.reverse()).map((face) => ({
        ...face,
        points: face.points.map((point) => reflect(point, op.line)),
        side: op.type === 'reverse' ? face.side : toggle(face.side),
        tags: op.tag ? [...face.tags, op.tag] : face.tags,
      }))
      const rest = before.filter((face) => !moving.has(face.id))
      const onTop = op.type === 'valley'
      faces = onTop ? [...rest, ...flaps] : [...flaps, ...rest]
      frames.push({ type: op.type, before, moving, axis: op.line, onTop })
    }
    states.push(faces)
  }
  return { states, frames }
}

/** A square sheet: `diamond` stands on a corner, otherwise its edges are level. */
export function squareSheet(side: Side, shape: 'diamond' | 'square'): FaceSpec[] {
  const points: Point[] = shape === 'diamond'
    ? [[0, -140], [140, 0], [0, 140], [-140, 0]]
    : [[-100, -100], [100, -100], [100, 100], [-100, 100]]
  return [{ points, side }]
}
