import { describe, expect, it } from 'vitest'
import { BIG_FLAG_LAYOUT, createDominoPlacements } from './dominoLayout'
import { createBigFlagGrid } from './bigFlagRenderer'
import { dominoFlags, type DominoFlagId, type FlagCellColor } from './flagDefinitions'

const palette = new Set<FlagCellColor>([
  'red', 'white', 'blue', 'black', 'yellow', 'green', 'orange', 'lightBlue',
])

const requiredColorsByFlag: Readonly<Record<DominoFlagId, readonly FlagCellColor[]>> = {
  jp: ['red', 'white'],
  fr: ['blue', 'white', 'red'],
  us: ['blue', 'red', 'white'],
  gb: ['blue', 'red', 'white'],
  it: ['green', 'white', 'red'],
  de: ['black', 'red', 'yellow'],
  nl: ['red', 'white', 'blue'],
  be: ['black', 'yellow', 'red'],
  pl: ['white', 'red'],
  ua: ['blue', 'yellow'],
  id: ['red', 'white'],
  ch: ['red', 'white'],
  se: ['blue', 'yellow'],
  fi: ['white', 'blue'],
  bd: ['green', 'red'],
  ca: ['red', 'white'],
  br: ['green', 'yellow', 'blue', 'white'],
  kr: ['white', 'red', 'blue', 'black'],
  in: ['orange', 'white', 'green', 'blue'],
  tr: ['red', 'white'],
  gr: ['blue', 'white'],
  jm: ['yellow', 'green', 'black'],
  cz: ['blue', 'white', 'red'],
  pk: ['white', 'green'],
  mk: ['yellow', 'red'],
  za: ['red', 'blue', 'green', 'black', 'yellow', 'white'],
  es: ['red', 'yellow'],
  pt: ['green', 'red', 'yellow'],
  dk: ['red', 'white'],
  no: ['red', 'white', 'blue'],
  cn: ['red', 'yellow'],
  vn: ['red', 'yellow'],
  th: ['red', 'white', 'blue'],
  ph: ['white', 'blue', 'red', 'yellow'],
  at: ['red', 'white'],
  ie: ['green', 'white', 'orange'],
  ro: ['blue', 'yellow', 'red'],
  hu: ['red', 'white', 'green'],
  bg: ['white', 'green', 'red'],
  ar: ['lightBlue', 'white', 'yellow'],
}

function sortedColors(colors: Iterable<FlagCellColor>): FlagCellColor[] {
  return [...colors].sort()
}

function countColorInRegion(
  grid: FlagCellColor[][],
  color: FlagCellColor,
  rowStart: number,
  rowEnd: number,
  colStart: number,
  colEnd: number,
): number {
  let count = 0
  for (let row = rowStart; row <= rowEnd; row += 1) {
    for (let col = colStart; col <= colEnd; col += 1) {
      if (grid[row]![col] === color) count += 1
    }
  }
  return count
}

describe('createBigFlagGrid', () => {
  it('全40か国が実旗の主要色を少なくとも1セルずつ保持する', () => {
    expect(Object.keys(requiredColorsByFlag)).toHaveLength(dominoFlags.length)
    for (const flag of dominoFlags) {
      const colors = new Set(createBigFlagGrid(flag.id, { cols: 50, rows: 32 }).flat())
      expect(sortedColors(colors), flag.id).toEqual(sortedColors(requiredColorsByFlag[flag.id]!))
    }
  })

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

  it('ジャマイカは金色の斜め十字と上下緑・左右黒を保つ', () => {
    const grid = createBigFlagGrid('jm', { cols: 50, rows: 32 })

    expect(grid[2]![25]).toBe('green')
    expect(grid[29]![25]).toBe('green')
    expect(grid[16]![3]).toBe('black')
    expect(grid[16]![46]).toBe('black')
    expect(grid[16]![25]).toBe('yellow')
    expect(grid.flat().filter((color) => color === 'yellow').length).toBeGreaterThan(100)
  })

  it('南アフリカは黒三角・黄色縁・緑Y・赤青の構造を保つ', () => {
    const grid = createBigFlagGrid('za', { cols: 50, rows: 32 })

    expect(grid[16]![4]).toBe('black')
    expect(grid[4]![1]).toBe('yellow')
    expect(grid[16]![30]).toBe('green')
    expect(grid[11]![30]).toBe('white')
    expect(grid[2]![45]).toBe('red')
    expect(grid[29]![45]).toBe('blue')
    expect(countColorInRegion(grid, 'green', 12, 19, 24, 49)).toBeGreaterThan(20)
  })

  it('アメリカは13本の赤白縞、青いカントン、白い星を保持する', () => {
    const grid = createBigFlagGrid('us', { cols: 50, rows: 32 })
    const stripeColumn = grid.map((row) => row[45]!)
    const runs: FlagCellColor[] = []
    for (const color of stripeColumn) {
      if (runs.at(-1) !== color) runs.push(color)
    }

    expect(runs).toEqual([
      'red', 'white', 'red', 'white', 'red', 'white', 'red',
      'white', 'red', 'white', 'red', 'white', 'red',
    ])
    expect(grid[0]![0]).toBe('blue')
    expect(countColorInRegion(grid, 'white', 0, 16, 0, 19)).toBeGreaterThan(20)
    expect(grid[0]![21]).toBe('red')
  })

  it('ブラジルは緑地・黄色ひし形・青円に白帯を重ねる', () => {
    const grid = createBigFlagGrid('br', { cols: 50, rows: 32 })
    const discRegion = grid
      .slice(9, 24)
      .flatMap((row) => row.slice(17, 34))

    expect(grid[0]![0]).toBe('green')
    expect(grid[3]![25]).toBe('yellow')
    expect(grid[16]![25]).toBe('blue')
    expect(discRegion.filter((color) => color === 'white').length).toBeGreaterThan(5)
    expect(discRegion.filter((color) => color === 'blue').length).toBeGreaterThan(20)
  })

  it('韓国はS字の太極と4隅のトリグラムを保持する', () => {
    const grid = createBigFlagGrid('kr', { cols: 50, rows: 32 })

    expect(grid[13]![21]).toBe('red')
    expect(grid[13]![29]).toBe('blue')
    expect(grid[20]![21]).toBe('blue')
    expect(grid[20]![29]).toBe('blue')
    const trigramRegions = [
      [2, 9, 3, 17], [2, 9, 32, 46],
      [22, 29, 3, 17], [22, 29, 32, 46],
    ] as const
    for (const [rowStart, rowEnd, colStart, colEnd] of trigramRegions) {
      expect(countColorInRegion(grid, 'black', rowStart, rowEnd, colStart, colEnd)).toBeGreaterThan(15)
    }
  })

  it('インドはサフラン・白・緑と閉じた青いチャクラを保持する', () => {
    const grid = createBigFlagGrid('in', { cols: 50, rows: 32 })

    expect(grid[2]![25]).toBe('orange')
    expect(grid[16]![25]).toBe('blue')
    expect(grid[29]![25]).toBe('green')
    expect(grid[11]![25]).toBe('blue')
    expect(grid[20]![25]).toBe('blue')
    expect(grid[16]![21]).toBe('blue')
    expect(grid[16]![29]).toBe('blue')
    expect(countColorInRegion(grid, 'blue', 10, 21, 18, 32)).toBeGreaterThan(30)
  })

  it('重点旗の主要識別要素を維持する', () => {
    const japan = createBigFlagGrid('jp', { cols: 50, rows: 32 })
    const vietnam = createBigFlagGrid('vn', { cols: 50, rows: 32 })
    const unitedKingdom = createBigFlagGrid('gb', { cols: 50, rows: 32 })
    const pakistan = createBigFlagGrid('pk', { cols: 50, rows: 32 })
    const northMacedonia = createBigFlagGrid('mk', { cols: 50, rows: 32 })

    expect(japan[16]![25]).toBe('red')
    expect(vietnam[16]![25]).toBe('yellow')
    expect(unitedKingdom[16]![25]).toBe('red')
    expect(unitedKingdom[1]!.filter((color) => color === 'white').length).toBeGreaterThan(2)
    expect(pakistan[16]![5]).toBe('white')
    expect(pakistan[16]![30]).toBe('green')
    expect(northMacedonia[16]![25]).toBe('yellow')
    expect(northMacedonia[2]![2]).toBe('red')
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
