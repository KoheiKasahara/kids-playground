import { describe, expect, test } from 'vitest'
import { createGame, playTurn, type GameState } from './sugorokuGame'
import { TIMING, eventMessage, turnTimeline } from './turnTimeline'

const at = (positions: number[], turn = 0): GameState => ({ ...createGame('mori', 2), positions, turn })

describe('turnTimeline', () => {
  test('ころころ → でた め → 1マスずつ かぞえて すすむ → しかけ の じゅんに ならぶ', () => {
    const before = createGame('mori', 2)
    const plan = playTurn(before, 3)
    const { frames, duration } = turnTimeline(plan, before)
    expect(frames[0]).toMatchObject({ at: 0, rolling: true, message: 'ころころ…', sound: { kind: 'roll' } })
    expect(frames.map((frame) => frame.at)).toEqual([...frames.map((frame) => frame.at)].sort((a, b) => a - b))
    expect(frames.find((frame) => frame.dice === 3 && frame.rolling === false)).toMatchObject({ at: TIMING.rollMs, message: '3が でた！' })

    const moves = frames.filter((frame) => frame.positions)
    expect(moves.map((frame) => frame.positions![0])).toEqual([1, 2, 3, 4, 5])
    expect(moves.map((frame) => frame.mover?.count)).toEqual([1, 2, 3, 1, 2])
    expect(new Set(moves.map((frame) => frame.mover?.hop)).size).toBe(moves.length)
    expect(moves.every((frame) => frame.positions![1] === 0)).toBe(true)
    expect(frames.find((frame) => frame.message === eventMessage({ kind: 'forward', steps: 2 }))).toMatchObject({ sound: { kind: 'good' }, haptic: 'success' })
    expect(duration).toBeGreaterThan(moves.at(-1)!.at)
  })

  test('ワープは とびさきへ 1かいで とび、しかけの ない ばんは でた めの ぶんだけ', () => {
    const warp = turnTimeline(playTurn(at([9, 0]), 2), at([9, 0]))
    const flight = warp.frames.filter((frame) => frame.mover?.flying)
    expect(flight).toHaveLength(1)
    expect(flight[0]).toMatchObject({ positions: [15, 0], sound: { kind: 'warp' }, mover: { count: null } })

    const plain = turnTimeline(playTurn(at([0, 0], 1), 2), at([0, 0], 1))
    expect(plain.frames.filter((frame) => frame.positions).map((frame) => frame.positions)).toEqual([[0, 1], [0, 2]])
    expect(plain.frames.some((frame) => frame.haptic === 'success' || frame.haptic === 'impact')).toBe(false)
    expect(plain.duration).toBeLessThan(warp.duration)
  })

  test('もどる・やすみは ざんねんの おとで しらせる', () => {
    const back = turnTimeline(playTurn(at([5, 0]), 3), at([5, 0]))
    expect(back.frames.find((frame) => frame.message === 'あらら、1 もどる')).toMatchObject({ sound: { kind: 'bad' }, haptic: 'impact' })
    expect(back.frames.filter((frame) => frame.positions).at(-1)?.positions).toEqual([7, 0])
    const rest = turnTimeline(playTurn(at([10, 0]), 3), at([10, 0]))
    expect(rest.frames.find((frame) => frame.message === eventMessage({ kind: 'rest' }))).toMatchObject({ sound: { kind: 'rest' } })
  })
})
