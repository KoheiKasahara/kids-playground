import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { describe, expect, it } from 'vitest'
import {
  BORDER_LINE_WIDTH,
  createGlobeBorderLines,
  disposeGlobeBorderLines,
  isAntimeridianSeam,
  MAX_BORDER_SEGMENT_DEGREES,
  setGlobeBorderLinesSize,
} from './globeBorderLines'
import { BASE_BORDER_RADIUS, SELECTED_BORDER_RADIUS } from './globeLayers'
import type { GlobeFeature } from '../types'

const feature: GlobeFeature = {
  id: 1,
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [170, 0],
      [-170, 0],
      [-170, 1],
      [170, 0],
    ]],
  },
}

function radiusAt(borderLines: ReturnType<typeof createGlobeBorderLines>, index: number): number {
  const starts = borderLines.geometry.getAttribute('instanceStart')
  return Math.hypot(starts.getX(index), starts.getY(index), starts.getZ(index))
}

describe('globe border lines', () => {
  it('densifies only the visual border and keeps antimeridian edges short', () => {
    const borderLines = createGlobeBorderLines([feature])
    const starts = borderLines.geometry.getAttribute('instanceStart')

    // 20°の辺は最大分割幅ごとに分割され、1本ずつが線分インスタンスになる。
    expect(starts.count).toBeGreaterThanOrEqual(20 / MAX_BORDER_SEGMENT_DEGREES)
    expect(borderLines.children).toHaveLength(0)
    expect(radiusAt(borderLines, 0)).toBeCloseTo(BASE_BORDER_RADIUS)

    disposeGlobeBorderLines(borderLines)
  })

  it('does not draw the seam where a country was split at the antimeridian', () => {
    const splitCountry: GlobeFeature = {
      id: 2,
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [[[179, 60], [180, 60], [180, 61], [179, 60]]],
          [[[-180, 60], [-179, 60], [-180, 61], [-180, 60]]],
        ],
      },
    }
    const borderLines = createGlobeBorderLines([splitCountry])
    const starts = borderLines.geometry.getAttribute('instanceStart')
    const ends = borderLines.geometry.getAttribute('instanceEnd')

    // 経度180度上（x ≈ 0 かつ z < 0）を通る線分が1本も無いこと。
    for (let index = 0; index < starts.count; index += 1) {
      const onSeam = [starts, ends].every((attribute) => (
        Math.abs(attribute.getX(index)) < 1e-6 && attribute.getZ(index) < 0
      ))
      expect(onSeam).toBe(false)
    }
    expect(isAntimeridianSeam([180, 60], [180, 61])).toBe(true)
    expect(isAntimeridianSeam([-180, 61], [-180, 60])).toBe(true)
    expect(isAntimeridianSeam([180, 60], [-180, 61])).toBe(false)
    expect(isAntimeridianSeam([179, 60], [180, 60])).toBe(false)

    disposeGlobeBorderLines(borderLines)
  })

  it('draws with a pixel-ratio independent width, antialiased by the renderer', () => {
    const borderLines = createGlobeBorderLines([feature])
    const material = borderLines.material as LineMaterial

    expect(material).toBeInstanceOf(LineMaterial)
    expect(material.linewidth).toBe(BORDER_LINE_WIDTH)
    // CSSピクセル基準の線幅にするため、ワールド単位モードは使わない。
    expect(material.worldUnits).toBe(false)
    // 短い線分が連なるため、継ぎ目でカバレッジが合成されないalphaToCoverageは使わない。
    expect(material.alphaToCoverage).toBe(false)
    expect(material.depthWrite).toBe(false)

    disposeGlobeBorderLines(borderLines)
  })

  it('takes the drawing size so the line keeps its width after a resize', () => {
    const borderLines = createGlobeBorderLines([feature])

    setGlobeBorderLinesSize(borderLines, 390, 844)

    const material = borderLines.material as LineMaterial
    expect(material.resolution.x).toBe(390)
    expect(material.resolution.y).toBe(844)

    disposeGlobeBorderLines(borderLines)
  })

  it('can place a selected-country outline just above its raised cap', () => {
    const borderLines = createGlobeBorderLines([feature], SELECTED_BORDER_RADIUS)

    expect(radiusAt(borderLines, 0)).toBeCloseTo(SELECTED_BORDER_RADIUS)

    disposeGlobeBorderLines(borderLines)
  })
})
