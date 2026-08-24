import { CELL_SIZE, GRID_COLS, GRID_LEFT, GRID_ROWS, GRID_TOP } from './boardLayout'

/** 配置グリッドのマス。左上が (col: 0, row: 0) */
export type GridCell = { readonly col: number; readonly row: number }

/** 盤面の論理座標（px） */
export type Point = { readonly x: number; readonly y: number }

/** マスの中心の論理座標。パーツの描画位置と物理Bodyの位置はどちらもここを基準にする */
export function cellCenter(cell: GridCell): Point {
  return {
    x: GRID_LEFT + cell.col * CELL_SIZE + CELL_SIZE / 2,
    y: GRID_TOP + cell.row * CELL_SIZE + CELL_SIZE / 2,
  }
}

/** グリッドの範囲内のマスか */
export function isInsideGrid(cell: GridCell): boolean {
  return cell.col >= 0 && cell.col < GRID_COLS && cell.row >= 0 && cell.row < GRID_ROWS
}

/**
 * 論理座標を最寄りのマスへスナップする。
 * 等間隔のグリッドでは「その点を含むマス」が「中心が最も近いマス」と一致するため、
 * 距離計算をせず切り捨てで求められる。グリッドの外を指した場合も範囲外の
 * col / row をそのまま返し、置けるかどうかの判断は isInsideGrid 側に任せる
 * （端へ寄せて無理に置くと、幼児には「押した場所と違うところに出た」と見えるため）。
 */
export function nearestCell(point: Point): GridCell {
  return {
    col: Math.floor((point.x - GRID_LEFT) / CELL_SIZE),
    row: Math.floor((point.y - GRID_TOP) / CELL_SIZE),
  }
}

/** Set / Map のキーに使う、マスの文字列表現 */
export function cellKey(cell: GridCell): string {
  return `${cell.col},${cell.row}`
}

export function sameCell(a: GridCell, b: GridCell): boolean {
  return a.col === b.col && a.row === b.row
}
