import { describe, expect, test } from 'vitest'
import {
  BEE,
  DIFFICULTY_SETTINGS,
  FEEDBACK_MS,
  FRIENDS,
  HOLE_COUNT,
  advance,
  createInitialState,
  isFinished,
  judge,
  remainingSeconds,
  touchHole,
  type Pop,
  type PyokoDifficulty,
  type PyokoState,
} from './pyokoGame'

const TICK_MS = 100

/** randomFnが常に0のとき、最初の空き穴・最初のなかま・最短の時間が選ばれる（=完全に決定的）。 */
const alwaysZero = () => 0

/** 実際の遊びに近い乱数の揺れを再現するための、種を固定した簡易乱数。 */
function seededRandom(seed: number): () => number {
  let value = seed
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296
    return value / 4294967296
  }
}

/** tickMsずつ、合計durationMsぶん進めた状態を返す（画面と同じ刻みで進める）。 */
function run(
  state: PyokoState,
  difficulty: PyokoDifficulty,
  durationMs: number,
  randomFn: () => number,
  onEachTick?: (current: PyokoState) => void,
): PyokoState {
  let current = state
  for (let elapsed = 0; elapsed < durationMs; elapsed += TICK_MS) {
    current = advance(current, difficulty, TICK_MS, randomFn)
    onEachTick?.(current)
  }
  return current
}

describe('createInitialState', () => {
  test('穴は空で0てんから始まり、いきなりは出てこない', () => {
    const state = createInitialState()
    expect(state.pops).toEqual([])
    expect(state.score).toBe(0)
    expect(state.nextSpawnAtMs).toBeGreaterThan(0)
  })
})

describe('advance（出てくる・引っこむ）', () => {
  test('はじめの間が過ぎるまでは誰も出てこない', () => {
    const before = run(createInitialState(), 'easy', 700, alwaysZero)
    expect(before.pops).toHaveLength(0)

    const after = advance(before, 'easy', TICK_MS, alwaysZero)
    expect(after.pops).toHaveLength(1)
    expect(after.pops[0]!.status).toBe('up')
  })

  test('やさしいでは、はちが出ずになかまだけが出てくる', () => {
    const friendEmojis = new Set(FRIENDS.map((friend) => friend.emoji))
    const seen = new Set<string>()
    run(createInitialState(), 'easy', DIFFICULTY_SETTINGS.easy.durationMs, seededRandom(7), (state) => {
      for (const pop of state.pops) seen.add(pop.creature.emoji)
    })

    expect(seen.size).toBeGreaterThan(0)
    for (const emoji of seen) expect(friendEmojis).toContain(emoji)
  })

  test('はやいでは、はちも混ざって出てくる', () => {
    const kinds = new Set<string>()
    run(createInitialState(), 'fast', DIFFICULTY_SETTINGS.fast.durationMs, seededRandom(3), (state) => {
      for (const pop of state.pops) kinds.add(pop.creature.kind)
    })

    expect(kinds).toContain('friend')
    expect(kinds).toContain('bee')
  })

  test('同時に顔を出す数はむずかしさの上限を超えない', () => {
    for (const difficulty of ['easy', 'fast'] as const) {
      let maxUp = 0
      run(createInitialState(), difficulty, DIFFICULTY_SETTINGS[difficulty].durationMs, seededRandom(11), (state) => {
        maxUp = Math.max(maxUp, state.pops.filter((pop) => pop.status === 'up').length)
      })
      expect(maxUp).toBeGreaterThan(0)
      expect(maxUp).toBeLessThanOrEqual(DIFFICULTY_SETTINGS[difficulty].maxVisible)
    }
  })

  test('ひとつの穴に2ひき重ならず、穴の番号も範囲内に収まる', () => {
    run(createInitialState(), 'fast', DIFFICULTY_SETTINGS.fast.durationMs, seededRandom(23), (state) => {
      const holes = state.pops.map((pop) => pop.holeIndex)
      expect(new Set(holes).size).toBe(holes.length)
      for (const hole of holes) {
        expect(hole).toBeGreaterThanOrEqual(0)
        expect(hole).toBeLessThan(HOLE_COUNT)
      }
    })
  })

  test('とらないままだと、にげた表示になってから穴から消える', () => {
    const spawned = run(createInitialState(), 'easy', 800, alwaysZero)
    const pop = spawned.pops[0]!
    expect(pop.status).toBe('up')

    const escaped = run(spawned, 'easy', pop.untilMs - spawned.elapsedMs, alwaysZero)
    const escapedPop = escaped.pops.find((current) => current.id === pop.id)
    expect(escapedPop?.status).toBe('gone')

    const cleared = run(escaped, 'easy', FEEDBACK_MS + TICK_MS, alwaysZero)
    expect(cleared.pops.find((current) => current.id === pop.id)).toBeUndefined()
  })

  test('じかん切れのあとは新しく出てこない', () => {
    const finished = run(createInitialState(), 'easy', DIFFICULTY_SETTINGS.easy.durationMs + 2_000, seededRandom(5))
    expect(isFinished(finished, 'easy')).toBe(true)

    const after = run(finished, 'easy', 5_000, seededRandom(5))
    expect(after.pops).toHaveLength(0)
    expect(after.nextPopId).toBe(finished.nextPopId)
  })
})

describe('remainingSeconds / isFinished', () => {
  test('のこり秒はあそびの長さから減り、0より下がらない', () => {
    const state = createInitialState()
    expect(remainingSeconds(state, 'easy')).toBe(DIFFICULTY_SETTINGS.easy.durationMs / 1000)
    expect(isFinished(state, 'easy')).toBe(false)

    const halfway = { ...state, elapsedMs: DIFFICULTY_SETTINGS.easy.durationMs - 1_500 }
    expect(remainingSeconds(halfway, 'easy')).toBe(2)

    const over = { ...state, elapsedMs: DIFFICULTY_SETTINGS.easy.durationMs + 5_000 }
    expect(remainingSeconds(over, 'easy')).toBe(0)
    expect(isFinished(over, 'easy')).toBe(true)
  })
})

describe('touchHole（タッチの結果）', () => {
  function stateWith(pops: Pop[], score = 0): PyokoState {
    return { elapsedMs: 1_000, pops, nextSpawnAtMs: 999_999, nextPopId: 100, score }
  }

  function popAt(holeIndex: number, creature = FRIENDS[0]!): Pop {
    return { id: 1, holeIndex, creature, status: 'up', untilMs: 3_000 }
  }

  test('なかまをタッチすると1てん増えて、つかまえた表示になる', () => {
    const { state, result } = touchHole(stateWith([popAt(4)]), 4)
    expect(result).toBe('friend')
    expect(state.score).toBe(1)
    expect(state.pops[0]!.status).toBe('caught')
    expect(state.pops[0]!.untilMs).toBe(1_000 + FEEDBACK_MS)
  })

  test('はちをタッチすると1てん もどる', () => {
    const { state, result } = touchHole(stateWith([popAt(2, BEE)], 3), 2)
    expect(result).toBe('bee')
    expect(state.score).toBe(2)
    expect(state.pops[0]!.status).toBe('oops')
  })

  test('0てんのときにはちをタッチしても、マイナスにはならない', () => {
    const { state } = touchHole(stateWith([popAt(2, BEE)], 0), 2)
    expect(state.score).toBe(0)
  })

  test('空の穴をタッチしても何も起きない（状態をそのまま返す）', () => {
    const before = stateWith([popAt(4)], 5)
    const { state, result } = touchHole(before, 7)
    expect(result).toBe('none')
    expect(state).toBe(before)
  })

  test('同じ相手を続けてタッチしても2てんにはならない', () => {
    const first = touchHole(stateWith([popAt(4)]), 4)
    const second = touchHole(first.state, 4)
    expect(second.result).toBe('none')
    expect(second.state.score).toBe(1)
  })
})

describe('judge', () => {
  test('点数に応じて、記号と文言の両方でたたえる', () => {
    expect(judge(0).message).toBeTruthy()
    expect(judge(0).emoji).toBeTruthy()
    expect(judge(20).message).not.toBe(judge(10).message)
    expect(judge(10).message).not.toBe(judge(0).message)
  })
})
