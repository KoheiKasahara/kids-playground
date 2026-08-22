import { describe, expect, it } from 'vitest'
import { isMazePlayState, parseMazePlayState } from './playState'

describe('flag-roll-maze playState', () => {
  it('既知のflagIdだけを持つstateを受け付ける', () => {
    const state = { flagId: 'jp', stageId: 'kantan' }
    expect(isMazePlayState(state)).toBe(true)
    expect(parseMazePlayState(state)).toEqual(state)
  })

  it('stateなし・null・未知のflagIdを弾く', () => {
    expect(isMazePlayState(undefined)).toBe(false)
    expect(isMazePlayState(null)).toBe(false)
    expect(parseMazePlayState({ flagId: 'xx', stageId: 'kantan' })).toBeNull()
  })

  it('未知のstageIdや、stageIdが無い古い形を弾く', () => {
    expect(parseMazePlayState({ flagId: 'jp', stageId: 'unknown-stage' })).toBeNull()
    expect(parseMazePlayState({ flagId: 'jp' })).toBeNull()
  })

  it('余分なフィールドを持つstateを弾く', () => {
    expect(isMazePlayState({ flagId: 'jp', stageId: 'kantan', debug: true })).toBe(false)
    expect(parseMazePlayState({ flagId: 'jp', stageId: 'kantan', score: 0 })).toBeNull()
  })
})
