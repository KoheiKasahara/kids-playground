import { describe, expect, it } from 'vitest'
import { BIG_FLAG_LAYOUT, createDominoPlacements } from './dominoLayout'
import { createBigFlagGrid, } from './bigFlagRenderer'
import { dominoFlags, type FlagCellColor } from './flagDefinitions'

const palette = new Set<FlagCellColor>([
  'red', 'white', 'blue', 'black', 'yellow', 'green', 'orange', 'lightBlue',
])

describe('createBigFlagGrid', () => {
  it('全40か国を50×32へ直接生成し、共通パレット以外の色を使わない', () => {
    for (const flag of dominoFlags) {
      const grid = createBigFlagGrid(flag.id, { cols: 50, rows: 32 })
      expect(grid).toHaveLength(32)
      expect(grid.every((row) => row.length === 50), flag.id).toBe(true)
      expect(grid.flat().every((color) => palette.has(color)), flag.id).toBe(true)
    }
  })

  it('任意の偶数サイズへ再ラスタライズできる', () => {
    for (const id of ['jp', 'vn', 'gb', 'br', 'za'] as const) {
      const grid = createBigFlagGrid(id, { cols: 60, rows: 40 })
      expect(grid).toHaveLength(40)
      expect(grid.flat()).toHaveLength(2400)
    }
  })

  it('不正な国旗ID・サイズを受け付けない', () => {
    expect(() => createBigFlagGrid('unknown' as never, { cols: 50, rows: 32 })).toThrow()
    expect(() => createBigFlagGrid('jp', { cols: 0, rows: 32 })).toThrow()
  })

  it('日本は中心を保った円を描き、左右の輪郭も対称になる', () => {
    const grid = createBigFlagGrid('jp', { cols: 50, rows: 32 })
    expect(grid[16]![25]).toBe('red')
    expect(grid[3]![25]).toBe('white')
    expect(grid[16]!.filter((color) => color === 'red')).toHaveLength(18)
    expect(grid.every((row) => row.every((color, col) => color === row[49 - col]))).toBe(true)
  })

  it('星・斜線・ひし形をビッグ解像度で描画する', () => {
    const vietnam = createBigFlagGrid('vn', { cols: 50, rows: 32 })
    const unitedKingdom = createBigFlagGrid('gb', { cols: 50, rows: 32 })
    const brazil = createBigFlagGrid('br', { cols: 50, rows: 32 })

    expect(vietnam.flat().filter((color) => color === 'yellow').length).toBeGreaterThan(150)
    expect(vietnam.flat().filter((color) => color === 'yellow').length).toBeLessThan(230)
    expect(unitedKingdom[1]!.filter((color) => color === 'white').length).toBeGreaterThan(2)
    expect(unitedKingdom[1]!.filter((color) => color === 'red').length).toBeGreaterThan(0)
    expect(brazil[16]![25]).toBe('blue')
    expect(brazil[3]![25]).toBe('yellow')
    expect(brazil[0]![0]).toBe('green')
  })

  it('ビッグ配置だけが高解像度グリッドを使い、ふつう配置は16×10のまま', () => {
    const bigFlags = createDominoPlacements('jp', BIG_FLAG_LAYOUT).filter((placement) => placement.kind === 'flag')
    const normalFlags = createDominoPlacements('jp').filter((placement) => placement.kind === 'flag')

    expect(bigFlags).toHaveLength(1600)
    expect(bigFlags.find((placement) => placement.row === 16 && placement.col === 25)?.color).toBe('red')
    expect(normalFlags).toHaveLength(160)
    expect(normalFlags.find((placement) => placement.row === 2 && placement.col === 6)?.color).toBe('red')
  })
})
