import { describe, expect, test } from 'vitest'
import {
  BUOYANCY_RATIO,
  createFloaterState,
  resolveCircleAgainstRect,
  stepFloater,
  type FloatStepContext,
  type FloaterState,
} from './floatModel'
import type { FloaterDefinition, Rect } from './types'

const duck: FloaterDefinition = { id: 'duck', kind: 'duck', radius: 8, startX: 30, startY: 100 }
const floor: Rect = { x: 0, y: 120, width: 100, height: 10 }
const bounds = { width: 100, height: 150 }
const STEP = 1 / 60

function context(overrides: Partial<FloatStepContext> = {}): FloatStepContext {
  return {
    surfaceY: undefined,
    solids: [floor],
    bounds,
    driftDirection: 1,
    ...overrides,
  }
}

function advance(state: FloaterState, seconds: number, ctx: FloatStepContext): FloaterState {
  let current = state
  const steps = Math.round(seconds / STEP)
  for (let index = 0; index < steps; index += 1) {
    current = stepFloater(duck, current, ctx, STEP)
  }
  return current
}

describe('floatModel: 円と矩形の押し出し', () => {
  test('離れていれば当たらない', () => {
    expect(resolveCircleAgainstRect(50, 50, 8, floor)).toBeNull()
  })

  test('上から重なったら上へ押し出す', () => {
    const hit = resolveCircleAgainstRect(50, 115, 8, floor)
    expect(hit).not.toBeNull()
    expect(hit!.y).toBeCloseTo(112, 5)
    expect(hit!.normalY).toBe(-1)
  })

  test('中心まで入り込んでもいちばん浅い側へ出る', () => {
    const hit = resolveCircleAgainstRect(50, 122, 8, floor)
    expect(hit).not.toBeNull()
    expect(hit!.y).toBeCloseTo(112, 5)
  })

  test('横から重なったら横へ押し出す', () => {
    const wall: Rect = { x: 40, y: 0, width: 10, height: 100 }
    const hit = resolveCircleAgainstRect(36, 50, 8, wall)
    expect(hit).not.toBeNull()
    expect(hit!.x).toBeCloseTo(32, 5)
    expect(hit!.normalX).toBe(-1)
  })
})

describe('floatModel: 浮力', () => {
  test('水がなければ落ちて床の上で止まる', () => {
    const settled = advance(createFloaterState(duck), 3, context())

    expect(settled.y).toBeCloseTo(112, 1)
    expect(Math.abs(settled.vy)).toBeLessThan(1)
    expect(settled.submergedRatio).toBe(0)
  })

  test('水面があると、その近くで落ち着く', () => {
    const settled = advance(createFloaterState(duck), 6, context({ surfaceY: 60 }))

    // 沈み込みの割合は 1 / BUOYANCY_RATIO に収束する。
    expect(settled.submergedRatio).toBeCloseTo(1 / BUOYANCY_RATIO, 1)
    expect(settled.y).toBeGreaterThan(60 - 8)
    expect(settled.y).toBeLessThan(60 + 8)
  })

  test('水面が上がると浮遊物も上がる', () => {
    const settled = advance(createFloaterState(duck), 6, context({ surfaceY: 100 }))
    const raised = advance(settled, 6, context({ surfaceY: 60 }))

    expect(raised.y).toBeLessThan(settled.y - 30)
  })

  test('水面が下がると浮遊物も下がる', () => {
    const settled = advance(createFloaterState(duck), 6, context({ surfaceY: 60 }))
    const lowered = advance(settled, 6, context({ surfaceY: 100 }))

    expect(lowered.y).toBeGreaterThan(settled.y + 30)
  })

  test('水位が急に変わっても、しばらく揺れてから落ち着く（ぷかぷか）', () => {
    const settled = advance(createFloaterState(duck), 6, context({ surfaceY: 100 }))
    const justAfter = advance(settled, 0.5, context({ surfaceY: 60 }))
    const later = advance(justAfter, 6, context({ surfaceY: 60 }))

    // 直後は動いていて、時間が経つとほぼ止まる。
    expect(Math.abs(justAfter.vy)).toBeGreaterThan(5)
    expect(Math.abs(later.vy)).toBeLessThan(2)
  })
})

describe('floatModel: 水平の流れ', () => {
  test('水に触れているとゴール方向へゆっくり流れる', () => {
    const started = advance(createFloaterState(duck), 1, context({ surfaceY: 60 }))
    const drifted = advance(started, 1, context({ surfaceY: 60 }))

    expect(drifted.x).toBeGreaterThan(started.x + 5)
  })

  test('水から離れていれば横に流れない', () => {
    const settled = advance(createFloaterState(duck), 3, context())
    const later = advance(settled, 2, context())

    expect(later.x).toBeCloseTo(settled.x, 3)
  })

  test('壁があれば流れても越えない', () => {
    const wall: Rect = { x: 60, y: 0, width: 8, height: 130 }
    const ctx = context({ surfaceY: 60, solids: [floor, wall] })
    const drifted = advance(createFloaterState(duck), 10, ctx)

    expect(drifted.x).toBeLessThanOrEqual(60 - 8 + 0.001)
  })
})

describe('floatModel: 破綻しないこと', () => {
  test('ステージ外へ出ない', () => {
    const ctx = context({ surfaceY: 0, solids: [] })
    const moved = advance(createFloaterState(duck), 10, ctx)

    expect(moved.x).toBeGreaterThanOrEqual(8)
    expect(moved.x).toBeLessThanOrEqual(bounds.width - 8)
    expect(moved.y).toBeGreaterThanOrEqual(8)
    expect(moved.y).toBeLessThanOrEqual(bounds.height - 8)
  })

  test('水面が毎フレーム大きく動いても数値が壊れない', () => {
    let current = createFloaterState(duck)
    for (let index = 0; index < 600; index += 1) {
      const surfaceY = index % 2 === 0 ? 40 : 118
      current = stepFloater(duck, current, context({ surfaceY }), STEP)
    }

    expect(Number.isFinite(current.x)).toBe(true)
    expect(Number.isFinite(current.y)).toBe(true)
    expect(current.y).toBeLessThanOrEqual(112.001)
  })
})
