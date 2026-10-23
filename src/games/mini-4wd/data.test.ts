import { describe, expect, test } from 'vitest'
import { COLORS, COURSES, DEFAULT_BUILD, getStats, normalizeBuild, PARTS, sampleTrack } from './data'
import type { PartCategory } from './types'

describe('mini-4wd parts and courses', () => {
  test('each selectable part is unique and makes a real performance choice', () => {
    for (const category of Object.keys(PARTS) as PartCategory[]) {
      const parts = PARTS[category]
      expect(new Set(parts.map(part => part.id)).size).toBe(parts.length)
      const variants = parts.map(part => getStats({ ...DEFAULT_BUILD, [category]: part.id }))
      expect(new Set(variants.map(stats => JSON.stringify(stats))).size).toBe(parts.length)
    }
    expect(COLORS).toHaveLength(6)
    expect(new Set(COLORS.map(color => color.id)).size).toBe(COLORS.length)
    for (const color of COLORS) expect(getStats({ ...DEFAULT_BUILD, color: color.id })).toEqual(getStats(DEFAULT_BUILD))
  })

  test('unknown saved selections fall back individually and known selections survive', () => {
    expect(normalizeBuild(null)).toEqual(DEFAULT_BUILD)
    expect(normalizeBuild([])).toEqual(DEFAULT_BUILD)
    expect(normalizeBuild({ body: 'buggy', motor: 'rocket', tires: 7, color: 'mint' })).toEqual({
      ...DEFAULT_BUILD, body: 'buggy', color: 'mint',
    })
    const valid = normalizeBuild(DEFAULT_BUILD)
    valid.body = 'wing'
    expect(DEFAULT_BUILD.body).toBe('arrow')
  })

  test.each(COURSES)('$id: closed smooth track fits the scene and can be sampled across lap boundaries', course => {
    expect(course.length).toBeGreaterThan(1200)
    expect(course.points.length).toBeGreaterThan(100)
    for (let i = 0; i < course.points.length; i++) {
      const point = course.points[i]
      const next = course.points[(i + 1) % course.points.length]
      expect(point.x).toBeGreaterThan(70)
      expect(point.x).toBeLessThan(650)
      expect(point.y).toBeGreaterThan(70)
      expect(point.y).toBeLessThan(370)
      expect(Math.hypot(next.x - point.x, next.y - point.y)).toBeLessThan(25)
    }
    expect(sampleTrack(course, 0)).toEqual(sampleTrack(course, course.length * 3))
    const last = sampleTrack(course, -.1)
    const first = sampleTrack(course, .1)
    expect(Math.hypot(last.x - first.x, last.y - first.y)).toBeLessThan(.21)
    expect(Math.abs(last.angle - first.angle)).toBeLessThan(.15)
    for (const zone of course.zones) {
      expect(zone.start).toBeGreaterThanOrEqual(0)
      expect(zone.end).toBeLessThanOrEqual(1)
      expect(zone.end).toBeGreaterThan(zone.start)
    }
  })
})
