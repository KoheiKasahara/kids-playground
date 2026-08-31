import { describe, expect, it } from 'vitest'
import {
  BOWL_RADIUS,
  bowlHeightAt,
  bowlSlopeAt,
  createStadiumHeightfield,
  createWallSegments,
  FIELD_RADIUS,
  VALLEY_RADIUS,
  WALL_INNER_RADIUS,
  WALL_SEGMENTS,
  WALL_THICKNESS,
} from './komaStadium'

describe('bowlHeightAt', () => {
  it('谷がいちばん低く、縁で高さ0になる', () => {
    expect(bowlHeightAt(VALLEY_RADIUS)).toBeLessThan(bowlHeightAt(0))
    expect(bowlHeightAt(VALLEY_RADIUS)).toBeLessThan(bowlHeightAt(BOWL_RADIUS))
    expect(bowlHeightAt(BOWL_RADIUS)).toBeCloseTo(0, 6)
  })

  it('中央はわずかに盛り上がっているが、谷との差はごく小さい', () => {
    const mound = bowlHeightAt(0) - bowlHeightAt(VALLEY_RADIUS)
    expect(mound).toBeGreaterThan(0)
    // 中央へ寄ったコマを谷へ戻す程度で足り、乗り越えられない山にはしない。
    expect(mound).toBeLessThan(0.05)
  })

  it('外周より外は高さ0の平らな踏みしろになる', () => {
    expect(bowlHeightAt(BOWL_RADIUS + 0.1)).toBe(0)
    expect(bowlHeightAt(FIELD_RADIUS + 10)).toBe(0)
  })

  it('NaNを渡しても有限な高さを返す', () => {
    expect(bowlHeightAt(Number.NaN)).toBe(0)
  })
})

describe('bowlSlopeAt', () => {
  it('谷の外側は内向き、内側は外向きの傾きになる', () => {
    expect(bowlSlopeAt(VALLEY_RADIUS + 0.5)).toBeGreaterThan(0)
    expect(bowlSlopeAt(VALLEY_RADIUS - 0.2)).toBeLessThan(0)
  })

  it('いちばん急なところでも浅いすり鉢の範囲に収まる', () => {
    // 縁での傾きが約0.23（13度弱）。急勾配にして常に中央へ落ち続ける形にはしない。
    const steepest = Math.abs(bowlSlopeAt(BOWL_RADIUS - 0.01))
    expect(steepest).toBeGreaterThan(0.1)
    expect(steepest).toBeLessThan(0.3)
  })
})

describe('createStadiumHeightfield', () => {
  it('Rapierが要求する頂点数ぶんの高さを列優先で返す', () => {
    const field = createStadiumHeightfield(8)
    expect(field.segments).toBe(8)
    expect(field.heights).toHaveLength(9 * 9)
    expect(field.size).toBeCloseTo(FIELD_RADIUS * 2)
  })

  it('すべての高さが有限で、床の外側は下げてある', () => {
    const field = createStadiumHeightfield(16)
    for (const height of field.heights) expect(Number.isFinite(height)).toBe(true)
    // 四隅は必ず半径FIELD_RADIUSの外側にあり、壁を越えたコマが落ちる領域になる。
    expect(field.heights[0]).toBeLessThan(-1)
  })

  it('中心の高さが解析的な形状と一致する', () => {
    const field = createStadiumHeightfield(16)
    const vertices = 17
    const middle = (vertices - 1) / 2
    expect(field.heights[middle * vertices + middle]).toBeCloseTo(bowlHeightAt(0), 6)
  })
})

describe('createWallSegments', () => {
  it('既定の枚数で円周をひと回りする', () => {
    expect(createWallSegments()).toHaveLength(WALL_SEGMENTS)
  })

  it('すべての壁が同じ半径に等間隔で並ぶ', () => {
    const segments = createWallSegments(12)
    const expectedRadius = WALL_INNER_RADIUS + WALL_THICKNESS / 2
    for (const segment of segments) {
      expect(Math.hypot(segment.center.x, segment.center.z)).toBeCloseTo(expectedRadius, 6)
      expect(segment.center.y).toBeGreaterThan(0)
    }
  })

  it('隣り合う壁が隙間なくつながる幅を持つ', () => {
    const count = 12
    const segments = createWallSegments(count)
    const centerRadius = WALL_INNER_RADIUS + WALL_THICKNESS / 2
    // 隣の中心までの弦の長さを、2枚ぶんの半幅が覆えていればコマは抜けられない。
    const chord = 2 * centerRadius * Math.sin(Math.PI / count)
    expect(segments[0]!.halfWidth * 2).toBeGreaterThanOrEqual(chord)
  })

  it('壁の厚みが半径方向を向いている', () => {
    for (const segment of createWallSegments(8)) {
      // ローカルZ(厚み方向)をyawで回した向きが、その壁の半径方向と一致する。
      const thicknessX = Math.sin(segment.yaw)
      const thicknessZ = Math.cos(segment.yaw)
      const radialX = segment.center.x / Math.hypot(segment.center.x, segment.center.z)
      const radialZ = segment.center.z / Math.hypot(segment.center.x, segment.center.z)
      expect(thicknessX).toBeCloseTo(radialX, 6)
      expect(thicknessZ).toBeCloseTo(radialZ, 6)
    }
  })
})
