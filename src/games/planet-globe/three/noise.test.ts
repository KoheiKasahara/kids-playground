import { describe, expect, it } from 'vitest'
import { createNoise2D, fbm2D } from './noise'

describe('createNoise2D', () => {
  it('同じseed・同じ入力からは同じ値を返す', () => {
    const noise = createNoise2D(3)
    expect(noise(1.3, 2.7, 8)).toBe(noise(1.3, 2.7, 8))
  })

  it('0..1の範囲に収まる', () => {
    const noise = createNoise2D(5)
    for (let x = 0; x < 20; x += 0.37) {
      for (let y = 0; y < 10; y += 0.51) {
        const value = noise(x, y, 8)
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(1)
      }
    }
  })

  it('X方向にperiodXでタイルする(経度0度の継ぎ目を作らない)', () => {
    const noise = createNoise2D(11)
    const period = 8
    for (let y = 0; y < 5; y += 1) {
      expect(noise(0, y, period)).toBeCloseTo(noise(period, y, period), 10)
      expect(noise(1.4, y, period)).toBeCloseTo(noise(period + 1.4, y, period), 10)
    }
  })

  it('seedが違えば違う値になる', () => {
    const a = createNoise2D(1)
    const b = createNoise2D(2)
    expect(a(1.5, 1.5, 8)).not.toBe(b(1.5, 1.5, 8))
  })
})

describe('fbm2D', () => {
  it('0..1の範囲に正規化される', () => {
    const noise = createNoise2D(9)
    for (let i = 0; i < 30; i += 1) {
      const value = fbm2D(noise, i * 0.31, i * 0.17, 8, 5)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    }
  })

  it('同一seed・同一入力では決定的に同じ値を返す', () => {
    const noise = createNoise2D(4)
    expect(fbm2D(noise, 2.2, 3.3, 8, 4)).toBe(fbm2D(noise, 2.2, 3.3, 8, 4))
  })

  it('X方向にperiodXでタイルする', () => {
    const noise = createNoise2D(6)
    expect(fbm2D(noise, 0, 1.1, 8, 4)).toBeCloseTo(fbm2D(noise, 8, 1.1, 8, 4), 10)
  })
})
