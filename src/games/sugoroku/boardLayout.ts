import type { Course } from './courses'

/** ばんめんの 1マスぶんの おおきさ（SVG の ざひょう）。 */
export const CELL = 100

export type Point = { x: number; y: number }

export function boardRows(course: Course): number {
  return Math.ceil(course.length / course.columns)
}

export function boardSize(course: Course): { width: number; height: number } {
  return { width: course.columns * CELL, height: boardRows(course) * CELL }
}

/** ひだりうえの スタートから、だんごとに むきを かえる ジグザグで ならべた マスの まんなか。 */
export function squareCenter(course: Course, index: number): Point {
  const row = Math.floor(index / course.columns)
  const step = index % course.columns
  const column = row % 2 === 0 ? step : course.columns - 1 - step
  return { x: column * CELL + CELL / 2, y: row * CELL + CELL / 2 }
}

/** おなじ マスに いる コマを ずらす ばしょ。ひとりなら まんなか。 */
export function pieceOffset(slot: number, together: number): Point {
  if (together <= 1) return { x: 0, y: 0 }
  const spread = CELL * 0.2
  if (together === 2) return { x: slot === 0 ? -spread : spread, y: 0 }
  return { x: slot % 2 === 0 ? -spread : spread, y: slot < 2 ? -spread : spread }
}
