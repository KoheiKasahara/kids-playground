import { describe, expect, it } from 'vitest'
import { HARD_TIMEOUT_MS } from './dominoCompletion'
import {
  LINE_PITCH_Z,
  createDominoPlacements,
  getLayoutBounds,
  type DominoPlacement,
} from './dominoLayout'
import { createDominoCourse } from './dominoCourse'
import { GROUND_SIZE } from './dominoPhysics'
import { dominoFlags } from './flagDefinitions'

function distance(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.z - b.z)
}

function withoutChainIndex(placement: DominoPlacement) {
  const {
    id,
    kind,
    x,
    z,
    width,
    yaw,
    chainYaw,
    color,
    row,
    col,
  } = placement
  return { id, kind, x, z, width, yaw, chainYaw, color, row, col }
}

describe('createDominoCourse', () => {
  it('normalは全20か国で既存createDominoPlacementsと完全一致する', () => {
    for (const flag of dominoFlags) {
      const course = createDominoCourse('normal', flag.id)
      expect(course.placements).toEqual(createDominoPlacements(flag.id))
    }
  })

  it('longは既存コースを複製せず、chainIndexだけ道中ぶんずらす', () => {
    for (const flag of dominoFlags) {
      const normal = createDominoPlacements(flag.id)
      const long = createDominoCourse('long', flag.id)
      const shared = long.placements.slice(long.approachCount)

      expect(shared.map(withoutChainIndex)).toEqual(normal.map(withoutChainIndex))
      expect(shared.map((placement) => placement.chainIndex)).toEqual(
        normal.map((placement) => placement.chainIndex + long.approachCount),
      )
    }
  })

  it('normalのコース既定値と国旗カメラ境界を維持する', () => {
    const normal = createDominoCourse('normal', 'jp')
    const long = createDominoCourse('long', 'jp')

    expect(normal.approachCount).toBe(0)
    expect(normal.cameraProgressCount).toBe(0)
    expect(normal.approachPath).toHaveLength(0)
    expect(normal.cameraApproachPath).toHaveLength(0)
    expect(normal.ballSection).toBeNull()
    expect(normal.startId).toBe('line-0')
    expect(normal.groundSize).toBe(GROUND_SIZE)
    expect(normal.hardTimeoutMs).toBe(HARD_TIMEOUT_MS)
    expect(normal.flagCameraBounds).toEqual(long.flagCameraBounds)
  })

  it('long縺ｮ繧ｫ繝｡繝ｩ騾ｲ陦悟ｺｦ縺ｮ蜈磯ｭ縺ｯ道中44枚の後に共有直線12枚が続く', () => {
    const course = createDominoCourse('long', 'jp')

    expect(course.cameraProgressCount).toBe(course.cameraApproachPath.length + 12)
    expect(
      course.placements
        .slice(course.approachCount, course.approachCount + 12)
        .every((placement) => placement.kind === 'line'),
    ).toBe(true)
    expect(
      course.placements
        .slice(course.approachCount, course.approachCount + 12)
        .map((placement) => placement.id),
    ).toEqual(Array.from({ length: 12 }, (_, index) => `line-${index}`))
  })

  it('ロングは折り返し15枚を1球のレールへ置き換え、前後の接続点を保つ', () => {
    const course = createDominoCourse('long', 'jp')
    const approach = course.placements.slice(0, course.approachCount)
    const lineZero = course.placements.find((placement) => placement.id === 'line-0')!
    const ids = approach.map((placement) => placement.id)
    const last = approach.at(-1)!
    const ball = course.ballSection

    expect(ball).not.toBeNull()
    expect(approach.length).toBe(29)
    expect(new Set(ids).size).toBe(approach.length)
    expect(ids).toEqual([
      ...Array.from({ length: 15 }, (_, index) => `approach-${index}`),
      ...Array.from({ length: 14 }, (_, index) => `approach-${index + 30}`),
    ])
    expect(ball!.replacedApproachIndexes).toEqual(
      Array.from({ length: 15 }, (_, index) => index + 15),
    )
    expect(ball!.triggerDominoId).toBe('approach-14')
    expect(ball!.receiverDominoId).toBe('approach-30')
    expect(ball!.railSegments).toHaveLength(5)
    expect(course.cameraApproachPath).toHaveLength(44)
    expect(last.x).toBeCloseTo(0)
    expect(last.z).toBeCloseTo(lineZero.z - LINE_PITCH_Z)
    expect(last.yaw).toBeCloseTo(0)
    expect(last.chainYaw).toBe(last.yaw)
    expect(distance(last, lineZero)).toBeCloseTo(LINE_PITCH_Z)
    expect(course.startId).toBe('approach-0')
  })

  it('残る道中の旋回、自己干渉、通常コース干渉、地面内を満たす', () => {
    const course = createDominoCourse('long', 'jp')
    const approach = course.placements.slice(0, course.approachCount)
    const normal = createDominoPlacements('jp')
    // line-0は終端の接続相手なので、接続区間だけは通常配置との距離検査から外す。
    const nonConnectionNormal = normal.filter((placement) => placement.id !== 'line-0')
    const sequentialPairs = approach.slice(1).flatMap((placement, index) => {
      const previous = approach[index]!
      const previousIndex = Number(previous.id.replace('approach-', ''))
      const currentIndex = Number(placement.id.replace('approach-', ''))
      return currentIndex === previousIndex + 1 ? [[previous, placement] as const] : []
    })
    const yawChanges = sequentialPairs.map(([previous, placement]) => placement.yaw! - previous.yaw!)
    const adjacentDistances = sequentialPairs.map(([previous, placement]) => distance(previous, placement))

    expect(Math.max(...yawChanges.map(Math.abs))).toBeLessThanOrEqual(
      (15 * Math.PI) / 180 + 1e-9,
    )
    expect(yawChanges.some((change) => change > 0.001)).toBe(true)
    expect(yawChanges.some((change) => change < -0.001)).toBe(true)
    // 倒伏到達距離1.07に対して0.9以下なら、隣の接触に十分な余裕が残る。
    expect(Math.max(...adjacentDistances)).toBeLessThanOrEqual(0.9)

    let minDistanceAtTwo = Number.POSITIVE_INFINITY
    let minDistanceAtThreeOrMore = Number.POSITIVE_INFINITY
    for (let first = 0; first < approach.length; first += 1) {
      for (let second = 0; second < first - 1; second += 1) {
        const indexDifference = first - second
        const minimumDistance = indexDifference === 2 ? 1.3 : 1.6
        const currentDistance = distance(approach[first]!, approach[second]!)
        if (indexDifference === 2) {
          minDistanceAtTwo = Math.min(minDistanceAtTwo, currentDistance)
        } else {
          minDistanceAtThreeOrMore = Math.min(
            minDistanceAtThreeOrMore,
            currentDistance,
          )
        }
        expect(currentDistance).toBeGreaterThanOrEqual(minimumDistance)
      }
      if (first === approach.length - 1) continue
      for (const placement of nonConnectionNormal) {
        expect(distance(approach[first]!, placement)).toBeGreaterThanOrEqual(2)
      }
    }

    console.log(
      `[domino-course] adjacentMax=${Math.max(...adjacentDistances).toFixed(6)}, ` +
        `distanceDiff2Min=${minDistanceAtTwo.toFixed(6)}, ` +
        `distanceDiff3PlusMin=${minDistanceAtThreeOrMore.toFixed(6)}, ` +
        `lastToLine0=${distance(approach.at(-1)!, normal.find((p) => p.id === 'line-0')!).toFixed(6)}`,
    )

    const bounds = getLayoutBounds(course.placements)
    const edge = course.groundSize / 2 - 1
    expect(bounds.minX).toBeGreaterThanOrEqual(-edge)
    expect(bounds.maxX).toBeLessThanOrEqual(edge)
    expect(bounds.minZ).toBeGreaterThanOrEqual(-edge)
    expect(bounds.maxZ).toBeLessThanOrEqual(edge)
  })
})
