import { describe, expect, test } from 'vitest'
import { createSumoState, RING_EDGE, TAP_COOLDOWN_MS, tapSumo, type Side } from './sumoGame'

describe('paper sumo', () => {
  test.each<Side>(['left', 'right'])('%s pushes the other wrestler out and ends the match', (side) => {
    let state = createSumoState()
    for (let n = 0; n < RING_EDGE - 1; n++) state = tapSumo(state, side, n * 200)
    expect(state.winner).toBeNull()
    state = tapSumo(state, side, RING_EDGE * 200)
    expect(state.winner).toBe(side)
    expect(Math.abs(state.position)).toBe(RING_EDGE)
    expect(tapSumo(state, side === 'left' ? 'right' : 'left', 10000)).toBe(state)
    expect(createSumoState().position).toBe(0)
  })

  test('equal taps from both sides stay balanced, including simultaneous touches', () => {
    let state = createSumoState()
    for (let n = 0; n < 30; n++) {
      state = tapSumo(state, 'left', n * 200)
      state = tapSumo(state, 'right', n * 200)
    }
    expect(state.position).toBe(0)
    expect(state.winner).toBeNull()
    expect(state.taps).toEqual({ left: 30, right: 30 })
  })

  test('debounces rapid taps per player without blocking the other player', () => {
    const initial = createSumoState()
    const first = tapSumo(initial, 'left', 0)
    expect(tapSumo(first, 'left', TAP_COOLDOWN_MS - 1)).toBe(first)
    expect(tapSumo(first, 'left', TAP_COOLDOWN_MS).taps.left).toBe(2)
    expect(tapSumo(first, 'right', 0).position).toBe(0)
    expect(initial.position).toBe(0)
    expect(initial.taps.left).toBe(0)
  })
})
