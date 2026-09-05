import { describe, expect, test } from 'vitest'
import type { WaterBodyDefinition } from './types'
import {
  createWaterField,
  findWaterBodyAt,
  requestWaterChange,
  stepWaterField,
  surfaceYAt,
  waterBodyCapacity,
  waterBodyMaxLevel,
  waterFillRatio,
  waterLevelOf,
  waterSurfaceY,
} from './waterModel'

// 幅の違う2水域を使い、Phase 1のステージ形（1水域）に依存しないことを確かめる。
// 上段（幅20）・下段（幅40）は #517 ゲートで水を移す将来像のミニチュア。
const upper: WaterBodyDefinition = {
  id: 'upper',
  label: 'うえの すいそう',
  left: 10,
  right: 30,
  floorY: 60,
  ceilingY: 20,
  initialLevel: 10,
}

const lower: WaterBodyDefinition = {
  id: 'lower',
  label: 'したの すいそう',
  left: 10,
  right: 50,
  floorY: 120,
  ceilingY: 70,
  initialLevel: 0,
}

const bodies = [upper, lower]

describe('waterModel: 水域の基本値', () => {
  test('最大水位と容量は定義から決まる', () => {
    expect(waterBodyMaxLevel(upper)).toBe(40)
    expect(waterBodyCapacity(upper)).toBe(20 * 40)
    expect(waterBodyCapacity(lower)).toBe(40 * 50)
  })

  test('初期水位が水域ごとに独立している', () => {
    const field = createWaterField(bodies)

    expect(waterLevelOf(upper, field.upper)).toBe(10)
    expect(waterLevelOf(lower, field.lower)).toBe(0)
    expect(waterSurfaceY(upper, field.upper)).toBe(50)
    expect(waterSurfaceY(lower, field.lower)).toBe(120)
  })

  test('満水・空のときの割合が0〜1に収まる', () => {
    const field = createWaterField(bodies)
    const full = requestWaterChange(bodies, field, 'upper', 999)
    const stepped = stepWaterField(bodies, full, 100)

    expect(waterFillRatio(upper, stepped.upper)).toBe(1)
    expect(waterFillRatio(lower, stepped.lower)).toBe(0)
  })
})

describe('waterModel: 水量の増減', () => {
  test('指示した水域だけが変わる', () => {
    const field = createWaterField(bodies)
    const requested = requestWaterChange(bodies, field, 'upper', 5)
    const stepped = stepWaterField(bodies, requested, 1)

    expect(waterLevelOf(upper, stepped.upper)).toBeCloseTo(15, 5)
    expect(waterLevelOf(lower, stepped.lower)).toBe(0)
  })

  test('容量を超える指示は満水で止まる', () => {
    const field = createWaterField(bodies)
    const requested = requestWaterChange(bodies, field, 'upper', 1000)
    const stepped = stepWaterField(bodies, requested, 100)

    expect(waterLevelOf(upper, stepped.upper)).toBe(waterBodyMaxLevel(upper))
  })

  test('0を下回る指示は空で止まる', () => {
    const field = createWaterField(bodies)
    const requested = requestWaterChange(bodies, field, 'upper', -1000)
    const stepped = stepWaterField(bodies, requested, 100)

    expect(waterLevelOf(upper, stepped.upper)).toBe(0)
    expect(waterSurfaceY(upper, stepped.upper)).toBe(upper.floorY)
  })

  test('知らない水域IDを指示しても状態が変わらない', () => {
    const field = createWaterField(bodies)
    expect(requestWaterChange(bodies, field, 'unknown', 10)).toBe(field)
  })

  test('目標へ到達済みなら同じ参照を返す（無駄な再描画を避ける）', () => {
    const field = createWaterField(bodies)
    expect(stepWaterField(bodies, field, 1)).toBe(field)
  })

  test('水位は目標へ一気に飛ばず、時間をかけて動く', () => {
    const field = createWaterField(bodies)
    const requested = requestWaterChange(bodies, field, 'upper', 30)
    const afterShortStep = stepWaterField(bodies, requested, 0.1)

    const level = waterLevelOf(upper, afterShortStep.upper)
    expect(level).toBeGreaterThan(10)
    expect(level).toBeLessThan(40)
  })
})

describe('waterModel: 位置から水域を引く', () => {
  test('X範囲と底で水域を判別する', () => {
    expect(findWaterBodyAt(bodies, 20, 40)?.id).toBe('upper')
    expect(findWaterBodyAt(bodies, 45, 100)?.id).toBe('lower')
  })

  test('どの水域にも属さない位置では水面が求まらない', () => {
    const field = createWaterField(bodies)
    expect(findWaterBodyAt(bodies, 90, 40)).toBeUndefined()
    expect(surfaceYAt(bodies, field, 90, 40)).toBeUndefined()
  })

  test('水面より上にいても、その柱の水域として扱う', () => {
    const field = createWaterField(bodies)
    // upperの水面は y=50。その上（y=25）にいる浮遊物も upper の水面を参照できる。
    expect(surfaceYAt(bodies, field, 20, 25)).toBe(50)
  })
})
