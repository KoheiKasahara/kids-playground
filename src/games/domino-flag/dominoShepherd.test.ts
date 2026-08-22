import { describe, expect, it } from 'vitest'
import {
  SHEPHERD_MAX_NUDGES,
  SHEPHERD_MAX_STUCK_NUDGES_PER_PASS,
  SHEPHERD_STALL_MAX_NUDGES,
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
  it('全ドミノが立っていて波面がない間は押さない', () => {
    const result = planShepherdNudges(
      [domino('line-0', 0, false), domino('line-1', 1, false)],
      createShepherdMemory(),
      0,
    )

    expect(result.plan.nudges).toEqual([])
  })

  it('波面のすぐ後ろが自然に倒れている連鎖では押さない', () => {
    const result = planShepherdNudges(
      [domino('line-0', 0, true), domino('line-1', 1, true), domino('line-2', 2, false)],
      createShepherdMemory(),
      1000,
    )

    expect(result.plan.nudges).toEqual([])
  })

  it('取り残しを見つけてから600ms未満では押さない', () => {
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
    expect(second.plan.nudges[0]!.id).toBe('line-0')
  })

  it('同じドミノを押し続けると強さが上がり上限回数で止まる', () => {
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
    expect(strengths[1]!).toBeGreaterThan(strengths[0]!)
    expect(afterLimit.plan.nudges).toEqual([])
  })

  it('V字波面で中央列が進んだだけでは外側列を先回りして押さない', () => {
    const dominos = [
      domino('flag-0-6', 16, true),
      domino('flag-0-7', 16, true),
      domino('flag-1-6', 17, true),
      domino('flag-0-0', 19, false),
      domino('flag-0-1', 19, false),
    ]
    const first = planShepherdNudges(dominos, createShepherdMemory(), 0)
    const result = planShepherdNudges(dominos, first.memory, 600)

    expect(result.plan.nudges).toEqual([])
  })

  it('停滞時に同じ期待順位の経路を押す個数を上限内に抑える', () => {
    const dominos = [
      domino('fan-root', 12, true),
      ...Array.from({ length: SHEPHERD_STALL_MAX_NUDGES + 2 }, (_, index) =>
        domino(`fan-next-${index}`, 13, false),
      ),
    ]
    const first = planShepherdNudges(dominos, createShepherdMemory(), 0)
    const result = planShepherdNudges(dominos, first.memory, 1500)

    expect(result.plan.nudges).toHaveLength(SHEPHERD_STALL_MAX_NUDGES)
  })

  it('sleep中の静止ドミノだけを600ms後に押す', () => {
    const dominos = [domino('line-0', 0, false, true), domino('line-1', 1, true)]
    const first = planShepherdNudges(dominos, createShepherdMemory(), 0)
    const result = planShepherdNudges(dominos, first.memory, 600)

    expect(result.plan.nudges.map((nudge) => nudge.id)).toEqual(['line-0'])
  })

  it('取り残し救出は一回の検査で押す枚数を上限に制限する', () => {
    const dominos = [
      domino('wavefront', 100, true),
      ...Array.from({ length: SHEPHERD_MAX_STUCK_NUDGES_PER_PASS + 4 }, (_, index) =>
        domino(`stuck-${index}`, index, false),
      ),
    ]
    const first = planShepherdNudges(dominos, createShepherdMemory(), 0)
    const result = planShepherdNudges(dominos, first.memory, 600)

    expect(result.plan.nudges).toHaveLength(SHEPHERD_MAX_STUCK_NUDGES_PER_PASS)
    expect(result.plan.nudges.map((nudge) => nudge.id)).toEqual(
      Array.from({ length: SHEPHERD_MAX_STUCK_NUDGES_PER_PASS }, (_, index) =>
        `stuck-${index}`,
      ),
    )
  })

  it('回転中でsleepしていないドミノは押さない', () => {
    const dominos = [domino('line-0', 0, false, false), domino('line-1', 1, true)]
    const first = planShepherdNudges(dominos, createShepherdMemory(), 0)
    const result = planShepherdNudges(dominos, first.memory, 600)

    expect(result.plan.nudges).toEqual([])
  })
})
