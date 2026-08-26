import { describe, expect, it } from 'vitest'
import { celestialBodies, celestialBodyById, DEFAULT_CELESTIAL_BODY_ID } from './celestialBodies'
import type { CelestialBodyId } from '../types'

describe('celestialBodies', () => {
  it('4天体が moon, mars, jupiter, saturn の順で存在する', () => {
    expect(celestialBodies.map((body) => body.id)).toEqual([
      'moon',
      'mars',
      'jupiter',
      'saturn',
    ])
  })

  it('id と displayName が重複しない', () => {
    const ids = celestialBodies.map((body) => body.id)
    const names = celestialBodies.map((body) => body.displayName)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(names).size).toBe(names.length)
  })

  it('celestialBodyById が対応する天体を返す', () => {
    for (const body of celestialBodies) {
      expect(celestialBodyById(body.id)).toBe(body)
    }
  })

  it('DEFAULT_CELESTIAL_BODY_ID は一覧に含まれる天体を指す', () => {
    expect(celestialBodies.some((body) => body.id === DEFAULT_CELESTIAL_BODY_ID)).toBe(true)
  })

  it('全天体で半径・ズーム倍率が妥当な範囲にある', () => {
    for (const body of celestialBodies) {
      expect(body.radius).toBeGreaterThan(0)
      expect(body.zoom.outMargin).toBeGreaterThanOrEqual(1.05)
      expect(body.zoom.inMargin).toBeGreaterThan(0)
      expect(body.zoom.inMargin).toBeLessThan(body.zoom.outMargin)
    }
  })

  it('surface.bands の at は 0..1 の範囲で昇順になっている', () => {
    for (const body of celestialBodies) {
      const bands = body.surface.bands
      if (bands === undefined) continue

      for (const band of bands) {
        expect(band.at).toBeGreaterThanOrEqual(0)
        expect(band.at).toBeLessThanOrEqual(1)
      }
      for (let i = 1; i < bands.length; i += 1) {
        expect(bands[i].at).toBeGreaterThanOrEqual(bands[i - 1].at)
      }
    }
  })

  it('speckles の半径・不透明度が妥当な範囲にある', () => {
    for (const body of celestialBodies) {
      const speckles = body.surface.speckles
      if (speckles === undefined) continue

      expect(speckles.minRadius).toBeGreaterThan(0)
      expect(speckles.minRadius).toBeLessThan(speckles.maxRadius)
      expect(speckles.opacity).toBeGreaterThan(0)
      expect(speckles.opacity).toBeLessThanOrEqual(1)
      expect(speckles.count).toBeGreaterThan(0)
    }
  })

  it('輪を持つのは土星だけで、内外半径の比が妥当である', () => {
    const ringBodyIds: CelestialBodyId[] = celestialBodies
      .filter((body) => body.ring !== undefined)
      .map((body) => body.id)
    expect(ringBodyIds).toEqual(['saturn'])

    const saturn = celestialBodyById('saturn')
    const ring = saturn.ring
    expect(ring).toBeDefined()
    if (ring === undefined) return

    expect(ring.innerRadiusRatio).toBeGreaterThan(1)
    expect(ring.outerRadiusRatio).toBeGreaterThan(ring.innerRadiusRatio)

    for (const band of ring.bands) {
      expect(band.at).toBeGreaterThanOrEqual(0)
      expect(band.at).toBeLessThanOrEqual(1)
      expect(band.opacity).toBeGreaterThanOrEqual(0)
      expect(band.opacity).toBeLessThanOrEqual(1)
    }
    for (let i = 1; i < ring.bands.length; i += 1) {
      expect(ring.bands[i].at).toBeGreaterThanOrEqual(ring.bands[i - 1].at)
    }
  })
})
