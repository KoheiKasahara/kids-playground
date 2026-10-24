import { describe, expect, test } from 'vitest'
import { createBattle } from './battle'
import { fighterMotion } from './motion'
import { spriteRotation, stageDots, viewSize, ZOOM } from './render'
import { SPECIES } from './species'
import { STAGES } from './stages'
import type { Technique } from './techniques'

describe('ドットの キャンバスの 大きさ', () => {
  test.each(STAGES.map(stage => [stage.id, stage] as const))('%s: どんな 画面でも カメラの まどが ぜんぶ はいる', (_id, stage) => {
    const dots = stageDots(stage)
    expect(dots.w).toBe(Math.round(stage.viewW * ZOOM))
    for (const [w, h, dpr] of [[844, 390, 3], [852, 393, 2], [640, 360, 1], [1280, 720, 1], [390, 844, 3], [1024, 768, 2]]) {
      const view = viewSize(w, h, dpr, dots.w, dots.h)
      expect(view.w, `${w}x${h}@${dpr}`).toBeGreaterThanOrEqual(dots.w - 1)
      expect(view.h, `${w}x${h}@${dpr}`).toBeGreaterThanOrEqual(dots.h - 1)
      // キャンバスを はみださずに うめる。
      expect(view.w * view.scale).toBeGreaterThanOrEqual(view.dw - view.scale)
    }
  })

  test('こまかい 画面では せいすうばいで くっきり、よこむきの スマホでは むしが 大きく みえる', () => {
    const dots = stageDots(STAGES[0])
    const view = viewSize(844, 390, 3, dots.w, dots.h)
    expect(Number.isInteger(view.scale)).toBe(true)
    // 1ドットが CSS で 2px いじょうに なる（むしの 絵が 大きい）。
    expect(view.scale / 3).toBeGreaterThanOrEqual(2)
  })
})

describe('ドット絵の かたむき', () => {
  test.each(['charge', 'rush', 'lift'] as Technique[])('%s: 小さな かたむきが 描画の ときに きえない', move => {
    const f = createBattle(SPECIES[0], SPECIES[1], 'branch', 1).f[0]
    f.state = 'strike'; f.move = move; f.t = .02
    const m = fighterMotion(f)
    const lean = -m.pitch * Math.cos(f.heading) * Math.cos(STAGES[0].elevation)
    const rot = spriteRotation(f.pose.spin, lean)
    expect(Math.abs(rot)).toBeGreaterThan(0)
    expect(Math.sign(rot)).toBe(Math.sign(lean))
    expect(Math.abs(rot - lean)).toBeLessThan(.025)
  })

  test('なげられた 回転の コマは たもち、かたむきだけを こまかく たす', () => {
    expect(spriteRotation(.1, 0)).toBe(0)
    expect(spriteRotation(.4, 0)).toBeCloseTo(Math.PI / 8)
    expect(spriteRotation(.4, .08)).toBeGreaterThan(spriteRotation(.4, 0))
    expect(spriteRotation(-.4, -.08)).toBeCloseTo(-spriteRotation(.4, .08))
  })
})
