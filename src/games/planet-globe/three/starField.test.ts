import { describe, expect, it } from 'vitest'
import { createStarPositions, STAR_COUNT, STAR_FIELD_RADIUS } from './starField'

describe('createStarPositions', () => {
  it('各点が半径STAR_FIELD_RADIUSの球面上にある', () => {
    const { positions } = createStarPositions(1)
    for (let i = 0; i < STAR_COUNT; i += 1) {
      const x = positions[i * 3]
      const y = positions[i * 3 + 1]
      const z = positions[i * 3 + 2]
      const radius = Math.sqrt(x * x + y * y + z * z)
      expect(radius).toBeCloseTo(STAR_FIELD_RADIUS, 3)
    }
  })

  it('同じseedからは同じ配置を返す', () => {
    const a = createStarPositions(7)
    const b = createStarPositions(7)
    expect(a.positions).toEqual(b.positions)
    expect(a.colors).toEqual(b.colors)
  })

  it('seedが違えば違う配置になる', () => {
    const a = createStarPositions(7)
    const b = createStarPositions(8)
    expect(a.positions).not.toEqual(b.positions)
  })

  it('色成分は0..1に収まる', () => {
    const { colors } = createStarPositions(3)
    for (const component of colors) {
      expect(component).toBeGreaterThanOrEqual(0)
      expect(component).toBeLessThanOrEqual(1)
    }
  })

  it('配列の長さがSTAR_COUNT*3になる', () => {
    const { positions, colors } = createStarPositions(2)
    expect(positions).toHaveLength(STAR_COUNT * 3)
    expect(colors).toHaveLength(STAR_COUNT * 3)
  })

  it('星ごとの大きさを持ち、小さい星が多く大きい星は少ない', () => {
    const { sizes } = createStarPositions(4)
    expect(sizes).toHaveLength(STAR_COUNT)
    for (const size of sizes) expect(size).toBeGreaterThan(0)
    const large = Array.from(sizes).filter((size) => size > 3)
    expect(large.length).toBeGreaterThan(0)
    expect(large.length).toBeLessThan(STAR_COUNT * 0.15)
  })
})
