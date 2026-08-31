import { describe, expect, test } from 'vitest'
import type { CelestialBodyId } from '../types'
import { satellites, satellitesByParentBodyId, satellitesFor } from './satellites'

const expectedIds: Record<string, readonly string[]> = {
  mars: ['phobos', 'deimos'],
  jupiter: ['io', 'europa', 'ganymede', 'callisto'],
  saturn: ['titan', 'enceladus'],
  uranus: ['titania', 'miranda'],
  neptune: ['triton'],
  pluto: ['charon'],
}

describe('satellites', () => {
  test('keeps the twelve exact ids under the six supported parents', () => {
    expect(satellites).toHaveLength(12)
    expect(new Set(satellites.map((item) => item.id)).size).toBe(12)

    for (const [parentId, ids] of Object.entries(expectedIds)) {
      expect(satellitesFor(parentId as CelestialBodyId).map((item) => item.id)).toEqual(ids)
    }
    expect(satellitesFor('sun')).toEqual([])
    expect(satellitesFor('mercury')).toEqual([])
    expect(satellitesFor('venus')).toEqual([])
    expect(satellitesFor('earth')).toEqual([])
    expect(satellitesFor('moon')).toEqual([])
    expect(Object.values(satellitesByParentBodyId).flat()).toHaveLength(12)
  })

  test('keeps display and orbit values in the child-friendly range', () => {
    for (const satellite of satellites) {
      expect(satellite.displayScale).toBeGreaterThan(0)
      expect(satellite.displayScale).toBeLessThan(0.6)
      expect(satellite.orbitRadius).toBeGreaterThan(0)
      expect(satellite.orbitSpeed).toBeGreaterThan(0)
      expect(satellite.hitRadiusPx).toBeGreaterThanOrEqual(32)
      expect(satellite.hitRadiusPx).toBeLessThanOrEqual(48)
    }
  })

  test('marks only Triton retrograde and only Charon as offset primary', () => {
    expect(satellites.filter((item) => item.retrograde).map((item) => item.id)).toEqual(['triton'])
    expect(satellites.filter((item) => item.parentOffsetRadiusRatio !== undefined).map((item) => item.id)).toEqual(['charon'])

    const charon = satellitesFor('pluto')[0]
    expect(charon?.parentOffsetRadiusRatio).toBeGreaterThan(1)
  })
})
