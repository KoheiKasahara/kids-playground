import { describe, expect, it } from 'vitest'
import {
  BOWL_RADIUS,
  BOWL_DEPTH,
  bowlHeightAt,
  DEFAULT_KOMA_FIELD_ID,
  DEFAULT_WALL_GAPS,
  fieldHeightAt,
  fieldSlopeAt,
  getKomaField,
  KOMA_FIELD_DEFINITIONS,
  OUT_RADIUS,
  FIELD_RADIUS,
  bowlSlopeAt,
  createWallSegments,
  VALLEY_RADIUS,
  WALL_INNER_RADIUS,
  WALL_SEGMENTS,
  WALL_THICKNESS,
  createStadiumHeightfield,
  wallGapMarkers,
  wallGapSegmentIndices,
} from './komaStadium'

describe('コマバトルのフィールド定義', () => {
  it('3つのフィールドをデータとして持ち、未知のIDはbasicへ戻る', () => {
    expect(KOMA_FIELD_DEFINITIONS.map((field) => field.id)).toEqual(['basic', 'bumper', 'ridge'])
    expect(getKomaField(DEFAULT_KOMA_FIELD_ID).id).toBe('basic')
    expect(getKomaField('not-a-field').id).toBe('basic')
  })

  it('basicは既存の浅いすり鉢と同じ高さで、全フィールドの高さが有限', () => {
    const basic = getKomaField('basic')
    for (const radius of [0, 0.3, 0.8, 1.2, BOWL_RADIUS, OUT_RADIUS]) {
      expect(fieldHeightAt(basic, radius)).toBeCloseTo(fieldHeightAt('basic', radius), 8)
      for (const field of KOMA_FIELD_DEFINITIONS) {
        expect(Number.isFinite(fieldHeightAt(field, radius))).toBe(true)
      }
    }
    expect(fieldHeightAt('basic', 0.3)).toBeCloseTo(-BOWL_DEPTH, 8)
  })

  it('ridgeはリング位置だけを緩やかに盛り上げ、急な段差を作らない', () => {
    expect(fieldHeightAt('ridge', 1.2)).toBeGreaterThan(fieldHeightAt('basic', 1.2) + 0.06)
    let maxSlope = 0
    for (let radius = 0.02; radius < BOWL_RADIUS; radius += 0.02) {
      maxSlope = Math.max(maxSlope, Math.abs(fieldSlopeAt('ridge', radius)))
    }
    expect(maxSlope).toBeLessThan(0.3)
    expect(fieldHeightAt('ridge', 0.3) - fieldHeightAt('basic', 0.3)).toBeLessThan(0.01)
  })

  it('bumperは3つで、コマが通れる隙間と面内の位置を保つ', () => {
    const bumpers = getKomaField('bumper').obstacles
    expect(bumpers).toHaveLength(3)
    for (const bumper of bumpers) {
      expect(Math.hypot(bumper.x, bumper.z)).toBeCloseTo(0.95, 6)
      expect(bumper.radius).toBeGreaterThan(0)
      expect(bumper.height).toBeGreaterThan(0)
      expect(Math.hypot(bumper.x, bumper.z) + bumper.radius).toBeLessThan(BOWL_RADIUS)
    }
    for (let first = 0; first < bumpers.length; first += 1) {
      for (let second = first + 1; second < bumpers.length; second += 1) {
        const a = bumpers[first]!
        const b = bumpers[second]!
        expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(a.radius + b.radius + 0.1)
      }
    }
  })

  it('heightfieldはbasic/ridgeで同じ軽量サイズを使う', () => {
    const basic = createStadiumHeightfield(16, 'basic')
    const ridge = createStadiumHeightfield('ridge', 16)
    expect(basic.heights).toHaveLength((16 + 1) ** 2)
    expect(ridge.heights).toHaveLength((16 + 1) ** 2)
    expect(ridge.size).toBe(basic.size)
    expect(ridge.heights.some((height, index) => height > basic.heights[index]! + 0.02)).toBe(true)
  })
})

describe('外周壁の開口（場外ポイント）', () => {
  it('全フィールドが同じ既定の開口配置を持ち、全周を壁で埋め尽くさない', () => {
    for (const field of KOMA_FIELD_DEFINITIONS) {
      expect(field.wallGaps).toEqual(DEFAULT_WALL_GAPS)
    }
    expect(DEFAULT_WALL_GAPS.count).toBeGreaterThanOrEqual(2)
    expect(DEFAULT_WALL_GAPS.count).toBeLessThanOrEqual(4)
  })

  it('開口は東西南北（角度0/90/180/270度）を避け、指定した数だけ均等に配置される', () => {
    const indices = wallGapSegmentIndices(DEFAULT_WALL_GAPS, WALL_SEGMENTS)
    expect(indices.size).toBe(DEFAULT_WALL_GAPS.count * DEFAULT_WALL_GAPS.widthSegments)
    const cardinalIndices = [0, WALL_SEGMENTS / 4, WALL_SEGMENTS / 2, (WALL_SEGMENTS * 3) / 4]
    for (const cardinal of cardinalIndices) {
      expect(indices.has(cardinal)).toBe(false)
    }
  })

  it('開口設定が無ければ何も取り除かない', () => {
    expect(wallGapSegmentIndices(null, WALL_SEGMENTS).size).toBe(0)
    expect(wallGapSegmentIndices(undefined, WALL_SEGMENTS).size).toBe(0)
  })

  it('createWallSegmentsへ開口を渡すと、その番号の壁だけが無くなり残りは隙間なく並ぶ', () => {
    const gapIndices = wallGapSegmentIndices(DEFAULT_WALL_GAPS, WALL_SEGMENTS)
    const withoutGaps = createWallSegments(WALL_SEGMENTS)
    const withGaps = createWallSegments(WALL_SEGMENTS, undefined, gapIndices)

    expect(withGaps).toHaveLength(withoutGaps.length - gapIndices.size)
    for (const segment of withGaps) {
      expect(gapIndices.has(segment.index)).toBe(false)
    }
    // 壁が残っている場所は開口の影響を受けず、既存と同じ半径・向きのまま。
    const keptIndex = withGaps[0]!.index
    const original = withoutGaps.find((segment) => segment.index === keptIndex)!
    expect(withGaps[0]!.center).toEqual(original.center)
    expect(withGaps[0]!.yaw).toBeCloseTo(original.yaw, 10)
  })

  it('wallGapMarkersは壁を取り除いた場所だけに、壁と同じ角度公式でマーカーを置く', () => {
    const gapIndices = wallGapSegmentIndices(DEFAULT_WALL_GAPS, WALL_SEGMENTS)
    const markers = wallGapMarkers(gapIndices, WALL_SEGMENTS)
    expect(markers).toHaveLength(gapIndices.size)
    for (const marker of markers) {
      expect(marker.angle).toBeCloseTo((marker.index / WALL_SEGMENTS) * Math.PI * 2, 10)
    }
    // 壁セグメントとマーカーで、24セグメントぶんをちょうど分け合う（重複も欠落もない）。
    const wallIndices = new Set(
      createWallSegments(WALL_SEGMENTS, undefined, gapIndices).map((segment) => segment.index),
    )
    const markerIndices = new Set(markers.map((marker) => marker.index))
    expect(wallIndices.size + markerIndices.size).toBe(WALL_SEGMENTS)
    for (const index of wallIndices) expect(markerIndices.has(index)).toBe(false)
  })
})

describe('bowlHeightAt compatibility', () => {
  it('谷がいちばん低く、縁で高さ0になる', () => {
    expect(bowlHeightAt(VALLEY_RADIUS)).toBeLessThan(bowlHeightAt(0))
    expect(bowlHeightAt(VALLEY_RADIUS)).toBeLessThan(bowlHeightAt(BOWL_RADIUS))
    expect(bowlHeightAt(BOWL_RADIUS)).toBeCloseTo(0, 6)
  })

  it('中央はわずかに盛り上がり、外側は高さ0でNaNにも耐える', () => {
    const mound = bowlHeightAt(0) - bowlHeightAt(VALLEY_RADIUS)
    expect(mound).toBeGreaterThan(0)
    expect(mound).toBeLessThan(0.05)
    expect(bowlHeightAt(BOWL_RADIUS + 0.1)).toBe(0)
    expect(bowlHeightAt(FIELD_RADIUS + 10)).toBe(0)
    expect(bowlHeightAt(Number.NaN)).toBe(0)
  })
})

describe('bowlSlopeAt compatibility', () => {
  it('谷の内外の向きと最大勾配を維持する', () => {
    expect(bowlSlopeAt(VALLEY_RADIUS + 0.5)).toBeGreaterThan(0)
    expect(bowlSlopeAt(VALLEY_RADIUS - 0.2)).toBeLessThan(0)
    const steepest = Math.abs(bowlSlopeAt(BOWL_RADIUS - 0.01))
    expect(steepest).toBeGreaterThan(0.1)
    expect(steepest).toBeLessThan(0.3)
  })
})

describe('createWallSegments compatibility', () => {
  it('既定の枚数で円周をひと回りする', () => {
    expect(createWallSegments()).toHaveLength(WALL_SEGMENTS)
  })

  it('壁が等間隔・隙間なく円周へ並び、厚みが半径方向を向く', () => {
    const segments = createWallSegments(12)
    const expectedRadius = WALL_INNER_RADIUS + WALL_THICKNESS / 2
    for (const segment of segments) {
      expect(Math.hypot(segment.center.x, segment.center.z)).toBeCloseTo(expectedRadius, 6)
      expect(segment.center.y).toBeGreaterThan(0)
    }
    const chord = 2 * expectedRadius * Math.sin(Math.PI / 12)
    expect(segments[0]!.halfWidth * 2).toBeGreaterThanOrEqual(chord)
    for (const segment of createWallSegments(8)) {
      const thicknessX = Math.sin(segment.yaw)
      const thicknessZ = Math.cos(segment.yaw)
      const radialX = segment.center.x / Math.hypot(segment.center.x, segment.center.z)
      const radialZ = segment.center.z / Math.hypot(segment.center.x, segment.center.z)
      expect(thicknessX).toBeCloseTo(radialX, 6)
      expect(thicknessZ).toBeCloseTo(radialZ, 6)
    }
  })
})
