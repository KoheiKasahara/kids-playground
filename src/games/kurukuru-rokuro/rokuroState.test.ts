import { describe, expect, test } from 'vitest'
import { MAX_STROKE_POINTS, MAX_TOTAL_POINTS, type Stroke } from './paint'
import { createLump } from './pottery'
import { initialRokuroState, rokuroReducer, type RokuroAction, type RokuroState } from './rokuroState'

const run = (actions: RokuroAction[], state: RokuroState = initialRokuroState) => actions.reduce(rokuroReducer, state)
const line = (count: number): Stroke => ({ color: 'red', brush: 'thick', points: Array.from({ length: count }, (_, i) => [(i % 100) / 100, 0.5] as const) })

describe('rokuroReducer', () => {
  test('メニュー → かたち → いろ → やく → できあがり → もう1こ', () => {
    let state = run([{ type: 'start', targetId: 'vase' }])
    expect(state.screen).toBe('shape')
    expect(state.targetId).toBe('vase')
    state = run([{ type: 'stretch', direction: 1 }, { type: 'toPaint' }, { type: 'base', base: 'blue' }, { type: 'bake' }], state)
    expect(state.screen).toBe('bake')
    expect(state.paint.base).toBe('blue')
    state = run([{ type: 'baked' }, { type: 'saved' }], state)
    expect(state.screen).toBe('done')
    expect(state.saved).toBe(true)
    state = run([{ type: 'restart' }], state)
    expect(state).toMatchObject({ screen: 'shape', targetId: 'vase', saved: false, paint: { base: null, strokes: [] } })
    expect(state.profile).toEqual(createLump())
  })

  test('もどる は ひとつ まえの がめんへ。かたちや いろは のこる', () => {
    let state = run([{ type: 'start', targetId: null }, { type: 'stretch', direction: 1 }, { type: 'toPaint' }, { type: 'base', base: 'pink' }, { type: 'bake' }])
    state = run([{ type: 'back' }], state)
    expect(state.screen).toBe('paint')
    state = run([{ type: 'back' }], state)
    expect(state.screen).toBe('shape')
    expect(state.paint.base).toBe('pink')
    expect(state.profile.height).toBeGreaterThan(createLump().height)
    expect(run([{ type: 'back' }], state).screen).toBe('menu')
    expect(run([{ type: 'baked' }, { type: 'back' }], { ...state, screen: 'bake' }).screen).toBe('menu')
  })

  test('かたちの もどす・さいしょから', () => {
    let state = run([{ type: 'start', targetId: null }, { type: 'stretch', direction: 1 }, { type: 'stretch', direction: 1 }])
    const twice = state.profile
    state = run([{ type: 'undoShape' }], state)
    expect(state.profile.height).toBeLessThan(twice.height)
    state = run([{ type: 'resetShape' }, { type: 'undoShape' }], state)
    expect(state.profile).toEqual(stateAfterOneStretch().profile)
    expect(run([{ type: 'undoShape' }, { type: 'undoShape' }, { type: 'undoShape' }], state).profile).toEqual(createLump())
  })

  test('かたちを かえるのは かたちの がめんだけ', () => {
    const painting = run([{ type: 'start', targetId: null }, { type: 'toPaint' }])
    expect(run([{ type: 'stretch', direction: 1 }], painting).profile).toBe(painting.profile)
    expect(run([{ type: 'profile', profile: { height: 2, radii: createLump().radii } }], painting).profile).toBe(painting.profile)
    expect(run([{ type: 'nudge', delta: 0.08 }], painting).profile).toBe(painting.profile)
  })

  test('キーボードの カーソルは 0〜1 を 0.1 ずつ うごく', () => {
    let state = run([{ type: 'start', targetId: null }])
    for (let i = 0; i < 8; i++) state = run([{ type: 'cursor', step: 1 }], state)
    expect(state.cursor).toBe(1)
    for (let i = 0; i < 3; i++) state = run([{ type: 'cursor', step: -1 }], state)
    expect(state.cursor).toBe(0.7)
    state = run([{ type: 'nudge', delta: -0.08 }], state)
    expect(state.shapeHistory).toHaveLength(1)
  })

  test('ぜんぶ ぬる は うわぐすり、ふでは せんを たす。もどすで ひとつずつ もどる', () => {
    let state = run([{ type: 'start', targetId: null }, { type: 'toPaint' }, { type: 'base', base: 'yellow' }])
    expect(state.color).toBe('yellow')
    state = run([{ type: 'tool', tool: 'thin' }, { type: 'color', color: 'green' }, { type: 'stroke', stroke: line(10) }, { type: 'paintRing' }], state)
    expect(state.paint.base).toBe('yellow')
    expect(state.paint.strokes.map(stroke => [stroke.color, stroke.brush])).toEqual([['red', 'thick'], ['green', 'thin']])
    expect(state.paint.strokes[1]!.points[0]).toEqual([0, 0.5])
    state = run([{ type: 'undoPaint' }, { type: 'undoPaint' }], state)
    expect(state.paint.strokes).toEqual([])
    state = run([{ type: 'undoPaint' }], state)
    expect(state.paint.base).toBeNull()
    expect(run([{ type: 'tool', tool: 'all' }, { type: 'paintRing' }], state).paint.strokes).toEqual([])
  })

  test('つち（null）に もどせ、おなじ いろを えらんでも りれきは ふえない', () => {
    let state = run([{ type: 'start', targetId: null }, { type: 'toPaint' }, { type: 'base', base: 'red' }, { type: 'base', base: 'red' }])
    expect(state.paintHistory).toHaveLength(1)
    state = run([{ type: 'base', base: null }], state)
    expect(state.paint.base).toBeNull()
    expect(state.color).toBe('red')
  })

  test('せんの 点は 上限で きり、いっぱいに なったら しらせる', () => {
    let state = run([{ type: 'start', targetId: null }, { type: 'toPaint' }, { type: 'stroke', stroke: line(MAX_STROKE_POINTS + 50) }])
    expect(state.paint.strokes[0]!.points).toHaveLength(MAX_STROKE_POINTS)
    for (let i = 0; i < Math.ceil(MAX_TOTAL_POINTS / MAX_STROKE_POINTS) + 2; i++) state = run([{ type: 'stroke', stroke: line(MAX_STROKE_POINTS) }], state)
    expect(state.paint.strokes.reduce((sum, stroke) => sum + stroke.points.length, 0)).toBe(MAX_TOTAL_POINTS)
    expect(state.paintFull).toBe(true)
    expect(run([{ type: 'undoPaint' }], state).paintFull).toBe(false)
  })

  test('やく まえと できあがり いがいでは baked / saved に ならない', () => {
    const shaping = run([{ type: 'start', targetId: null }])
    expect(run([{ type: 'bake' }], shaping).screen).toBe('shape')
    expect(run([{ type: 'baked' }], shaping).screen).toBe('shape')
    expect(run([{ type: 'stroke', stroke: line(3) }], shaping).paint.strokes).toEqual([])
  })
})

function stateAfterOneStretch() {
  return run([{ type: 'start', targetId: null }, { type: 'stretch', direction: 1 }])
}
