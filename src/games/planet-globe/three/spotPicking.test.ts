import { describe, expect, it } from 'vitest'
import {
  exceedsTapMovement,
  isRingPointVisible,
  isSurfacePointVisible,
  ndcToScreen,
  pickNearestSpot,
  POINTER_TAP_MOVE_PX,
} from './spotPicking'

describe('exceedsTapMovement', () => {
  it('閾値以下の移動はタップ扱い(false)', () => {
    expect(exceedsTapMovement(3, 4)).toBe(false) // hypot=5 < 10
    expect(exceedsTapMovement(0, 0)).toBe(false)
  })

  it('閾値を超える移動はタップ扱いしない(true)', () => {
    expect(exceedsTapMovement(6, 8.1)).toBe(true) // hypot≈10.06 > 10
  })

  it('閾値ちょうどはタップ扱い(false、境界を含む)', () => {
    expect(exceedsTapMovement(6, 8)).toBe(false)
  })

  it('カスタム閾値を渡せる', () => {
    expect(exceedsTapMovement(4, 0, 3)).toBe(true)
    expect(exceedsTapMovement(2, 0, 3)).toBe(false)
  })

  it('既定の閾値はPOINTER_TAP_MOVE_PX', () => {
    expect(exceedsTapMovement(POINTER_TAP_MOVE_PX + 0.1, 0)).toBe(true)
  })
})

describe('isSurfacePointVisible', () => {
  const camera = { x: 0, y: 0, z: 3 }

  it('カメラの手前を向く点は見える', () => {
    expect(isSurfacePointVisible(camera, { x: 0, y: 0, z: 1 })).toBe(true)
  })

  it('裏側を向く点は見えない', () => {
    expect(isSurfacePointVisible(camera, { x: 0, y: 0, z: -1 })).toBe(false)
  })

  it('輪郭ぎりぎりの点はmarginにより見えない扱いになる', () => {
    // dot(point, camera) = 3 * 0.35 = 1.05。marginなしのdot>1では見えるが、
    // 既定margin(0.06)を足した閾値1.06は超えないため見えない扱いになる。
    const nearHorizon = { x: Math.sqrt(1 - 0.35 * 0.35), y: 0, z: 0.35 }
    expect(isSurfacePointVisible(camera, nearHorizon, 0)).toBe(true)
    expect(isSurfacePointVisible(camera, nearHorizon)).toBe(false)
  })
})

describe('isRingPointVisible', () => {
  const camera = { x: 0, y: 0, z: 3 }

  it('天体の反対側にある輪上の点は見えない', () => {
    expect(isRingPointVisible(camera, { x: 0, y: 0, z: -1.5 })).toBe(false)
  })

  it('カメラと同じ側にある輪上の点は見える', () => {
    expect(isRingPointVisible(camera, { x: 0, y: 0, z: 1.5 })).toBe(true)
  })

  it('横に離れた輪上の点は(天体を迂回するので)見える', () => {
    expect(isRingPointVisible(camera, { x: 2, y: 0, z: 0 })).toBe(true)
  })
})

describe('ndcToScreen', () => {
  it('NDCの中心はキャンバス中心になる', () => {
    expect(ndcToScreen(0, 0, 800, 600)).toEqual({ x: 400, y: 300 })
  })

  it('四隅が正しく変換される', () => {
    expect(ndcToScreen(-1, 1, 800, 600)).toEqual({ x: 0, y: 0 }) // 左上
    expect(ndcToScreen(1, 1, 800, 600)).toEqual({ x: 800, y: 0 }) // 右上
    expect(ndcToScreen(-1, -1, 800, 600)).toEqual({ x: 0, y: 600 }) // 左下
    expect(ndcToScreen(1, -1, 800, 600)).toEqual({ x: 800, y: 600 }) // 右下
  })
})

describe('pickNearestSpot', () => {
  it('近い方の候補を選ぶ', () => {
    const candidates = [
      { id: 'far', x: 50, y: 0, hitRadiusPx: 60 },
      { id: 'near', x: 5, y: 0, hitRadiusPx: 60 },
    ]
    expect(pickNearestSpot(candidates, 0, 0)).toBe('near')
  })

  it('当たり判定半径の外ならnull', () => {
    const candidates = [{ id: 'a', x: 100, y: 100, hitRadiusPx: 5 }]
    expect(pickNearestSpot(candidates, 0, 0)).toBeNull()
  })

  it('候補が0件ならnull', () => {
    expect(pickNearestSpot([], 0, 0)).toBeNull()
  })
})
