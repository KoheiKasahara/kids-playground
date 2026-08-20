import { describe, expect, it } from 'vitest'
import { zoomIn, zoomOut } from './zoomState'

describe('earth-globe zoom state', () => {
  it('zooms in one level without passing the maximum', () => {
    expect(zoomIn(0)).toBe(1)
    expect(zoomIn(1)).toBe(2)
    expect(zoomIn(2)).toBe(3)
    expect(zoomIn(3)).toBe(3)
  })

  it('zooms out one level without passing the minimum', () => {
    expect(zoomOut(3)).toBe(2)
    expect(zoomOut(2)).toBe(1)
    expect(zoomOut(1)).toBe(0)
    expect(zoomOut(0)).toBe(0)
  })
})
