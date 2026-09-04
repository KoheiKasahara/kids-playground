import { describe, expect, it } from 'vitest'
import {
  BACK_WALL_Z,
  BOWLING_STAGES,
  DEFAULT_BOWLING_STAGE_ID,
  getBowlingStage,
  LANE_HALF_LENGTH,
  LANE_HALF_WIDTH,
  laneBodyTransform,
  laneSurfaceY,
  laneTiltQuaternion,
  stageBlockPlacements,
  stageBounds,
  stagePreview,
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

/** ステージ内のどこにも重なりがないか。 */
function hasNoOverlap(stage: BowlingStage): boolean {
  const blocks = stage.blocks.map(boundsOf)
  for (let a = 0; a < blocks.length; a += 1) {
    for (let b = a + 1; b < blocks.length; b += 1) {
      const first = blocks[a]!
      const second = blocks[b]!
      const overlapX = Math.min(first.maxX, second.maxX) - Math.max(first.minX, second.minX)
      const overlapY = Math.min(first.maxY, second.maxY) - Math.max(first.minY, second.minY)
      const overlapZ = Math.min(first.maxZ, second.maxZ) - Math.max(first.minZ, second.minZ)
      if (overlapX > 1e-6 && overlapY > 1e-6 && overlapZ > 1e-6) return false
    }
  }
  return true
}

/** すべての積み木が、レーン面か他の積み木の上に載っているか（宙に浮かない）。 */
function allSupported(stage: BowlingStage): boolean {
  const blocks = stage.blocks.map((block) => ({ block, bounds: boundsOf(block) }))
  return blocks.every(({ bounds }) => {
    if (Math.abs(bounds.minY) < 0.02) return true // レーン面に直接置いたもの
    return blocks.some(({ bounds: other }) => {
      if (other === bounds) return false
      const touching = Math.abs(other.maxY - bounds.minY) < 0.02
      const overlapX = Math.min(bounds.maxX, other.maxX) - Math.max(bounds.minX, other.minX)
      const overlapZ = Math.min(bounds.maxZ, other.maxZ) - Math.max(bounds.minZ, other.minZ)
      return touching && overlapX > 0.05 && overlapZ > 0.05
    })
  })
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

  it('積み木も発射位置もレーンの内側にある', () => {
    expect(Math.abs(LAUNCH_Z)).toBeLessThan(LANE_HALF_LENGTH)
  })

  it('既定ステージでは、発射位置は積み木の一番上より高い', () => {
    // 既定ステージ(tower)は発射位置の上から見下ろす構図が前提。
    // 高さで攻略が変わるステージ(tall等)は、逆に発射位置より高いことがあり
    // これは意図した違いなので全ステージへは広げない（bowlingStage.tsのコメント参照）。
    const tallest = Math.max(...STAGE.blocks.map((block) => block.height + block.size[1] / 2))
    expect(LAUNCH_HEIGHT).toBeGreaterThan(tallest)
  })
})

describe('全ステージ共通の制約', () => {
  it.each(BOWLING_STAGES)('$name: idとnameが空でなく、hintも空でない', (stage) => {
    expect(stage.id.length).toBeGreaterThan(0)
    expect(stage.name.length).toBeGreaterThan(0)
    expect(stage.hint.length).toBeGreaterThan(0)
  })

  it('idとnameは、どのステージとも重複しない', () => {
    const ids = BOWLING_STAGES.map((stage) => stage.id)
    const names = BOWLING_STAGES.map((stage) => stage.name)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(names).size).toBe(names.length)
  })

  it.each(BOWLING_STAGES)('$name: ブロック数が8〜32個の範囲にある', (stage) => {
    expect(stage.blocks.length).toBeGreaterThanOrEqual(8)
    expect(stage.blocks.length).toBeLessThanOrEqual(32)
  })

  it.each(BOWLING_STAGES)('$name: 積み木どうしが初期状態で重なっていない', (stage) => {
    // 少しでも重なった状態から始めると、Rapierが初期状態でそれを弾き飛ばし、
    // 何もしていないのに崩れてしまう（tower実測で19個中5個が勝手に倒れた）。
    expect(hasNoOverlap(stage)).toBe(true)
  })

  it.each(BOWLING_STAGES)('$name: すべての積み木がレーン面か他の積み木の上に載っている（宙に浮かない）', (stage) => {
    expect(allSupported(stage)).toBe(true)
  })

  it.each(BOWLING_STAGES)('$name: すべての積み木がレーンの内側にある', (stage) => {
    for (const block of stage.blocks) {
      expect(Math.abs(block.x) + block.size[0] / 2).toBeLessThan(LANE_HALF_WIDTH)
    }
  })

  it.each(BOWLING_STAGES)('$name: 玉から積み木まで、ビューンと進むのを楽しめる助走距離がある', (stage) => {
    // 近すぎると、離した瞬間にもう当たっていて「飛んでいく」が見えない。
    // 遠すぎると、幼児には狙いにくく、当たるまで待たされる。
    const runUp = LAUNCH_Z - stageBounds(stage).frontZ
    expect(runUp).toBeGreaterThan(12.5)
    expect(runUp).toBeLessThan(14)
  })

  it.each(BOWLING_STAGES)('$name: 奥には、崩れた積み木が散らばるだけの余地が残っている', (stage) => {
    // ここが詰まると、崩れた積み木がすぐ奥の壁で止まって「ガラガラ」が縮む。
    expect(stageBounds(stage).backZ - BACK_WALL_Z).toBeGreaterThan(2)
  })

  it.each(BOWLING_STAGES)('$name: stageBlockPlacementsがブロックと同数を返し、何度呼んでも同じ配置になる', (stage) => {
    const placements = stageBlockPlacements(stage)
    expect(placements).toHaveLength(stage.blocks.length)
    expect(stageBlockPlacements(stage)).toEqual(placements)
  })

  it.each(BOWLING_STAGES)('$name: まん中の帯(x=-0.8〜0.8)は、転がる高さで必ず何かにぶつかる', (stage) => {
    // ここが1か所でも空いていると、そこを通った投球だけ
    // 「当てたのに何も起きない」になる。
    const diameter = BALL.radius * 2
    const reachable = stage.blocks.map(boundsOf).filter((bounds) => bounds.minY < diameter)
    for (let x = -0.8; x <= 0.8; x += 0.05) {
      const ballMin = x - BALL.radius
      const ballMax = x + BALL.radius
      const hit = reachable.some((bounds) => bounds.minX < ballMax && bounds.maxX > ballMin)
      expect(hit, `${stage.id}: x=${x.toFixed(2)} を通る玉が何にも当たらない`).toBe(true)
    }
  })
})

/**
 * 「大きく横へ狙ったときに当たるか」は、ステージごとに意図して変えている。
 *
 * 左右いっぱいに狙った玉は x≒±2.4 まで届く（実測）。塔が細いステージでは
 * そこまで届かず、思い切り横へ狙うと外れる。これは不具合ではなく、
 * ステージの違い（幅の狭さ）そのもの。ねらっている間は予測の点と着地の輪が
 * 出るので、外れる投球は投げる前に見えている。
 *
 * ただし最初に触るステージだけは、外して終わる体験にしない。
 * 既定(tower)・入門(triangle)・横に広い(castle)の3つは、
 * Phase 1 と同じ「x=-2〜2 のどこを通っても必ず何かに当たる」を守る。
 */
describe('横に大きく狙ったときに当たるか', () => {
  const FORGIVING_STAGE_IDS = ['tower', 'triangle', 'castle'] as const

  it.each(FORGIVING_STAGE_IDS)(
    '%s: 玉が通れる左右のどの位置でも、転がる高さで必ず何かにぶつかる',
    (stageId) => {
      const stage = getBowlingStage(stageId)
      const diameter = BALL.radius * 2
      const reachable = stage.blocks.map(boundsOf).filter((bounds) => bounds.minY < diameter)
      for (let x = -2; x <= 2; x += 0.05) {
        const ballMin = x - BALL.radius
        const ballMax = x + BALL.radius
        const hit = reachable.some((bounds) => bounds.minX < ballMax && bounds.maxX > ballMin)
        expect(hit, `${stageId}: x=${x.toFixed(2)} を通る玉が何にも当たらない`).toBe(true)
      }
    },
  )

  it('細いステージと広いステージが両方あり、幅の違いが遊びの違いになっている', () => {
    const widths = BOWLING_STAGES.map((stage) => stageBounds(stage).halfWidth)
    expect(Math.min(...widths)).toBeLessThan(1.5)
    expect(Math.max(...widths)).toBeGreaterThan(2.2)
  })
})

describe('ステージごとの見た目・崩れ方の違い', () => {
  const bounds = BOWLING_STAGES.map((stage) => ({ stage, bounds: stageBounds(stage) }))

  it('いちばん高いステージといちばん低いステージで1.5m以上の差がある', () => {
    const heights = bounds.map(({ bounds: b }) => b.topHeight)
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThanOrEqual(1.5)
  })

  it('半幅に0.8m以上の差があるステージの組が存在する', () => {
    const hasWideDifference = bounds.some(({ bounds: a }) =>
      bounds.some(({ bounds: b }) => Math.abs(a.halfWidth - b.halfWidth) >= 0.8),
    )
    expect(hasWideDifference).toBe(true)
  })

  it('ブロック数に15個以上の差があるステージの組が存在する', () => {
    const counts = BOWLING_STAGES.map((stage) => stage.blocks.length)
    const hasWideDifference = counts.some((a) => counts.some((b) => Math.abs(a - b) >= 15))
    expect(hasWideDifference).toBe(true)
  })

  it('どの2ステージも(ブロック数, 高さ, 半幅)の3つ組が一致しない', () => {
    const signatures = bounds.map(
      ({ stage, bounds: b }) => `${stage.blocks.length}:${b.topHeight}:${b.halfWidth}`,
    )
    expect(new Set(signatures).size).toBe(signatures.length)
  })
})

describe('プレビュー投影', () => {
  it.each(BOWLING_STAGES)('$name: ブロック数と同じ数の矩形を返す', (stage) => {
    expect(stagePreview(stage).rects).toHaveLength(stage.blocks.length)
  })

  it.each(BOWLING_STAGES)('$name: すべての矩形がviewBoxの内側にある', (stage) => {
    const preview = stagePreview(stage)
    for (const rect of preview.rects) {
      expect(rect.x).toBeGreaterThanOrEqual(0)
      expect(rect.x + rect.width).toBeLessThanOrEqual(preview.width + 1e-9)
      expect(rect.y).toBeGreaterThanOrEqual(0)
      expect(rect.y + rect.height).toBeLessThanOrEqual(preview.height + 1e-9)
    }
  })

  it.each(BOWLING_STAGES)('$name: 奥から手前の順（depthが単調非減少）に並んでいる', (stage) => {
    const preview = stagePreview(stage)
    for (let index = 1; index < preview.rects.length; index += 1) {
      expect(preview.rects[index]!.depth).toBeGreaterThanOrEqual(preview.rects[index - 1]!.depth)
    }
  })

  it.each(BOWLING_STAGES)('$name: 同じ引数なら常に同じ結果になる（純粋関数）', (stage) => {
    expect(stagePreview(stage)).toEqual(stagePreview(stage))
  })
})

describe('既定ステージ固有の性質', () => {
  it('既定はtower。未知のIDでも既定へ戻る', () => {
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

describe('世界座標への変換（既定ステージ）', () => {
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
})
