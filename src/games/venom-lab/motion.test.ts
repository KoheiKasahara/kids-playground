import { describe, expect, test } from 'vitest'
import { SPECIES } from './data'
import { actSeconds, createActor, frameAt, profileOf, SIGNATURE_MOVES, stepActor, triggerAct } from './motion'
import { renderFrame, rgbaOf } from './sprite'
import type { Pose } from './pose'

/** くらべる だけ なので あらい こまかさで かく。 */
const pixels = (s: (typeof SPECIES)[number], pose: Pose) => rgbaOf(renderFrame(s, pose, 1))
const opaqueDiff = (a: Uint8ClampedArray, b: Uint8ClampedArray) => {
  let diff = 0
  for (let k = 0; k < a.length; k += 4) if (a[k] !== b[k] || a[k + 1] !== b[k + 1] || a[k + 2] !== b[k + 2] || a[k + 3] !== b[k + 3]) diff++
  return diff
}

describe('venom lab creature motion', () => {
  test('every creature has its own signature move that visibly changes the sprite', () => {
    expect(Object.keys(SIGNATURE_MOVES).sort()).toEqual(SPECIES.map(s => s.id).sort())
    expect(new Set(Object.values(SIGNATURE_MOVES)).size).toBe(SPECIES.length)
    for (const s of SPECIES) {
      const rest = pixels(s, { clip: 'idle', t: 0 })
      const most = Math.max(...[.3, .4, .5, .6, .7].map(t => opaqueDiff(rest, pixels(s, { clip: 'act', t }))))
      expect(most, s.id).toBeGreaterThan(20)
    }
  })

  test('idle and move loops animate frame by frame', () => {
    for (const s of SPECIES) {
      const p = profileOf(s)
      for (const clip of ['idle', 'move'] as const) {
        const a = pixels(s, { clip, t: 0 })
        const most = Math.max(...[.125, .25, .375, .5, .625].map(t => opaqueDiff(a, pixels(s, { clip, t }))))
        expect(most, `${s.id} ${clip}`).toBeGreaterThan(2)
      }
      expect(p.frames.idle).toBeGreaterThanOrEqual(12)
      expect(p.frames.act).toBeGreaterThanOrEqual(16)
    }
  })

  test('wandering creatures stay near home, face where they go, and return to rest after an act', () => {
    for (const s of SPECIES) {
      const p = profileOf(s)
      const a = createActor(SPECIES.indexOf(s) + 1)
      let moved = false, acted = false
      for (let i = 0; i < 60 * 40; i++) {
        stepActor(a, p, 1 / 60)
        if (a.mode === 'move') {
          moved = true
          if (Math.abs(a.target - a.x) > .01) expect(a.facing, s.id).toBe(a.target < a.x ? 1 : -1)
        }
        if (a.mode === 'act') acted = true
        expect(Math.abs(a.x), s.id).toBeLessThanOrEqual(p.range + p.stride + .01)
        const f = frameAt(a, p)
        expect(f.index, s.id).toBeGreaterThanOrEqual(0)
        expect(f.index, s.id).toBeLessThan(f.count)
      }
      expect(acted, s.id).toBe(true)
      expect(moved, s.id).toBe(p.gait !== 'sit')
      if (p.gait === 'sit') expect(a.x).toBe(0)
    }
  })

  test('a tap starts the signature move at once and it finishes', () => {
    const frog = SPECIES.find(s => s.id === 'golden-frog')!
    const p = profileOf(frog)
    expect(p.gait).toBe('hop')
    const a = createActor(3)
    triggerAct(a)
    expect(frameAt(a, p)).toEqual({ clip: 'act', index: 0, count: p.frames.act })
    for (let t = 0; t < actSeconds(p) + .2; t += .05) stepActor(a, p, .05)
    expect(a.mode).toBe('idle')
  })

  test('hops land back on the ground', () => {
    const p = profileOf(SPECIES.find(s => s.id === 'blue-frog')!)
    const a = createActor(9)
    let flew = false
    for (let i = 0; i < 60 * 30; i++) {
      stepActor(a, p, 1 / 60)
      if (a.y > 3) flew = true
      if (a.mode !== 'move') expect(a.y).toBe(0)
    }
    expect(flew).toBe(true)
  })
})
