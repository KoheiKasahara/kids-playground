import { describe, expect, test } from 'vitest'
import type { WaterBodyDefinition } from './types'
import {
  createWaterField,
  findWaterBodyAt,
  requestWaterChange,
  stepWaterField,
  surfaceYAt,
  transferWaterThroughGate,
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

describe('waterModel: 水門の2水域移送(#568)', () => {
  // 同じ底の高さで幅が違う左右水槽。別の高さは下の専用ケースで検証する。
  const lower = { ...bodies[1], floorY: upper.floorY, ceilingY: upper.ceilingY }
  const gateBodies = [upper, lower]

  test('高い側から低い側へ移り、総水量を保存しながら水位差が縮む', () => {
    const before = createWaterField(gateBodies)
    const totalBefore = before.upper.volume + before.lower.volume
    const result = transferWaterThroughGate(gateBodies, before, 'upper', 'lower', 0.1)

    expect(result.direction).toBe(1)
    expect(result.fromBodyId).toBe('upper')
    expect(result.toBodyId).toBe('lower')
    expect(result.transferredVolume).toBeGreaterThan(0)
    expect(result.field.upper.volume + result.field.lower.volume).toBeCloseTo(totalBefore, 8)
    expect(waterLevelOf(upper, result.field.upper)).toBeLessThan(waterLevelOf(upper, before.upper))
    expect(waterLevelOf(lower, result.field.lower)).toBeGreaterThan(waterLevelOf(lower, before.lower))
  })

  test('幅が違っても差を逆転させず、繰り返すと同じ水位で止まる', () => {
    let field = createWaterField(gateBodies)
    for (let index = 0; index < 120; index += 1) {
      field = transferWaterThroughGate(gateBodies, field, 'upper', 'lower', 1 / 60).field
    }

    expect(waterLevelOf(upper, field.upper)).toBeCloseTo(waterLevelOf(lower, field.lower), 5)
    expect(transferWaterThroughGate(gateBodies, field, 'upper', 'lower', 1 / 60).direction).toBe(0)
  })

  test('逆の水位差なら右から左へ移り、targetVolumeも同量移動して後続stepに戻されない', () => {
    const lowerFilled = stepWaterField(
      gateBodies,
      requestWaterChange(gateBodies, createWaterField(gateBodies), 'lower', 30),
      10,
    )
    const result = transferWaterThroughGate(gateBodies, lowerFilled, 'upper', 'lower', 0.1)

    expect(result.direction).toBe(-1)
    expect(result.field.upper.volume).toBe(result.field.upper.targetVolume)
    expect(result.field.lower.volume).toBe(result.field.lower.targetVolume)
    expect(stepWaterField(gateBodies, result.field, 1)).toBe(result.field)
  })

  test('不正なdt・同一ID・未知IDでは状態を変えない', () => {
    const field = createWaterField(gateBodies)
    expect(transferWaterThroughGate(gateBodies, field, 'upper', 'lower', Number.NaN).field).toBe(field)
    expect(transferWaterThroughGate(gateBodies, field, 'upper', 'upper', 1).field).toBe(field)
    expect(transferWaterThroughGate(gateBodies, field, 'upper', 'unknown', 1).field).toBe(field)
  })

  test.each([
    ['排水予約中', -1000],
    ['給水予約中', 20],
  ])('%sでもtargetVolume合計を保存し、有限値かつ容量内に保つ', (_label, pendingDelta) => {
    const pending = requestWaterChange(gateBodies, createWaterField(gateBodies), 'upper', pendingDelta as number)
    const targetTotalBefore = pending.upper.targetVolume + pending.lower.targetVolume
    const result = transferWaterThroughGate(gateBodies, pending, 'upper', 'lower', 0.1)
    const targetTotalAfter = result.field.upper.targetVolume + result.field.lower.targetVolume

    expect(targetTotalAfter).toBeCloseTo(targetTotalBefore, 8)
    for (const [definition, state] of [
      [upper, result.field.upper],
      [lower, result.field.lower],
    ] as const) {
      expect(Number.isFinite(state.targetVolume)).toBe(true)
      expect(state.targetVolume).toBeGreaterThanOrEqual(0)
      expect(state.targetVolume).toBeLessThanOrEqual(waterBodyCapacity(definition))
    }
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
