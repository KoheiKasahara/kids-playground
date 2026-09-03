import { describe, expect, it } from 'vitest'
import {
  createBowlingGameState,
  currentThrowNumber,
  finishThrow,
  restartGame,
  startThrow,
  THROWS_PER_GAME,
} from './bowlingGame'

describe('3投で1プレイ', () => {
  it('はじめは1投目で、まだ何も倒していない', () => {
    const state = createBowlingGameState()
    expect(state.phase).toBe('aiming')
    expect(currentThrowNumber(state)).toBe(1)
    expect(state.toppledTotal).toBe(0)
  })

  it('発射すると投球中になる', () => {
    expect(startThrow(createBowlingGameState()).phase).toBe('flying')
  })

  it('投球中にもういちど発射しても二重に進まない', () => {
    const flying = startThrow(createBowlingGameState())
    expect(startThrow(flying)).toBe(flying)
  })

  it('3投で結果へ進み、合計は各投の和になる', () => {
    let state = createBowlingGameState()
    for (const toppled of [5, 8, 3]) {
      state = finishThrow(startThrow(state), toppled)
    }
    expect(state.phase).toBe('finished')
    expect(state.throwResults).toEqual([5, 8, 3])
    expect(state.toppledTotal).toBe(16)
    expect(currentThrowNumber(state)).toBe(THROWS_PER_GAME)
  })

  it('2投目までは、また ねらう状態へ戻る', () => {
    const state = finishThrow(startThrow(createBowlingGameState()), 4)
    expect(state.phase).toBe('aiming')
    expect(currentThrowNumber(state)).toBe(2)
    expect(state.toppledTotal).toBe(4)
  })

  it('ねらっている状態で終了通知が来ても進まない', () => {
    const state = createBowlingGameState()
    expect(finishThrow(state, 3)).toBe(state)
  })

  it('3投終わったあとは発射しても進まない', () => {
    let state = createBowlingGameState()
    for (let index = 0; index < THROWS_PER_GAME; index += 1) {
      state = finishThrow(startThrow(state), 1)
    }
    expect(startThrow(state)).toBe(state)
  })

  it('おかしな数（負・小数・NaN）でも数がおかしくならない', () => {
    let state = createBowlingGameState()
    state = finishThrow(startThrow(state), -5)
    state = finishThrow(startThrow(state), 2.7)
    state = finishThrow(startThrow(state), Number.NaN)
    expect(state.throwResults).toEqual([0, 2, 0])
    expect(state.toppledTotal).toBe(2)
  })

  it('もういちどで、前のプレイの記録を引き継がない', () => {
    let state = createBowlingGameState()
    for (const toppled of [5, 8, 3]) state = finishThrow(startThrow(state), toppled)
    expect(restartGame()).toEqual(createBowlingGameState())
  })
})
