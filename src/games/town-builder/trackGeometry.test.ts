import { describe, expect, it } from 'vitest'
import { pathOf, segmentsOf } from './trackGeometry'
import { comfortableZoom, tileSizeFor, ZOOM_LEVELS } from './zoom'

describe('track geometry', () => {
  it('draws straight roads edge to edge, corners as arcs and junctions through the middle', () => {
    expect(segmentsOf(0b0101)).toEqual({ segments: [{ from: [50, 0], to: [50, 100] }], junction: false })
    expect(segmentsOf(0b0011).segments).toEqual([{ from: [50, 0], to: [100, 50], center: [100, 0] }])
    expect(segmentsOf(0b1100).segments[0].center).toEqual([0, 100])
    expect(segmentsOf(0b1001).segments[0].center).toEqual([0, 0])
    expect(segmentsOf(0b0111)).toMatchObject({ junction: true })
    expect(segmentsOf(0b1111).segments).toHaveLength(4)
    expect(segmentsOf(0b0001)).toEqual({ segments: [{ from: [50, 0], to: [50, 50] }], junction: false })
    expect(segmentsOf(0).segments).toHaveLength(1)
  })

  it('offsets rails to both sides of the centre line', () => {
    const [straight] = segmentsOf(0b1010).segments
    expect(pathOf(straight)).toBe('M100 50 L0 50')
    expect(pathOf(straight, 11)).toBe('M100 39 L0 39')
    expect(pathOf(straight, -11)).toBe('M100 61 L0 61')
    expect(pathOf(straight, 0, 0.5)).toBe('M100 50 L50 50')
    const [corner] = segmentsOf(0b0011).segments
    expect(pathOf(corner)).toBe('M50 0 A50 50 0 0 0 100 50')
    expect(pathOf(corner, -11)).toBe('M61 0 A39 39 0 0 0 100 39')
    const [other] = segmentsOf(0b0110).segments
    expect(pathOf(other)).toBe('M100 50 A50 50 0 0 0 50 100')
  })
})

describe('zoom', () => {
  it('fits the whole map at the smallest zoom and grows with every step', () => {
    expect(tileSizeFor(364, 520, 0) * 14).toBeLessThanOrEqual(364)
    for (let zoom = 1; zoom < ZOOM_LEVELS; zoom += 1) {
      expect(tileSizeFor(364, 520, zoom)).toBeGreaterThan(tileSizeFor(364, 520, zoom - 1))
    }
  })

  it('starts phones and tablets with large, comfortable tiles', () => {
    const phone = tileSizeFor(364, 560, comfortableZoom(364, 560))
    const tablet = tileSizeFor(796, 920, comfortableZoom(796, 920))
    const landscape = tileSizeFor(560, 300, comfortableZoom(560, 300))
    for (const size of [phone, tablet, landscape]) {
      expect(size).toBeGreaterThanOrEqual(48)
      expect(size).toBeLessThanOrEqual(100)
    }
  })
})
