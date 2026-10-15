import { describe, expect, test } from 'vitest'
import { FISH } from './fishingGame'
import {
  HOOK_BOUNDS, LURE_AFTER_SEC, MOUTH_OFFSET, SWIM_BOUNDS, createPond, lureNearest, setHookTarget, stepPond, syncPond,
  type Pond, type StepInput,
} from './pondSim'

/** 再現できる疑似乱数。 */
function seeded(seed = 1) {
  let value = seed
  return () => {
    value = (value * 16807) % 2147483647
    return (value - 1) / 2147483646
  }
}

const FISHING: StepInput = { active: true, hookedId: null, progress: 0 }
const DT = 1 / 60

function runUntilBite(pond: Pond, seconds: number, random = seeded()) {
  for (let t = 0; t < seconds; t += DT) {
    const bite = stepPond(pond, DT, FISHING, random)
    if (bite) return { bite, at: t }
  }
  return null
}

describe('pondSim', () => {
  test('釣っていない魚だけが海の中を泳ぎ、範囲の外へ出ない', () => {
    const random = seeded(7)
    const pond = createPond(['clownfish', 'tang'], random)
    expect(pond.fish.map((fish) => fish.id)).toEqual(FISH.slice(2).map((fish) => fish.id))
    for (let i = 0; i < 60 * 40; i++) stepPond(pond, DT, { active: false, hookedId: null, progress: 0 }, random)
    for (const fish of pond.fish) {
      expect(fish.mode).toBe('swim')
      expect(fish.x).toBeGreaterThanOrEqual(SWIM_BOUNDS.minX)
      expect(fish.x).toBeLessThanOrEqual(SWIM_BOUNDS.maxX)
      expect(fish.y).toBeGreaterThan(SWIM_BOUNDS.minY - 4)
      expect(fish.y).toBeLessThan(SWIM_BOUNDS.maxY + 4)
    }
  })

  test('針は海の中だけを、指を追いかけてなめらかに動く', () => {
    const pond = createPond([], seeded())
    setHookTarget(pond, { x: -50, y: 5 })
    expect(pond.target).toEqual({ x: HOOK_BOUNDS.minX, y: HOOK_BOUNDS.minY })
    const start = { ...pond.hook }
    const idle: StepInput = { ...FISHING, active: false }
    stepPond(pond, DT, idle, seeded())
    expect(pond.hook.x).toBeLessThan(start.x)
    expect(pond.hook.x).toBeGreaterThan(pond.target.x)
    for (let i = 0; i < 180; i++) stepPond(pond, DT, idle, seeded())
    expect(pond.hook).toEqual(pond.target)
  })

  test('針を魚の近くへ動かすと、その魚が寄ってきて食いつく', () => {
    const random = seeded(3)
    const pond = createPond([], random)
    const target = pond.fish.find((fish) => fish.id === 'puffer')!
    setHookTarget(pond, { x: target.x + target.dir * (MOUTH_OFFSET + 4), y: target.y })
    const result = runUntilBite(pond, 6, random)
    expect(result).not.toBeNull()
    expect(result!.at).toBeLessThan(LURE_AFTER_SEC)
    expect(pond.fish.filter((fish) => fish.mode === 'hooked')).toHaveLength(1)
  })

  test('針を動かさなくても、しばらくすると近くの魚が自分から寄ってくる', () => {
    const random = seeded(11)
    const pond = createPond([], random)
    // 誰も自分からは気づかない状態で待つ。
    for (const fish of pond.fish) fish.cooldown = 999
    const result = runUntilBite(pond, LURE_AFTER_SEC + 20, random)
    expect(result).not.toBeNull()
    expect(result!.at).toBeGreaterThanOrEqual(LURE_AFTER_SEC - DT)
  })

  test('えさを揺らすと遠くの魚でも呼べ、同時に2匹は寄らない', () => {
    const pond = createPond([], seeded())
    expect(lureNearest(pond)).toBe(true)
    expect(lureNearest(pond)).toBe(false)
    expect(pond.fish.filter((fish) => fish.mode === 'approach')).toHaveLength(1)
  })

  test('かかった魚は進み具合に合わせて水面へ上がり、逃げると泳ぎ去る', () => {
    const random = seeded(5)
    const pond = createPond([], random)
    lureNearest(pond)
    const result = runUntilBite(pond, 30, random)!
    const fish = pond.fish.find((entry) => entry.id === result.bite)!
    const depth = fish.y
    for (let i = 0; i < 60; i++) stepPond(pond, DT, { active: false, hookedId: fish.id, progress: 0.8 }, random)
    expect(fish.y).toBeLessThan(depth - 5)
    expect(fish.mode).toBe('hooked')
    syncPond(pond, [], null)
    expect(fish.mode).toBe('flee')
    expect(fish.cooldown).toBeGreaterThan(0)
    syncPond(pond, [fish.id], null)
    expect(pond.fish.some((entry) => entry.id === fish.id)).toBe(false)
  })
})
