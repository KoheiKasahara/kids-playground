import { describe, expect, it } from 'vitest'
import { createRandom, layoutSpeckles, withAlpha } from './planetSurface'
import type { SurfaceSpeckles } from '../types'

describe('withAlpha', () => {
  it('16進カラーとアルファから rgba() 文字列を作る', () => {
    expect(withAlpha('#ff8800', 0.5)).toBe('rgba(255, 136, 0, 0.5)')
  })

  it('黒・白でも正しく変換する', () => {
    expect(withAlpha('#000000', 1)).toBe('rgba(0, 0, 0, 1)')
    expect(withAlpha('#ffffff', 0)).toBe('rgba(255, 255, 255, 0)')
  })
})

describe('createRandom', () => {
  it('同じ seed からは同じ乱数列が得られる', () => {
    const a = createRandom(42)
    const b = createRandom(42)
    const sequenceA = [a(), a(), a()]
    const sequenceB = [b(), b(), b()]
    expect(sequenceA).toEqual(sequenceB)
  })

  it('違う seed からは違う乱数列が得られる', () => {
    const a = createRandom(1)
    const b = createRandom(2)
    expect(a()).not.toBe(b())
  })

  it('0..1 の範囲の値を返す', () => {
    const random = createRandom(7)
    for (let i = 0; i < 20; i += 1) {
      const value = random()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})

describe('layoutSpeckles', () => {
  const speckles: SurfaceSpeckles = {
    count: 50,
    minRadius: 0.01,
    maxRadius: 0.05,
    color: '#8d8b83',
    opacity: 0.5,
    seed: 7,
  }

  it('同じ seed からは同じ配置を返す', () => {
    expect(layoutSpeckles(speckles)).toEqual(layoutSpeckles(speckles))
  })

  it('y は 0.14..0.86 に収まる', () => {
    for (const layout of layoutSpeckles(speckles)) {
      expect(layout.y).toBeGreaterThanOrEqual(0.14)
      expect(layout.y).toBeLessThanOrEqual(0.86)
    }
  })

  it('半径は minRadius..maxRadius に収まる', () => {
    for (const layout of layoutSpeckles(speckles)) {
      expect(layout.radius).toBeGreaterThanOrEqual(speckles.minRadius)
      expect(layout.radius).toBeLessThanOrEqual(speckles.maxRadius)
    }
  })

  it('左右端をまたぐ斑点は複製され、件数が count 以上になる', () => {
    expect(layoutSpeckles(speckles).length).toBeGreaterThanOrEqual(speckles.count)
  })

  it('大きな半径で端に寄りやすいときは実際に複製が発生する', () => {
    // 半径を広くして端との重なり判定に必ず数件ヒットするようにする回帰テスト。
    const wideSpeckles: SurfaceSpeckles = { ...speckles, count: 200, maxRadius: 0.3 }
    expect(layoutSpeckles(wideSpeckles).length).toBeGreaterThan(wideSpeckles.count)
  })
})
