import { describe, expect, it } from 'vitest'
import {
  beginAreaMove,
  createAdventureState,
  enterArea,
  reachGoal,
} from './adventureState'

describe('adventureState', () => {
  it('開始エリアだけを訪問済みのrunning状態で作る', () => {
    expect(createAdventureState('sky')).toEqual({
      phase: 'running',
      currentAreaId: 'sky',
      visitedAreaIds: ['sky'],
    })
  })

  it('runningから一度だけmovingへ進み、moving中の再開始は無視する', () => {
    const running = createAdventureState('sky')
    const moving = beginAreaMove(running)
    expect(moving.phase).toBe('moving')
    expect(beginAreaMove(moving)).toBe(moving)
  })

  it('moving中の到着でエリアと履歴を更新する', () => {
    const state = beginAreaMove(createAdventureState('sky'))
    expect(enterArea(state, 'forest')).toEqual({
      phase: 'running',
      currentAreaId: 'forest',
      visitedAreaIds: ['sky', 'forest'],
    })
  })

  it('同じエリアへの二重到着やrunning中の直接到着を無視する', () => {
    const running = createAdventureState('sky')
    expect(enterArea(running, 'forest')).toBe(running)

    const moving = beginAreaMove(running)
    const entered = enterArea(moving, 'forest')
    expect(enterArea(entered, 'forest')).toBe(entered)
    const movingAgain = beginAreaMove(entered)
    expect(enterArea(movingAgain, 'sky')).toBe(movingAgain)
  })

  it('ゴール後はどのイベントでも状態が変わらない', () => {
    const goal = reachGoal(createAdventureState('goal'))
    expect(goal.phase).toBe('goal')
    expect(reachGoal(goal)).toBe(goal)
    expect(beginAreaMove(goal)).toBe(goal)
    expect(enterArea(goal, 'forest')).toBe(goal)
  })
})
