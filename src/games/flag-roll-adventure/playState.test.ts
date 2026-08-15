import { describe, expect, it } from 'vitest'
import {
  isAdventureGoalState,
  isAdventurePlayState,
  parseAdventurePlayState,
} from './playState'

describe('flag-roll-adventure playState', () => {
  it('既知のflagIdだけを持つstateを受け付ける', () => {
    const state = { flagId: 'jp' }
    expect(isAdventurePlayState(state)).toBe(true)
    expect(parseAdventurePlayState(state)).toEqual(state)
    expect(isAdventureGoalState(state)).toBe(true)
  })

  it('stateなし・null・未知のflagIdを弾く', () => {
    expect(isAdventurePlayState(undefined)).toBe(false)
    expect(isAdventurePlayState(null)).toBe(false)
    expect(parseAdventurePlayState({ flagId: 'xx' })).toBeNull()
  })

  it('余分なフィールドを持つstateを弾く', () => {
    expect(isAdventurePlayState({ flagId: 'jp', debug: true })).toBe(false)
    expect(isAdventureGoalState({ flagId: 'jp', areaId: 'sky' })).toBe(false)
    expect(parseAdventurePlayState({ flagId: 'jp', score: 0 })).toBeNull()
  })
})
