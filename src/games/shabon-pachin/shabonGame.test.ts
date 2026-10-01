import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  COLOR_KINDS,
  GOAL_COUNT,
  MAX_FLOATING,
  POPS_PER_TARGET,
  SHAPE_KINDS,
  advance,
  createInitialState,
  isFinished,
  riseProgress,
  scoreStars,
  touchBubble,
  type ShabonState,
} from './shabonGame'

afterEach(() => {
  vi.restoreAllMocks()
})

/** 刻みを細かく区切って進める（画面と同じく小さなdeltaで進めたときの挙動を見る）。 */
function run(state: ShabonState, ms: number, step = 50): ShabonState {
  let next = state
  for (let t = 0; t < ms; t += step) next = advance(next, 'color', step)
  return next
}

function stateWith(partial: Partial<ShabonState>): ShabonState {
  return { ...createInitialState('color'), ...partial }
}

describe('shabonGame', () => {
  test('データ: どのモードも名前・IDが重ならない', () => {
    for (const kinds of [COLOR_KINDS, SHAPE_KINDS]) {
      expect(new Set(kinds.map((k) => k.id)).size).toBe(kinds.length)
      expect(new Set(kinds.map((k) => k.name)).size).toBe(kinds.length)
    }
    // かたちモードは色が同じなので、記号で見分けられること。
    expect(new Set(SHAPE_KINDS.map((k) => k.symbol)).size).toBe(SHAPE_KINDS.length)
    expect(new Set(COLOR_KINDS.map((k) => k.color)).size).toBe(COLOR_KINDS.length)
  })

  test('しばらく進めると しゃぼんだまが出て、上限をこえない', () => {
    const state = run(createInitialState('color'), 20_000)
    const floating = state.bubbles.filter((b) => b.poppedAt === null)
    expect(floating.length).toBeGreaterThan(0)
    expect(floating.length).toBeLessThanOrEqual(MAX_FLOATING)
  })

  test('おだいが ただよっていないときは かならず おだいが出る', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const state = run(createInitialState('color'), 300)
    expect(state.bubbles).toHaveLength(1)
    expect(state.bubbles[0]!.kindIndex).toBe(state.targetIndex)
  })

  test('のぼりきった しゃぼんだまは きえる', () => {
    let state = run(createInitialState('color'), 300)
    const first = state.bubbles[0]!
    state = run(state, first.riseMs + 100)
    expect(state.bubbles.some((b) => b.id === first.id)).toBe(false)
    expect(riseProgress(first, first.bornAt + first.riseMs * 2)).toBe(1)
  })

  test('おだいを わると1こ ふえ、はじけた演出は すこしで きえる', () => {
    let state = run(createInitialState('color'), 300)
    const first = state.bubbles[0]!
    const touched = touchBubble(state, 'color', first.id)
    expect(touched.result).toBe('hit')
    expect(touched.state.popped).toBe(1)
    // 同じ しゃぼんだまは 2かい われない。
    expect(touchBubble(touched.state, 'color', first.id).result).toBe('none')
    state = run(touched.state, 600)
    expect(state.bubbles.some((b) => b.id === first.id)).toBe(false)
  })

  test('ちがう しゃぼんだまは われずに ぷるぷるし、まちがいが ふえる', () => {
    const state = stateWith({
      targetIndex: 0,
      bubbles: [{ id: 7, kindIndex: 1, x: 0.5, bornAt: 0, riseMs: 6000, poppedAt: null, wobbleUntil: 0 }],
    })
    const touched = touchBubble(state, 'color', 7)
    expect(touched.result).toBe('wrong')
    expect(touched.state.popped).toBe(0)
    expect(touched.state.mistakes).toBe(1)
    expect(touched.state.bubbles[0]!.poppedAt).toBeNull()
    expect(touched.state.bubbles[0]!.wobbleUntil).toBeGreaterThan(state.elapsedMs)
  })

  test(`${POPS_PER_TARGET}こ わるごとに おだいが ちがうものに かわる`, () => {
    let state = stateWith({ targetIndex: 2, popped: POPS_PER_TARGET - 1 })
    state = { ...state, bubbles: [{ id: 1, kindIndex: 2, x: 0.5, bornAt: 0, riseMs: 6000, poppedAt: null, wobbleUntil: 0 }] }
    const touched = touchBubble(state, 'shape', 1)
    expect(touched.state.targetIndex).not.toBe(2)
  })

  test(`${GOAL_COUNT}こ わると おわり、それ以上は すすまない`, () => {
    const state = stateWith({
      targetIndex: 0,
      popped: GOAL_COUNT - 1,
      bubbles: [{ id: 1, kindIndex: 0, x: 0.5, bornAt: 0, riseMs: 6000, poppedAt: null, wobbleUntil: 0 }],
    })
    const touched = touchBubble(state, 'color', 1)
    expect(isFinished(touched.state)).toBe(true)
    expect(advance(touched.state, 'color', 1000)).toBe(touched.state)
  })

  test('★は まちがいの すくなさで きまる', () => {
    expect(scoreStars(0)).toBe(3)
    expect(scoreStars(1)).toBe(3)
    expect(scoreStars(3)).toBe(2)
    expect(scoreStars(10)).toBe(1)
  })
})
