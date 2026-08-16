import { describe, expect, it } from 'vitest'
import {
  FLAG_COLS,
  FLAG_ROWS,
  FLAG_PITCH_X,
  createDominoPlacements,
  type DominoPlacement,
} from './dominoLayout'
import { createFlagGrid, dominoFlags } from './flagDefinitions'

describe('createDominoPlacements', () => {
  it('合計211個で、直線12・扇状分岐39・国旗160の内訳になる', () => {
    const placements = createDominoPlacements()

    expect(placements).toHaveLength(211)
    expect(placements.filter((placement) => placement.kind === 'line')).toHaveLength(12)
    expect(placements.filter((placement) => placement.kind === 'branch')).toHaveLength(39)
    expect(placements.filter((placement) => placement.kind === 'flag')).toHaveLength(160)
    expect(placements.some((placement) => placement.kind === ('trigger' as never))).toBe(false)
  })

  it('idが一意で国旗セル座標が16×10を網羅する', () => {
    const placements = createDominoPlacements()
    const flags = placements.filter((placement) => placement.kind === 'flag')
    const ids = placements.map((placement) => placement.id)
    const coordinates = flags.map((placement) => `${placement.row},${placement.col}`)
    const expectedCoordinates = Array.from({ length: FLAG_ROWS }, (_, row) =>
      Array.from({ length: FLAG_COLS }, (_, col) => `${row},${col}`),
    ).flat()

    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(coordinates).size).toBe(FLAG_ROWS * FLAG_COLS)
    expect(coordinates.sort()).toEqual(expectedCoordinates.sort())
  })

  it('直線の終点から扇状分岐を経てrow 0へ進むZ順序になる', () => {
    const placements = createDominoPlacements()
    const lines = placements.filter((placement) => placement.kind === 'line')
    const branches = placements.filter((placement) => placement.kind === 'branch')
    const flags = placements.filter((placement) => placement.kind === 'flag')
    const root = branches.find((placement) => placement.id === 'fan-root')
    const rowZero = flags.filter((placement) => placement.row === 0)

    expect(root).toBeDefined()
    expect(Math.max(...lines.map((placement) => placement.z))).toBeLessThan(root!.z)
    expect(Math.max(...branches.map((placement) => placement.z))).toBeLessThan(
      rowZero[0]!.z,
    )
    for (let row = 1; row < FLAG_ROWS; row += 1) {
      const previous = flags.find((placement) => placement.row === row - 1)!
      const current = flags.filter((placement) => placement.row === row)
      expect(new Set(current.map((placement) => placement.z))).toHaveLength(1)
      expect(current[0]!.z).toBeGreaterThan(previous.z)
    }
  })

  it('最終フィーダーが隣接2列の中間にあり、yawが0である', () => {
    const placements = createDominoPlacements()
    const feeders = placements.filter(
      (placement) =>
        placement.kind === 'branch' &&
        /^fan-(left|right)-feeder-\d+$/.test(placement.id),
    )
    const flags = placements.filter((placement) => placement.kind === 'flag')

    expect(feeders).toHaveLength(8)
    expect(feeders.every((placement) => placement.yaw === 0)).toBe(true)
    for (const feeder of feeders) {
      const nearby = flags.filter(
        (flag) =>
          flag.row === 0 &&
          Math.abs(flag.x - feeder.x) < FLAG_PITCH_X * 0.6,
      )
      expect(nearby).toHaveLength(2)
      expect(feeder.x).toBeCloseTo((nearby[0]!.x + nearby[1]!.x) / 2)
    }
  })

  it('国旗ドミノの色がグリッドと一致する', () => {
    for (const definition of dominoFlags) {
      const grid = createFlagGrid(definition.id)
      const flags = createDominoPlacements(definition.id).filter(
        (placement) => placement.kind === 'flag',
      )

      for (const flag of flags) {
        expect(flag.color).toBe(grid[flag.row!][flag.col!])
      }
    }
  })

  it('4か国でplacementの非color項目は一致し、差分はcolorだけになる', () => {
    const comparable = ({
      id,
      kind,
      x,
      z,
      width,
      yaw,
      chainIndex,
      row,
      col,
    }: DominoPlacement) => ({ id, kind, x, z, width, yaw, chainIndex, row, col })
    const base = createDominoPlacements('jp').map(
      comparable,
    )

    for (const definition of dominoFlags.filter((flag) => flag.id !== 'jp')) {
      const placements = createDominoPlacements(definition.id).map(comparable)
      expect(placements).toEqual(base)
    }
  })
})
