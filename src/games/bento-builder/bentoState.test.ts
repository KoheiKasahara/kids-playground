import { describe, expect, test } from 'vitest'
import { bentoReducer, BOXES, clampToBox, DIVIDER_HALF, findPlacement, fits, FOODS, foodDefinition, HALF_DEPTH, HALF_WIDTH, initialBentoState, MAX_FOODS, PACKING_RATIO, ROUND_RADIUS, type BentoState } from './bentoState'

test('おかずのID・名前・絵文字が重複せず、半径が箱に収まる', () => {
  for (const key of ['id', 'name', 'emoji'] as const) {
    expect(new Set(FOODS.map(food => food[key])).size).toBe(FOODS.length)
  }
  for (const food of FOODS) {
    expect(food.radius).toBeGreaterThan(0)
    expect(food.radius).toBeLessThan(Math.min(HALF_DEPTH, ROUND_RADIUS - DIVIDER_HALF))
  }
})

describe('箱の配置領域', () => {
  for (const box of BOXES) test(`${box.name}の壁と仕切りから食材の半径分を確保する`, () => {
    for (const food of FOODS) for (const x of [-20, -3, -0.01, 0, 0.01, 3, 20]) for (const z of [-20, 0, 20]) {
      const p = clampToBox(box.id, { x, z }, food.radius)
      if (box.id === 'round') expect(Math.hypot(p.x, p.z) + food.radius).toBeLessThanOrEqual(ROUND_RADIUS + 1e-8)
      else {
        expect(Math.abs(p.x) + food.radius).toBeLessThanOrEqual(HALF_WIDTH + 1e-8)
        expect(Math.abs(p.z) + food.radius).toBeLessThanOrEqual(HALF_DEPTH + 1e-8)
        if (box.id === 'divided') expect(Math.abs(p.x) - food.radius).toBeGreaterThanOrEqual(DIVIDER_HALF - 1e-8)
      }
    }
  })
  test('重なりを近くで補正し、空きがなければ遠くへ飛ばさない', () => {
    const others = [{ id: 1, kind: 'onigiri' as const, x: 0, z: 0, rotation: 0 }]
    const p = findPlacement('rectangle', { x: 0.8, z: 0 }, 0.5, others, 0.6)!
    expect(p).not.toBeNull()
    expect(Math.hypot(p.x - 0.8, p.z)).toBeLessThanOrEqual(0.6)
    expect(Math.hypot(p.x, p.z)).toBeGreaterThanOrEqual((0.62 + 0.5) * PACKING_RATIO)
    expect(findPlacement('rectangle', { x: 0, z: 0 }, 0.5, others, 0.6)).toBeNull()
    expect(findPlacement('round', { x: NaN, z: 0 }, 0.5, [], 2)).toBeNull()
  })
})

describe('自由制作の遊びのループ', () => {
  test('箱・色・追加・回転・完成・修正・やり直し', () => {
    let s = bentoReducer(initialBentoState, { type: 'box', box: 'divided' })
    s = bentoReducer(s, { type: 'color', color: '#62b9df' })
    s = bentoReducer(s, { type: 'start' })
    s = bentoReducer(s, { type: 'add', kind: 'sushi' })
    s = bentoReducer(s, { type: 'add', kind: 'sushi' })
    expect(s.foods).toHaveLength(2)
    const first = s.foods[0]!
    s = bentoReducer(s, { type: 'rotate' })
    expect(s.foods[1]!.rotation).toBeCloseTo(Math.PI / 2)
    expect(s.foods[0]).toEqual(first)
    const foods = s.foods
    s = bentoReducer(s, { type: 'finish' })
    expect(s.mode).toBe('done')
    expect(bentoReducer(s, { type: 'add', kind: 'egg' })).toBe(s)
    s = bentoReducer(s, { type: 'edit' })
    expect(s.foods).toBe(foods)
    s = bentoReducer(s, { type: 'select', id: first.id })
    s = bentoReducer(s, { type: 'remove' })
    expect(s.foods).toHaveLength(1)
    s = bentoReducer(s, { type: 'back' })
    expect(s.mode).toBe('choose')
    expect(s.foods).toHaveLength(1)
    s = bentoReducer(s, { type: 'restart' })
    expect(s.foods).toEqual([])
    expect(s.box).toBe('divided')
    expect(s.color).toBe('#62b9df')
  })
  test('やりなおしですべてのおかずと選択を消す', () => {
    let s = bentoReducer(initialBentoState, { type: 'start' })
    s = bentoReducer(s, { type: 'add', kind: 'carrot' })
    s = bentoReducer(s, { type: 'add', kind: 'tomato' })
    s = bentoReducer(s, { type: 'clear' })
    expect(s.foods).toEqual([])
    expect(s.selected).toBeNull()
    expect(s.message).toContain('さいしょから')
  })
  for (const box of BOXES) test(`${box.name}に同じ食材を追加し続けても上限・壁・めり込みを守る`, () => {
    let s: BentoState = { ...initialBentoState, box: box.id, mode: 'edit' }
    for (let i = 0; i < MAX_FOODS + 5; i++) s = bentoReducer(s, { type: 'add', kind: 'tomato' })
    expect(s.foods.length).toBeGreaterThan(8)
    expect(s.foods.length).toBeLessThanOrEqual(MAX_FOODS)
    expect(s.message).toContain('いっぱい')
    for (const food of s.foods) expect(fits(s.box, food, foodDefinition(food.kind).radius, s.foods.filter(other => other.id !== food.id))).toBe(true)
  })
  test('埋まった場所・不正座標へのドロップは元の場所、箱外は内側へ戻す', () => {
    let s: BentoState = { ...initialBentoState, mode: 'edit', foods: [
      { id: 1, kind: 'onigiri', x: 0, z: 0, rotation: 0 },
      { id: 2, kind: 'onigiri', x: 1.5, z: 0, rotation: 0 },
    ] }
    s = bentoReducer(s, { type: 'move', id: 2, point: { x: 0, z: 0 } })
    expect(s.foods[1]!.x).toBe(1.5)
    s = bentoReducer(s, { type: 'move', id: 2, point: { x: Infinity, z: 0 } })
    expect(s.foods[1]!.x).toBe(1.5)
    s = bentoReducer(s, { type: 'move', id: 2, point: { x: 100, z: 0 } })
    expect(s.foods[1]!.x).toBeCloseTo(3 - 0.62)
  })
})

test('20個を超えて詰められ、接近配置でも同じ中心への重なりは防ぐ', () => {
  let state: BentoState = { ...initialBentoState, mode: 'edit' }
  for (let i = 0; i < 30; i++) state = bentoReducer(state, { type: 'add', kind: 'tomato' })
  expect(state.foods).toHaveLength(30)
  const first = state.foods[0]!
  expect(fits('rectangle', { x: 0.55, z: 0 }, 0.36, [first])).toBe(true)
  expect(fits('rectangle', first, 0.36, [first])).toBe(false)
})

test('カップは選んだおかずだけに付き、移動・回転・完成後も保たれる', () => {
  let state = bentoReducer(initialBentoState, { type: 'start' })
  state = bentoReducer(state, { type: 'add', kind: 'tomato' })
  state = bentoReducer(state, { type: 'add', kind: 'egg' })
  state = bentoReducer(state, { type: 'cup', cup: 'green' })
  expect(state.foods[0]!.cup).toBeUndefined()
  expect(state.foods[1]!.cup).toBe('green')
  state = bentoReducer(state, { type: 'move', id: 2, point: { x: 2, z: 1 } })
  state = bentoReducer(state, { type: 'rotate' })
  state = bentoReducer(state, { type: 'finish' })
  expect(state.foods[1]).toMatchObject({ x: 2, z: 1, cup: 'green', rotation: Math.PI / 2 })
  expect(bentoReducer(state, { type: 'cup', cup: 'pink' })).toBe(state)
  state = bentoReducer(state, { type: 'edit' })
  state = bentoReducer(state, { type: 'select', id: 2 })
  state = bentoReducer(state, { type: 'cup', cup: null })
  expect(state.foods[1]!.cup).toBeUndefined()
})

test('カップ同士は密な食材判定と違い縁が重ならず、箱の中に収まる', () => {
  let state = bentoReducer(initialBentoState, { type: 'start' })
  for (let i = 0; i < 3; i++) {
    state = bentoReducer(state, { type: 'add', kind: 'tomato' })
    state = bentoReducer(state, { type: 'cup', cup: 'blue' })
  }
  expect(state.foods.every(food => food.cup === 'blue')).toBe(true)
  state = bentoReducer(state, { type: 'move', id: 3, point: { x: 0.55, z: 0 } })
  for (const food of state.foods) {
    expect(fits(state.box, food, 0.36, state.foods.filter(other => food.id !== other.id), 0.36)).toBe(true)
  }
})
