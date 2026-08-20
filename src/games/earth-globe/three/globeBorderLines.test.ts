import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { describe, expect, it } from 'vitest'
import {
  BASE_BORDER_RADIUS,
  BORDER_LINE_WIDTH,
  createGlobeBorderLines,
  disposeGlobeBorderLines,
  MAX_BORDER_SEGMENT_DEGREES,
  SELECTED_BORDER_RADIUS,
  setGlobeBorderLinesSize,
} from './globeBorderLines'
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
