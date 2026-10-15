import { describe, expect, test } from 'vitest'
import { FISH } from './fishingGame'
import {
  CAST_SETTLE_SEC, HOOK_BOUNDS, LURE_AFTER_SEC, MAX_REFUSALS, MOUTH_OFFSET, NIBBLE_SEC, SURFACE_Y, SWIM_BOUNDS,
  castHook, createPond, lureNearest, setHookTarget, stepPond, syncPond,
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

/** 食いつく・戻っていくの抽選を外し、必ず食いつかせる。 */
function eager(pond: Pond) {
  for (const fish of pond.fish) fish.refusals = MAX_REFUSALS
  return pond
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
    const pond = eager(createPond([], seeded(3)))
    const target = pond.fish.find((fish) => fish.id === 'puffer')!
    setHookTarget(pond, { x: target.x + target.dir * (MOUTH_OFFSET + 4), y: target.y })
    // 気づく抽選はいつも当たりにする。
    const result = runUntilBite(pond, LURE_AFTER_SEC, () => 0)
    expect(result).not.toBeNull()
    expect(result!.at).toBeLessThan(LURE_AFTER_SEC)
    // つんつんしてから食いつくまで、少し間がある。
    expect(result!.at).toBeGreaterThan(NIBBLE_SEC)
    expect(pond.fish.filter((fish) => fish.mode === 'hooked')).toHaveLength(1)
  })

  test('近くまで来ても食いつかずに戻っていく魚がいて、何度か戻ると次は必ず食いつく', () => {
    const pond = createPond([], seeded(2))
    const never = () => 0.99
    expect(lureNearest(pond, never, 0.5)).toBe(true)
    const fish = pond.fish.find((entry) => entry.mode === 'approach')!
    expect(fish.willBite).toBe(false)
    let inspected = false
    for (let i = 0; i < 60 * 30 && fish.mode !== 'swim'; i++) {
      expect(stepPond(pond, DT, FISHING, never)).toBeNull()
      if (fish.mode === 'inspect') inspected = true
    }
    expect(inspected).toBe(true)
    expect(fish.mode).toBe('swim')
    expect(fish.refusals).toBe(1)
    expect(pond.time - pond.leftAt).toBeLessThan(0.1)
    fish.refusals = MAX_REFUSALS
    for (const other of pond.fish) if (other !== fish) other.mode = 'flee'
    expect(lureNearest(pond, never, 0)).toBe(true)
    expect(fish.willBite).toBe(true)
  })

  test('糸を投げ込むと、うきは水面から沈み、しばらく魚は寄ってこない', () => {
    const random = seeded(4)
    const pond = createPond([], random)
    castHook(pond, { x: 30, y: 70 })
    expect(pond.hook).toEqual({ x: 30, y: SURFACE_Y + 2 })
    expect(pond.target).toEqual({ x: 30, y: 70 })
    for (const fish of pond.fish) expect(fish.cooldown).toBeGreaterThanOrEqual(CAST_SETTLE_SEC)
    for (let t = 0; t < CAST_SETTLE_SEC - 0.1; t += DT) stepPond(pond, DT, FISHING, random)
    expect(pond.fish.every((fish) => fish.mode === 'swim')).toBe(true)
    expect(pond.hook.y).toBeCloseTo(70, 0)
  })

  test('針を動かさなくても、しばらくすると近くの魚が自分から寄ってくる', () => {
    const random = seeded(11)
    const pond = eager(createPond([], random))
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
    const pond = eager(createPond([], random))
    lureNearest(pond, random)
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
