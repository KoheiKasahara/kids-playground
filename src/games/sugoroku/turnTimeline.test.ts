import { describe, expect, test } from 'vitest'
import { courseById } from './courses'
import { createGame, playTurn, type GameState } from './sugorokuGame'
import { TIMING, eventMessage, turnTimeline, warpResultMessage } from './turnTimeline'

const mori = courseById('mori')
const at = (positions: number[], turn = 0): GameState => ({ ...createGame('mori', 2), positions, turn })

describe('turnTimeline', () => {
  test('ころころ → でた め → 1マスずつ かぞえて すすむ → しかけ の じゅんに ならぶ', () => {
    const before = createGame('mori', 2)
    const plan = playTurn(before, 2)
    const { frames, duration } = turnTimeline(plan, before)
    expect(frames[0]).toMatchObject({ at: 0, rolling: true, message: 'ころころ…', sound: { kind: 'roll' } })
    expect(frames.map((frame) => frame.at)).toEqual([...frames.map((frame) => frame.at)].sort((a, b) => a - b))
    expect(frames.find((frame) => frame.dice === 2 && frame.rolling === false)).toMatchObject({ at: TIMING.rollMs, message: '2が でた！' })

    const moves = frames.filter((frame) => frame.positions)
    expect(moves.map((frame) => frame.positions![0])).toEqual([1, 2, 3, 4])
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
    expect(flight[0]).toMatchObject({ positions: [20, 0], sound: { kind: 'warp' }, mover: { count: null } })
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
})
