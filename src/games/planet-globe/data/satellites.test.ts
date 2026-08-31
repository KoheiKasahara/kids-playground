import { describe, expect, test } from 'vitest'
import { satellites, satellitesByParentBodyId, satellitesFor } from './satellites'

describe('satellites', () => {
  test('has twelve unique ids and only supported parents', () => {
    expect(satellites).toHaveLength(12)
    expect(new Set(satellites.map((item) => item.id)).size).toBe(12)
    expect(satellites.every((item) => ['mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'].includes(item.parentBodyId))).toBe(true)
  })
  test('groups satellites by parent without adding Earth/Moon', () => {
    expect(satellitesFor('jupiter')).toHaveLength(4)
    expect(satellitesFor('earth')).toHaveLength(0)
    expect(Object.values(satellitesByParentBodyId).flat()).toHaveLength(12)
  })
  test('keeps Triton retrograde and Charon barycenter metadata', () => {
    expect(satellitesFor('neptune')[0]?.retrograde).toBe(true)
    expect(satellitesFor('pluto')[0]?.barycenter).toEqual({ parentOffsetRatio: 0.18, satelliteOffsetRatio: 0.82 })
  })
})
