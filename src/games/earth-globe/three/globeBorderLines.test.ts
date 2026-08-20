import { describe, expect, it } from 'vitest'
import {
  createGlobeBorderLines,
  disposeGlobeBorderLines,
  MAX_BORDER_SEGMENT_DEGREES,
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

describe('globe border lines', () => {
  it('densifies only the visual border and keeps antimeridian edges short', () => {
    const borderLines = createGlobeBorderLines([feature])
    const positions = borderLines.geometry.getAttribute('position')

    // 20°の辺は0.25°ごとに80分割され、各線分は2頂点になる。
    expect(positions.count).toBeGreaterThanOrEqual((20 / MAX_BORDER_SEGMENT_DEGREES) * 2)
    expect(borderLines.children).toHaveLength(0)
    expect(borderLines.material).toBeDefined()

    disposeGlobeBorderLines(borderLines)
  })
})
