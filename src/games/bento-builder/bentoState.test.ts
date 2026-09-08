import { describe, expect, test } from 'vitest'
import { bentoReducer, BOXES, clampToBox, DIVIDER_HALF, findPlacement, fits, FOODS, foodDefinition, HALF_DEPTH, HALF_WIDTH, initialBentoState, MAX_FOODS, ROUND_RADIUS, type BentoState } from './bentoState'

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
    expect(Math.hypot(p.x, p.z)).toBeGreaterThanOrEqual((0.62 + 0.5) * 0.9)
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
  for (const box of BOXES) test(`${box.name}に同じ食材を追加し続けても上限・壁・めり込みを守る`, () => {
    let s: BentoState = { ...initialBentoState, box: box.id, mode: 'edit' }
    for (let i = 0; i < 35; i++) s = bentoReducer(s, { type: 'add', kind: 'tomato' })
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
