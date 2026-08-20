import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import {
  BASE_BORDER_RADIUS,
  createGlobeBorderLines,
  disposeGlobeBorderLines,
  MAX_BORDER_SEGMENT_DEGREES,
  SELECTED_BORDER_RADIUS,
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

    const firstRadius = Math.hypot(positions.getX(0), positions.getY(0), positions.getZ(0))
    expect(firstRadius).toBeCloseTo(BASE_BORDER_RADIUS)
    expect((borderLines.material as THREE.LineBasicMaterial).depthWrite).toBe(false)

    disposeGlobeBorderLines(borderLines)
  })

  it('can place a selected-country outline just above its raised cap', () => {
    const borderLines = createGlobeBorderLines([feature], SELECTED_BORDER_RADIUS)
    const positions = borderLines.geometry.getAttribute('position')

    const firstRadius = Math.hypot(positions.getX(0), positions.getY(0), positions.getZ(0))
    expect(firstRadius).toBeCloseTo(SELECTED_BORDER_RADIUS)

    disposeGlobeBorderLines(borderLines)
  })
})
