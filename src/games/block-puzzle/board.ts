/**
 * ブロックパズルの盤面（マス目）そのものだけを扱う最小のモジュール。
 * パーツの形も配置も知らないので、盤面サイズを変えたいときはここだけを見ればよい。
 */

/**
 * 盤面の列数・行数。スマホ縦画面で「1マスが幼児にも押しやすい大きさ（実機で約60px）」に
 * なることを優先して 6×8 を採用している（8×8だと1マスが約45pxまで小さくなる）。
 * 縦長なのはスマホ縦画面の余白の形に合わせるため。
 */
export const BOARD_COLS = 6
export const BOARD_ROWS = 8

/** 盤面の総マス数。#482の「全マス埋まったか」の判定でも使う。 */
export const BOARD_CELL_COUNT = BOARD_COLS * BOARD_ROWS

/** 盤面のマス。左上が (col: 0, row: 0)。 */
export type BoardCell = { readonly col: number; readonly row: number }

/** 盤面の内側のマスか。盤面外への配置を弾く判定の土台。 */
export function isInsideBoard(cell: BoardCell): boolean {
  return cell.col >= 0 && cell.col < BOARD_COLS && cell.row >= 0 && cell.row < BOARD_ROWS
}

/** Set / Map のキーに使う、マスの文字列表現。 */
export function cellKey(cell: BoardCell): string {
  return `${cell.col},${cell.row}`
}

/** 盤面の全マスを左上から行優先で並べた配列。描画のループに使う。 */
export function allBoardCells(): BoardCell[] {
  const cells: BoardCell[] = []
  for (let row = 0; row < BOARD_ROWS; row += 1) {
    for (let col = 0; col < BOARD_COLS; col += 1) {
      cells.push({ col, row })
    }
  }
  return cells
}
