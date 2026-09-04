/**
 * ブロックの「形の定義」だけを持つモジュール。盤面も配置状態も知らない。
 *
 * 形は「基準セル(0,0)からの相対セル」で定義する。基準セルは
 * 読み順（いちばん上の段の、いちばん左の占有セル）で最初に来るセルとし、
 * 必ずその形自身の占有セルになる（blockShapes.test.ts で不変条件として固定）。
 * これにより「タップしたマスは必ずパーツの一部になる」ことが保証される。
 *
 * L型・S型のように基準セルより左へ伸びる形では col が負になるが、
 * 盤面外かどうかは placement.ts が判定するので、ここでは形だけを素直に表す。
 */

/** 基準セルからの相対位置。盤面の絶対マス(BoardCell)とは別の型にして取り違えを防ぐ。 */
export type CellOffset = { readonly col: number; readonly row: number }

export type BlockShapeId = 'single' | 'duo' | 'i' | 'o' | 't' | 'l' | 'j' | 's' | 'z'

export type BlockShape = {
  readonly id: BlockShapeId
  /** 読み上げ・ラベル用の短い日本語。画面には形と色で見せ、文字は補助にとどめる。 */
  readonly label: string
  /** 基準セルからの相対セル。読み順（row → col）に並べる。 */
  readonly cells: readonly CellOffset[]
  /** 形ごとに固定の面の色。同じ形は何度選んでも必ずこの色になる。 */
  readonly color: string
  /** 面より濃い、輪郭と厚みに使う色。 */
  readonly edgeColor: string
}

/**
 * パーツ一覧に出す順番のままの定義。
 * 色は「幼児が見分けやすい・明るい・隣り合っても区別できる」ことを優先し、
 * 取り違えやすい鏡像ペア（L/J・S/Z）には離れた色相を割り当てている。
 */
export const BLOCK_SHAPES: readonly BlockShape[] = [
  {
    id: 'single',
    label: '1マス',
    cells: [{ col: 0, row: 0 }],
    color: '#ff6b6b',
    edgeColor: '#e03131',
  },
  {
    id: 'duo',
    label: '2マス',
    cells: [
      { col: 0, row: 0 },
      { col: 1, row: 0 },
    ],
    color: '#ffa94d',
    edgeColor: '#e8590c',
  },
  {
    id: 'i',
    label: 'ながいぼう',
    cells: [
      { col: 0, row: 0 },
      { col: 1, row: 0 },
      { col: 2, row: 0 },
      { col: 3, row: 0 },
    ],
    color: '#ffd43b',
    edgeColor: '#e8a700',
  },
  {
    id: 'o',
    label: 'しかく',
    cells: [
      { col: 0, row: 0 },
      { col: 1, row: 0 },
      { col: 0, row: 1 },
      { col: 1, row: 1 },
    ],
    color: '#51cf66',
    edgeColor: '#2f9e44',
  },
  {
    id: 't',
    label: 'ティーのかたち',
    cells: [
      { col: 0, row: 0 },
      { col: 1, row: 0 },
      { col: 2, row: 0 },
      { col: 1, row: 1 },
    ],
    color: '#38d9a9',
    edgeColor: '#099268',
  },
  {
    // ..X
    // XXX
    // 基準セルは右上の出っぱりなので、左へ伸びる相対セル（負のcol）を持つ。
    id: 'l',
    label: 'エルのかたち',
    cells: [
      { col: 0, row: 0 },
      { col: -2, row: 1 },
      { col: -1, row: 1 },
      { col: 0, row: 1 },
    ],
    color: '#4dabf7',
    edgeColor: '#1971c2',
  },
  {
    // X..
    // XXX
    id: 'j',
    label: 'ジェイのかたち',
    cells: [
      { col: 0, row: 0 },
      { col: 0, row: 1 },
      { col: 1, row: 1 },
      { col: 2, row: 1 },
    ],
    color: '#845ef7',
    edgeColor: '#6741d9',
  },
  {
    // .XX
    // XX.
    id: 's',
    label: 'エスのかたち',
    cells: [
      { col: 0, row: 0 },
      { col: 1, row: 0 },
      { col: -1, row: 1 },
      { col: 0, row: 1 },
    ],
    color: '#a9e34b',
    edgeColor: '#74b816',
  },
  {
    // XX.
    // .XX
    id: 'z',
    label: 'ゼットのかたち',
    cells: [
      { col: 0, row: 0 },
      { col: 1, row: 0 },
      { col: 1, row: 1 },
      { col: 2, row: 1 },
    ],
    color: '#f06595',
    edgeColor: '#c2255c',
  },
]

/** 最初から選ばれている形。いちばん分かりやすい1マスにして、開いてすぐ置けるようにする。 */
export const DEFAULT_BLOCK_SHAPE_ID: BlockShapeId = 'single'

const SHAPES_BY_ID: ReadonlyMap<BlockShapeId, BlockShape> = new Map(
  BLOCK_SHAPES.map((shape) => [shape.id, shape]),
)

export function blockShape(id: BlockShapeId): BlockShape {
  const shape = SHAPES_BY_ID.get(id)
  // BlockShapeId は BLOCK_SHAPES から外れた値を取れないため、ここへは来ない。
  if (!shape) throw new Error(`unknown block shape: ${id}`)
  return shape
}

/**
 * ブロックの向き。時計回りの角度で表す。
 * Phase 1（#480）では常に 0 のまま置くが、盤面のデータに向きの居場所を最初から作っておくことで、
 * #481 の回転を「値を変えるだけ」で足せるようにしている。
 */
export type BlockRotation = 0 | 90 | 180 | 270

export const NO_ROTATION: BlockRotation = 0

/**
 * 基準セルを中心に、相対セルを時計回りへ回す。
 * 画面座標（col が右、row が下）での90度回転は (col, row) → (-row, col)。
 * 回した形は基準セルの周りで向きを変えるだけなので、盤面上での見た目の位置を
 * 保ちたい #481 の回転では、呼び出し側が基準位置を取り直すことになる。
 */
export function rotateOffsets(cells: readonly CellOffset[], rotation: BlockRotation): CellOffset[] {
  let rotated = cells.map((cell) => ({ col: cell.col, row: cell.row }))
  for (let turn = 0; turn < rotation / 90; turn += 1) {
    // `-0` になると cellKey が '-0,1' のような別表記になってしまうため 0 に寄せる。
    rotated = rotated.map((cell) => ({ col: cell.row === 0 ? 0 : -cell.row, row: cell.col }))
  }
  return rotated
}

/** その形・その向きの相対セル一覧。配置も描画もこの1か所を通す。 */
export function shapeCells(id: BlockShapeId, rotation: BlockRotation = NO_ROTATION): CellOffset[] {
  return rotateOffsets(blockShape(id).cells, rotation)
}
