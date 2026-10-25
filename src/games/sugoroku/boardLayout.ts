import type { Course, GridPoint, Landmark, SceneryKind } from './courses'

/** ばんめんの 1マスぶんの おおきさ（SVG の ざひょう）。 */
export const CELL = 100
/** みちの まわりに のこす よはく（マスの かず）。 */
const MARGIN = 0.5
/** ちかくで みる ときに、がめんの みじかい ほうに ならぶ マスの かず。 */
export const VIEW_SPAN = 6

export type Point = { x: number; y: number }
export type Size = { width: number; height: number }

function gridBounds(course: Course): { minX: number; minY: number; columns: number; rows: number } {
  const xs = course.cells.map((cell) => cell.x)
  const ys = course.cells.map((cell) => cell.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  return { minX, minY, columns: Math.max(...xs) - minX + 1, rows: Math.max(...ys) - minY + 1 }
}

export function boardSize(course: Course): Size {
  const { columns, rows } = gridBounds(course)
  return { width: (columns + MARGIN * 2) * CELL, height: (rows + MARGIN * 2) * CELL }
}

/** マスめ（ひだりうえ）を ばんめんの ざひょうに する。 */
export function gridToBoard(course: Course, cell: GridPoint): Point {
  const { minX, minY } = gridBounds(course)
  return { x: (cell.x - minX + MARGIN) * CELL, y: (cell.y - minY + MARGIN) * CELL }
}

/** マスの まんなか。 */
export function squareCenter(course: Course, index: number): Point {
  const cell = course.cells[Math.min(Math.max(0, index), course.cells.length - 1)]!
  const corner = gridToBoard(course, cell)
  return { x: corner.x + CELL / 2, y: corner.y + CELL / 2 }
}

/** squares の じゅんに マスを むすぶ みち。まがりかどは まるく つなぐ。 */
export function roadPath(course: Course, squares: readonly number[]): string {
  const points = squares.map((index) => squareCenter(course, index))
  const mid = (a: Point, b: Point) => `${(a.x + b.x) / 2} ${(a.y + b.y) / 2}`
  let d = `M${points[0]!.x} ${points[0]!.y}`
  for (let index = 1; index < points.length - 1; index++) {
    const corner = points[index]!
    d += ` L${mid(points[index - 1]!, corner)} Q${corner.x} ${corner.y} ${mid(corner, points[index + 1]!)}`
  }
  const last = points.at(-1)!
  return `${d} L${last.x} ${last.y}`
}

export function landmarkCells(landmark: Landmark): GridPoint[] {
  return Array.from({ length: landmark.w * landmark.h }, (_, index) => ({
    x: landmark.x + (index % landmark.w),
    y: landmark.y + Math.floor(index / landmark.w),
  }))
}

export type SceneryItem = { kind: SceneryKind; x: number; y: number; flip: boolean }

/** みちも めじるしも ない マスに、いつも おなじ ならびで こものを ちらす。 */
export function scatterScenery(course: Course): SceneryItem[] {
  const { minX, minY, columns, rows } = gridBounds(course)
  const taken = new Set([...course.cells, ...course.landmarks.flatMap(landmarkCells)].map((cell) => `${cell.x},${cell.y}`))
  const items: SceneryItem[] = []
  for (let y = minY; y < minY + rows; y++) {
    for (let x = minX; x < minX + columns; x++) {
      if (taken.has(`${x},${y}`)) continue
      const hash = Math.abs((x * 73856093) ^ (y * 19349663) ^ course.length * 83492791)
      if (hash % 10 >= 6) continue
      const corner = gridToBoard(course, { x, y })
      // マスめの なかで すこし ずらして、ならびが かたく みえない ように する。
      const jitterX = ((hash >> 4) % 31) - 15
      const jitterY = ((hash >> 9) % 31) - 15
      items.push({
        kind: course.scenery[(hash >> 3) % course.scenery.length]!,
        x: corner.x + CELL / 2 + jitterX,
        y: corner.y + CELL / 2 + jitterY,
        flip: ((hash >> 2) & 1) === 1,
      })
    }
  }
  return items
}

/** ちかくで みる ときの みえる はんい（ばんめんの ざひょう）。みじかい ほうに VIEW_SPAN マス。 */
export function viewSize(aspect: number): Size {
  const span = VIEW_SPAN * CELL
  return aspect >= 1 ? { width: span * aspect, height: span } : { width: span, height: span / aspect }
}

export type Camera = { x: number; y: number; scale: number }

/**
 * みる ところを ばんめんの どこに あわせるか。focus を まんなかに おき、ばんめんの そとが
 * なるべく みえない ように はしで とめる。ばんめんの ほうが ちいさい むきは まんなかに よせる。
 * overview なら ばんめん ぜんたいを ちぢめて おさめる。
 */
export function cameraFor(board: Size, view: Size, focus: Point, overview: boolean): Camera {
  if (overview) {
    const scale = Math.min(view.width / board.width, view.height / board.height)
    return { x: (view.width - board.width * scale) / 2, y: (view.height - board.height * scale) / 2, scale }
  }
  const axis = (center: number, boardLength: number, viewLength: number) => (boardLength <= viewLength
    ? (viewLength - boardLength) / 2
    : Math.max(Math.min(viewLength / 2 - center, 0), viewLength - boardLength))
  return { x: axis(focus.x, board.width, view.width), y: axis(focus.y, board.height, view.height), scale: 1 }
}

/** おなじ マスに いる コマを ずらす ばしょ。ひとりなら まんなか。 */
export function pieceOffset(slot: number, together: number): Point {
  if (together <= 1) return { x: 0, y: 0 }
  const spread = CELL * 0.2
  if (together === 2) return { x: slot === 0 ? -spread : spread, y: 0 }
  return { x: slot % 2 === 0 ? -spread : spread, y: slot < 2 ? -spread : spread }
}
