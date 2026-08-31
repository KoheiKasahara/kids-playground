import { describe, expect, test } from 'vitest'
import { celestialBodyById } from '../data/celestialBodies'
import { satellitesFor } from '../data/satellites'
import {
  cameraDistanceForZoom,
  cameraDistanceForZoomWithSatellites,
  fitDistance,
  parentOffsetRadiusForSatellite,
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

  test('Charon uses a concrete outside-Pluto common-barycenter fit', () => {
    const body = celestialBodyById('pluto')
    const charon = satellitesFor('pluto')[0]
    if (charon === undefined) throw new Error('Charon data missing')

    const primaryOffset = parentOffsetRadiusForSatellite(body, charon)
    const expectedRadius = Math.max(
      viewRadiusOf(body),
      charon.orbitRadius + body.radius * charon.displayScale,
      primaryOffset + body.radius,
    )
    expect(charon.parentOffsetRadiusRatio).toBe(1.05)
    expect(primaryOffset).toBeCloseTo(35.7)
    expect(primaryOffset).toBeGreaterThan(body.radius)
    expect(viewRadiusWithSatellites(body, [charon], true)).toBeCloseTo(expectedRadius)
    expect(viewRadiusWithSatellites(body, [charon], true)).toBeCloseTo(73.32)

    const aspect = 390 / 844
    expect(cameraDistanceForZoomWithSatellites(body, 0, aspect, [charon], true))
      .toBeCloseTo(fitDistance(expectedRadius, aspect) * body.zoom.outMargin)
    expect(viewRadiusWithSatellites(body, [charon], false)).toBe(viewRadiusOf(body))
    expect(cameraDistanceForZoomWithSatellites(body, 0, aspect, [charon], false))
      .toBe(cameraDistanceForZoom(body, 0, aspect))
  })
})
