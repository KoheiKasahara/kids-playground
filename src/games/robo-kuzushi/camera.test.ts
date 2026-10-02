import { describe, expect, test } from 'vitest'
import { clampCenter, follow, makeView, toWorld, viewScale } from './camera'
import { GROUND_Y } from './levels'

describe('robo-kuzushi camera', () => {
  test('a wide screen shows the whole stage; narrow and portrait screens pan instead', () => {
    const wide = makeView(1200, 700, 0, 1200)
    expect(wide.left).toBeCloseTo(0)
    expect(wide.width).toBeCloseTo(1200)
    // とても ひろい ステージは ロボットが 小さく なりすぎないよう ぜんぶは うつさない。
    expect(makeView(1200, 700, 0, 1700).width).toBeCloseTo(1450)
    expect(makeView(800, 400, 0, 1700).width).toBeLessThan(1700)
    const portrait = makeView(390, 780, 0, 1400)
    expect(portrait.width).toBeCloseTo(800)
    // たて画面でも 地面は 画面の 中に ある。
    expect(GROUND_Y).toBeLessThan(portrait.top + portrait.height * .8)
  })
  test('the view never shows past the ends of the stage', () => {
    expect(clampCenter(-500, 600, 1400)).toBe(300)
    expect(clampCenter(5000, 600, 1400)).toBe(1100)
    expect(clampCenter(700, 2000, 1400)).toBe(700)
  })
  test('toWorld undoes the view transform and follow eases toward the target', () => {
    const view = makeView(900, 500, 700, 1500)
    const p = toWorld(view, 450, 250)
    expect(p.x).toBeCloseTo(view.left + 450 / view.scale)
    expect(p.y).toBeCloseTo(view.top + 250 / view.scale)
    expect(follow(0, 100, 0)).toBe(0)
    expect(follow(0, 100, 1)).toBeGreaterThan(0)
    expect(follow(0, 100, 1000)).toBeCloseTo(100)
    expect(viewScale(0, 500, 1400)).toBe(1)
  })
})
