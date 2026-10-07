import { describe, expect, test } from 'vitest'
import type { Mood, Speaker } from './dialogue'
import { drawConversation, drawPortrait } from './portraits'

/** Records every filled pixel so faces can be compared without a real canvas. */
function recorder() {
  const fills: string[] = []
  const ctx = {
    fillStyle: '',
    imageSmoothingEnabled: true,
    fillRect(x: number, y: number, w: number, h: number) { fills.push(`${String(ctx.fillStyle)} ${x},${y} ${w}x${h}`) },
    save() {}, restore() {}, translate() {}, scale() {},
  }
  return { ctx: ctx as unknown as CanvasRenderingContext2D, fills }
}

const SPEAKERS: readonly Speaker[] = ['fox', 'owl', 'squirrel', 'rabbit', 'bear']
const MOODS: readonly Mood[] = ['normal', 'happy', 'surprised', 'worried']

function portrait(who: Speaker, mood: Mood, pose: Partial<{ blink: boolean; talking: boolean; dim: boolean }> = {}) {
  const { ctx, fills } = recorder()
  drawPortrait(ctx, who, mood, { blink: false, talking: false, dim: false, time: 0, ...pose })
  return fills
}

describe('ドット絵の かお', () => {
  test.each(SPEAKERS)('%s は 表情ごとに ちがう顔になり、まばたきと 口パクもする', (who) => {
    const faces = MOODS.map((mood) => portrait(who, mood).join('|'))
    expect(new Set(faces).size).toBe(MOODS.length)
    expect(portrait(who, 'normal', { blink: true })).not.toEqual(portrait(who, 'normal'))
    expect(portrait(who, 'normal', { talking: true })).not.toEqual(portrait(who, 'normal'))
    // Everything lands on whole pixels inside the 40×40 portrait.
    for (const fill of portrait(who, 'happy', { talking: true })) {
      const [, at, size] = fill.split(' ')
      const [x, y] = at.split(',').map(Number)
      const [w, h] = size.split('x').map(Number)
      for (const value of [x, y, w, h]) expect(Number.isInteger(value)).toBe(true)
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x + w).toBeLessThanOrEqual(40)
      expect(y + h).toBeLessThanOrEqual(40)
    }
  })

  test('聞いている人は 少し暗くなる', () => {
    const bright = portrait('bear', 'normal').map((fill) => fill.split(' ')[0])
    const dim = portrait('bear', 'normal', { dim: true }).map((fill) => fill.split(' ')[0])
    expect(dim).toHaveLength(bright.length)
    expect(dim.filter((color, index) => color !== bright[index]).length).toBe(dim.length)
    expect(dim.every((color) => /^#[0-9a-f]{6}$/.test(color))).toBe(true)
  })

  test.each(['spring', 'summer', 'dusk'] as const)('%s の会話の場面を 動きを減らしても描ける', (season) => {
    for (const reducedMotion of [false, true]) {
      const { ctx, fills } = recorder()
      drawConversation(ctx, {
        season, partner: 'owl', speaker: 'fox', time: 12.3, talking: true, reducedMotion,
        moods: { fox: 'happy', owl: 'worried', squirrel: 'normal', rabbit: 'normal', bear: 'normal' },
      })
      expect(fills.length).toBeGreaterThan(300)
    }
  })
})
