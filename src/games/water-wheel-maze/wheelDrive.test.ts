import { describe, expect, test } from 'vitest'
import { GEAR_RATIO } from './scene'
import { TOTAL_RIDERS, easeAngle, ridersDelivered, toyAngle, toyTurns, wheelAngle } from './wheelDrive'

describe('かんらんしゃの うごき', () => {
  test('目あてまで とどけると ちょうど 1しゅうする', () => {
    expect(toyTurns(0, 100)).toBe(0)
    expect(toyTurns(50, 100)).toBe(0.5)
    expect(toyTurns(100, 100)).toBe(1)
    expect(toyAngle(100, 100)).toBeCloseTo(Math.PI * 2)
  })

  test('目あてが 0でも 0わりにならない', () => {
    expect(Number.isFinite(toyTurns(10, 0))).toBe(true)
  })

  test('みずぐるまは かんらんしゃより GEAR_RATIO ばい まわる', () => {
    expect(wheelAngle(100, 100)).toBeCloseTo(toyAngle(100, 100) * GEAR_RATIO)
  })
})

describe('のった どうぶつの かず', () => {
  test('とどいた ぶんだけ ふえる', () => {
    expect(ridersDelivered(0, 60)).toBe(0)
    expect(ridersDelivered(9, 60)).toBe(0)
    expect(ridersDelivered(10, 60)).toBe(1)
    expect(ridersDelivered(59, 60)).toBe(5)
    expect(ridersDelivered(60, 60)).toBe(TOTAL_RIDERS)
  })

  test('目あてを こえても ゴンドラの かず いじょうには ならない', () => {
    expect(ridersDelivered(600, 60)).toBe(TOTAL_RIDERS)
  })

  test('マイナスにも ならない', () => {
    expect(ridersDelivered(-5, 60)).toBe(0)
  })
})

describe('easeAngle', () => {
  test('目あての 角度へ 近づくが いきすぎない', () => {
    let angle = 0
    for (let step = 0; step < 200; step++) angle = easeAngle(angle, 10)
    expect(angle).toBeGreaterThan(9.9)
    expect(angle).toBeLessThanOrEqual(10)
  })

  test('1回では とびこえない', () => {
    expect(easeAngle(0, 10)).toBeLessThan(10)
    expect(easeAngle(0, 10)).toBeGreaterThan(0)
  })
})
