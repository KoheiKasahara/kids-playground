import { describe, expect, test } from 'vitest'
import { activateSpecial, advanceSpecial, SPECIAL_CHARGE_SECONDS, SPECIAL_DURATION_SECONDS } from './special'

describe('special charge and activation', () => {
  test('charges while advancing, rejects early/repeated activation and recharges after use', () => {
    const state = { charge: 0, remaining: 0 }
    expect(activateSpecial(state)).toBe(false)
    advanceSpecial(state, SPECIAL_CHARGE_SECONDS / 2)
    expect(state.charge).toBeCloseTo(0.5)
    expect(activateSpecial(state)).toBe(false)
    advanceSpecial(state, SPECIAL_CHARGE_SECONDS)
    expect(state.charge).toBe(1)
    expect(activateSpecial(state)).toBe(true)
    expect(activateSpecial(state)).toBe(false)
    expect(advanceSpecial(state, 1)).toBe(1)
    expect(state.charge).toBe(0)
    expect(advanceSpecial(state, SPECIAL_DURATION_SECONDS)).toBe(SPECIAL_DURATION_SECONDS - 1)
    expect(state.remaining).toBe(0)
    expect(state.charge).toBeCloseTo(1 / SPECIAL_CHARGE_SECONDS)
  })
  test('cars retain independent gauges', () => {
    const first = { charge: 1, remaining: 0 }
    const second = { charge: 1, remaining: 0 }
    activateSpecial(first)
    expect(second).toEqual({ charge: 1, remaining: 0 })
  })
})
