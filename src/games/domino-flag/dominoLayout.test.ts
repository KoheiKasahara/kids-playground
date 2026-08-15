import { describe, expect, it } from 'vitest'
import {
  FLAG_COLS,
  FLAG_ROWS,
  createDominoPlacements,
  createJapanFlagGrid,
} from './dominoLayout'

describe('createJapanFlagGrid', () => {
  it('10行×16列のグリッドを作る', () => {
    const grid = createJapanFlagGrid()

    expect(grid).toHaveLength(FLAG_ROWS)
    expect(grid.every((row) => row.length === FLAG_COLS)).toBe(true)
  })

  it('赤セルの面積が日の丸らしい範囲に収まる', () => {
    const grid = createJapanFlagGrid()
    const redCount = grid.flat().filter((color) => color === 'red').length
    const redRatio = redCount / (FLAG_ROWS * FLAG_COLS)

    expect(redRatio).toBeGreaterThanOrEqual(0.15)
    expect(redRatio).toBeLessThanOrEqual(0.23)
  })

  it('左右対称かつ上下対称である', () => {
    const grid = createJapanFlagGrid()

    for (let row = 0; row < FLAG_ROWS; row += 1) {
      for (let col = 0; col < FLAG_COLS; col += 1) {
        expect(grid[row][col]).toBe(grid[row][FLAG_COLS - 1 - col])
        expect(grid[row][col]).toBe(grid[FLAG_ROWS - 1 - row][col])
      }
    }
  })

  it('中央4セルが赤で四隅が白である', () => {
    const grid = createJapanFlagGrid()

    for (const row of [4, 5]) {
      for (const col of [7, 8]) expect(grid[row][col]).toBe('red')
    }
    for (const [row, col] of [
      [0, 0],
      [0, FLAG_COLS - 1],
      [FLAG_ROWS - 1, 0],
      [FLAG_ROWS - 1, FLAG_COLS - 1],
    ]) {
      expect(grid[row][col]).toBe('white')
    }
  })

  it('赤と白の両方を含む', () => {
    const colors = new Set(createJapanFlagGrid().flat())

    expect(colors).toEqual(new Set(['red', 'white']))
  })
})

describe('createDominoPlacements', () => {
  it('合計173個で、直線12・トリガー1・国旗160の内訳になる', () => {
    const placements = createDominoPlacements()

    expect(placements).toHaveLength(173)
    expect(placements.filter((placement) => placement.kind === 'line')).toHaveLength(12)
    expect(placements.filter((placement) => placement.kind === 'trigger')).toHaveLength(1)
    expect(placements.filter((placement) => placement.kind === 'flag')).toHaveLength(160)
  })

  it('idと国旗セル座標が重複せず、16×10を埋める', () => {
    const flags = createDominoPlacements().filter((placement) => placement.kind === 'flag')
    const ids = createDominoPlacements().map((placement) => placement.id)
    const coordinates = flags.map((placement) => `${placement.row},${placement.col}`)
    const expectedCoordinates = Array.from({ length: FLAG_ROWS }, (_, row) =>
      Array.from({ length: FLAG_COLS }, (_, col) => `${row},${col}`),
    ).flat()

    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(coordinates).size).toBe(FLAG_ROWS * FLAG_COLS)
    expect(coordinates.sort()).toEqual(expectedCoordinates.sort())
  })

  it('zが直線、トリガー、国旗row 0〜9の順に増える', () => {
    const placements = createDominoPlacements()
    const lines = placements.filter((placement) => placement.kind === 'line')
    const trigger = placements.find((placement) => placement.kind === 'trigger')
    const flags = placements.filter((placement) => placement.kind === 'flag')

    expect(trigger).toBeDefined()
    expect(Math.max(...lines.map((placement) => placement.z))).toBeLessThan(trigger!.z)
    for (let row = 0; row < FLAG_ROWS; row += 1) {
      const rowPlacements = flags.filter((placement) => placement.row === row)
      expect(new Set(rowPlacements.map((placement) => placement.z))).toHaveLength(1)
      if (row > 0) {
        const previous = flags.find((placement) => placement.row === row - 1)!
        expect(rowPlacements[0].z).toBeGreaterThan(previous.z)
      }
    }
    expect(flags.find((placement) => placement.row === 0)!.z).toBeGreaterThan(trigger!.z)
  })

  it('国旗ドミノの色がグリッドと一致する', () => {
    const grid = createJapanFlagGrid()
    const flags = createDominoPlacements().filter((placement) => placement.kind === 'flag')

    for (const flag of flags) {
      expect(flag.color).toBe(grid[flag.row!][flag.col!])
    }
  })
})
