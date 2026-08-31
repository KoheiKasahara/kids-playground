import { describe, expect, test } from 'vitest'
import { celestialBodyById } from '../data/celestialBodies'
import { satellitesFor } from '../data/satellites'
import {
  cameraDistanceForZoom,
  cameraDistanceForZoomWithSatellites,
  viewRadiusWithSatellites,
  viewRadiusOf,
} from './planetCamera'

describe('planet camera satellite fit', () => {
  test('OFF returns the existing body/ring fit exactly', () => {
    const body = celestialBodyById('saturn')
    const satellites = satellitesFor('saturn')
    expect(viewRadiusWithSatellites(body, satellites, false)).toBe(viewRadiusOf(body))
    expect(cameraDistanceForZoomWithSatellites(body, 0, 390 / 844, satellites, false))
      .toBe(cameraDistanceForZoom(body, 0, 390 / 844))
  })

  test('ON includes a satellite outside Saturn rings', () => {
    const body = celestialBodyById('saturn')
    const satellites = satellitesFor('saturn')
    expect(viewRadiusWithSatellites(body, satellites, true)).toBeGreaterThan(viewRadiusOf(body))
    expect(cameraDistanceForZoomWithSatellites(body, 0, 390 / 844, satellites, true))
      .toBeGreaterThan(cameraDistanceForZoom(body, 0, 390 / 844))
  })

  test('Charon fit includes its Pluto-side barycenter offset', () => {
    const body = celestialBodyById('pluto')
    const satellites = satellitesFor('pluto')
    expect(viewRadiusWithSatellites(body, satellites, true)).toBeGreaterThanOrEqual(body.radius)
  })
})
