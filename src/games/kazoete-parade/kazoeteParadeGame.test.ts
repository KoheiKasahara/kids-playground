import { describe, expect, test } from 'vitest'
import {
  CPU_REACT_MAX_MS,
  DIFFICULTY_SETTINGS,
  EDGE_PERCENT,
  MAX_COUNT,
  PARADE_ANIMALS,
  PLAYERS,
  REVEAL_STEP_MS,
  SHOW_MS,
  advance,
  changeCount,
  confirmAnswer,
  cpuTappedWithin,
  createInitialState,
  createParade,
  isExact,
  judgeAtMs,
  marcherX,
  nextRound,
  passTime,
  planCpuTaps,
  rankOf,
  resultStars,
  revealedCount,
  roundCount,
  standings,
  type Difficulty,
  type GameEvent,
  type GameState,
  type Rng,
} from './kazoeteParadeGame'

/** くりかえし つかえる 決め打ちの乱数。 */
function seeded(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const constant = (value: number): Rng => () => value
const DIFFICULTIES: Difficulty[] = ['easy', 'hard']

/** dtMs ずつ すすめて、events を あつめる。 */
function run(state: GameState, totalMs: number, dtMs = 33): { state: GameState; events: GameEvent[] } {
  let current = state
  const events: GameEvent[] = []
  for (let t = 0; t < totalMs; t += dtMs) {
    const result = advance(current, dtMs)
    current = result.state
    events.push(...result.events)
  }
  return { state: current, events }
}

/** パレードを さいごまで みて、こたえを きめる まで すすめる。 */
function toAnswer(state: GameState): GameState {
  const shown = run(state, SHOW_MS + 33).state
  expect(shown.phase).toBe('parade')
  const answered = run(shown, shown.parade.endMs + 33).state
  expect(answered.phase).toBe('answer')
  return answered
}

/** ふやす・へらす を くりかえして value に ちかづける。それ以上 かわらなく なったら やめる。 */
function setCount(state: GameState, value: number): GameState {
  let current = state
  for (;;) {
    const next = changeCount(current, Math.sign(value - current.myCount))
    if (next === current) return current
    current = next
  }
}

/** こたえを きめて こたえあわせを おえる。 */
function answerAndJudge(state: GameState, value: number): { state: GameState; events: GameEvent[] } {
  const revealing = confirmAnswer(setCount(toAnswer(state), value))
  return run(revealing, judgeAtMs(revealing.parade.targetCount) + 66)
}

describe('createParade', () => {
  test.each(DIFFICULTIES)('%s: おだいと ほかの どうぶつの かずが ラウンドの はんいに おさまる', (difficulty) => {
    const settings = DIFFICULTY_SETTINGS[difficulty]
    for (let round = 1; round <= roundCount(difficulty); round++) {
      const [tMin, tMax] = settings.targetCounts[round - 1]!
      const [dMin, dMax] = settings.decoyCounts[round - 1]!
      for (let seed = 0; seed < 60; seed++) {
        const parade = createParade(difficulty, round, seeded(seed * 31 + round))
        const targets = parade.marchers.filter((m) => m.animal === parade.target)
        const decoys = parade.marchers.filter((m) => m.animal !== parade.target)
        expect(parade.targetCount).toBe(targets.length)
        expect(targets.length).toBeGreaterThanOrEqual(tMin)
        expect(targets.length).toBeLessThanOrEqual(tMax)
        expect(decoys.length).toBeGreaterThanOrEqual(dMin)
        expect(decoys.length).toBeLessThanOrEqual(dMax)
        expect(new Set(decoys.map((m) => m.animal)).size).toBeLessThanOrEqual(settings.decoyKinds)
        expect(new Set(parade.marchers.map((m) => m.key)).size).toBe(parade.marchers.length)
      }
    }
  })

  test.each(DIFFICULTIES)('%s: おなじ みちの どうぶつは かさならないよう 間を あけ、ぜんぶ とおりおわってから おわる', (difficulty) => {
    const settings = DIFFICULTY_SETTINGS[difficulty]
    for (let seed = 0; seed < 80; seed++) {
      const parade = createParade(difficulty, 1 + (seed % roundCount(difficulty)), seeded(seed))
      for (let lane = 0; lane < settings.lanes; lane++) {
        const starts = parade.marchers.filter((m) => m.lane === lane).map((m) => m.startMs).sort((a, b) => a - b)
        for (let i = 1; i < starts.length; i++) expect(starts[i]! - starts[i - 1]!).toBeGreaterThanOrEqual(settings.gapMinMs - 1)
      }
      for (const marcher of parade.marchers) {
        expect(marcher.lane).toBeLessThan(settings.lanes)
        expect(marcher.crossMs).toBe(settings.crossMs[marcher.lane])
        expect(marcher.startMs + marcher.crossMs).toBeLessThan(parade.endMs)
      }
    }
  })

  test('ゆっくりは 1ほんみちで みぎから ひだり、はやいは 2ほんめの みちが はんたいむき', () => {
    const easy = createParade('easy', 3, seeded(5))
    expect(easy.marchers.every((m) => m.lane === 0 && m.dir === -1)).toBe(true)

    const lanes = new Set<number>()
    for (let seed = 0; seed < 20; seed++) {
      for (const m of createParade('hard', 3, seeded(seed)).marchers) {
        lanes.add(m.lane)
        expect(m.dir).toBe(m.lane === 0 ? -1 : 1)
      }
    }
    expect([...lanes].sort()).toEqual([0, 1])
  })

  test('おなじ 乱数なら おなじ パレードに なる', () => {
    expect(createParade('hard', 4, seeded(42))).toEqual(createParade('hard', 4, seeded(42)))
  })
})

describe('marcherX', () => {
  const marcher = { key: 0, animal: 0, lane: 0, startMs: 1000, crossMs: 2000, dir: -1 as const }

  test('でてくる前と いなくなった後は 見えない', () => {
    expect(marcherX(marcher, 999)).toBeNull()
    expect(marcherX(marcher, 3001)).toBeNull()
  })

  test('みぎの そとから ひだりの そとへ すすみ、まんなかを passTime に とおる', () => {
    expect(marcherX(marcher, 1000)).toBeCloseTo(100 + EDGE_PERCENT)
    expect(marcherX(marcher, passTime(marcher))).toBeCloseTo(50)
    expect(marcherX(marcher, 3000)).toBeCloseTo(-EDGE_PERCENT)
    expect(marcherX({ ...marcher, dir: 1 }, 1000)).toBeCloseTo(-EDGE_PERCENT)
    expect(marcherX({ ...marcher, dir: 1 }, 3000)).toBeCloseTo(100 + EDGE_PERCENT)
  })
})

describe('planCpuTaps', () => {
  test('まちがえない ときは おだいの かずだけ、どうぶつが とおった すこし あとに かぞえる', () => {
    const parade = createParade('hard', 5, seeded(9))
    const plans = planCpuTaps('hard', parade, constant(0.99))
    const passes = parade.marchers.filter((m) => m.animal === parade.target).map(passTime).sort((a, b) => a - b)
    for (const taps of Object.values(plans)) {
      expect(taps).toHaveLength(parade.targetCount)
      taps.forEach((at, i) => {
        expect(at).toBeGreaterThan(passes[i]!)
        expect(at).toBeLessThanOrEqual(passes[i]! + CPU_REACT_MAX_MS)
        expect(at).toBeLessThan(parade.endMs)
      })
    }
  })

  test('いつも まちがえると おだいを みおとし、ほかの どうぶつを かぞえる', () => {
    const parade = createParade('easy', 2, seeded(3))
    const plans = planCpuTaps('easy', parade, constant(0))
    for (const taps of Object.values(plans)) expect(taps).toHaveLength(parade.marchers.length - parade.targetCount)
  })

  test('あいてごとに まちがえやすさが ちがう（きつね は パンダ より まちがえる）', () => {
    let pandaExact = 0
    let kitsuneExact = 0
    for (let seed = 0; seed < 300; seed++) {
      const parade = createParade('hard', 5, seeded(seed))
      const plans = planCpuTaps('hard', parade, seeded(seed + 1000))
      if (plans.panda.length === parade.targetCount) pandaExact++
      if (plans.kitsune.length === parade.targetCount) kitsuneExact++
    }
    expect(pandaExact).toBeGreaterThan(kitsuneExact)
    expect(kitsuneExact).toBeGreaterThan(0)
  })
})

describe('すすみかた', () => {
  test('おだいを みせてから パレード、おわると こたえを きめる。こたえる あいだは 時間が すすまない', () => {
    const state = createInitialState('easy', seeded(1))
    expect(state.phase).toBe('show')
    expect(state.round).toBe(1)

    const shown = run(state, SHOW_MS + 33)
    expect(shown.state.phase).toBe('parade')
    expect(shown.events).toEqual(['go'])

    const answered = run(shown.state, shown.state.parade.endMs + 33)
    expect(answered.state.phase).toBe('answer')
    expect(answered.events).toEqual(['stop'])
    expect(advance(answered.state, 10_000).state).toBe(answered.state)
  })

  test('かぞえられるのは パレードと こたえる あいだだけ。0〜MAX_COUNT に おさまる', () => {
    const state = createInitialState('easy', seeded(2))
    expect(changeCount(state, 1)).toBe(state)
    expect(changeCount(state, -1)).toBe(state)

    const parading = run(state, SHOW_MS + 33).state
    expect(changeCount(parading, 1).myCount).toBe(1)
    expect(changeCount(parading, -1)).toBe(parading)

    const answering = toAnswer(state)
    expect(setCount(answering, MAX_COUNT + 5).myCount).toBe(MAX_COUNT)
    expect(changeCount(setCount(answering, MAX_COUNT), 1).myCount).toBe(MAX_COUNT)

    const revealing = confirmAnswer(setCount(answering, 3))
    expect(changeCount(revealing, 1)).toBe(revealing)
  })

  test('こたえあわせで 1ぴきずつ かぞえ、ぴったりの なかまに 🏅', () => {
    const state = createInitialState('easy', constant(0.99))
    const answering = setCount(toAnswer(state), state.parade.targetCount)
    expect(confirmAnswer(createInitialState('easy', constant(0.99)))).toEqual(createInitialState('easy', constant(0.99)))

    const revealing = confirmAnswer(answering)
    expect(revealing.phase).toBe('reveal')
    expect(revealing.answers).toEqual({ me: state.parade.targetCount, panda: state.parade.targetCount, kitsune: state.parade.targetCount, kaeru: state.parade.targetCount })
    expect(revealing.judged).toBe(false)

    const halfway = run(revealing, REVEAL_STEP_MS + 33)
    expect(revealedCount(halfway.state)).toBe(1)
    expect(halfway.events).toEqual(['count'])

    const judged = run(revealing, judgeAtMs(state.parade.targetCount) + 33)
    expect(judged.events.filter((e) => e === 'count')).toHaveLength(state.parade.targetCount)
    expect(judged.events.at(-1)).toBe('correct')
    expect(judged.state.judged).toBe(true)
    expect(judged.state.medals).toEqual({ me: 1, panda: 1, kitsune: 1, kaeru: 1 })
    // こたえあわせの あとは つぎへ を おすまで まつ。
    expect(advance(judged.state, 10_000).state).toBe(judged.state)
  })

  test('ぴったりで なければ 🏅 は もらえず miss', () => {
    const state = createInitialState('easy', constant(0))
    const { state: judged, events } = answerAndJudge(state, state.parade.targetCount + 1)
    expect(events.at(-1)).toBe('miss')
    expect(isExact(judged, 'me')).toBe(false)
    expect(judged.medals.me).toBe(0)
  })

  test('こたえあわせが おわるまで つぎへ は すすめない', () => {
    const revealing = confirmAnswer(toAnswer(createInitialState('easy', seeded(4))))
    expect(nextRound(revealing, seeded(5)).state).toBe(revealing)
  })

  test('パレードの あいだ、あいてが かぞえた しゅんかんが わかる', () => {
    const parading = run(createInitialState('easy', constant(0.99)), SHOW_MS + 33).state
    const untilTap = parading.cpuTaps.panda[0]! - parading.phaseMs
    expect(cpuTappedWithin(advance(parading, untilTap - 10).state, 'panda', 200)).toBe(false)
    expect(cpuTappedWithin(advance(parading, untilTap + 10).state, 'panda', 200)).toBe(true)
    expect(cpuTappedWithin(advance(parading, untilTap + 300).state, 'panda', 200)).toBe(false)
  })
})

describe('しょうぶ', () => {
  /** ラウンドを ぜんぶ あそぶ。answerFor で なんと こたえるかを きめる。 */
  function playAll(difficulty: Difficulty, rng: Rng, answerFor: (state: GameState) => number) {
    let state = createInitialState(difficulty, rng)
    const roundEvents: GameEvent[][] = []
    for (let round = 1; round <= roundCount(difficulty); round++) {
      expect(state.round).toBe(round)
      const judged = answerAndJudge(state, answerFor(state)).state
      const next = nextRound(judged, rng)
      roundEvents.push(next.events)
      state = next.state
    }
    return { state, roundEvents }
  }

  test.each(DIFFICULTIES)('%s: ぜんぶ ぴったりで あいてが まちがえると ひとりで 1い・★3', (difficulty) => {
    const { state, roundEvents } = playAll(difficulty, constant(0), (s) => s.parade.targetCount)
    expect(state.phase).toBe('over')
    expect(roundEvents.slice(0, -1).every((events) => events.join() === 'show')).toBe(true)
    expect(roundEvents.at(-1)).toEqual(['win'])
    expect(state.medals.me).toBe(roundCount(difficulty))
    expect(rankOf(state, 'me')).toBe(1)
    expect(standings(state).map((s) => s.rank)).toEqual([1, 2, 2, 2])
    expect(resultStars(state)).toBe(3)
  })

  test('みんな ぴったりなら みんな 1い（きみが さきに ならぶ）', () => {
    const { state } = playAll('easy', constant(0.99), (s) => s.parade.targetCount)
    expect(standings(state).map((s) => [s.id, s.rank])).toEqual(PLAYERS.map((p) => [p.id, 1]))
    expect(resultStars(state)).toBe(3)
  })

  test('いちども ぴったりが ないと 4い・★なし', () => {
    const { state, roundEvents } = playAll('easy', constant(0.99), () => 0)
    expect(roundEvents.at(-1)).toEqual(['lose'])
    expect(rankOf(state, 'me')).toBe(4)
    expect(resultStars(state)).toBe(0)
  })

  test('🏅 が あっても あいても 0こなら 1い、🏅 0こ どうしの 1いには ★を あげない', () => {
    const base = createInitialState('easy', seeded(8))
    const tied = { ...base, phase: 'over' as const, medals: { me: 0, panda: 0, kitsune: 0, kaeru: 0 } }
    expect(rankOf(tied, 'me')).toBe(1)
    expect(resultStars(tied)).toBe(0)
    const second = { ...tied, medals: { me: 2, panda: 3, kitsune: 2, kaeru: 1 } }
    expect(rankOf(second, 'me')).toBe(2)
    expect(rankOf(second, 'kitsune')).toBe(2)
    expect(rankOf(second, 'kaeru')).toBe(4)
    expect(resultStars(second)).toBe(2)
  })

  test('どうぶつの なまえと 絵が かさならない', () => {
    expect(new Set(PARADE_ANIMALS.map((a) => a.emoji)).size).toBe(PARADE_ANIMALS.length)
    expect(new Set(PARADE_ANIMALS.map((a) => a.name)).size).toBe(PARADE_ANIMALS.length)
    expect(DIFFICULTY_SETTINGS.easy.targetCounts).toHaveLength(DIFFICULTY_SETTINGS.easy.decoyCounts.length)
    expect(DIFFICULTY_SETTINGS.hard.targetCounts).toHaveLength(DIFFICULTY_SETTINGS.hard.decoyCounts.length)
  })
})
