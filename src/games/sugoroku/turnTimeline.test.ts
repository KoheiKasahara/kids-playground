import { describe, expect, test } from 'vitest'
import { courseById } from './courses'
import { createGame, playTurn, type GameState } from './sugorokuGame'
import { FORK_STOP_MESSAGE, TIMING, eventMessage, rollMessage, swapResultMessage, turnTimeline, warpResultMessage } from './turnTimeline'

const mori = courseById('mori')
const at = (positions: number[], turn = 0, players = 2): GameState => ({ ...createGame('mori', players), positions, turn })

describe('turnTimeline', () => {
  test('ころころ → でた め → 1マスずつ かぞえて すすむ → しかけ の じゅんに ならぶ', () => {
    const before = at([2, 0])
    const plan = playTurn(before, 2)
    const { frames, duration } = turnTimeline(plan, before)
    expect(frames[0]).toMatchObject({ at: 0, rolling: true, message: 'ころころ…', sound: { kind: 'roll' } })
    expect(frames.map((frame) => frame.at)).toEqual([...frames.map((frame) => frame.at)].sort((a, b) => a - b))
    expect(frames.find((frame) => frame.rolling === false)).toMatchObject({ at: TIMING.rollMs, dice: [2], message: '2が でた！' })
    expect(frames.filter((frame) => frame.dice).every((frame) => frame.dice!.length === 1)).toBe(true)

    const moves = frames.filter((frame) => frame.positions)
    expect(moves.map((frame) => frame.positions![0])).toEqual([3, 4, 5, 6])
    expect(moves.map((frame) => frame.mover?.count)).toEqual([1, 2, 1, 2])
    expect(new Set(moves.map((frame) => frame.mover?.hop)).size).toBe(moves.length)
    expect(moves.every((frame) => frame.positions![1] === 0)).toBe(true)
    expect(frames.find((frame) => frame.message === eventMessage({ kind: 'forward', steps: 2 }))).toMatchObject({ sound: { kind: 'good' }, haptic: 'success' })
    expect(duration).toBeGreaterThan(moves.at(-1)!.at)
  })

  test('ワープは とびさきへ 1かいで とび、ついてから さきか うしろかを しらせる', () => {
    const warp = turnTimeline(playTurn(at([12, 0]), 2, mori, () => 0), at([12, 0]))
    expect(warp.frames.find((frame) => frame.message === eventMessage({ kind: 'warp', to: [] }))).toMatchObject({ sound: { kind: 'select' }, haptic: 'tap' })
    const flight = warp.frames.filter((frame) => frame.mover?.flying)
    expect(flight).toHaveLength(1)
    expect(flight[0]).toMatchObject({ positions: [24, 0], sound: { kind: 'warp' }, mover: { count: null } })
    const landed = warp.frames.find((frame) => frame.message === warpResultMessage(true))
    expect(landed).toMatchObject({ sound: { kind: 'good' }, haptic: 'success' })
    expect(landed!.at).toBeGreaterThan(flight[0]!.at)

    const unlucky = turnTimeline(playTurn(at([12, 0]), 2, mori, () => 0.99), at([12, 0]))
    expect(unlucky.frames.filter((frame) => frame.mover?.flying)[0]).toMatchObject({ positions: [10, 0] })
    expect(unlucky.frames.find((frame) => frame.message === warpResultMessage(false))).toMatchObject({ sound: { kind: 'bad' }, haptic: 'impact' })

    const plain = turnTimeline(playTurn(at([0, 0], 1), 1), at([0, 0], 1))
    expect(plain.frames.filter((frame) => frame.positions).map((frame) => frame.positions)).toEqual([[0, 1]])
    expect(plain.frames.some((frame) => frame.haptic === 'success' || frame.haptic === 'impact')).toBe(false)
    expect(plain.duration).toBeLessThan(warp.duration)
  })

  test('もどる・やすみは ざんねんの おとで しらせる', () => {
    const back = turnTimeline(playTurn(at([5, 0]), 3), at([5, 0]))
    expect(back.frames.find((frame) => frame.message === 'あらら、1 もどる')).toMatchObject({ sound: { kind: 'bad' }, haptic: 'impact' })
    expect(back.frames.filter((frame) => frame.positions).at(-1)?.positions).toEqual([7, 0])
    const rest = turnTimeline(playTurn(at([10, 0]), 1), at([10, 0]))
    expect(rest.frames.find((frame) => frame.message === eventMessage({ kind: 'rest' }))).toMatchObject({ sound: { kind: 'rest' } })
  })

  test('サイコロ 2こは ふたつの めと たしざんを みせる', () => {
    expect(rollMessage([3])).toBe('3が でた！')
    expect(rollMessage([3, 5])).toBe('3と 5で 8！')
    const before = { ...at([12, 0]), doubles: [true, false] }
    const { frames } = turnTimeline(playTurn(before, [2, 5]), before)
    expect(frames.filter((frame) => frame.dice).every((frame) => frame.dice!.length === 2)).toBe(true)
    expect(frames.find((frame) => frame.rolling === false)).toMatchObject({ dice: [2, 5], message: '2と 5で 7！' })
    expect(frames.filter((frame) => frame.positions).at(-1)?.positions).toEqual([19, 0])

    const land = turnTimeline(playTurn(at([15, 0]), 1), at([15, 0]))
    expect(land.frames.find((frame) => frame.message === eventMessage({ kind: 'double' }))).toMatchObject({ sound: { kind: 'good' }, haptic: 'success' })
  })

  test('わかれみちで とまると、めが のこっていても とまった ことを しらせる', () => {
    const stop = turnTimeline(playTurn(at([0, 0]), 5), at([0, 0]))
    expect(stop.frames.filter((frame) => frame.positions).map((frame) => frame.positions![0])).toEqual([1, 2])
    const notice = stop.frames.find((frame) => frame.message === FORK_STOP_MESSAGE)
    expect(notice).toMatchObject({ sound: { kind: 'select' } })
    expect(notice!.at).toBeGreaterThan(stop.frames.filter((frame) => frame.positions).at(-1)!.at)
    const exact = turnTimeline(playTurn(at([0, 0]), 2), at([0, 0]))
    expect(exact.frames.some((frame) => frame.message === FORK_STOP_MESSAGE)).toBe(false)
  })

  test('いれかわりは ふたりの コマを いっしょに とばし、まえに だれも いなければ そのまま', () => {
    const before = at([19, 25, 23], 0, 3)
    const swap = turnTimeline(playTurn(before, 2), before)
    const flight = swap.frames.filter((frame) => frame.mover?.flying)
    expect(flight).toHaveLength(1)
    expect(flight[0]).toMatchObject({ positions: [25, 21, 23], sound: { kind: 'warp' } })
    expect(swap.frames.find((frame) => frame.message === swapResultMessage(true))!.at).toBeGreaterThan(flight[0]!.at)

    const alone = at([19, 10, 12], 0, 3)
    const stay = turnTimeline(playTurn(alone, 2), alone)
    expect(stay.frames.some((frame) => frame.mover?.flying)).toBe(false)
    expect(stay.frames.some((frame) => frame.message === swapResultMessage(false))).toBe(true)
    expect(stay.frames.filter((frame) => frame.positions).at(-1)?.positions).toEqual([21, 10, 12])
  })
})
