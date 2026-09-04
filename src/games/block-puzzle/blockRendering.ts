/**
 * ブロックを「バラバラの四角」ではなく「1つのまとまったパーツ」に見せるための、
 * 描画に必要な形の計算だけを集めた純粋関数。React には依存しない。
 *
 * 盤面上の配置済みブロックも、パーツ一覧のミニ表示も、同じ関数を通して描くので
 * 見た目が2か所でずれない。
 */

/** 相対セル(CellOffset)・絶対マス(BoardCell)のどちらでも受けられる、位置だけの形。 */
export type RenderCell = { readonly col: number; readonly row: number }

/** セル群を囲む最小の長方形。左上の位置と、列数・行数。 */
export type CellBounds = {
  readonly minCol: number
  readonly minRow: number
  readonly cols: number
  readonly rows: number
}

export function cellBounds(cells: readonly RenderCell[]): CellBounds {
  const cols = cells.map((cell) => cell.col)
  const rows = cells.map((cell) => cell.row)
  const minCol = Math.min(...cols)
  const minRow = Math.min(...rows)
  return {
    minCol,
    minRow,
    cols: Math.max(...cols) - minCol + 1,
    rows: Math.max(...rows) - minRow + 1,
  }
}

/** セル群を、囲む長方形の左上が (0,0) になるように平行移動する。 */
export function normalizeCells(cells: readonly RenderCell[]): RenderCell[] {
  const bounds = cellBounds(cells)
  return cells.map((cell) => ({ col: cell.col - bounds.minCol, row: cell.row - bounds.minRow }))
}

/** 盤面全体に対する割合(%)で表した、セル群の位置と大きさ。 */
export type CellRectPercent = {
  readonly leftPercent: number
  readonly topPercent: number
  readonly widthPercent: number
  readonly heightPercent: number
}

/**
 * セル群が占める範囲を、盤面（boardCols × boardRows）に対する割合(%)で表す。
 * グリッドの行・列番号ではなく割合で位置決めすることで、#483 の「回転で盤面外へ
 * はみ出た、まだ確定していないパーツ」も同じ仕組みでそのまま描ける
 * （CSS Gridの行番号は0や負の番号を「外側」として素直には扱えないため）。
 */
export function cellBoundsPercent(
  bounds: CellBounds,
  boardCols: number,
  boardRows: number,
): CellRectPercent {
  return {
    leftPercent: (bounds.minCol / boardCols) * 100,
    topPercent: (bounds.minRow / boardRows) * 100,
    widthPercent: (bounds.cols / boardCols) * 100,
    heightPercent: (bounds.rows / boardRows) * 100,
  }
}

/** そのセルの四辺が、パーツの外周かどうか（＝同じパーツの隣がいないか）。 */
export type CellEdges = {
  readonly top: boolean
  readonly right: boolean
  readonly bottom: boolean
  readonly left: boolean
}

/**
 * 外周の辺にだけ濃い輪郭と丸みを付け、内側の継ぎ目は細い線にとどめるための判定。
 * 角を丸めるかどうかは「その角に接する2辺がどちらも外周か」で決まるので、
 * 呼び出し側は edges の組み合わせで判断できる。
 */
export function cellEdges(cells: readonly RenderCell[], cell: RenderCell): CellEdges {
  const filled = new Set(cells.map((one) => `${one.col},${one.row}`))
  const isEmpty = (col: number, row: number) => !filled.has(`${col},${row}`)
  return {
    top: isEmpty(cell.col, cell.row - 1),
    right: isEmpty(cell.col + 1, cell.row),
    bottom: isEmpty(cell.col, cell.row + 1),
    left: isEmpty(cell.col - 1, cell.row),
  }
}
