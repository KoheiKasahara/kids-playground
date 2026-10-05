import { describe, expect, it } from 'vitest'
import { boxesOverlap, type LayoutBox } from '../../e2e/support/layout'

describe('E2E layout overlap assertions', () => {
  const button: LayoutBox = { x: 10, y: 20, width: 44, height: 44 }

  it('detects a Playwright boundingBox overlapping visible heading text', () => {
    const heading = { x: 40, y: 30, width: 160, height: 24 }
    expect(boxesOverlap(button, heading)).toBe(true)
    expect(boxesOverlap(heading, button)).toBe(true)
  })

  it('detects containment without relying on right/bottom fields', () => {
    expect(boxesOverlap(button, { x: 15, y: 25, width: 10, height: 10 })).toBe(true)
    expect(boxesOverlap(button, button)).toBe(true)
  })

  it.each([
    { x: 54, y: 20, width: 100, height: 20 },
    { x: 10, y: 64, width: 100, height: 20 },
    { x: -40, y: 20, width: 50, height: 20 },
    { x: 10, y: 0, width: 100, height: 20 },
    { x: 80, y: 20, width: 100, height: 20 },
  ])('does not treat a separated/touching box as an overlap: %j', (heading) => {
    expect(boxesOverlap(button, heading)).toBe(false)
    expect(boxesOverlap(heading, button)).toBe(false)
  })

  it('does not invent a rectangle for absent content', () => {
    expect(boxesOverlap(null, button)).toBe(false)
    expect(boxesOverlap(button, null)).toBe(false)
  })
})
