/**
 * Garden maps: `H` = hive (start and goal), `.` = flower,
 * `#` = grass, `~` = pond, `^` = rock (the last three cannot be entered).
 */
export type Tile = 'H' | '.' | '#' | '~' | '^'
export type Stage = {
  name: string
  cols: number
  rows: number
  /** Tile for every board index (row-major). */
  tiles: readonly Tile[]
  /** Enterable cells; the first one is the hive. */
  cells: readonly number[]
}

function garden(name: string, map: readonly string[]): Stage {
  const cols = map[0].length
  const tiles = map.join('').split('') as Tile[]
  const hive = tiles.indexOf('H')
  const cells = [hive, ...tiles.flatMap((tile, i) => tile === '.' ? [i] : [])]
  return { name, cols, rows: map.length, tiles, cells }
}

export const STAGES: readonly Stage[] = [
  garden('ちいさな おにわ', ['H.', '..']),
  garden('ながい おにわ', ['H..', '...']),
  garden('ぐるっと おさんぽ', ['H..', '.~.', '...']),
  garden('わかれみち', ['H...', '....', '..##']),
  garden('おはなの ひろば', ['H...', '....', '....']),
  garden('おおきな おにわ', ['H...', '....', '....', '....']),
  garden('いわの ある みち', ['H....', '...^.', '.^...', '.....']),
  garden('いけの まわり', ['H....', '.....', '..~..', '.....', '.....']),
  garden('くねくね みち', ['H.....', '......', '^^^^..', '......', '......']),
  garden('もりの めいろ', ['H.....', '.^..^.', '......', '......', '.^..^.', '......']),
]

export function row(stage: Stage, cell: number): number { return Math.floor(cell / stage.cols) }
export function col(stage: Stage, cell: number): number { return cell % stage.cols }

export function adjacent(stage: Stage, a: number, b: number): boolean {
  return Math.abs(col(stage, a) - col(stage, b)) + Math.abs(row(stage, a) - row(stage, b)) === 1
}

export function isComplete(stage: Stage, path: readonly number[]): boolean {
  return path.length === stage.cells.length + 1 && path.at(-1) === stage.cells[0]
}

export function moves(stage: Stage, path: readonly number[]): number[] {
  if (isComplete(stage, path)) return []
  return stage.cells.filter(cell => adjacent(stage, path.at(-1)!, cell) &&
    (!path.includes(cell) || (cell === stage.cells[0] && path.length === stage.cells.length)))
}

/** Cheap necessary conditions for finishing the loop; prunes hopeless branches. */
function promising(stage: Stage, path: readonly number[]): boolean {
  const hive = stage.cells[0]
  const head = path.at(-1)!
  const rest = new Set(stage.cells.filter(cell => !path.includes(cell)))
  if (rest.size === 0) return true
  const ends = new Set([head, hive])
  for (const cell of rest) {
    const links = stage.cells.filter(other => adjacent(stage, cell, other) && (rest.has(other) || ends.has(other))).length
    if (links < 2) return false
  }
  const seen = new Set<number>()
  const queue = [...rest].filter(cell => adjacent(stage, cell, head)).slice(0, 1)
  while (queue.length) {
    const cell = queue.pop()!
    if (seen.has(cell)) continue
    seen.add(cell)
    for (const other of rest) if (!seen.has(other) && adjacent(stage, cell, other)) queue.push(other)
  }
  return seen.size === rest.size
}

export function solution(stage: Stage, path: readonly number[]): number[] | null {
  if (isComplete(stage, path)) return [...path]
  if (!promising(stage, path)) return null
  for (const cell of moves(stage, path)) {
    const result = solution(stage, [...path, cell])
    if (result) return result
  }
  return null
}
