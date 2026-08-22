import { BALL_RADIUS, CELL_SIZE_IN_RADII } from './mazePhysics'

/**
 * 文字グリッドとワールド座標をつなぐ最小モジュール。
 * ギミック側からステージ全体を参照しなくて済むよう、座標の正本をここへ集める。
 */

/** 1マスの一辺。ボール直径の両側に余白を残せる3Rを採用する。 */
export const CELL_SIZE = BALL_RADIUS * CELL_SIZE_IN_RADII

export type MazePoint = { x: number; z: number }

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
