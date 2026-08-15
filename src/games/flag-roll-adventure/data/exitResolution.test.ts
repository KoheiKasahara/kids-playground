import { describe, expect, it } from 'vitest'
import { findArea, pickExitForBallX, resolveExitTarget } from './areas'
import { AREA_HEIGHT } from '../adventurePhysics'
import type { AdventureArea, AreaExit } from '../types'

function makeExit(id: string, x: number): AreaExit {
  return {
    id,
    kind: 'hole',
    x,
    y: AREA_HEIGHT - 52,
    width: 80,
    height: 40,
    to: 'next',
    toEntry: 'next-entry',
  }
}

const branchingArea: AdventureArea = {
  id: 'branching-test-area',
  nameJa: 'テスト分岐',
  theme: 'sky',
  origin: { x: 0, y: 0 },
  objects: [],
  entries: [],
  exits: [makeExit('left', 120), makeExit('right', 360)],
}

describe('resolveExitTarget', () => {
  it('出口から接続先エリアと入口を解決し、未知idはundefinedで扱う', () => {
    const target = resolveExitTarget('sky', 'sky-to-forest')
    expect(target).toEqual({
      areaId: 'forest',
      entry: findArea('forest')?.entries[0],
    })
    expect(resolveExitTarget('sky', 'unknown-exit')).toBeUndefined()
    expect(resolveExitTarget('unknown-area', 'sky-to-forest')).toBeUndefined()
  })
})

describe('pickExitForBallX', () => {
  it('開口内ではボールが入っている出口を返す', () => {
    expect(pickExitForBallX(branchingArea, 120)?.id).toBe('left')
    expect(pickExitForBallX(branchingArea, 360)?.id).toBe('right')
    expect(pickExitForBallX(branchingArea, 80)?.id).toBe('left')
    expect(pickExitForBallX(branchingArea, 400)?.id).toBe('right')
  })

  it('開口の間やエリア端では中心が最も近い出口を返す', () => {
    expect(pickExitForBallX(branchingArea, 220)?.id).toBe('left')
    expect(pickExitForBallX(branchingArea, 280)?.id).toBe('right')
    expect(pickExitForBallX(branchingArea, 0)?.id).toBe('left')
    expect(pickExitForBallX(branchingArea, 480)?.id).toBe('right')
  })

  it('出口が無いゴールエリアではundefinedを返す', () => {
    const goal = findArea('goal')
    expect(goal).toBeDefined()
    if (!goal) return
    expect(pickExitForBallX(goal, 240)).toBeUndefined()
  })

  it('実際のforestでは左寄りがcave、右寄りがriverを選ぶ', () => {
    const forest = findArea('forest')
    expect(forest).toBeDefined()
    if (!forest) return

    const leftExit = forest.exits.find((exit) => exit.to === 'cave')
    const rightExit = forest.exits.find((exit) => exit.to === 'river')
    expect(leftExit).toBeDefined()
    expect(rightExit).toBeDefined()
    if (!leftExit || !rightExit) return

    expect(pickExitForBallX(forest, leftExit.x)?.to).toBe('cave')
    expect(pickExitForBallX(forest, rightExit.x)?.to).toBe('river')
  })
})
