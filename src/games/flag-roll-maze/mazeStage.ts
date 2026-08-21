import { BALL_RADIUS, CELL_SIZE_IN_RADII } from './mazePhysics'

/**
 * 迷路の形は文字グリッドで持ち、そこから床・壁・START・GOALを組み立てる。
 * 見たままの形を編集できるので、将来ステージを増やすときも
 * 座標計算をやり直さずに済む。
 */

/** 1マスの一辺（ワールド単位）。通路幅3.0Rとし、直径2Rのボールの左右に片側0.5Rの余白を確保する。 */
export const CELL_SIZE = BALL_RADIUS * CELL_SIZE_IN_RADII

export type MazeCell = '#' | '.' | 'S' | 'G'

export type MazeWallRect = {
  /** 中心座標。 */
  x: number
  z: number
  /** X方向の長さ。横に並んだ壁マスをまとめた結果。 */
  width: number
  /** Z方向の長さ。常に1マス。 */
  depth: number
}

export type MazePoint = { x: number; z: number }

export type MazeStage = {
  id: string
  /** 画面に出す短い名前。 */
  nameJa: string
  rows: readonly string[]
  columnCount: number
  rowCount: number
  boardWidth: number
  boardDepth: number
  walls: MazeWallRect[]
  start: MazePoint
  goal: MazePoint
}

/**
 * Phase 1で検証するのは「傾けて転がすのが楽しいか」なので、
 * 行き止まりのない一本道の蛇行コースにして、迷って詰まる要素を作らない。
 */
const STAGE_ROWS = [
  '#########',
  '#S......#',
  '#######.#',
  '#.......#',
  '#.#######',
  '#.......#',
  '#######.#',
  '#G......#',
  '#########',
] as const

/** グリッドの列・行番号を盤面中央原点のワールド座標へ変換する。 */
export function cellToWorld(
  column: number,
  row: number,
  columnCount: number,
  rowCount: number,
  cellSize = CELL_SIZE,
): MazePoint {
  return {
    x: (column - (columnCount - 1) / 2) * cellSize,
    z: (row - (rowCount - 1) / 2) * cellSize,
  }
}

/**
 * 横に連続する壁マスを1つの矩形へまとめる。
 * コライダーとMeshの数がマス数ではなく壁の本数で決まるため、低速端末でも軽い。
 */
export function buildWallRects(
  rows: readonly string[],
  cellSize = CELL_SIZE,
): MazeWallRect[] {
  const rowCount = rows.length
  const columnCount = rows[0]?.length ?? 0
  const rects: MazeWallRect[] = []

  for (const [row, line] of rows.entries()) {
    let runStart: number | null = null
    for (let column = 0; column <= columnCount; column += 1) {
      const isWall = line[column] === '#'
      if (isWall && runStart === null) {
        runStart = column
        continue
      }
      if (!isWall && runStart !== null) {
        const length = column - runStart
        const center = cellToWorld(
          runStart + (length - 1) / 2,
          row,
          columnCount,
          rowCount,
          cellSize,
        )
        rects.push({
          x: center.x,
          z: center.z,
          width: length * cellSize,
          depth: cellSize,
        })
        runStart = null
      }
    }
  }
  return rects
}

/** グリッドから最初に見つかった記号のマス中心を返す。 */
function findCell(rows: readonly string[], symbol: MazeCell): MazePoint {
  const rowCount = rows.length
  const columnCount = rows[0]?.length ?? 0
  for (const [row, line] of rows.entries()) {
    const column = line.indexOf(symbol)
    if (column >= 0) return cellToWorld(column, row, columnCount, rowCount)
  }
  throw new Error(`迷路に ${symbol} がありません`)
}

/** 文字グリッドから遊べる形のステージを組み立てる。 */
export function createMazeStage(
  rows: readonly string[] = STAGE_ROWS,
  options: { id?: string; nameJa?: string } = {},
): MazeStage {
  const rowCount = rows.length
  const columnCount = rows[0]?.length ?? 0
  if (rowCount === 0 || columnCount === 0) throw new Error('迷路のグリッドが空です')
  if (rows.some((line) => line.length !== columnCount)) {
    throw new Error('迷路の各行の長さが揃っていません')
  }

  return {
    id: options.id ?? 'stage-1',
    nameJa: options.nameJa ?? 'めいろ 1',
    rows,
    columnCount,
    rowCount,
    boardWidth: columnCount * CELL_SIZE,
    boardDepth: rowCount * CELL_SIZE,
    walls: buildWallRects(rows),
    start: findCell(rows, 'S'),
    goal: findCell(rows, 'G'),
  }
}

/** カメラが盤面全体を収めるための境界。壁の外周ぶんを含む。 */
export function mazeStageBounds(stage: MazeStage): {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
} {
  return {
    minX: -stage.boardWidth / 2,
    maxX: stage.boardWidth / 2,
    minZ: -stage.boardDepth / 2,
    maxZ: stage.boardDepth / 2,
  }
}

/**
 * STARTからGOALまでの最短経路を幅優先で求め、通るマス中心をワールド座標で返す。
 * クリア可能かの検査だけでなく、物理テストで「実際に転がして着けるか」を
 * 確かめるときの目標地点としても使う。
 */
export function findMazePath(
  rows: readonly string[],
  cellSize = CELL_SIZE,
): MazePoint[] | null {
  const rowCount = rows.length
  const columnCount = rows[0]?.length ?? 0
  let start: string | null = null
  let goal: string | null = null
  for (const [row, line] of rows.entries()) {
    for (let column = 0; column < columnCount; column += 1) {
      if (line[column] === 'S') start = `${column},${row}`
      if (line[column] === 'G') goal = `${column},${row}`
    }
  }
  if (start === null || goal === null) return null

  // 各マスへ最初に到達した経路が最短になるので、来た元を辿れば経路を復元できる。
  const cameFrom = new Map<string, string | null>([[start, null]])
  const queue: string[] = [start]
  while (queue.length > 0) {
    const current = queue.shift()!
    if (current === goal) {
      const path: MazePoint[] = []
      let cursor: string | null = current
      while (cursor !== null) {
        const [column, row] = cursor.split(',').map(Number) as [number, number]
        path.push(cellToWorld(column, row, columnCount, rowCount, cellSize))
        cursor = cameFrom.get(cursor) ?? null
      }
      return path.reverse()
    }
    const [column, row] = current.split(',').map(Number) as [number, number]
    for (const [nextColumn, nextRow] of [
      [column + 1, row],
      [column - 1, row],
      [column, row + 1],
      [column, row - 1],
    ] as [number, number][]) {
      if (nextColumn < 0 || nextColumn >= columnCount) continue
      if (nextRow < 0 || nextRow >= rowCount) continue
      if (rows[nextRow]![nextColumn] === '#') continue
      const key = `${nextColumn},${nextRow}`
      if (cameFrom.has(key)) continue
      cameFrom.set(key, current)
      queue.push(key)
    }
  }
  return null
}

/** ステージ追加時に「クリア不能な迷路」を混入させないための品質ゲート。 */
export function isMazeSolvable(rows: readonly string[]): boolean {
  return findMazePath(rows) !== null
}

/** Phase 1で遊べる唯一のステージ。 */
export const MAZE_STAGE_ROWS = STAGE_ROWS
