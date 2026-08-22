import { CELL_SIZE, cellToWorld } from './mazeGrid'
import type { MazePoint } from './mazeGrid'
import {
  resolveGimmicks,
  type CellCoordinate,
  type GimmickPlacement,
  type MazeGimmicks,
  type MazeHole,
} from './mazeGimmicks'

// 既存の利用側がmazeStageから座標の正本を参照しているため、互換re-exportを残す。
export { CELL_SIZE, cellToWorld }
export type { MazePoint }

/**
 * 迷路の形は文字グリッドで持ち、そこから床・壁・START・GOAL・穴を組み立てる。
 * 見たままの形を編集できるので、将来ステージを増やすときも
 * 座標計算をやり直さずに済む。
 */

export type MazeCell = '#' | '.' | 'S' | 'G' | 'O'

export type MazeWallRect = {
  /** 中心座標。 */
  x: number
  z: number
  /** X方向の長さ。横に並んだ壁マスをまとめた結果。 */
  width: number
  /** Z方向の長さ。常に1マス。 */
  depth: number
}

export type MazeFloorRect = {
  /** 床矩形の中心座標。 */
  x: number
  z: number
  /** X方向の長さ。連続する床マスを横にまとめた大きさ。 */
  width: number
  /** Z方向の長さ。上下にまとめた床マスを含む大きさ。 */
  depth: number
}

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
  floors: MazeFloorRect[]
  holes: MazeHole[]
  gimmicks: MazeGimmicks
  checkpoints: MazePoint[]
  start: MazePoint
  goal: MazePoint
}

/**
 * 上下を3マス幅の部屋にし、中央の2マス幅の縦通路でつないだ11×11のステージ。
 * 壁の下にも床を置く一方、Oのマスだけは床を抜いて落下を分かりやすくする。
 */
const STAGE_ROWS = [
  '###########',
  '#S........#',
  '#.........#',
  '#.........#',
  '######O.###',
  '######O.###',
  '######O.###',
  '#.........#',
  '#G........#',
  '#.........#',
  '###########',
] as const

/** 既定ステージのギミックはセル座標で管理し、グリッドの大きさに合わせて解決する。 */
const STAGE_GIMMICKS: readonly GimmickPlacement[] = [
  // 下の縦通路(列7)へ降りる導線の真上に置き、普通に進むと必ず棒に出会うようにする。
  // 南側には1.9の退避レーンが残るので、避けたい子は部屋の下側を回れば通れる。
  { kind: 'spinner', id: 'spinner-top', cell: { column: 7.0, row: 1.85 }, angularSpeed: 1.0, initialAngle: 0 },
  // ゴール手前の最後の関門。少し遅くして、終盤でも落ち着いて抜けられるようにする。
  { kind: 'spinner', id: 'spinner-goal', cell: { column: 2.5, row: 8.0 }, angularSpeed: -0.85, initialAngle: Math.PI / 2 },
  // 下の部屋。ボールは列6付近から入って左のゴールへ向かうので、その道すじへ散らして置く。
  { kind: 'bumper', id: 'bumper-a', cell: { column: 7.5, row: 8.0 } },
  { kind: 'bumper', id: 'bumper-b', cell: { column: 5.6, row: 7.6 } },
  { kind: 'bumper', id: 'bumper-c', cell: { column: 4.2, row: 8.4 } },
]

/** 復帰先はスタートから順に並べ、穴やギミックの直前で再開しないようにする。 */
const STAGE_CHECKPOINT_CELLS = [
  { column: 1, row: 1 },      // START
  { column: 7, row: 3 },      // 穴のある縦通路へ入る直前
  { column: 6, row: 7 },      // 穴を抜けて下の部屋へ入った直後
  { column: 5.0, row: 8.6 },  // ゴール手前の回転棒へ挑む前
] as const

/** グリッドの列・行番号が指定した点と一致するかを比較する。 */
function samePoint(a: MazePoint | undefined, b: MazePoint): boolean {
  return a?.x === b.x && a.z === b.z
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
      const isWall = column < columnCount && line[column] === '#'
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

type FloorRun = {
  startColumn: number
  endColumn: number
  startRow: number
  endRow: number
}

/**
 * 穴以外のマスを行ごとの連続区間にし、同じ列範囲が上下に続くときだけ縦にもまとめる。
 * 壁の下にも床を残すことで、床の切れ目でボールが引っ掛からないようにする。
 */
export function buildFloorRects(
  rows: readonly string[],
  cellSize = CELL_SIZE,
): MazeFloorRect[] {
  const rowCount = rows.length
  const columnCount = rows[0]?.length ?? 0
  const mergedRuns: FloorRun[] = []

  for (const [row, line] of rows.entries()) {
    let runStart: number | null = null
    for (let column = 0; column <= columnCount; column += 1) {
      const isFloor = column < columnCount && line[column] !== 'O'
      if (isFloor && runStart === null) {
        runStart = column
        continue
      }
      if (!isFloor && runStart !== null) {
        const endColumn = column - 1
        const previous = mergedRuns.find(
          (run) =>
            run.startColumn === runStart &&
            run.endColumn === endColumn &&
            run.endRow === row - 1,
        )
        if (previous) {
          previous.endRow = row
        } else {
          mergedRuns.push({
            startColumn: runStart,
            endColumn,
            startRow: row,
            endRow: row,
          })
        }
        runStart = null
      }
    }
  }

  return mergedRuns.map((run) => {
    const center = cellToWorld(
      (run.startColumn + run.endColumn) / 2,
      (run.startRow + run.endRow) / 2,
      columnCount,
      rowCount,
      cellSize,
    )
    return {
      x: center.x,
      z: center.z,
      width: (run.endColumn - run.startColumn + 1) * cellSize,
      depth: (run.endRow - run.startRow + 1) * cellSize,
    }
  })
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

/** 穴記号をワールド座標へ解決する。穴は1マスに1件だけ作る。 */
function findHoles(rows: readonly string[]): MazeHole[] {
  const rowCount = rows.length
  const columnCount = rows[0]?.length ?? 0
  const holes: MazeHole[] = []
  for (const [row, line] of rows.entries()) {
    for (let column = 0; column < columnCount; column += 1) {
      if (line[column] !== 'O') continue
      holes.push({
        center: cellToWorld(column, row, columnCount, rowCount),
        size: CELL_SIZE,
      })
    }
  }
  return holes
}

/** 文字グリッドから遊べる形のステージを組み立てる。 */
export function createMazeStage(
  rows: readonly string[] = STAGE_ROWS,
  options: {
    id?: string
    nameJa?: string
    gimmicks?: readonly GimmickPlacement[]
    checkpointCells?: readonly CellCoordinate[]
  } = {},
): MazeStage {
  const rowCount = rows.length
  const columnCount = rows[0]?.length ?? 0
  if (rowCount === 0 || columnCount === 0) throw new Error('迷路のグリッドが空です')
  if (rows.some((line) => line.length !== columnCount)) {
    throw new Error('迷路の各行の長さが揃っていません')
  }

  const start = findCell(rows, 'S')
  const goal = findCell(rows, 'G')
  const requestedCheckpointCells = options.checkpointCells ?? STAGE_CHECKPOINT_CELLS
  const checkpoints = requestedCheckpointCells.map((cell) =>
    cellToWorld(cell.column, cell.row, columnCount, rowCount),
  )
  // 復帰処理が常に安全な起点を持てるよう、外部指定でも先頭をSTARTに保証する。
  if (!samePoint(checkpoints[0], start)) checkpoints.unshift(start)

  return {
    id: options.id ?? 'stage-1',
    nameJa: options.nameJa ?? 'めいろ 1',
    rows,
    columnCount,
    rowCount,
    boardWidth: columnCount * CELL_SIZE,
    boardDepth: rowCount * CELL_SIZE,
    walls: buildWallRects(rows),
    floors: buildFloorRects(rows),
    holes: findHoles(rows),
    gimmicks: resolveGimmicks(
      options.gimmicks ?? STAGE_GIMMICKS,
      columnCount,
      rowCount,
    ),
    checkpoints,
    start,
    goal,
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
      const nextCell = rows[nextRow]?.[nextColumn]
      if (nextCell === undefined || nextCell === '#' || nextCell === 'O') continue
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

/** Phase 4で遊ぶ唯一のステージ。 */
export const MAZE_STAGE_ROWS = STAGE_ROWS
