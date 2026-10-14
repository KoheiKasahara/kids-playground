import { describe, expect, it } from 'vitest'
import { MAX_ZOOM_LEVEL } from './types'
import { zoomIn, zoomOut } from './zoomState'

describe('earth-globe zoom state', () => {
  it('zooms in one level without passing the maximum', () => {
    expect(zoomIn(0)).toBe(1)
    expect(zoomIn(1)).toBe(2)
    expect(zoomIn(MAX_ZOOM_LEVEL - 1)).toBe(MAX_ZOOM_LEVEL)
    expect(zoomIn(MAX_ZOOM_LEVEL)).toBe(MAX_ZOOM_LEVEL)
  })

  it('zooms out one level without passing the minimum', () => {
    expect(zoomOut(MAX_ZOOM_LEVEL)).toBe(MAX_ZOOM_LEVEL - 1)
    expect(zoomOut(2)).toBe(1)
    expect(zoomOut(1)).toBe(0)
    expect(zoomOut(0)).toBe(0)
  })

  it('steps to the neighbouring whole level after a pinch left a fractional level', () => {
    expect(zoomIn(2.4)).toBe(3)
    expect(zoomOut(2.4)).toBe(2)
    expect(zoomIn(2.98)).toBe(4)
    expect(zoomOut(3.02)).toBe(2)
    expect(zoomOut(0.3)).toBe(0)
    expect(zoomIn(MAX_ZOOM_LEVEL - 0.3)).toBe(MAX_ZOOM_LEVEL)
  })
})
