import { expect, it } from 'vitest'
import { charts } from './charts'
import { createRippleField, waterCols, waterRows } from './rippleField'

it('着水で起きた波が隣の水域へ進み、岸の内側には伝わらず減衰する', () => {
  const field = createRippleField(charts[0])
  field.disturb(300, 160, 15, 12)
  field.disturb(20, 14, 15, 12)
  const nearby = Math.floor(waterRows / 2) * waterCols + Math.floor(waterCols / 2) + 10
  expect(field.advance(0)[nearby]).toBe(0)
  let crest = 0
  let heights
  for (let i = 0; i < 60; i++) {
    heights = field.advance(1 / 40)
    crest = Math.max(crest, Math.abs(heights[nearby]))
  }
  expect(crest).toBeGreaterThan(0.2)
  for (let i = 0; i < 300; i++) heights = field.advance(1 / 40)
  expect(heights!.every((h, i) => field.open[i] ? Number.isFinite(h) && Math.abs(h) < crest : h === 0)).toBe(true)
})
