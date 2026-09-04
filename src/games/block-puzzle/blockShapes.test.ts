import { describe, expect, test } from 'vitest'
import {
  BLOCK_SHAPES,
  DEFAULT_BLOCK_SHAPE_ID,
  blockShape,
  nextRotation,
  rotateOffsets,
  shapeCells,
  type BlockRotation,
  type BlockShapeId,
} from './blockShapes'

const cellSet = (cells: readonly { col: number; row: number }[]) =>
  new Set(cells.map((cell) => `${cell.col},${cell.row}`))

describe('blockShapes: 形の定義', () => {
  test('Issueが求める9種類がこの順番で揃っている', () => {
    expect(BLOCK_SHAPES.map((shape) => shape.id)).toEqual([
      'single',
      'duo',
      'i',
      'o',
      't',
      'l',
      'j',
      's',
      'z',
    ])
  })

  test('救済パーツの1マスがあり、セルは1つだけ', () => {
    expect(blockShape('single').cells).toEqual([{ col: 0, row: 0 }])
  })

  test('最初に選ばれている形は1マス', () => {
    expect(DEFAULT_BLOCK_SHAPE_ID).toBe<BlockShapeId>('single')
  })

  test('各形のセル数が定義どおり', () => {
    const cellCounts = Object.fromEntries(
      BLOCK_SHAPES.map((shape) => [shape.id, shape.cells.length]),
    )
    expect(cellCounts).toEqual({
      single: 1,
      duo: 2,
      i: 4,
      o: 4,
      t: 4,
      l: 4,
      j: 4,
      s: 4,
      z: 4,
    })
  })

  test('各形のセル定義（相対セル）が意図した形になっている', () => {
    expect(blockShape('duo').cells).toEqual([
      { col: 0, row: 0 },
      { col: 1, row: 0 },
    ])
    // ながいぼうは横4マス。
    expect(blockShape('i').cells).toEqual([
      { col: 0, row: 0 },
      { col: 1, row: 0 },
      { col: 2, row: 0 },
      { col: 3, row: 0 },
    ])
    // しかくは2×2。
    expect(cellSet(blockShape('o').cells)).toEqual(cellSet([
      { col: 0, row: 0 },
      { col: 1, row: 0 },
      { col: 0, row: 1 },
      { col: 1, row: 1 },
    ]))
    // T型は上段3マス＋下段まんなか。
    expect(cellSet(blockShape('t').cells)).toEqual(cellSet([
      { col: 0, row: 0 },
      { col: 1, row: 0 },
      { col: 2, row: 0 },
      { col: 1, row: 1 },
    ]))
    // L型は右上の出っぱり＋下段3マス（基準セルより左へ伸びる）。
    expect(cellSet(blockShape('l').cells)).toEqual(cellSet([
      { col: 0, row: 0 },
      { col: -2, row: 1 },
      { col: -1, row: 1 },
      { col: 0, row: 1 },
    ]))
    // J型は左上の出っぱり＋下段3マス。
    expect(cellSet(blockShape('j').cells)).toEqual(cellSet([
      { col: 0, row: 0 },
      { col: 0, row: 1 },
      { col: 1, row: 1 },
      { col: 2, row: 1 },
    ]))
    expect(cellSet(blockShape('s').cells)).toEqual(cellSet([
      { col: 0, row: 0 },
      { col: 1, row: 0 },
      { col: -1, row: 1 },
      { col: 0, row: 1 },
    ]))
    expect(cellSet(blockShape('z').cells)).toEqual(cellSet([
      { col: 0, row: 0 },
      { col: 1, row: 0 },
      { col: 1, row: 1 },
      { col: 2, row: 1 },
    ]))
  })

  test('どの形も基準セル(0,0)を占有する（タップしたマスが必ずパーツの一部になる）', () => {
    for (const shape of BLOCK_SHAPES) {
      expect(cellSet(shape.cells).has('0,0'), `${shape.id} が基準セルを含んでいない`).toBe(true)
    }
  })

  test('基準セルは読み順（最上段のいちばん左）で最初のセル', () => {
    for (const shape of BLOCK_SHAPES) {
      const topRow = Math.min(...shape.cells.map((cell) => cell.row))
      const leftMostOfTopRow = Math.min(
        ...shape.cells.filter((cell) => cell.row === topRow).map((cell) => cell.col),
      )
      expect({ id: shape.id, col: leftMostOfTopRow, row: topRow }).toEqual({
        id: shape.id,
        col: 0,
        row: 0,
      })
    }
  })

  test('同じ形の中にセルの重複がない', () => {
    for (const shape of BLOCK_SHAPES) {
      expect(cellSet(shape.cells).size).toBe(shape.cells.length)
    }
  })

  test('形ごとに色が固定され、9色すべて異なる', () => {
    const colors = BLOCK_SHAPES.map((shape) => shape.color)
    expect(new Set(colors).size).toBe(BLOCK_SHAPES.length)
    // 同じ形は何度引いても必ず同じ色になる。
    expect(blockShape('o').color).toBe(blockShape('o').color)
    expect(blockShape('o').color).toBe('#51cf66')
    for (const shape of BLOCK_SHAPES) {
      expect(shape.color).toMatch(/^#[0-9a-f]{6}$/)
      expect(shape.edgeColor).toMatch(/^#[0-9a-f]{6}$/)
      expect(shape.edgeColor).not.toBe(shape.color)
    }
  })

  test('idとラベルが一意', () => {
    expect(new Set(BLOCK_SHAPES.map((shape) => shape.id)).size).toBe(BLOCK_SHAPES.length)
    expect(new Set(BLOCK_SHAPES.map((shape) => shape.label)).size).toBe(BLOCK_SHAPES.length)
  })
})

// 回転操作そのものは #481 で実装するが、向きを持てる型と計算だけは
// ここで正しさを固定しておく（#480 の配置では常に 0 を使う）。
describe('blockShapes: 向き（#481の土台）', () => {
  test('回転0は元の定義のまま', () => {
    expect(shapeCells('l')).toEqual(blockShape('l').cells)
  })

  test('90度は基準セルを中心に時計回り（右→下）', () => {
    expect(rotateOffsets([{ col: 1, row: 0 }], 90)).toEqual([{ col: 0, row: 1 }])
    expect(rotateOffsets([{ col: 0, row: 1 }], 90)).toEqual([{ col: -1, row: 0 }])
  })

  test('ながいぼうの90度は縦4マスになる', () => {
    expect(shapeCells('i', 90)).toEqual([
      { col: 0, row: 0 },
      { col: 0, row: 1 },
      { col: 0, row: 2 },
      { col: 0, row: 3 },
    ])
  })

  test('しかくは回転しても2×2のまま（基準セルの周りで向きだけが変わる）', () => {
    const rotated = shapeCells('o', 90)
    expect(rotated).toHaveLength(4)
    expect(new Set(rotated.map((cell) => cell.col)).size).toBe(2)
    expect(new Set(rotated.map((cell) => cell.row)).size).toBe(2)
  })

  test('360度ぶん回すと元に戻る', () => {
    for (const shape of BLOCK_SHAPES) {
      const turnedFourTimes = rotateOffsets(
        rotateOffsets(rotateOffsets(rotateOffsets(shape.cells, 90), 90), 90),
        90,
      )
      expect(cellSet(turnedFourTimes)).toEqual(cellSet(shape.cells))
    }
  })

  test('回転してもセル数は変わらない', () => {
    for (const shape of BLOCK_SHAPES) {
      for (const rotation of [0, 90, 180, 270] as const) {
        expect(cellSet(shapeCells(shape.id, rotation)).size).toBe(shape.cells.length)
      }
    }
  })
})

describe('blockShapes: nextRotation（#481のまわす操作の土台）', () => {
  test('90度ずつ時計回りに進む', () => {
    expect(nextRotation(0)).toBe(90)
    expect(nextRotation(90)).toBe(180)
    expect(nextRotation(180)).toBe(270)
  })

  test('4回進めると元に戻る', () => {
    expect(nextRotation(270)).toBe(0)
  })

  test('対称形（1マス）は向きの値自体はふつうに進み、セルは常に基準セルのみ', () => {
    let rotation: BlockRotation = 0
    for (let i = 0; i < 4; i += 1) {
      rotation = nextRotation(rotation)
      expect(shapeCells('single', rotation)).toEqual([{ col: 0, row: 0 }])
    }
  })
})
