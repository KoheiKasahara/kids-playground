/// <reference types="node" />

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { countries } from '../flag-quiz/data/countries'
import {
  FLAG_COLS,
  FLAG_PITCH_X,
  FLAG_PITCH_Z,
  FLAG_ROWS,
} from './dominoLayout'
import {
  FLAG_CELL_COLOR_BY_CHAR,
  FLAG_COLOR_HEX,
  createFlagGrid,
  dominoFlags,
  type DominoFlagId,
  type FlagCellColor,
} from './flagDefinitions'

const flagIds: DominoFlagId[] = [
  'jp',
  'fr',
  'us',
  'gb',
  'it',
  'de',
  'nl',
  'be',
  'pl',
  'ua',
  'id',
  'ch',
  'se',
  'fi',
  'bd',
  'ca',
  'br',
  'kr',
  'in',
  'tr',
  'gr',
  'jm',
  'cz',
  'pk',
  'mk',
  'za',
]
/** flag-quizのcountriesマスターに存在しない国旗ID。北マケドニアはこっきドミノ限定の追加国。 */
const idsWithoutFlagQuizMaster = new Set<DominoFlagId>(['mk'])
const knownColors = new Set<FlagCellColor>([
  'red',
  'white',
  'blue',
  'black',
  'yellow',
  'green',
  'orange',
])

describe('dominoFlags', () => {
  it('26か国が指定順で一意に定義されている', () => {
    expect(dominoFlags.map((definition) => definition.id)).toEqual(flagIds)
    expect(new Set(flagIds).size).toBe(flagIds.length)
  })

  it('26か国すべてが10行×16列の160セルである', () => {
    for (const id of flagIds) {
      const grid = createFlagGrid(id)

      expect(grid).toHaveLength(10)
      expect(grid.flat()).toHaveLength(160)
      expect(grid.every((row) => row.length === 16)).toBe(true)
    }
  })

  it('全セルが共通パレットのいずれかに解決される', () => {
    for (const id of flagIds) {
      const grid = createFlagGrid(id)

      expect(grid.flat().every((color) => knownColors.has(color))).toBe(true)
    }
  })

  it('追加色のHEXと文字マッピングが共通定義になっている', () => {
    expect(FLAG_COLOR_HEX.red).toBe('#bc002d')
    expect(FLAG_COLOR_HEX.white).toBe('#fffdf5')
    expect(FLAG_COLOR_HEX.blue).toBe('#1f4aa8')

    const paletteKeys = new Set(Object.keys(FLAG_COLOR_HEX))
    const mappedColors = new Set(Object.values(FLAG_CELL_COLOR_BY_CHAR))
    expect(mappedColors).toEqual(paletteKeys)
    expect(paletteKeys.size).toBeLessThanOrEqual(7)
  })

  it('未知の国旗IDを渡すとthrowする', () => {
    expect(() => createFlagGrid('unknown')).toThrow()
  })

  it('日本は赤と白だけで、青を含まない', () => {
    const colors = new Set(createFlagGrid('jp').flat())

    expect(colors.has('red')).toBe(true)
    expect(colors.has('white')).toBe(true)
    expect(colors.has('blue')).toBe(false)
  })

  it('フランスは青・白・赤をすべて含む', () => {
    expect(new Set(createFlagGrid('fr').flat())).toEqual(
      new Set(['red', 'white', 'blue']),
    )
  })

  it('アメリカは赤・白・青をすべて含む', () => {
    expect(new Set(createFlagGrid('us').flat())).toEqual(
      new Set(['red', 'white', 'blue']),
    )
  })

  it('イギリスは赤・白・青をすべて含む', () => {
    expect(new Set(createFlagGrid('gb').flat())).toEqual(
      new Set(['red', 'white', 'blue']),
    )
  })

  it('日本のグリッドはPhase 1.5の円形計算と完全一致する', () => {
    const radius = FLAG_ROWS * FLAG_PITCH_Z * 0.3
    const expected = Array.from({ length: FLAG_ROWS }, (_, row) =>
      Array.from({ length: FLAG_COLS }, (_, col) => {
        const x = (col - (FLAG_COLS - 1) / 2) * FLAG_PITCH_X
        const z = (row - (FLAG_ROWS - 1) / 2) * FLAG_PITCH_Z
        return Math.hypot(x, z) <= radius ? 'red' : 'white'
      }),
    )

    expect(createFlagGrid('jp')).toEqual(expected)
  })

  it('各国の特徴セルが定義どおりである', () => {
    const japan = createFlagGrid('jp')
    const france = createFlagGrid('fr')
    const usa = createFlagGrid('us')
    const unitedKingdom = createFlagGrid('gb')

    for (const row of [4, 5]) {
      for (const col of [7, 8]) expect(japan[row]![col]).toBe('red')
    }
    for (const [row, col] of [
      [0, 0],
      [0, 15],
      [9, 0],
      [9, 15],
    ]) {
      expect(japan[row]![col]).toBe('white')
    }

    for (const row of france) {
      expect(row[0]).toBe('blue')
      expect(row[8]).toBe('white')
      expect(row[15]).toBe('red')
    }

    expect(usa[0]![0]).toBe('blue')
    expect(usa[1]![1]).toBe('white')
    expect(usa[6]).toEqual(Array.from({ length: 16 }, () => 'red'))
    expect(usa[0]![7]).toBe('red')

    expect(unitedKingdom[4]).toEqual(Array.from({ length: 16 }, () => 'red'))
    expect(unitedKingdom[5]).toEqual(Array.from({ length: 16 }, () => 'red'))
    expect(unitedKingdom.every((row) => row[7] === 'red')).toBe(true)
    expect(unitedKingdom.every((row) => row[8] === 'red')).toBe(true)
    for (const [row, col] of [
      [0, 0],
      [0, 15],
      [9, 0],
      [9, 15],
    ]) {
      expect(unitedKingdom[row]![col]).toBe('red')
    }
    const blueRatio = unitedKingdom.flat().filter((color) => color === 'blue').length / 160
    expect(blueRatio).toBeGreaterThanOrEqual(0.2)
    expect(blueRatio).toBeLessThan(0.25)
  })

  it('追加11か国が主要色と視認しやすい形状を持つ', () => {
    for (const [id, colors] of [
      ['it', ['green', 'white', 'red']],
      ['de', ['black', 'red', 'yellow']],
      ['nl', ['red', 'white', 'blue']],
      ['be', ['black', 'yellow', 'red']],
      ['pl', ['white', 'red']],
      ['ua', ['blue', 'yellow']],
      ['id', ['red', 'white']],
      ['ch', ['red', 'white']],
      ['se', ['blue', 'yellow']],
      ['fi', ['white', 'blue']],
      ['bd', ['green', 'red']],
    ] as const) {
      expect(new Set(createFlagGrid(id).flat())).toEqual(new Set(colors))
    }

    const italy = createFlagGrid('it')
    expect(italy[0]!.slice(0, 5)).toEqual([
      'green',
      'green',
      'green',
      'green',
      'green',
    ])
    expect(italy[0]![5]).toBe('white')
    expect(italy[0]![11]).toBe('red')

    const germany = createFlagGrid('de')
    expect(germany[0]![0]).toBe('black')
    expect(germany[3]![0]).toBe('red')
    expect(germany[7]![0]).toBe('yellow')

    const netherlands = createFlagGrid('nl')
    expect(netherlands[0]![0]).toBe('red')
    expect(netherlands[3]![0]).toBe('white')
    expect(netherlands[7]![0]).toBe('blue')

    const belgium = createFlagGrid('be')
    expect(belgium[0]![0]).toBe('black')
    expect(belgium[0]![5]).toBe('yellow')
    expect(belgium[0]![11]).toBe('red')

    const poland = createFlagGrid('pl')
    expect(poland[0]![0]).toBe('white')
    expect(poland[5]![0]).toBe('red')

    const ukraine = createFlagGrid('ua')
    expect(ukraine[0]![0]).toBe('blue')
    expect(ukraine[5]![0]).toBe('yellow')

    const indonesia = createFlagGrid('id')
    expect(indonesia[0]![0]).toBe('red')
    expect(indonesia[5]![0]).toBe('white')

    const switzerland = createFlagGrid('ch')
    const swissBorder = [
      ...switzerland[0]!,
      ...switzerland[9]!,
      ...switzerland.map((row) => row[0]),
      ...switzerland.map((row) => row[15]),
    ]
    expect(swissBorder.every((color) => color === 'red')).toBe(true)
    expect(switzerland[4]![7]).toBe('white')
    expect(switzerland[4]![4]).toBe('red')
    expect(switzerland[4]![10]).toBe('white')
    expect(switzerland[4]![11]).toBe('red')
    expect(switzerland[2]![7]).toBe('white')
    expect(switzerland[1]![7]).toBe('red')
    const swissWhiteRatio =
      switzerland.flat().filter((color) => color === 'white').length / 160
    expect(swissWhiteRatio).toBeGreaterThanOrEqual(0.1)
    expect(swissWhiteRatio).toBeLessThan(0.2)

    const sweden = createFlagGrid('se')
    expect(sweden[0]![0]).toBe('blue')
    expect(sweden[0]![5]).toBe('yellow')
    expect(sweden[4]).toEqual(Array.from({ length: 16 }, () => 'yellow'))

    const finland = createFlagGrid('fi')
    expect(finland[0]![0]).toBe('white')
    expect(finland[0]![5]).toBe('blue')
    expect(finland[4]).toEqual(Array.from({ length: 16 }, () => 'blue'))

    const bangladesh = createFlagGrid('bd')
    expect(bangladesh[0]![0]).toBe('green')
    expect(bangladesh[4]![7]).toBe('red')
    const redCells = bangladesh.flatMap((row) =>
      row.flatMap((color, col) => (color === 'red' ? [col] : [])),
    )
    const redColumnCenter = redCells.reduce((sum, col) => sum + col, 0) / redCells.length
    expect(redColumnCenter).toBeLessThan((FLAG_COLS - 1) / 2)
  })

  it('新規5か国が主要色と旗の特徴を持つ', () => {
    for (const [id, colors] of [
      ['ca', ['red', 'white']],
      ['br', ['green', 'yellow', 'blue']],
      ['kr', ['white', 'red', 'blue', 'black']],
      ['in', ['orange', 'white', 'green', 'blue']],
      ['tr', ['red', 'white']],
    ] as const) {
      expect(new Set(createFlagGrid(id).flat())).toEqual(new Set(colors))
    }

    const canada = createFlagGrid('ca')
    expect(
      canada.every(
        (row) =>
          row.slice(0, 4).every((color) => color === 'red') &&
          row.slice(12).every((color) => color === 'red'),
      ),
    ).toBe(true)
    expect(canada.some((row) => row.slice(4, 12).includes('red'))).toBe(true)
    expect(canada.every((row) => row[4] === 'white' && row[11] === 'white')).toBe(true)
    expect(canada.some((row) => row.every((color) => color === 'red'))).toBe(false)
    expect(canada[8]![7]).toBe('red')
    expect(canada[0]![7]).toBe('white')
    expect(canada[2]![5]).toBe('red')
    expect(canada[2]![6]).toBe('white')
    expect(canada[2]![9]).toBe('white')
    expect(canada[2]![10]).toBe('red')
    const canadaLeafWidths = canada.map(
      (row) => row.slice(4, 12).filter((color) => color === 'red').length,
    )
    expect(canadaLeafWidths).toEqual([0, 2, 4, 6, 6, 4, 2, 2, 2, 0])
    expect(canadaLeafWidths).not.toEqual([...canadaLeafWidths].reverse())
    const canadaRedRows = canada.flatMap((row, rowIndex) =>
      row.flatMap((color) => (color === 'red' ? [rowIndex] : [])),
    )
    const canadaRedCenter =
      canadaRedRows.reduce((sum, rowIndex) => sum + rowIndex, 0) / canadaRedRows.length
    expect(canadaRedCenter).toBeLessThan((FLAG_ROWS - 1) / 2)

    const brazil = createFlagGrid('br')
    const brazilDiamondWidths = brazil.map(
      (row) => row.filter((color) => color !== 'green').length,
    )
    expect(brazilDiamondWidths).toEqual([2, 4, 6, 8, 10, 10, 8, 6, 4, 2])
    const brazilBlueCells = brazil.flatMap((row, rowIndex) =>
      row.flatMap((color, col) =>
        color === 'blue' ? [{ row: rowIndex, col }] : [],
      ),
    )
    expect(brazilBlueCells.length).toBeGreaterThan(0)
    for (const { row, col } of brazilBlueCells) {
      const surroundingColors = []
      for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
        for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
          if (rowOffset === 0 && colOffset === 0) continue
          surroundingColors.push(brazil[row + rowOffset]![col + colOffset])
        }
      }
      expect(
        surroundingColors
          .filter((color) => color !== 'blue')
          .every((color) => color === 'yellow'),
      ).toBe(true)
    }

    const korea = createFlagGrid('kr')
    const blackAreas = [
      { rows: [1, 2], cols: [1, 2, 3] },
      { rows: [1, 2], cols: [12, 13, 14] },
      { rows: [7, 8], cols: [1, 2, 3] },
      { rows: [7, 8], cols: [12, 13, 14] },
    ]
    for (const area of blackAreas) {
      expect(
        area.rows.every((row) =>
          area.cols.every((col) => korea[row]![col] === 'black'),
        ),
      ).toBe(true)
    }
    const isBlackArea = (row: number, col: number) =>
      ((row === 1 || row === 2 || row === 7 || row === 8) &&
        ((col >= 1 && col <= 3) || (col >= 12 && col <= 14)))
    const koreaBlackCells = korea.flatMap((row, rowIndex) =>
      row.flatMap((color, col) =>
        color === 'black' ? [{ row: rowIndex, col }] : [],
      ),
    )
    expect(koreaBlackCells.every(({ row, col }) => isBlackArea(row, col))).toBe(true)
    expect(korea.some((row) => row.includes('red'))).toBe(true)
    expect(korea.some((row) => row.includes('blue'))).toBe(true)

    const india = createFlagGrid('in')
    expect(india[0]).toEqual(Array.from({ length: FLAG_COLS }, () => 'orange'))
    expect(india[9]).toEqual(Array.from({ length: FLAG_COLS }, () => 'green'))
    expect(
      india.every(
        (row, rowIndex) =>
          rowIndex >= 3 && rowIndex <= 6 ? true : !row.includes('blue'),
      ),
    ).toBe(true)
    expect(india[3]![7]).toBe('blue')
    expect(india[4]![6]).toBe('blue')
    expect(india[4]![7]).toBe('white')
    expect(india[4]![8]).toBe('white')
    expect(india[4]![9]).toBe('blue')

    const turkey = createFlagGrid('tr')
    const countWhite = (start: number, end: number) =>
      turkey.reduce(
        (total, row) => total + row.slice(start, end).filter((color) => color === 'white').length,
        0,
      )
    const leftWhite = countWhite(0, 8)
    const rightWhite = countWhite(8, 16)
    expect(leftWhite).toBeGreaterThan(rightWhite)
    expect(rightWhite).toBeGreaterThan(0)
    const whiteColumns = (rowIndex: number) =>
      turkey[rowIndex]!.flatMap((color, col) =>
        color === 'white' ? [col] : [],
      )
    expect(whiteColumns(2)).toEqual([4, 5, 6, 7])
    expect(whiteColumns(3)).toEqual([3, 4, 5, 6])
    expect(whiteColumns(4)).toEqual([3, 4, 5, 10])
    expect(whiteColumns(5)).toEqual([3, 4, 5, 9, 10, 11])
    expect(whiteColumns(6)).toEqual([3, 4, 5, 6, 10])
    expect(whiteColumns(7)).toEqual([4, 5, 6, 7])
    expect(turkey[2]![7]).toBe('white')
    expect(turkey[3]![7]).toBe('red')
    expect(turkey[4]![7]).toBe('red')
    expect(turkey[6]![7]).toBe('red')
    expect(turkey[5]![7]).toBe('red')
    expect(turkey[5]!.slice(9, 12)).toEqual(['white', 'white', 'white'])
  })

  it('id・nameJa・画像パスがflag-quizのマスターと一致する（北マケドニアを除く）', () => {
    for (const definition of dominoFlags) {
      if (idsWithoutFlagQuizMaster.has(definition.id)) continue
      const country = countries.find((candidate) => candidate.id === definition.id)

      expect(country?.id).toBe(definition.id)
      expect(country?.nameJa).toBe(definition.nameJa)
      expect(country?.flag).toBe(definition.imagePath)
    }
  })

  it('26か国の画像ファイルがpublic/flagsに実在する', () => {
    for (const definition of dominoFlags) {
      expect(existsSync(resolve('public', definition.imagePath))).toBe(true)
    }
  })

  it('新規6か国が主要色と旗の特徴を持つ', () => {
    for (const [id, colors] of [
      ['gr', ['blue', 'white']],
      ['jm', ['green', 'yellow', 'black']],
      ['cz', ['white', 'red', 'blue']],
      ['pk', ['green', 'white']],
      ['mk', ['red', 'yellow']],
      ['za', ['green', 'black', 'yellow', 'white', 'red', 'blue']],
    ] as const) {
      expect(new Set(createFlagGrid(id).flat())).toEqual(new Set(colors))
    }

    // ギリシャ: 左上のカントンが白十字を持つ青地で、アメリカ国旗と違って赤を含まない
    const greece = createFlagGrid('gr')
    expect(greece.flat().includes('red')).toBe(false)
    expect(greece[0]![3]).toBe('white')
    expect(greece[2]!.slice(0, 7)).toEqual(Array.from({ length: 7 }, () => 'white'))

    // ジャマイカ: 黄色い斜め十字が中央を横切り、上下は緑、左右は黒
    const jamaica = createFlagGrid('jm')
    for (const row of [4, 5]) {
      expect(jamaica[row]!.slice(6, 10).every((color) => color === 'yellow')).toBe(true)
    }
    expect(jamaica[0]![7]).toBe('green')
    expect(jamaica[0]![0]).toBe('yellow')
    expect(jamaica[4]![0]).toBe('black')
    expect(jamaica[4]![15]).toBe('black')

    // チェコ: 上半分が白、下半分が赤。青い三角形は列0(ホイスト側)で全10行を占め、
    // 列が中央へ近づくほど上下中央(行4,5)だけへ収束する
    // （行ごとの幅ではなく列ごとの高さで先細る三角形であることを確認する）
    const czech = createFlagGrid('cz')
    expect(czech[0]![15]).toBe('white')
    expect(czech[9]![15]).toBe('red')
    expect(czech.every((row) => row[0] === 'blue')).toBe(true)
    const czechBlueHeights = Array.from({ length: FLAG_COLS }, (_, col) =>
      czech.filter((row) => row[col] === 'blue').length,
    )
    expect(czechBlueHeights[0]).toBe(10)
    for (let col = 1; col < FLAG_COLS - 1; col += 1) {
      expect(czechBlueHeights[col]).toBeLessThanOrEqual(czechBlueHeights[col - 1])
    }
    expect(czechBlueHeights[FLAG_COLS - 1]).toBe(0)
    const czechBlueWidths = czech.map(
      (row) => row.filter((color) => color === 'blue').length,
    )
    expect(czechBlueWidths).toEqual([1, 2, 4, 6, 8, 8, 6, 4, 2, 1])

    // パキスタン: 左4列が白帯、残りは緑地に白い三日月と星
    const pakistan = createFlagGrid('pk')
    expect(pakistan.every((row) => row.slice(0, 4).every((color) => color === 'white'))).toBe(
      true,
    )
    expect(pakistan.every((row) => row.slice(4).some((color) => color === 'green'))).toBe(true)
    expect(pakistan[4]!.slice(5, 8).every((color) => color === 'white')).toBe(true)

    // 北マケドニア: 中央から黄色い光線が放射状に伸び、赤地が過半数を占める
    const macedonia = createFlagGrid('mk')
    expect(macedonia[4]).toEqual(Array.from({ length: FLAG_COLS }, () => 'yellow'))
    expect(macedonia.every((row) => row[7] === 'yellow' && row[8] === 'yellow')).toBe(true)
    const macedoniaYellowRatio =
      macedonia.flat().filter((color) => color === 'yellow').length / 160
    expect(macedoniaYellowRatio).toBeGreaterThan(0.2)
    expect(macedoniaYellowRatio).toBeLessThan(0.5)

    // 南アフリカ: 中央に緑のY字、左に黒い三角形、右上が赤・右下が青
    const southAfrica = createFlagGrid('za')
    expect(southAfrica[0]![0]).toBe('red')
    expect(southAfrica[9]![0]).toBe('blue')
    expect(southAfrica[4]![0]).toBe('black')
    const greenCells = southAfrica.flatMap((row, rowIndex) =>
      row.flatMap((color, col) => (color === 'green' ? [{ row: rowIndex, col }] : [])),
    )
    expect(greenCells.length).toBeGreaterThan(20)
    // 緑は左端(黒の右)から右端の角近くまで連なり、単なる「左黒・右上赤・右下青」ではない
    const greenCols = greenCells.map(({ col }) => col)
    expect(Math.min(...greenCols)).toBeLessThanOrEqual(3)
    expect(Math.max(...greenCols)).toBeGreaterThanOrEqual(13)
    expect(southAfrica[0]!.some((color) => color === 'green')).toBe(true)
    expect(southAfrica[9]!.some((color) => color === 'green')).toBe(true)
  })
})
