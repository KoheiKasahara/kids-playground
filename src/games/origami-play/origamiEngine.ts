/**
 * A tiny flat-folding model. Paper is a stack of convex faces (bottom → top) in model
 * coordinates; each operation folds or turns over that stack. Folds only ever split and
 * reflect faces, so the paper is never cut or lost. Every face also remembers where it
 * came from on the unfolded sheet (`paper`), which lets a step pick layers by the part of
 * the sheet they belong to. The result is a list of states (one per step) plus the frame
 * data the renderer needs to animate each fold.
 */
export type Point = readonly [number, number]
export type Side = 'front' | 'back'
export type Face = { id: number; points: readonly Point[]; paper: readonly Point[]; side: Side; tags: readonly string[] }
export type FaceSpec = { points: readonly Point[]; side: Side; tags?: readonly string[] }
export type FaceFilter = (face: Face) => boolean
export type Bounds = { minX: number; minY: number; maxX: number; maxY: number }

export type FoldOp = {
  /** valley: flap lands on top. mountain: flap goes behind. reverse: flap tucks inside without turning over. */
  type: 'valley' | 'mountain' | 'reverse'
  line: readonly [Point, Point]
  /** Any point on the side of the line that moves; also where a child would pinch the paper. */
  move: Point
  select?: FaceFilter
  /** Only fold this many layers, counted from the top, of the paper under `move`. */
  top?: number
  /**
   * Keep the flap next to the layers it was folded from instead of moving it to the very
   * top or bottom of the whole stack (a flap folded inside a pocket or under one layer).
   */
  tuck?: boolean
  tag?: string
}
export type FlipOp = { type: 'flip' }
/** One hand movement made of several folds that happen together, such as a squash or petal fold. */
export type CollapseOp = { type: 'collapse'; folds: readonly FoldOp[] }
export type OrigamiOp = FoldOp | FlipOp | CollapseOp

export type FoldFrame = {
  type: FoldOp['type']
  before: readonly Face[]
  moving: ReadonlySet<number>
  axis: readonly [Point, Point]
  /** Where the flap sits among the faces that stay still (0 = under all of them). */
  layer: number
}
export type Frame = FoldFrame | { type: 'flip' } | { type: 'collapse'; parts: readonly FoldFrame[] }
export type Sequence = { states: readonly (readonly Face[])[]; frames: readonly Frame[] }

const EPSILON = 1e-6

export function hasTag(tag: string): FaceFilter {
  return (face) => face.tags.includes(tag)
}

export function lacksTag(...tags: string[]): FaceFilter {
  return (face) => tags.every((tag) => !face.tags.includes(tag))
}

/** Faces cut from the part of the unfolded sheet that `test` accepts. */
export function fromPaper(test: (point: Point) => boolean): FaceFilter {
  return (face) => test(centroid([{ points: face.paper }]))
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

function contains(points: readonly Point[], point: Point) {
  let sign = 0
  for (let index = 0; index < points.length; index += 1) {
    const value = sideOf(point, [points[index]!, points[(index + 1) % points.length]!])
    if (value === 0) continue
    if (sign === 0) sign = Math.sign(value)
    else if (Math.sign(value) !== sign) return false
  }
  return true
}

type Piece = { points: Point[]; paper: Point[] }

/** Keep the part of a convex face where `value(point) >= 0`, carrying the sheet position along. */
function clip(face: Face, value: (point: Point) => number): Piece | null {
  const points: Point[] = []
  const paper: Point[] = []
  face.points.forEach((current, index) => {
    const next = (index + 1) % face.points.length
    const a = value(current)
    const b = value(face.points[next]!)
    if (a >= 0) {
      points.push(current)
      paper.push(face.paper[index]!)
    }
    if ((a > 0 && b < 0) || (a < 0 && b > 0)) {
      const t = a / (a - b)
      const lerp = ([x0, y0]: Point, [x1, y1]: Point): Point => [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]
      points.push(lerp(current, face.points[next]!))
      paper.push(lerp(face.paper[index]!, face.paper[next]!))
    }
  })
  return area(points) < 0.5 ? null : { points, paper }
}

function toggle(side: Side): Side {
  return side === 'front' ? 'back' : 'front'
}

function applyFold(faces: readonly Face[], op: FoldOp, newId: () => number, label: string): { faces: Face[]; frame: FoldFrame } {
  const direction = Math.sign(sideOf(op.move, op.line))
  let chosen = faces.filter((face) => !op.select || op.select(face))
  if (op.top !== undefined) {
    const under = new Set(chosen.filter((face) => contains(face.points, op.move)).slice(-op.top).map((face) => face.id))
    chosen = chosen.filter((face) => under.has(face.id))
  }
  const chosenIds = new Set(chosen.map((face) => face.id))
  const before: Face[] = []
  const moving = new Set<number>()
  /** Faces that took part in the fold, including the parts left behind. */
  const involved = new Set<number>()
  for (const face of faces) {
    if (!chosenIds.has(face.id)) {
      before.push(face)
      continue
    }
    const moved = clip(face, (point) => direction * sideOf(point, op.line))
    if (!moved) {
      before.push(face)
      continue
    }
    const stays = clip(face, (point) => -direction * sideOf(point, op.line))
    const flap = stays ? { ...face, id: newId(), ...moved } : face
    if (stays) {
      const rest = { ...face, id: newId(), ...stays }
      before.push(rest)
      involved.add(rest.id)
    }
    before.push(flap)
    moving.add(flap.id)
    involved.add(flap.id)
  }
  if (moving.size === 0) throw new Error(`${label} does not move any paper`)

  const turn = (face: Face): Face => ({
    ...face,
    points: face.points.map((point) => reflect(point, op.line)),
    side: toggle(face.side),
    tags: op.tag ? [...face.tags, op.tag] : face.tags,
  })
  const rest = before.filter((face) => !moving.has(face.id))
  const lifted = before.filter((face) => moving.has(face.id))
  let layer: number
  let flaps: Face[]
  if (op.type === 'reverse') {
    // An inside reverse fold pushes the tip in between the layers: the front half folds
    // behind itself and the back half folds forward, so both meet in the middle.
    const back = lifted.slice(0, Math.ceil(lifted.length / 2))
    const front = lifted.slice(back.length)
    const middle = before.indexOf(front[0] ?? back[0]!)
    layer = before.slice(0, middle).filter((face) => !moving.has(face.id)).length
    flaps = [...back.reverse(), ...front.reverse()].map(turn)
  } else {
    flaps = lifted.reverse().map(turn)
    const touched = rest.map((face, index) => (involved.has(face.id) ? index : -1)).filter((index) => index >= 0)
    if (op.type === 'valley') layer = op.tuck && touched.length ? touched.at(-1)! + 1 : rest.length
    else layer = op.tuck && touched.length ? touched[0]! : 0
  }
  const result = [...rest.slice(0, layer), ...flaps, ...rest.slice(layer)]
  return { faces: result, frame: { type: op.type, before, moving, axis: op.line, layer } }
}

export function buildSequence(start: readonly FaceSpec[], ops: readonly OrigamiOp[]): Sequence {
  let nextId = 0
  const newId = () => nextId++
  let faces: Face[] = start.map((spec) => ({ id: newId(), points: spec.points, paper: spec.points, side: spec.side, tags: spec.tags ?? [] }))
  const states: Face[][] = [faces]
  const frames: Frame[] = []

  ops.forEach((op, index) => {
    if (op.type === 'flip') {
      faces = faces.map((face) => ({ ...face, points: face.points.map(([x, y]) => [-x, y] as Point), side: toggle(face.side) })).reverse()
      frames.push({ type: 'flip' })
    } else if (op.type === 'collapse') {
      const parts: FoldFrame[] = []
      op.folds.forEach((fold, part) => {
        const result = applyFold(faces, fold, newId, `step ${index + 1} part ${part + 1}`)
        faces = result.faces
        parts.push(result.frame)
      })
      frames.push({ type: 'collapse', parts })
    } else {
      const result = applyFold(faces, op, newId, `step ${index + 1}`)
      faces = result.faces
      frames.push(result.frame)
    }
    states.push(faces)
  })
  return { states, frames }
}

/** A square sheet: `diamond` stands on a corner, otherwise its edges are level. */
export function squareSheet(side: Side, shape: 'diamond' | 'square'): FaceSpec[] {
  const points: Point[] = shape === 'diamond'
    ? [[0, -140], [140, 0], [0, 140], [-140, 0]]
    : [[-100, -100], [100, -100], [100, 100], [-100, 100]]
  return [{ points, side }]
}
