import { describe, expect, it } from 'vitest'
import { isMazePlayState, parseMazePlayState } from './playState'

describe('flag-roll-maze playState', () => {
  it('既知のflagIdだけを持つstateを受け付ける', () => {
    const state = { flagId: 'jp' }
    expect(isMazePlayState(state)).toBe(true)
    expect(parseMazePlayState(state)).toEqual(state)
  })

  it('stateなし・null・未知のflagIdを弾く', () => {
    expect(isMazePlayState(undefined)).toBe(false)
    expect(isMazePlayState(null)).toBe(false)
    expect(parseMazePlayState({ flagId: 'xx' })).toBeNull()
  })

  it('余分なフィールドを持つstateを弾く', () => {
    expect(isMazePlayState({ flagId: 'jp', debug: true })).toBe(false)
    expect(parseMazePlayState({ flagId: 'jp', score: 0 })).toBeNull()
  })
})
