import { describe, expect, it } from 'vitest'
import {
  BIG_FLAG_LAYOUT,
  createDominoPlacements,
  feederColumns,
  feederEntryRank,
  type DominoPlacement,
} from './dominoLayout'
import { dominoFlags } from './flagDefinitions'

describe('BIG_FLAG_LAYOUT', () => {
  it('50×32の国旗セルと一意な配置を生成する', () => {
    const placements = createDominoPlacements('jp', BIG_FLAG_LAYOUT)
    const flags = placements.filter((placement) => placement.kind === 'flag')
    const coordinates = flags.map((flag) => `${flag.row},${flag.col}`)

    expect(flags).toHaveLength(50 * 32)
    expect(new Set(placements.map((placement) => placement.id)).size).toBe(
      placements.length,
    )
    expect(new Set(coordinates).size).toBe(50 * 32)
    expect(new Set(flags.map((placement) => placement.col))).toEqual(
      new Set(Array.from({ length: 50 }, (_, col) => col)),
    )
    expect(new Set(flags.map((placement) => placement.row))).toEqual(
      new Set(Array.from({ length: 32 }, (_, row) => row)),
    )

    const feeders = placements.filter(
      (placement) =>
        placement.kind === 'branch' &&
        /^fan-(left|right)-feeder-\d+$/.test(placement.id),
    )
    for (const flag of flags) {
      expect(Number.isFinite(flag.chainIndex)).toBe(true)
      const side = flag.col! < BIG_FLAG_LAYOUT.cols / 2 ? -1 : 1
      const group = feederEntryRank(flag.col!, BIG_FLAG_LAYOUT.cols)
      expect(feederColumns(side, group, BIG_FLAG_LAYOUT.cols)).toContain(flag.col)
      const feederId = `fan-${side < 0 ? 'left' : 'right'}-feeder-${group}`
      const feeder = feeders.find((placement) => placement.id === feederId)
      expect(feeder).toBeDefined()
      expect(flag.chainIndex).toBeGreaterThanOrEqual(feeder!.chainIndex)
    }
  })

  it('50列の扇状分岐は外側だけ1列グループにする', () => {
    expect(feederColumns(-1, 0, BIG_FLAG_LAYOUT.cols)).toEqual([23, 24])
    expect(feederColumns(1, 0, BIG_FLAG_LAYOUT.cols)).toEqual([25, 26])
    expect(feederColumns(-1, 12, BIG_FLAG_LAYOUT.cols)).toEqual([0])
    expect(feederColumns(1, 12, BIG_FLAG_LAYOUT.cols)).toEqual([49])
    expect(feederEntryRank(0, BIG_FLAG_LAYOUT.cols)).toBe(12)
    expect(feederEntryRank(49, BIG_FLAG_LAYOUT.cols)).toBe(12)
  })

  it('アームはピッチ以内で外側まで連続する', () => {
    const placements = createDominoPlacements('jp', BIG_FLAG_LAYOUT)

    for (const sideName of ['left', 'right'] as const) {
      const arms = placements
        .filter(
          (placement) =>
            placement.kind === 'branch' &&
            new RegExp(`^fan-${sideName}-arm(?:-gap)?-\\d+$`).test(placement.id),
        )
        .sort((a, b) => a.x - b.x)
      const distances = arms.slice(1).map((placement, index) =>
        Math.hypot(placement.x - arms[index]!.x, placement.z - arms[index]!.z),
      )

      expect(arms).toHaveLength(22)
      expect(Math.max(...distances)).toBeLessThanOrEqual(0.85)
      if (sideName === 'left') {
        expect(Math.min(...arms.map((placement) => placement.x))).toBeCloseTo(-15.89)
      } else {
        expect(Math.max(...arms.map((placement) => placement.x))).toBeCloseTo(15.89)
      }
    }
  })

  it('全配置に物理的な重複がない', () => {
    const placements = createDominoPlacements('jp', BIG_FLAG_LAYOUT)
    const bucketSize = 0.3
    // 外側1列のフィーダーは端の旗から設計上0.3離れる。浮動小数点の丸めを許容しつつ、
    // ドミノの厚み0.14を考慮した0.29超を重複なしの判定値にする。
    const minimumCenterDistance = 0.29
    const buckets = new Map<string, DominoPlacement[]>()

    for (const placement of placements) {
      const bucketX = Math.floor(placement.x / bucketSize)
      const bucketZ = Math.floor(placement.z / bucketSize)
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        for (let offsetZ = -1; offsetZ <= 1; offsetZ += 1) {
          const nearby = buckets.get(`${bucketX + offsetX},${bucketZ + offsetZ}`) ?? []
          for (const previous of nearby) {
            expect(
              Math.hypot(placement.x - previous.x, placement.z - previous.z),
              `${placement.id} と ${previous.id}`,
            ).toBeGreaterThan(minimumCenterDistance)
          }
        }
      }
      const key = `${bucketX},${bucketZ}`
      buckets.set(key, [...(buckets.get(key) ?? []), placement])
    }
  })

  it('dominoFlags全件で配置生成が例外にならない', () => {
    for (const definition of dominoFlags) {
      expect(() => createDominoPlacements(definition.id, BIG_FLAG_LAYOUT)).not.toThrow()
    }
  })
})
