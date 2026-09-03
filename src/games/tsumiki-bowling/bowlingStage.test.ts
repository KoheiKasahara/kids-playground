import { describe, expect, it } from 'vitest'
import {
  BOWLING_STAGES,
  DEFAULT_BOWLING_STAGE_ID,
  getBowlingStage,
  LANE_HALF_LENGTH,
  LANE_HALF_WIDTH,
  laneBodyTransform,
  laneSurfaceY,
  laneTiltQuaternion,
  stageBlockPlacements,
  type BowlingStage,
} from './bowlingStage'
import { LANE_SLOPE_RAD, LAUNCH_HEIGHT, LAUNCH_Z } from './bowlingPhysics'
import { getBowlingBall } from './bowlingBalls'

const BALL = getBowlingBall('heavy')
const STAGE = getBowlingStage(DEFAULT_BOWLING_STAGE_ID)

/** 積み木1個の軸沿い境界。同じ段の重なりを調べるために使う。 */
function boundsOf(block: BowlingStage['blocks'][number]) {
  return {
    minX: block.x - block.size[0] / 2,
    maxX: block.x + block.size[0] / 2,
    minY: block.height - block.size[1] / 2,
    maxY: block.height + block.size[1] / 2,
    minZ: block.z - block.size[2] / 2,
    maxZ: block.z + block.size[2] / 2,
  }
}

describe('レーンの形', () => {
  it('手前が高く、奥が低いごく緩い下り勾配になっている', () => {
    expect(laneSurfaceY(LAUNCH_Z)).toBeGreaterThan(laneSurfaceY(0))
    expect(laneSurfaceY(0)).toBeGreaterThan(laneSurfaceY(-8))
    // 積み木が自重で滑り出さない程度の緩さ。
    expect(Math.tan(LANE_SLOPE_RAD)).toBeLessThan(0.1)
  })

  it('勾配に沿わせるクォータニオンが、レーンの法線と一致する', () => {
    const q = laneTiltQuaternion()
    // ローカル+Yを回した向き。
    const up = {
      x: 2 * (q.x * q.y - q.z * q.w),
      y: 1 - 2 * (q.x * q.x + q.z * q.z),
      z: 2 * (q.x * q.w + q.y * q.z),
    }
    expect(up.y).toBeCloseTo(Math.cos(LANE_SLOPE_RAD), 6)
    expect(up.z).toBeCloseTo(-Math.sin(LANE_SLOPE_RAD), 6)
  })

  it('レーン板の上面が、laneSurfaceYの表す面と重なる', () => {
    const lane = laneBodyTransform()
    // 面の中心から法線方向へ板厚のぶん戻ると、必ず面の上にいる。
    expect(lane.center.y).toBeLessThan(laneSurfaceY(lane.center.z))
  })

  it('発射位置は積み木の一番上より高い', () => {
    const tallest = Math.max(...STAGE.blocks.map((block) => block.height + block.size[1] / 2))
    expect(LAUNCH_HEIGHT).toBeGreaterThan(tallest)
  })

  it('積み木も発射位置もレーンの内側にある', () => {
    expect(Math.abs(LAUNCH_Z)).toBeLessThan(LANE_HALF_LENGTH)
    for (const block of STAGE.blocks) {
      expect(Math.abs(block.x) + block.size[0] / 2).toBeLessThan(LANE_HALF_WIDTH)
    }
  })
})

describe('ステージ定義', () => {
  it('Phase 1 は固定1ステージで、既定はその1つ', () => {
    expect(BOWLING_STAGES).toHaveLength(1)
    expect(getBowlingStage(undefined).id).toBe(DEFAULT_BOWLING_STAGE_ID)
    expect(getBowlingStage('does-not-exist').id).toBe(DEFAULT_BOWLING_STAGE_ID)
  })

  it('1発でガラガラ崩れるだけの数がある', () => {
    expect(STAGE.blocks.length).toBeGreaterThanOrEqual(12)
  })

  it('前後2列に積んであり、力が奥へも連鎖する形になっている', () => {
    const rows = new Set(STAGE.blocks.map((block) => block.z))
    expect(rows.size).toBeGreaterThanOrEqual(3)
  })

  it('積み木どうしが初期状態で重なっていない', () => {
    // ここが重なっていると、Rapierが開始直後に弾き飛ばして
    // 何もしていないのに塔が崩れる（実際に19個中5個が勝手に倒れた）。
    const blocks = STAGE.blocks.map(boundsOf)
    for (let a = 0; a < blocks.length; a += 1) {
      for (let b = a + 1; b < blocks.length; b += 1) {
        const first = blocks[a]!
        const second = blocks[b]!
        const overlapX = Math.min(first.maxX, second.maxX) - Math.max(first.minX, second.minX)
        const overlapY = Math.min(first.maxY, second.maxY) - Math.max(first.minY, second.minY)
        const overlapZ = Math.min(first.maxZ, second.maxZ) - Math.max(first.minZ, second.minZ)
        const overlapping = overlapX > 1e-6 && overlapY > 1e-6 && overlapZ > 1e-6
        expect(overlapping, `積み木 ${a} と ${b} が重なっている`).toBe(false)
      }
    }
  })

  it('すべての積み木がレーン面か他の積み木の上に載っている（宙に浮かない）', () => {
    const blocks = STAGE.blocks.map((block) => ({ block, bounds: boundsOf(block) }))
    for (const { block, bounds } of blocks) {
      if (Math.abs(bounds.minY) < 0.02) continue // レーン面に直接置いたもの
      const supported = blocks.some(({ bounds: other }) => {
        if (other === bounds) return false
        const touching = Math.abs(other.maxY - bounds.minY) < 0.02
        const overlapX = Math.min(bounds.maxX, other.maxX) - Math.max(bounds.minX, other.minX)
        const overlapZ = Math.min(bounds.maxZ, other.maxZ) - Math.max(bounds.minZ, other.minZ)
        return touching && overlapX > 0.05 && overlapZ > 0.05
      })
      expect(supported, `高さ${block.height}の積み木が何にも載っていない`).toBe(true)
    }
  })

  it('レーンを転がる高さの列は、すき間が玉の直径より狭く素通りできない', () => {
    // ここが玉より広いと、弾道の低い弱い発射が積み木の間を抜けてしまい、
    // 当てたつもりなのに1個も倒れない投球になる（実際に0個の投球が出た）。
    // 上段は玉が転がって当たる高さではないので対象外。
    const diameter = BALL.radius * 2
    const rows = new Map<string, ReturnType<typeof boundsOf>[]>()
    for (const block of STAGE.blocks) {
      if (block.height - block.size[1] / 2 >= diameter) continue
      const key = `${block.z}:${block.height}`
      const row = rows.get(key) ?? []
      row.push(boundsOf(block))
      rows.set(key, row)
    }
    for (const [key, row] of rows) {
      if (row.length < 2) continue
      const sorted = [...row].sort((a, b) => a.minX - b.minX)
      for (let index = 1; index < sorted.length; index += 1) {
        const gap = sorted[index]!.minX - sorted[index - 1]!.maxX
        expect(gap, `列 ${key} のすき間が広すぎる`).toBeLessThan(diameter)
      }
    }
  })
})

describe('どこへ当てても崩れる形になっているか', () => {
  it('玉が通れる左右のどの位置でも、転がる高さで必ず何かにぶつかる', () => {
    // ここが1か所でも空いていると、そこを通った投球だけ「当てたのに何も起きない」になる。
    const diameter = BALL.radius * 2
    const reachable = STAGE.blocks
      .map(boundsOf)
      .filter((bounds) => bounds.minY < diameter)
    for (let x = -2; x <= 2; x += 0.05) {
      const ballMin = x - BALL.radius
      const ballMax = x + BALL.radius
      const hit = reachable.some((bounds) => bounds.minX < ballMax && bounds.maxX > ballMin)
      expect(hit, `x=${x.toFixed(2)} を通る玉が何にも当たらない`).toBe(true)
    }
  })

  it('幅いっぱいの壁が塔の手前に立っていて、力を左右へ伝える', () => {
    const wall = STAGE.blocks.find((block) => block.size[0] >= 4)
    expect(wall).toBeDefined()
    // 塔の柱より手前にあること。
    const towerZ = Math.min(...STAGE.blocks.map((block) => block.z))
    expect(wall!.z).toBeGreaterThan(towerZ)
  })
})

describe('世界座標への変換', () => {
  const placements = stageBlockPlacements(STAGE)

  it('積み木の数だけ配置が作られる', () => {
    expect(placements).toHaveLength(STAGE.blocks.length)
  })

  it('レーン面より上に置かれる', () => {
    placements.forEach((placement, index) => {
      const halfHeight = placement.size[1] / 2
      expect(placement.position.y - halfHeight).toBeGreaterThanOrEqual(
        laneSurfaceY(placement.position.z) - 1e-6,
      )
      expect(placement.position.y, `${index}番目の高さ`).toBeGreaterThan(-10)
    })
  })

  it('勾配に沿った姿勢で置かれる', () => {
    const tilt = laneTiltQuaternion()
    for (const placement of placements) {
      expect(placement.rotation.x).toBeCloseTo(tilt.x, 6)
      expect(placement.rotation.w).toBeCloseTo(tilt.w, 6)
    }
  })

  it('何度呼んでも同じ配置になる（もういちどで形が変わらない）', () => {
    expect(stageBlockPlacements(STAGE)).toEqual(placements)
  })
})
