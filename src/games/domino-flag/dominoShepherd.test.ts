import { describe, expect, it } from 'vitest'
import {
  SHEPHERD_MAX_NUDGES,
  createShepherdMemory,
  planShepherdNudges,
  type ShepherdDomino,
} from './dominoShepherd'

function domino(
  id: string,
  chainIndex: number,
  fallen: boolean,
  sleeping = true,
): ShepherdDomino {
  return { id, chainIndex, fallen, sleeping }
}

describe('planShepherdNudges', () => {
  it('全部立っていて波面がないときは押さない', () => {
    const result = planShepherdNudges(
      [domino('line-0', 0, false), domino('line-1', 1, false)],
      createShepherdMemory(),
      0,
    )

    expect(result.plan.nudges).toEqual([])
  })

  it('波面の手前がすべて倒れている正常な連鎖では押さない', () => {
    const result = planShepherdNudges(
      [domino('line-0', 0, true), domino('line-1', 1, true), domino('line-2', 2, false)],
      createShepherdMemory(),
      1000,
    )

    expect(result.plan.nudges).toEqual([])
  })

  it('取り残しを見つけても600ms未満では押さない', () => {
    const dominos = [domino('line-0', 0, false), domino('line-1', 1, true)]
    const first = planShepherdNudges(dominos, createShepherdMemory(), 0)
    const second = planShepherdNudges(dominos, first.memory, 599)

    expect(second.plan.nudges).toEqual([])
  })

  it('同じ取り残しが600ms続くと押す', () => {
    const dominos = [domino('line-0', 0, false), domino('line-1', 1, true)]
    const first = planShepherdNudges(dominos, createShepherdMemory(), 0)
    const second = planShepherdNudges(dominos, first.memory, 600)

    expect(second.plan.nudges).toHaveLength(1)
    expect(second.plan.nudges[0].id).toBe('line-0')
  })

  it('同じドミノを押し続けると強さが上がり、上限回数で止まる', () => {
    const dominos = [domino('line-0', 0, false), domino('line-1', 1, true)]
    let memory = createShepherdMemory()
    const strengths: number[] = []

    for (let index = 0; index <= SHEPHERD_MAX_NUDGES; index += 1) {
      const result = planShepherdNudges(dominos, memory, index * 600)
      memory = result.memory
      if (result.plan.nudges[0]) strengths.push(result.plan.nudges[0].strength)
    }
    const afterLimit = planShepherdNudges(
      dominos,
      memory,
      (SHEPHERD_MAX_NUDGES + 1) * 600,
    )

    expect(strengths).toHaveLength(SHEPHERD_MAX_NUDGES)
    expect(strengths[1]).toBeGreaterThan(strengths[0])
    expect(afterLimit.plan.nudges).toEqual([])
  })

  it('全体が1500ms停滞すると波面の次の列を押す', () => {
    const dominos = [
      domino('trigger-bar', 12, true),
      domino('flag-0-0', 13, false),
      domino('flag-0-1', 13, false),
      domino('flag-1-0', 14, false),
    ]
    const first = planShepherdNudges(dominos, createShepherdMemory(), 0)
    const stalled = planShepherdNudges(dominos, first.memory, 1500)

    expect(stalled.plan.nudges.map((nudge) => nudge.id)).toEqual([
      'flag-0-0',
      'flag-0-1',
    ])
  })

  it('static standing domino is nudged after the stuck timeout', () => {
    const dominos = [domino('line-0', 0, false, true), domino('line-1', 1, true)]
    const first = planShepherdNudges(dominos, createShepherdMemory(), 0)
    const result = planShepherdNudges(dominos, first.memory, 600)

    expect(result.plan.nudges.map((nudge) => nudge.id)).toEqual(['line-0'])
  })

  it('rotating domino is not nudged while it is awake', () => {
    const dominos = [domino('line-0', 0, false, false), domino('line-1', 1, true)]
    const first = planShepherdNudges(dominos, createShepherdMemory(), 0)
    const result = planShepherdNudges(dominos, first.memory, 600)

    expect(result.plan.nudges).toEqual([])
  })
})
