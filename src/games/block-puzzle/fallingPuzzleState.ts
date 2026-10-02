import type { BoardCell } from './board'
import { cellBounds } from './blockRendering'
import { NO_ROTATION, nextRotation, shapeCells, type BlockRotation, type BlockShapeId } from './blockShapes'
import { occupiedCells } from './placement'

/**
 * 「おちてくる」モード（#711）の状態と操作だけを持つモジュール。描画にも React にも依存せず、
 * 更新関数はすべて非破壊（引数を変えず新しい状態を返す）。
 *
 * 自由に置くモード（blockPuzzleState.ts）とは盤面の持ち方から違う。あちらは
 * 「配置済みパーツの配列」が正本だが、こちらは よこ1れつ がそろうと段が消えて
 * パーツが分断されるため、マスの配列（どのマスがどの形の色か）を正本にする。
 * 同じ盤面モジュール（board.ts）を共有せず、盤面の大きさもここで独自に持つのは、
 * 片方のモードの都合でもう片方の盤面が変わらないようにするため。
 */

/**
 * 落ちてくるモードの盤面の列数・行数。
 * 横8列・縦12段にしているのは、スマホを縦に持ったときに盤面が画面の幅いっぱいに広がり、
 * 1マスも指で押しやすい大きさに保てるから。
 * 縦は、上から落ちてくる様子が分かり、かつ1マスが小さくなりすぎない12段にしている。
 */
export const FALLING_COLS = 8
export const FALLING_ROWS = 12

/**
 * 落ちてくる形の種類。S字・Z字は入れていない。
 * 鏡像どうしで見分けがつきにくく、すき間なく積むには回転と位置合わせの両方が要り、
 * 幼児が自分で置ける形の範囲を超えるため（自由に置くモードでは今までどおり選べる）。
 */
export const FALLING_SHAPE_IDS: readonly BlockShapeId[] = ['single', 'duo', 'o', 'i', 't', 'l', 'j']

/** 盤面のマス1つ。まだ何もなければ null、あれば「どの形の色か」を持つ。 */
export type FallingGridCell = BlockShapeId | null

/** 盤面。row（上から）→ col（左から）の二次元配列。 */
export type FallingGrid = readonly (readonly FallingGridCell[])[]

/** いま落ちている（まだ積まれていない）ブロック1個。 */
export type FallingPiece = {
  readonly shapeId: BlockShapeId
  readonly rotation: BlockRotation
  /** 基準セルの絶対位置。占有マスは occupiedCells() で導出する。 */
  readonly anchor: BoardCell
}

/** 遊べる状態か、積み上がって いっぱい になったか。負けの演出は使わない（#711）。 */
export type FallingPuzzleStatus = 'playing' | 'over'

export type FallingPuzzleState = {
  /** 積まれたマスの正本。 */
  readonly grid: FallingGrid
  /** いま落ちているブロック。いっぱいになったとき（status === 'over'）だけ null。 */
  readonly piece: FallingPiece | null
  /** つぎに出てくる形。画面の「つぎ」に見せて、心の準備ができるようにする。 */
  readonly nextShapeId: BlockShapeId
  /** はじめてからそろえた段の合計。 */
  readonly clearedRows: number
  /** 直前の着地でそろった段の数（0 = そろわなかった）。演出と読み上げに使う。 */
  readonly lastClearedRows: number
  /** 積んだブロックの数。 */
  readonly droppedPieces: number
  readonly status: FallingPuzzleStatus
}

/** 乱数の差し替え口。テストからは決まった形だけを出せるようにする。 */
export type RandomSource = () => number

export function isInsideFallingBoard(cell: BoardCell): boolean {
  return cell.col >= 0 && cell.col < FALLING_COLS && cell.row >= 0 && cell.row < FALLING_ROWS
}

function emptyGrid(): FallingGridCell[][] {
  return Array.from({ length: FALLING_ROWS }, () => Array.from({ length: FALLING_COLS }, () => null))
}

function toMutableGrid(grid: FallingGrid): FallingGridCell[][] {
  return grid.map((row) => [...row])
}

/** そのブロックが占めている盤面のマス一覧。 */
export function fallingPieceCells(piece: FallingPiece): BoardCell[] {
  return occupiedCells(piece.shapeId, piece.anchor, piece.rotation)
}

/** そのブロックが盤面の内側に収まり、積まれたマスとも重なっていないか。 */
export function fitsOnGrid(grid: FallingGrid, piece: FallingPiece): boolean {
  return fallingPieceCells(piece).every(
    (cell) => isInsideFallingBoard(cell) && grid[cell.row][cell.col] === null,
  )
}

function pickShapeId(random: RandomSource): BlockShapeId {
  const index = Math.min(FALLING_SHAPE_IDS.length - 1, Math.floor(random() * FALLING_SHAPE_IDS.length))
  return FALLING_SHAPE_IDS[Math.max(0, index)]
}

/**
 * 出てきたばかりのブロック。盤面のいちばん上の段から、横はまんなかに置く。
 * 形は基準セルからの相対セルで定義されていて負の col もあるため、
 * 囲む長方形（cellBounds）を使って「見た目の左上」が来る位置から基準セルを逆算する。
 */
export function spawnFallingPiece(shapeId: BlockShapeId): FallingPiece {
  const offsets = shapeCells(shapeId, NO_ROTATION)
  const bounds = cellBounds(offsets)
  const left = Math.floor((FALLING_COLS - bounds.cols) / 2)
  return {
    shapeId,
    rotation: NO_ROTATION,
    anchor: { col: left - bounds.minCol, row: -bounds.minRow },
  }
}

export function createFallingPuzzleState(random: RandomSource = Math.random): FallingPuzzleState {
  return {
    grid: emptyGrid(),
    piece: spawnFallingPiece(pickShapeId(random)),
    nextShapeId: pickShapeId(random),
    clearedRows: 0,
    lastClearedRows: 0,
    droppedPieces: 0,
    status: 'playing',
  }
}

function withPiece(state: FallingPuzzleState, piece: FallingPiece): FallingPuzzleState {
  return fitsOnGrid(state.grid, piece) ? { ...state, piece } : state
}

/**
 * タップされた列へブロックを動かす（#711 の「落ちる場所を選んで決める」操作）。
 * タップした列がブロックのまんなかに来るように寄せ、盤面からはみ出す分は端で止める。
 * ふさがっていて動かせない場合は、何も変えずに同じ状態を返す（失敗にはしない）。
 */
export function moveFallingPieceToColumn(state: FallingPuzzleState, col: number): FallingPuzzleState {
  const piece = state.piece
  if (!piece || state.status !== 'playing') return state
  const cells = fallingPieceCells(piece)
  const bounds = cellBounds(cells)
  const wantedLeft = col - Math.floor((bounds.cols - 1) / 2)
  const left = Math.min(Math.max(wantedLeft, 0), FALLING_COLS - bounds.cols)
  return withPiece(state, { ...piece, anchor: { ...piece.anchor, col: piece.anchor.col + (left - bounds.minCol) } })
}

/** 「ひだり」「みぎ」ボタンの1マス移動。動かせないときは同じ状態を返す。 */
export function moveFallingPieceSideways(state: FallingPuzzleState, delta: number): FallingPuzzleState {
  const piece = state.piece
  if (!piece || state.status !== 'playing') return state
  return withPiece(state, { ...piece, anchor: { ...piece.anchor, col: piece.anchor.col + delta } })
}

/**
 * いちばん長い形の長さ（マス）。ながいぼうなら4。
 * まわすときに縦へどれだけずらして試すかの上限に使うので、
 * 形を足しても、ずらせる範囲が足りなくなることがない。
 */
const LONGEST_SHAPE_SPAN = Math.max(
  ...FALLING_SHAPE_IDS.map((shapeId) => {
    const bounds = cellBounds(shapeCells(shapeId, NO_ROTATION))
    return Math.max(bounds.cols, bounds.rows)
  }),
)

/**
 * まわした先がふさがっているときに、ずらして試す量の一覧。
 * 横は盤面の幅ぶん、縦はいちばん長い形の長さぶんまで試し、
 * 元の位置から近い順（同じ距離なら、まず左右へ、つぎに持ち上げる方）に並べる。
 * これだけ広く探すのは、幼児が「まわす」を押したときに
 * 「反応しない」と感じることがないように、置ける場所があれば必ず見つけるため。
 */
function buildRotateKicks(): BoardCell[] {
  const maxCols = FALLING_COLS - 1
  const maxRows = LONGEST_SHAPE_SPAN - 1
  const kicks: BoardCell[] = []
  for (let row = -maxRows; row <= maxRows; row += 1) {
    for (let col = -maxCols; col <= maxCols; col += 1) kicks.push({ col, row })
  }
  return kicks.sort(
    (a, b) =>
      Math.abs(a.col) + Math.abs(a.row) - (Math.abs(b.col) + Math.abs(b.row)) ||
      Math.abs(a.row) - Math.abs(b.row) ||
      a.row - b.row ||
      Math.abs(a.col) - Math.abs(b.col) ||
      a.col - b.col,
  )
}

const ROTATE_KICKS: readonly BoardCell[] = buildRotateKicks()

/** 長さ span のまとまりが 0〜limit の内側に収まるように、左上の位置を端で止める。 */
function clampSpan(start: number, span: number, limit: number): number {
  return Math.min(Math.max(start, 0), limit - span)
}

/**
 * 向きが変わって長さが beforeSpan から afterSpan になるとき、
 * まんなかを保つためのずらし量。半マスぶんの端数は0の側へ寄せる。
 * こうすると行き（長い→短い）と帰り（短い→長い）のずらし量が必ず打ち消し合うので、
 * 「まわす」を4回押すと、ブロックは元の向き・元の場所へきっちり戻る。
 */
function centeringShift(beforeSpan: number, afterSpan: number): number {
  return Math.trunc((beforeSpan - afterSpan) / 2)
}

/**
 * まわしたあとの基準セル。囲む長方形（見た目の四角）のまんなかがまわす前と
 * 同じところに来るようにし、盤面からはみ出す分は端で止める。
 *
 * 形は「基準セル（いちばん上の段の、いちばん左のマス）からの相対セル」で定義されているため、
 * 基準セルを動かさずにまわすと、向きによっては形が基準セルより上へ伸びる。
 * 落ちてくるブロックは出てきた直後がいちばん上の段なので、それだけで盤面の外へ出てしまい、
 * 「まわす」を押しても向きが変わらない形（エル・ティー・しかく など）があった。
 * 見た目の四角を基準に位置を取り直すことで、いちばん上にいてもその場で向きが変わる。
 */
function rotatedAnchor(piece: FallingPiece, rotation: BlockRotation): BoardCell {
  const before = cellBounds(fallingPieceCells(piece))
  const after = cellBounds(shapeCells(piece.shapeId, rotation))
  const left = clampSpan(before.minCol + centeringShift(before.cols, after.cols), after.cols, FALLING_COLS)
  const top = clampSpan(before.minRow + centeringShift(before.rows, after.rows), after.rows, FALLING_ROWS)
  return { col: left - after.minCol, row: top - after.minRow }
}

/**
 * 落ちているブロックを90度まわす。まわしたあとも見た目の四角が同じところに来るように
 * 位置を取り直し、それでも かべ や 積まれたマス に当たるときは、
 * 近いところから順にずらして置ける場所を探す。
 * どこにも置けないときだけ、何も変えずに同じ状態を返す。
 */
export function rotateFallingPiece(state: FallingPuzzleState): FallingPuzzleState {
  const piece = state.piece
  if (!piece || state.status !== 'playing') return state
  const rotation = nextRotation(piece.rotation)
  const anchor = rotatedAnchor(piece, rotation)
  for (const kick of ROTATE_KICKS) {
    const candidate: FallingPiece = {
      ...piece,
      rotation,
      anchor: { col: anchor.col + kick.col, row: anchor.row + kick.row },
    }
    if (fitsOnGrid(state.grid, candidate)) return { ...state, piece: candidate }
  }
  return state
}

/** そのままおろしたときに止まる位置（着地先の基準セル）。落ちるブロックがなければ null。 */
export function fallingLandingAnchor(state: FallingPuzzleState): BoardCell | null {
  const piece = state.piece
  if (!piece) return null
  let anchor = piece.anchor
  for (;;) {
    const below = { col: anchor.col, row: anchor.row + 1 }
    if (!fitsOnGrid(state.grid, { ...piece, anchor: below })) return anchor
    anchor = below
  }
}

/** 着地先のマス一覧（置く前に見せる うすい ブロック）。 */
export function fallingGhostCells(state: FallingPuzzleState): BoardCell[] {
  const piece = state.piece
  const anchor = fallingLandingAnchor(state)
  if (!piece || !anchor) return []
  return occupiedCells(piece.shapeId, anchor, piece.rotation)
}

/**
 * 着地先まで一気におろす（まだ盤面には積まない）。
 * 積むのは lockFallingPiece() で、落ちていく見た目を見せてから積むために分けている。
 */
export function dropFallingPieceToLanding(state: FallingPuzzleState): FallingPuzzleState {
  const piece = state.piece
  const anchor = fallingLandingAnchor(state)
  if (!piece || !anchor) return state
  if (anchor.row === piece.anchor.row) return state
  return { ...state, piece: { ...piece, anchor } }
}

/**
 * ひとりでに落ちるモードの1段ぶんの落下。
 * これ以上落ちられない（＝積むタイミング）ときは null を返し、
 * 呼び出し側が「もう1回ぶん待ってから積む」猶予を作れるようにする。
 */
export function stepFallingPieceDown(state: FallingPuzzleState): FallingPuzzleState | null {
  const piece = state.piece
  if (!piece || state.status !== 'playing') return null
  const moved: FallingPiece = { ...piece, anchor: { ...piece.anchor, row: piece.anchor.row + 1 } }
  return fitsOnGrid(state.grid, moved) ? { ...state, piece: moved } : null
}

/** そろった段を消して、上の段をそのぶん下へ落とす。 */
function clearFullRows(grid: FallingGridCell[][]): { grid: FallingGridCell[][]; cleared: number } {
  const kept = grid.filter((row) => row.some((cell) => cell === null))
  const cleared = grid.length - kept.length
  const added = Array.from({ length: cleared }, () => Array.from({ length: FALLING_COLS }, () => null))
  return { grid: [...added, ...kept] as FallingGridCell[][], cleared }
}

/**
 * いま落ちているブロックを盤面へ積み、そろった段を消して、つぎのブロックを出す。
 * 出てきたブロックが置けないほど積み上がっていたら 'over' にする。
 * 'over' でも積んだ盤面はそのまま残し、「いっぱいになった」だけを伝える（#711）。
 */
export function lockFallingPiece(
  state: FallingPuzzleState,
  random: RandomSource = Math.random,
): FallingPuzzleState {
  const piece = state.piece
  if (!piece || state.status !== 'playing') return state

  const grid = toMutableGrid(state.grid)
  for (const cell of fallingPieceCells(piece)) {
    if (!isInsideFallingBoard(cell)) continue
    grid[cell.row][cell.col] = piece.shapeId
  }
  const { grid: settled, cleared } = clearFullRows(grid)
  const nextPiece = spawnFallingPiece(state.nextShapeId)
  const canContinue = fitsOnGrid(settled, nextPiece)

  return {
    grid: settled,
    piece: canContinue ? nextPiece : null,
    nextShapeId: pickShapeId(random),
    clearedRows: state.clearedRows + cleared,
    lastClearedRows: cleared,
    droppedPieces: state.droppedPieces + 1,
    status: canContinue ? 'playing' : 'over',
  }
}

/** 描画用に、積まれたマスを「同じ色のつながり」ごとにまとめたもの。 */
export type SettledGroup = {
  readonly shapeId: BlockShapeId
  readonly cells: readonly BoardCell[]
}

/**
 * 積まれたマスを、同じ形（＝同じ色）どうしの上下左右のつながりでまとめる。
 * 段が消えてパーツがばらばらになっても、残ったマスのつながりをそのまま
 * 1つのまとまりとして描けるようにするための、描画だけのための導出。
 */
export function settledGroups(grid: FallingGrid): SettledGroup[] {
  const visited = new Set<string>()
  const groups: SettledGroup[] = []

  for (let row = 0; row < FALLING_ROWS; row += 1) {
    for (let col = 0; col < FALLING_COLS; col += 1) {
      const shapeId = grid[row][col]
      if (shapeId === null || visited.has(`${col},${row}`)) continue

      const cells: BoardCell[] = []
      const queue: BoardCell[] = [{ col, row }]
      visited.add(`${col},${row}`)
      while (queue.length > 0) {
        const cell = queue.shift() as BoardCell
        cells.push(cell)
        const neighbors: BoardCell[] = [
          { col: cell.col, row: cell.row - 1 },
          { col: cell.col + 1, row: cell.row },
          { col: cell.col, row: cell.row + 1 },
          { col: cell.col - 1, row: cell.row },
        ]
        for (const neighbor of neighbors) {
          const key = `${neighbor.col},${neighbor.row}`
          if (visited.has(key)) continue
          if (!isInsideFallingBoard(neighbor)) continue
          if (grid[neighbor.row][neighbor.col] !== shapeId) continue
          visited.add(key)
          queue.push(neighbor)
        }
      }
      groups.push({ shapeId, cells })
    }
  }
  return groups
}
