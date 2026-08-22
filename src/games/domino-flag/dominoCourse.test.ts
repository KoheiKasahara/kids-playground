import { describe, expect, it } from 'vitest'
import { BIG_HARD_TIMEOUT_MS, HARD_TIMEOUT_MS } from './dominoCompletion'
import {
  BIG_FLAG_LAYOUT,
  LINE_PITCH_Z,
  createDominoPlacements,
  getLayoutBounds,
  type DominoPlacement,
} from './dominoLayout'
import { createBigCourse, createDominoCourse, type DominoCourse } from './dominoCourse'
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
  it('bigは全配置の50×32国旗と短い導線だけを持つ', () => {
    const course = createBigCourse('jp')
    const flags = course.placements.filter((placement) => placement.kind === 'flag')

    expect(course.type).toBe('big')
    expect(course.flagLayout).toEqual(BIG_FLAG_LAYOUT)
    expect(flags).toHaveLength(50 * 32)
    expect(course.startId).toBe('line-0')
    expect(course.approachCount).toBe(0)
    expect(course.approachPath).toEqual([])
    expect(course.cameraApproachPath).toEqual([])
    expect(course.ballSection).toBeNull()
    expect(course.seesawBallSection).toBeNull()
    expect(course.seesawSection).toBeNull()
    expect(course.cameraProgressCount).toBe(0)
    expect(course.solverIterations).toBe(2)
    expect(course.settleSleepEnabled).toBe(true)
    expect(course.cameraMode).toBe('bigPullout')
    expect(course.hardTimeoutMs).toBe(BIG_HARD_TIMEOUT_MS)
    expect(course.groundSize).toBeGreaterThanOrEqual(80)
  })

  it('bigのSTARTから国旗までの導線はふつうと同じ長さになる', () => {
    // Issue #142の「導線はふつうと同程度に短い」を、行数が増えても保つための回帰テスト。
    // 国旗が奥へ広がるぶん扇状分岐と直線も一緒に下がるため、両者の差は変わらないはず。
    const approachLengthOf = (course: DominoCourse): number => {
      const start = course.placements.find((placement) => placement.id === course.startId)
      const firstFlagRow = course.placements.filter(
        (placement) => placement.kind === 'flag' && placement.row === 0,
      )
      if (!start || firstFlagRow.length === 0) throw new Error('導線の基準が見つかりません')
      return firstFlagRow[0]!.z - start.z
    }

    expect(approachLengthOf(createBigCourse('jp'))).toBeCloseTo(
      approachLengthOf(createDominoCourse('normal', 'jp')),
      10,
    )
  })

  it('bigはlayoutを差し替えてサイズ比較できる', () => {
    const layout = { cols: 32, rows: 24 } as const
    const course = createBigCourse('jp', layout)
    expect(course.flagLayout).toEqual({ ...layout, chainGroupWeight: 2 })
    expect(course.placements.filter((placement) => placement.kind === 'flag')).toHaveLength(
      layout.cols * layout.rows,
    )
  })
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
    expect(normal.seesawBallSection).toBeNull()
    expect(normal.seesawSection).toBeNull()
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
    expect(ball!.replacedApproachIndexes).toEqual(
      Array.from({ length: 15 }, (_, index) => index + 15),
    )
    expect(ball!.triggerDominoId).toBe('approach-14')
    expect(ball!.receiverDominoId).toBe('approach-30')
    expect(ball!.railSegments).toHaveLength(14)
    expect(last.x).toBeCloseTo(0)
    expect(last.z).toBeCloseTo(lineZero.z - LINE_PITCH_Z)
    expect(last.yaw).toBeCloseTo(0)
    expect(last.chainYaw).toBe(last.yaw)
    expect(distance(last, lineZero)).toBeCloseTo(LINE_PITCH_Z)
    expect(course.startId).toBe('approach-0')
    expect(new Set(ids).size).toBe(approach.length)
  })

  it('ロングは2つ目の坂の折り返し9枚もシーソー行きのボールへ置き換える', () => {
    const course = createDominoCourse('long', 'jp')
    const approach = course.placements.slice(0, course.approachCount)
    const ids = approach.map((placement) => placement.id)
    const seesawBall = course.seesawBallSection
    const seesaw = course.seesawSection

    expect(seesawBall).not.toBeNull()
    expect(seesaw).not.toBeNull()
    expect(seesawBall!.replacedApproachIndexes).toEqual(
      Array.from({ length: 9 }, (_, index) => index + 58),
    )
    expect(seesawBall!.triggerDominoId).toBe('approach-57')
    expect(seesawBall!.receiverDominoId).toBe('approach-67')
    expect(seesawBall!.railSegments).toHaveLength(7)
    expect(seesaw!.strikeDominoId).toBe('approach-67')
    // 既存Phase 6の15枚と、2つ目の坂の9枚を合わせて24枚が物理ドミノから消え、
    // 全体の道中(raw 0〜89=90枚)から66枚が実体のドミノとして残る。
    expect(course.cameraApproachPath).toHaveLength(90)
    expect(approach.length).toBe(course.cameraApproachPath.length - 15 - 9)
    expect(ids).toContain('approach-57')
    expect(ids).toContain('approach-67')
    expect(ids).not.toContain('approach-58')
    expect(ids).not.toContain('approach-66')
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
