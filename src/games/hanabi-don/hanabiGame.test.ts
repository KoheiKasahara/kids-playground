import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  BURST_RADIUS,
  BURST_SHOW_MS,
  FINALE_MS,
  FLIGHT_MS,
  LIT_SHOW_MS,
  MAX_FLYING,
  SKY_ASPECT,
  STAGES,
  advance,
  createInitialState,
  findStage,
  flightProgress,
  flyingCount,
  isCompleted,
  isFinished,
  isInBurst,
  launch,
  scoreStars,
  type HanabiState,
} from './hanabiGame'

afterEach(() => {
  vi.restoreAllMocks()
})

const EASY = STAGES[0]!
const HARD = STAGES[STAGES.length - 1]!

/** 画面と同じく小さな刻みで進め、ひらいた はなびを あつめる。 */
function run(state: HanabiState, ms: number, step = 50) {
  let next = state
  const bursts = []
  for (let t = 0; t < ms; t += step) {
    const result = advance(next, step)
    next = result.state
    bursts.push(...result.bursts)
  }
  return { state: next, bursts }
}

describe('STAGES', () => {
  test('idが重複せず、★の基準が むりなく ならぶ', () => {
    expect(new Set(STAGES.map((stage) => stage.id)).size).toBe(STAGES.length)
    for (const stage of STAGES) {
      expect(findStage(stage.id)).toBe(stage)
      expect(stage.starCount).toBeGreaterThan(0)
      expect(stage.threeStarShots).toBeLessThan(stage.twoStarShots)
      // 1ぱつで 2こ ともせば とどく はんいに ★3 を おく。
      expect(stage.threeStarShots).toBeGreaterThanOrEqual(Math.ceil(stage.starCount / 2))
    }
    expect(findStage('nope')).toBeUndefined()
  })
})

describe('createInitialState', () => {
  test.each(STAGES)('$id: ほしが かずどおり、はんいの なかに かさならず ならぶ', (stage) => {
    for (let seed = 0; seed < 20; seed += 1) {
      const state = createInitialState(stage)
      expect(state.stars).toHaveLength(stage.starCount)
      expect(new Set(state.stars.map((star) => star.id)).size).toBe(stage.starCount)
      for (const star of state.stars) {
        expect(star.x).toBeGreaterThanOrEqual(0.1)
        expect(star.x).toBeLessThanOrEqual(0.9)
        expect(star.y).toBeGreaterThanOrEqual(0.1)
        expect(star.y).toBeLessThanOrEqual(0.72)
        expect(star.litAt).toBeNull()
        expect(Math.hypot(star.vx, star.vy * SKY_ASPECT)).toBeCloseTo(stage.speed)
      }
    }
  })
})

describe('launch / advance', () => {
  test('ほしを ねらった はなびは FLIGHT_MS ごに ひらいて あかりを つける', () => {
    const start = createInitialState(EASY)
    const target = start.stars[0]!
    const { state: launched, launched: ok } = launch(start, target.x, target.y)
    expect(ok).toBe(true)
    expect(launched.shots).toBe(1)
    expect(flyingCount(launched)).toBe(1)

    const before = run(launched, FLIGHT_MS - 50)
    expect(before.bursts).toHaveLength(0)
    expect(before.state.lit).toBe(0)

    const after = run(before.state, 50)
    expect(after.bursts).toHaveLength(1)
    expect(after.bursts[0]!.caught).toBeGreaterThanOrEqual(1)
    expect(after.state.lit).toBe(after.bursts[0]!.caught)
    expect(after.state.stars.find((star) => star.id === target.id)!.litAt).not.toBeNull()
    expect(flyingCount(after.state)).toBe(0)
  })

  test('ほしの いない ところで ひらいても しっぱいには ならず、かずだけ ふえる', () => {
    const start = createInitialState(EASY)
    const { state } = launch(start, 0.5, 0.82)
    const after = run(state, FLIGHT_MS)
    expect(after.bursts).toEqual([{ shellId: state.shells[0]!.id, caught: 0 }])
    expect(after.state.lit).toBe(0)
    expect(after.state.shots).toBe(1)
    expect(isCompleted(after.state)).toBe(false)
  })

  test('とんでいる はなびは MAX_FLYING まで。ひらけば また あげられる', () => {
    let state = createInitialState(EASY)
    for (let i = 0; i < MAX_FLYING; i += 1) state = launch(state, 0.5, 0.82).state
    const blocked = launch(state, 0.5, 0.82)
    expect(blocked.launched).toBe(false)
    expect(blocked.state).toBe(state)

    const opened = run(state, FLIGHT_MS).state
    expect(launch(opened, 0.5, 0.82).launched).toBe(true)
  })

  test('ひらいた はなびと ともった ほしは すこし みせてから きえる', () => {
    const start = createInitialState(EASY)
    const target = start.stars[0]!
    let state = run(launch(start, target.x, target.y).state, FLIGHT_MS).state
    expect(state.shells).toHaveLength(1)
    state = run(state, Math.max(BURST_SHOW_MS, LIT_SHOW_MS) + 50).state
    expect(state.shells).toHaveLength(0)
    expect(state.stars.some((star) => star.id === target.id)).toBe(false)
    expect(state.lit).toBeGreaterThanOrEqual(1)
  })

  test('ほしは はんいの なかを ただよい、ともった ほしは とまる', () => {
    const start = createInitialState(HARD)
    const moved = run(start, 20_000).state
    expect(moved.stars.some((star, index) => star.x !== start.stars[index]!.x)).toBe(true)
    for (const star of moved.stars) {
      expect(star.x).toBeGreaterThanOrEqual(0.1)
      expect(star.x).toBeLessThanOrEqual(0.9)
      expect(star.y).toBeGreaterThanOrEqual(0.1)
      expect(star.y).toBeLessThanOrEqual(0.72)
    }
  })

  test('ひとつずつ ねらえば ぜんぶ ともせて、フィナーレの あとで おわる', () => {
    for (const stage of STAGES) {
      let state = createInitialState(stage)
      let guard = 0
      while (!isCompleted(state) && guard < 100) {
        guard += 1
        const star = state.stars.find((candidate) => candidate.litAt === null)!
        const lead = FLIGHT_MS / 1000
        state = launch(state, star.x + star.vx * lead, star.y + star.vy * lead).state
        state = run(state, FLIGHT_MS).state
      }
      expect(isCompleted(state)).toBe(true)
      expect(state.lit).toBe(stage.starCount)
      expect(state.shots).toBeLessThanOrEqual(stage.starCount)
      expect(scoreStars(stage, state.shots)).toBeGreaterThanOrEqual(2)
      expect(isFinished(state)).toBe(false)
      expect(launch(state, 0.5, 0.5).launched).toBe(false)
      state = run(state, FINALE_MS).state
      expect(isFinished(state)).toBe(true)
    }
  })
})

describe('isInBurst', () => {
  test('たてながの よぞらでも まるく とどく', () => {
    const shell = { x: 0.5, y: 0.5 }
    expect(isInBurst(shell, { x: 0.5 + BURST_RADIUS - 0.001, y: 0.5 })).toBe(true)
    expect(isInBurst(shell, { x: 0.5 + BURST_RADIUS + 0.001, y: 0.5 })).toBe(false)
    expect(isInBurst(shell, { x: 0.5, y: 0.5 + (BURST_RADIUS - 0.001) / SKY_ASPECT })).toBe(true)
    expect(isInBurst(shell, { x: 0.5, y: 0.5 + (BURST_RADIUS + 0.001) / SKY_ASPECT })).toBe(false)
  })
})

describe('scoreStars / flightProgress', () => {
  test('すくない はなびほど ★が おおい', () => {
    expect(scoreStars(EASY, EASY.threeStarShots)).toBe(3)
    expect(scoreStars(EASY, EASY.threeStarShots + 1)).toBe(2)
    expect(scoreStars(EASY, EASY.twoStarShots)).toBe(2)
    expect(scoreStars(EASY, EASY.twoStarShots + 1)).toBe(1)
    expect(scoreStars(EASY, 999)).toBe(1)
  })

  test('とんでいる たかさは 0 から 1 へ すすむ', () => {
    const { state } = launch(createInitialState(EASY), 0.5, 0.5)
    const shell = state.shells[0]!
    expect(flightProgress(shell, 0)).toBe(0)
    expect(flightProgress(shell, FLIGHT_MS / 2)).toBeCloseTo(0.5)
    expect(flightProgress(shell, FLIGHT_MS * 2)).toBe(1)
  })
})
