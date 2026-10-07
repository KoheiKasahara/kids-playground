import { describe, expect, test } from 'vitest'
import { createEffects, EFFECT_SECONDS, type Effect } from './effects'
import { createWorld, getObjective, interact, STAGES, targetPoi, updateWorld } from './model'
import { drawScene } from './render'

/** Records every filled rectangle so drawing can be checked without a real canvas. */
function recorder() {
  const fills: string[] = []
  const ctx = {
    fillStyle: '',
    globalAlpha: 1,
    imageSmoothingEnabled: true,
    fillRect() { fills.push(String(ctx.fillStyle)) },
    save() {}, restore() {}, translate() {}, scale() {}, drawImage() {},
  }
  return { ctx: ctx as unknown as CanvasRenderingContext2D, fills }
}

function playStage(index: number) {
  const world = createWorld(index)
  const effects: Effect[] = []
  for (let step = 0; !world.completed && step < 20; step += 1) {
    targetPoi(world, getObjective(world).targetId!)
    for (let frame = 0; world.path.length > 0 && frame < 1000; frame += 1) updateWorld(world, 0.1)
    effects.push(...createEffects(world, interact(world), step * 10))
  }
  return { world, effects }
}

const PLANK = '#d0a677'

describe('森の描画', () => {
  test.each(STAGES.map((stage, index) => [stage.name, index] as const))('%s の村とすべての演出を最初から最後まで描ける', (_, index) => {
    const { world, effects } = playStage(index)
    expect(world.completed).toBe(true)
    for (const effect of effects) {
      for (let age = 0; age <= EFFECT_SECONDS[effect.kind]; age += 0.1) {
        const { ctx, fills } = recorder()
        expect(() => drawScene(ctx, world, effect.start + age, false, effects)).not.toThrow()
        expect(fills.length).toBeGreaterThan(1000)
      }
    }
  })

  test('橋の板は1枚ずつ置かれ、動きを減らす設定ではすぐに全部そろう', () => {
    const world = createWorld()
    world.flags.bridgeRepaired = true
    const effects = createEffects(world, { type: 'repair', text: '', poiId: 'bridge' }, 5)
    const planks = (time: number, reduced = false, list: readonly Effect[] = effects) => {
      const { ctx, fills } = recorder()
      drawScene(ctx, world, time, reduced, list)
      return fills.filter((color) => color === PLANK).length
    }
    const done = planks(5 + EFFECT_SECONDS.repair + 1)
    expect(planks(5)).toBeLessThan(planks(5.5))
    expect(planks(5.5)).toBeLessThan(done)
    expect(planks(5, true)).toBe(done)
    expect(planks(5, false, [])).toBe(done)
  })

  test('動きを減らす設定では、お祝いの演出を重ねない', () => {
    const { world, effects } = playStage(1)
    const last = effects.at(-1)!
    const count = (list: readonly Effect[], reduced: boolean) => {
      const { ctx, fills } = recorder()
      drawScene(ctx, world, last.start + 0.6, reduced, list)
      return fills.length
    }
    expect(count(effects, false)).toBeGreaterThan(count([], false))
    expect(count(effects, true)).toBe(count([], true))
  })
})
