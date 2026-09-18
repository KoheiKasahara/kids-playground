import { describe, expect, test } from 'vitest'
import {
  FALLING_COLS,
  FALLING_ROWS,
  FALLING_SHAPE_IDS,
  createFallingPuzzleState,
  dropFallingPieceToLanding,
  fallingGhostCells,
  fallingLandingAnchor,
  fallingPieceCells,
  fitsOnGrid,
  lockFallingPiece,
  moveFallingPieceSideways,
  moveFallingPieceToColumn,
  rotateFallingPiece,
  settledGroups,
  spawnFallingPiece,
  stepFallingPieceDown,
  type FallingGrid,
  type FallingGridCell,
  type FallingPiece,
  type FallingPuzzleState,
} from './fallingPuzzleState'
import type { BlockShapeId } from './blockShapes'

/** テスト用の盤面記法。'.' は空きマス、文字は積まれた形（色）。下の段から書ける。 */
const GRID_CHARS: Record<string, BlockShapeId> = {
  s: 'single',
  d: 'duo',
  o: 'o',
  i: 'i',
  t: 't',
  l: 'l',
  j: 'j',
}

function gridFrom(rows: readonly string[]): FallingGridCell[][] {
  const empty = '.'.repeat(FALLING_COLS)
  const padded = [...Array.from({ length: FALLING_ROWS - rows.length }, () => empty), ...rows]
  return padded.map((row) => [...row].map((char) => (char === '.' ? null : GRID_CHARS[char])))
}

function gridRows(grid: FallingGrid): string[] {
  const charOf = new Map(Object.entries(GRID_CHARS).map(([char, id]) => [id, char]))
  return grid.map((row) => row.map((cell) => (cell === null ? '.' : (charOf.get(cell) ?? '?'))).join(''))
}

function stateWith(rows: readonly string[], piece: FallingPiece | null): FallingPuzzleState {
  return {
    grid: gridFrom(rows),
    piece,
    nextShapeId: 'single',
    clearedRows: 0,
    lastClearedRows: 0,
    droppedPieces: 0,
    status: piece === null ? 'over' : 'playing',
  }
}

function cellKeys(cells: readonly { col: number; row: number }[]): string[] {
  return cells.map((cell) => `${cell.col},${cell.row}`).sort()
}

/** いつも同じ形（FALLING_SHAPE_IDS の先頭 = 1マス）だけを出す乱数。 */
const alwaysFirstShape = () => 0

describe('おちてくるモード: 盤面と出る形', () => {
  test('盤面は自由に置くモードと別に持ち、幼児が1れつそろえやすい大きさにしている', () => {
    expect(FALLING_COLS).toBe(5)
    expect(FALLING_ROWS).toBe(9)
  })

  test('見分けにくいS字・Z字は落ちてこない', () => {
    expect(FALLING_SHAPE_IDS).not.toContain('s')
    expect(FALLING_SHAPE_IDS).not.toContain('z')
    expect(FALLING_SHAPE_IDS.length).toBeGreaterThan(0)
  })

  test('はじめの状態は、空の盤面といちばん上のブロック', () => {
    const state = createFallingPuzzleState(alwaysFirstShape)
    expect(state.status).toBe('playing')
    expect(state.grid.flat().every((cell) => cell === null)).toBe(true)
    expect(state.clearedRows).toBe(0)
    expect(state.droppedPieces).toBe(0)
    expect(state.piece).not.toBeNull()
    expect(Math.min(...fallingPieceCells(state.piece!).map((cell) => cell.row))).toBe(0)
  })

  test('どの形も、出てきた時点で盤面の内側のいちばん上に収まる（負の相対セルを持つ形でも）', () => {
    for (const shapeId of FALLING_SHAPE_IDS) {
      const piece = spawnFallingPiece(shapeId)
      const cells = fallingPieceCells(piece)
      expect(Math.min(...cells.map((cell) => cell.row))).toBe(0)
      expect(fitsOnGrid(gridFrom([]), piece), `${shapeId} が盤面に収まらない`).toBe(true)
    }
  })
})

describe('おちてくるモード: 場所をえらぶ', () => {
  test('タップした列がブロックのまんなかに来るように動く', () => {
    const state = createFallingPuzzleState(alwaysFirstShape)
    const moved = moveFallingPieceToColumn(state, 0)
    expect(cellKeys(fallingPieceCells(moved.piece!))).toEqual(['0,0'])
    const movedRight = moveFallingPieceToColumn(moved, FALLING_COLS - 1)
    expect(cellKeys(fallingPieceCells(movedRight.piece!))).toEqual([`${FALLING_COLS - 1},0`])
  })

  test('はしの列をタップしても、盤面からはみ出さないところで止まる', () => {
    const state = { ...createFallingPuzzleState(alwaysFirstShape), piece: spawnFallingPiece('i') }
    const moved = moveFallingPieceToColumn(state, 0)
    const cols = fallingPieceCells(moved.piece!).map((cell) => cell.col)
    expect(Math.min(...cols)).toBe(0)
    expect(Math.max(...cols)).toBe(3)

    const movedRight = moveFallingPieceToColumn(state, FALLING_COLS - 1)
    const rightCols = fallingPieceCells(movedRight.piece!).map((cell) => cell.col)
    expect(Math.max(...rightCols)).toBe(FALLING_COLS - 1)
  })

  test('ひだり・みぎは1マスずつ動き、盤面の外へは出ない', () => {
    const state = createFallingPuzzleState(alwaysFirstShape)
    const left = moveFallingPieceSideways(state, -1)
    expect(left.piece!.anchor.col).toBe(state.piece!.anchor.col - 1)

    let atWall = state
    for (let step = 0; step < FALLING_COLS + 2; step += 1) atWall = moveFallingPieceSideways(atWall, -1)
    expect(Math.min(...fallingPieceCells(atWall.piece!).map((cell) => cell.col))).toBe(0)
  })

  test('よこに積まれたブロックがあって動かせないときは、同じ状態のままにする', () => {
    // 盤面のいちばん下の段に「ss.ss」が積まれ、その真ん中のすき間に1マスが落ちている状態。
    const piece: FallingPiece = { shapeId: 'single', rotation: 0, anchor: { col: 2, row: FALLING_ROWS - 1 } }
    const state = stateWith(['ss.ss'], piece)
    expect(moveFallingPieceSideways(state, -1)).toBe(state)
    expect(moveFallingPieceSideways(state, 1)).toBe(state)
    expect(moveFallingPieceToColumn(state, 0)).toBe(state)
  })
})

describe('おちてくるモード: まわす', () => {
  test('まわすと向きが変わる', () => {
    const state = { ...createFallingPuzzleState(alwaysFirstShape), piece: spawnFallingPiece('i') }
    const rotated = rotateFallingPiece(state)
    expect(rotated.piece!.rotation).toBe(90)
    expect(new Set(fallingPieceCells(rotated.piece!).map((cell) => cell.col)).size).toBe(1)
  })

  test('かべぎわでも、少しずらして必ずまわせる', () => {
    const state = moveFallingPieceToColumn(
      { ...createFallingPuzzleState(alwaysFirstShape), piece: spawnFallingPiece('t') },
      0,
    )
    const rotated = rotateFallingPiece(state)
    expect(rotated.piece!.rotation).toBe(90)
    expect(fallingPieceCells(rotated.piece!).every((cell) => cell.col >= 0)).toBe(true)
  })

  test('ながいぼうは、かべぎわの縦向きからでも横向きへ必ずまわせる（幅4マスぶんのキック）', () => {
    // 左のかべぎわで縦向き → 横向きにすると、そのままでは盤面の外へ左へはみ出す。
    const atLeftWall = stateWith([], { shapeId: 'i', rotation: 90, anchor: { col: 0, row: 3 } })
    const rotatedAtLeftWall = rotateFallingPiece(atLeftWall)
    expect(rotatedAtLeftWall.piece!.rotation).toBe(180)
    expect(fallingPieceCells(rotatedAtLeftWall.piece!).every((cell) => cell.col >= 0)).toBe(true)

    // 右のかべぎわで縦向き → 横向きにすると、そのままでは盤面の外へ右へはみ出す。
    const atRightWall = stateWith([], { shapeId: 'i', rotation: 270, anchor: { col: FALLING_COLS - 1, row: 3 } })
    const rotatedAtRightWall = rotateFallingPiece(atRightWall)
    expect(rotatedAtRightWall.piece!.rotation).toBe(0)
    expect(fallingPieceCells(rotatedAtRightWall.piece!).every((cell) => cell.col < FALLING_COLS)).toBe(true)
  })

  test('どうやっても置けないときだけ、まわさずそのままにする', () => {
    const piece: FallingPiece = { shapeId: 'i', rotation: 0, anchor: { col: 0, row: 8 } }
    const state = stateWith([], piece)
    const rotated = rotateFallingPiece(state)
    // たてにすると盤面の下からはみ出し、持ち上げても1マスでは足りない。
    expect(rotated.piece!.rotation).toBe(0)
  })
})

describe('おちてくるモード: 着地と積み上げ', () => {
  test('着地先は、床または積まれたブロックの上', () => {
    const state = createFallingPuzzleState(alwaysFirstShape)
    expect(fallingLandingAnchor(state)).toEqual({ col: state.piece!.anchor.col, row: FALLING_ROWS - 1 })

    const stacked = stateWith(['..s..'], { shapeId: 'single', rotation: 0, anchor: { col: 2, row: 0 } })
    expect(fallingLandingAnchor(stacked)).toEqual({ col: 2, row: FALLING_ROWS - 2 })
    expect(cellKeys(fallingGhostCells(stacked))).toEqual([`2,${FALLING_ROWS - 2}`])
  })

  test('おとすと着地先まで下がるが、盤面にはまだ積まれない', () => {
    const state = createFallingPuzzleState(alwaysFirstShape)
    const dropped = dropFallingPieceToLanding(state)
    expect(dropped.piece!.anchor.row).toBe(FALLING_ROWS - 1)
    expect(dropped.grid.flat().every((cell) => cell === null)).toBe(true)
    expect(dropped.droppedPieces).toBe(0)
  })

  test('積むと盤面に残り、つぎのブロックが出てくる', () => {
    const state = dropFallingPieceToLanding(moveFallingPieceToColumn(createFallingPuzzleState(alwaysFirstShape), 0))
    const locked = lockFallingPiece(state, alwaysFirstShape)
    expect(locked.grid[FALLING_ROWS - 1][0]).toBe('single')
    expect(locked.droppedPieces).toBe(1)
    expect(locked.status).toBe('playing')
    expect(locked.piece).not.toBeNull()
    expect(Math.min(...fallingPieceCells(locked.piece!).map((cell) => cell.row))).toBe(0)
  })

  test('ひとりでに落ちるときは1段ずつ下がり、下がれなくなったらnullを返す', () => {
    const state = createFallingPuzzleState(alwaysFirstShape)
    const stepped = stepFallingPieceDown(state)
    expect(stepped!.piece!.anchor.row).toBe(state.piece!.anchor.row + 1)

    const onFloor = dropFallingPieceToLanding(state)
    expect(stepFallingPieceDown(onFloor)).toBeNull()
  })
})

describe('おちてくるモード: よこ1れつ', () => {
  test('よこ1れつがそろうと、その段が消えて上の段が下りてくる', () => {
    const piece: FallingPiece = { shapeId: 'single', rotation: 0, anchor: { col: 4, row: 0 } }
    const state = stateWith(['..d..', 'ssss.'], piece)
    const locked = lockFallingPiece(dropFallingPieceToLanding(state), alwaysFirstShape)

    expect(locked.lastClearedRows).toBe(1)
    expect(locked.clearedRows).toBe(1)
    expect(gridRows(locked.grid)[FALLING_ROWS - 1]).toBe('..d..')
    expect(gridRows(locked.grid)[FALLING_ROWS - 2]).toBe('.....')
  })

  test('そろわなかった着地では、消えた段は0になる', () => {
    const state = dropFallingPieceToLanding(createFallingPuzzleState(alwaysFirstShape))
    const locked = lockFallingPiece(state, alwaysFirstShape)
    expect(locked.lastClearedRows).toBe(0)
    expect(locked.clearedRows).toBe(0)
  })

  test('いちどに2段そろえてもまとめて消え、消えなかったマスは下りてくる', () => {
    // たてにしたながいぼう（4マス）を、右はしだけ空いた2段のすき間へ落とす。
    const piece: FallingPiece = { shapeId: 'i', rotation: 90, anchor: { col: 4, row: 0 } }
    const state = stateWith(['ssss.', 'ssss.'], piece)
    const locked = lockFallingPiece(dropFallingPieceToLanding(state), alwaysFirstShape)

    expect(locked.lastClearedRows).toBe(2)
    // 下の2段だけが消え、はみ出ていた上の2マスがそのぶん下りてくる。
    expect(gridRows(locked.grid).slice(-3)).toEqual(['.....', '....i', '....i'])
  })
})

describe('おちてくるモード: いっぱいになったとき', () => {
  test('つぎのブロックが出られないほど積み上がると、いっぱいになったことだけを伝える', () => {
    const piece: FallingPiece = { shapeId: 'single', rotation: 0, anchor: { col: 2, row: 0 } }
    const rows = Array.from({ length: FALLING_ROWS - 1 }, () => '..s..')
    const locked = lockFallingPiece(stateWith(rows, piece), alwaysFirstShape)

    expect(locked.status).toBe('over')
    expect(locked.piece).toBeNull()
    // 積んだ盤面は消さずに残す（やり直すかどうかは遊ぶ子が決める）。
    expect(locked.grid[1][2]).toBe('single')
  })

  test('いっぱいのあとは、動かす・まわす・積むのどれも盤面を変えない', () => {
    const over = stateWith(['..s..'], null)
    expect(moveFallingPieceToColumn(over, 0)).toBe(over)
    expect(moveFallingPieceSideways(over, 1)).toBe(over)
    expect(rotateFallingPiece(over)).toBe(over)
    expect(lockFallingPiece(over, alwaysFirstShape)).toBe(over)
    expect(stepFallingPieceDown(over)).toBeNull()
    expect(fallingGhostCells(over)).toEqual([])
  })
})

describe('おちてくるモード: 積まれたマスのまとまり（描画用）', () => {
  test('同じ色でつながったマスを1つのまとまりにする', () => {
    const groups = settledGroups(gridFrom(['oo...', 'oo..s']))
    const square = groups.find((group) => group.shapeId === 'o')
    expect(square?.cells).toHaveLength(4)
    expect(groups.filter((group) => group.shapeId === 'single')).toHaveLength(1)
  })

  test('色がちがえば、となりあっていても別のまとまりになる', () => {
    const groups = settledGroups(gridFrom(['sd...']))
    expect(groups).toHaveLength(2)
    expect(groups.map((group) => group.shapeId).sort()).toEqual(['duo', 'single'])
  })

  test('空の盤面ではまとまりが1つもない', () => {
    expect(settledGroups(gridFrom([]))).toEqual([])
  })
})
