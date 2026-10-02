import { describe, expect, test } from 'vitest'
import { GOLF_COURSES } from './golfCourses'
import { buildHoleGeometry, insideOutline } from './golfGeometry'
import { createTerrainHeight, createWaterDepth, waterInside, type Frame } from './golfTerrain'

const FRAME: Frame = { minX: -4, maxX: 4, minZ: -10, maxZ: 10 }

describe('まわりの じめん', () => {
  test('おかは コースの わくの すぐ そばでは もりあがらず、とおくで たかくなる', () => {
    const height = createTerrainHeight(FRAME, { kind: 'rolling', hills: 1.2 })
    for (let x = -6.4; x <= 6.4; x += 0.4) {
      for (let z = -12.4; z <= 12.4; z += 0.4) {
        if (Math.hypot(Math.max(0, Math.abs(x) - 4), Math.max(0, Math.abs(z) - 10)) <= 2.5) expect(height(x, z)).toBe(0)
      }
    }
    let far = 0
    for (let angle = 0; angle < Math.PI * 2; angle += 0.3) {
      const value = height(Math.cos(angle) * 60, Math.sin(angle) * 60)
      expect(value).toBeGreaterThanOrEqual(0)
      far += value
    }
    expect(far / 21).toBeGreaterThan(2)
  })

  test('大きな かわの ながれる ところは たいらに のこす', () => {
    const height = createTerrainHeight(FRAME, { kind: 'rolling', hills: 1.2, channel: { z: -19, halfWidth: 5 } })
    for (let x = -40; x <= 40; x += 2) expect(height(x, -19)).toBe(0)
    expect(height(30, 20)).toBeGreaterThan(0)
  })

  test('たにまは コースの 下と まえ・うしろが たにの そこで、よこに がけが そびえる', () => {
    const height = createTerrainHeight(FRAME, { kind: 'canyon', wall: 9 })
    for (let z = -60; z <= 60; z += 3) {
      for (let x = -6.4; x <= 6.4; x += 0.8) expect(height(x, z)).toBe(0)
      expect(height(-30, z)).toBeGreaterThan(7)
      expect(height(30, z)).toBeGreaterThan(7)
    }
  })
})

describe('いけ・かわの くぼみ', () => {
  const holes = GOLF_COURSES.flatMap(course => course.holes).filter(hole => hole.water?.length)

  test('みずの ある ホールが ある', () => {
    expect(holes.length).toBeGreaterThan(0)
  })

  test('くぼみは みずの 中だけで、ふちと 床の はしでは 床と つながる（すきまが できない）', () => {
    for (const hole of holes) {
      const geometry = buildHoleGeometry(hole)
      const outlines = geometry.outlines.map(outline => outline.points)
      const depth = createWaterDepth(hole.water!, outlines, 0.2, 0.4)
      const { minX, maxX, minZ, maxZ } = geometry.bounds
      let deepest = 0
      for (let x = minX; x <= maxX; x += 0.1) {
        for (let z = minZ; z <= maxZ; z += 0.1) {
          const value = depth(x, z)
          expect(value).toBeGreaterThanOrEqual(0)
          expect(value).toBeLessThanOrEqual(0.2 + 1e-9)
          deepest = Math.max(deepest, value)
          // 物理で みずに おちない ところ（みずの そと）は くぼまない。はしの上は みずの 上なので のぞく。
          if (waterInside(hole.water!, x, z) <= 0) expect(value).toBe(0)
          if (!outlines.some(points => insideOutline(x, z, points))) expect(value).toBe(0)
        }
      }
      expect(deepest, hole.id).toBeGreaterThan(0.15)
    }
  })

  test('いけの ふちから なかへ いくほど ふかくなる', () => {
    const pond = { kind: 'pond' as const, x: 0, z: 0, radius: 2 }
    const outline = [{ x: -5, z: -5 }, { x: 5, z: -5 }, { x: 5, z: 5 }, { x: -5, z: 5 }]
    const depth = createWaterDepth([pond], [outline], 0.2, 0.4)
    expect(depth(2, 0)).toBe(0)
    expect(depth(1.9, 0)).toBeGreaterThan(0)
    expect(depth(1.9, 0)).toBeLessThan(depth(1.7, 0))
    expect(depth(0, 0)).toBeCloseTo(0.2)
  })
})
