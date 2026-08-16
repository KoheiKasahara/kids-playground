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
  createFlagGrid,
  dominoFlags,
  type DominoFlagId,
  type FlagCellColor,
} from './flagDefinitions'

const flagIds: DominoFlagId[] = ['jp', 'fr', 'us', 'gb']
const knownColors = new Set<FlagCellColor>(['red', 'white', 'blue'])

describe('dominoFlags', () => {
  it('4か国すべてが10行×16列の160セルである', () => {
    for (const id of flagIds) {
      const grid = createFlagGrid(id)

      expect(grid).toHaveLength(10)
      expect(grid.flat()).toHaveLength(160)
      expect(grid.every((row) => row.length === 16)).toBe(true)
    }
  })

  it('全セルがred/white/blueのいずれかに解決される', () => {
    for (const id of flagIds) {
      const grid = createFlagGrid(id)

      expect(grid.flat().every((color) => knownColors.has(color))).toBe(true)
    }
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

  it('id・nameJa・画像パスがflag-quizのマスターと一致する', () => {
    for (const definition of dominoFlags) {
      const country = countries.find((candidate) => candidate.id === definition.id)

      expect(country?.id).toBe(definition.id)
      expect(country?.nameJa).toBe(definition.nameJa)
      expect(country?.flag).toBe(definition.imagePath)
    }
  })

  it('4か国の画像ファイルがpublic/flagsに実在する', () => {
    for (const definition of dominoFlags) {
      expect(existsSync(resolve('public', definition.imagePath))).toBe(true)
    }
  })
})
