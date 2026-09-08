import { describe, expect, test } from 'vitest'
import { ANIMALS, PATCHES, bathReducer, initialBath, touchesPatch } from './bath'

describe('animal bath progress', () => {
  test('animals have unique identities and all patches fit inside the animal', () => {
    expect(new Set(ANIMALS.map((animal) => animal.id)).size).toBe(3)
    expect(new Set(PATCHES.map(({ x, y }) => `${x},${y}`)).size).toBe(PATCHES.length)
    for (const patch of PATCHES) {
      expect(patch.x).toBeGreaterThan(100)
      expect(patch.x).toBeLessThan(300)
      expect(patch.y).toBeGreaterThan(90)
      expect(patch.y).toBeLessThan(330)
    }
  })

  test('a quick swipe cleans the patches between sparse pointer events', () => {
    const state = bathReducer(initialBath, { type: 'stroke', from: { x: 60, y: 215 }, to: { x: 340, y: 215 } })
    expect(state.cleaned).toEqual([3, 4, 5])
    expect(bathReducer(state, { type: 'stroke', from: { x: 340, y: 215 }, to: { x: 60, y: 215 } })).toBe(state)
  })

  test('stationary taps have a forgiving radius, but background taps do not wash the animal', () => {
    expect(touchesPatch({ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 0 })).toBe(true)
    expect(touchesPatch({ x: 0, y: 0 }, { x: 41, y: 0 }, { x: 41, y: 0 })).toBe(false)
    expect(bathReducer(initialBath, { type: 'stroke', from: { x: 0, y: 0 }, to: { x: 10, y: 10 } })).toBe(initialBath)
  })

  test('all three steps require cleaning; strokes cannot skip a tool or overflow completion', () => {
    let state = initialBath
    expect(bathReducer(state, { type: 'next' })).toBe(state)
    for (let step = 0; step < 3; step++) {
      expect(state).toEqual({ step, cleaned: [] })
      for (const patch of PATCHES) state = bathReducer(state, { type: 'stroke', from: patch, to: patch })
      expect(state.cleaned).toHaveLength(9)
      expect(bathReducer(state, { type: 'dab' })).toBe(state)
      expect(bathReducer(state, { type: 'stroke', from: PATCHES[0], to: PATCHES[8] })).toBe(state)
      if (step < 2) state = bathReducer(state, { type: 'next' })
    }
    expect(bathReducer(state, { type: 'next' })).toBe(state)
  })
})
