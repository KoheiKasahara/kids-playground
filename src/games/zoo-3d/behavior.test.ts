import { describe, expect, test } from 'vitest'
import { animalById, command, createZoo, dropFood, pickWanderTarget, stepZoo, wrapAngle, type ZooEvent, type ZooWorld } from './behavior'
import { locomotionOf } from './motion'
import { SPECIES, SPECIES_ORDER } from './species'
import { distance, enclosureById, obstaclesOf } from './zooMap'

/** 再現できる疑似乱数（線形合同法）。 */
function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function run(world: ZooWorld, seconds: number, random: () => number, dt = 1 / 30) {
  const events: ZooEvent[] = []
  const trace: { id: string; heading: number; speed: number; mode: string }[][] = []
  for (let t = 0; t < seconds; t += dt) {
    events.push(...stepZoo(world, dt, random))
    trace.push(world.animals.map(a => ({ id: a.id, heading: a.heading, speed: a.speed, mode: a.mode })))
  }
  return { events, trace }
}

describe('どうぶつの ふるまい', () => {
  test('すべての動物が自分のエリアの中に生まれ、障害物の中にいない', () => {
    const world = createZoo(seeded(1))
    expect(world.animals.length).toBeGreaterThanOrEqual(SPECIES_ORDER.length)
    for (const a of world.animals) {
      const enclosure = enclosureById(a.species)
      expect(distance(a, enclosure.center)).toBeLessThan(enclosure.radius)
      for (const o of obstaclesOf(enclosure)) expect(distance(a, o)).toBeGreaterThanOrEqual(o.r)
    }
  })

  test('長く歩き回っても、柵の外へ出ず、障害物にも仲間にもめり込まない', () => {
    const random = seeded(7)
    const world = createZoo(random)
    for (let i = 0; i < 6000; i++) {
      stepZoo(world, 1 / 30, random)
      for (const a of world.animals) {
        const enclosure = enclosureById(a.species)
        expect(distance(a, enclosure.center)).toBeLessThanOrEqual(enclosure.radius - a.front * 0.9 + 1e-6)
        for (const o of obstaclesOf(enclosure)) expect(distance(a, o)).toBeGreaterThan(o.r + a.radius * 0.85 - 1e-6)
      }
      for (const a of world.animals) {
        for (const b of world.animals) {
          if (a !== b && a.species === b.species) expect(distance(a, b)).toBeGreaterThan((a.radius + b.radius) * 0.75)
        }
      }
    }
  })

  test('向きは旋回の速さの上限を超えて変わらない（瞬間的に向きを変えない）', () => {
    const random = seeded(3)
    const world = createZoo(random)
    const { trace } = run(world, 120, random)
    for (const a of world.animals) {
      const lc = locomotionOf(SPECIES[a.species].manifest, a.scale)
      const maxRate = (Math.max(lc.turnSpeed, lc.walkTurn * 1.1) * Math.PI) / 180
      let last = trace[0].find(s => s.id === a.id)!.heading
      for (const frame of trace.slice(1)) {
        const s = frame.find(x => x.id === a.id)!
        expect(Math.abs(wrapAngle(s.heading - last))).toBeLessThanOrEqual(maxRate / 30 + 1e-6)
        last = s.heading
      }
    }
  })

  test('速さは急に変わらず、歩き・走りの速さを超えない', () => {
    const random = seeded(11)
    const world = createZoo(random)
    const { trace } = run(world, 90, random)
    for (const a of world.animals) {
      const lc = locomotionOf(SPECIES[a.species].manifest, a.scale)
      let last = 0
      for (const frame of trace) {
        const s = frame.find(x => x.id === a.id)!
        expect(s.speed).toBeLessThanOrEqual(lc.runSpeed + 1e-6)
        expect(Math.abs(s.speed - last)).toBeLessThanOrEqual(1.6 / 30 + 1e-6)
        last = s.speed
      }
    }
  })

  test('自分で 歩く・食べる・アクション・ねる をひととおり行う', () => {
    const random = seeded(5)
    const world = createZoo(random)
    const seen = new Set<string>()
    for (let i = 0; i < 30 * 600; i++) {
      stepZoo(world, 1 / 30, random)
      for (const a of world.animals) seen.add(a.clip)
    }
    for (const clip of ['Idle', 'Walk', 'Run', 'Eat', 'LieDown', 'Sleep', 'GetUp']) expect(seen).toContain(clip)
    expect([...seen].some(c => c === 'TurnLeft' || c === 'TurnRight')).toBe(true)
  })

  test('えさを あげると、歩いて行って食べ、そのあと喜ぶ', () => {
    const random = seeded(21)
    const world = createZoo(random)
    const a = world.animals[0]
    const food = dropFood(world, a.id, random)!
    expect(food).toBeDefined()
    const events: ZooEvent[] = []
    let ateAt: { x: number; z: number; heading: number } | undefined
    for (let i = 0; i < 40 * 30; i++) {
      for (const e of stepZoo(world, 1 / 30, random)) {
        events.push(e)
        if (e.type === 'eat' && e.animal === a.id) ateAt = { x: a.x, z: a.z, heading: a.heading }
      }
    }
    const eat = events.find(e => e.type === 'eat' && e.animal === a.id)
    expect(eat).toBeDefined()
    expect(events.findIndex(e => e.type === 'happy' && e.animal === a.id)).toBeGreaterThan(events.indexOf(eat!))
    expect(world.foods.find(f => f.id === food.id)).toBeUndefined()
    // 食べたとき、えさは顔の正面・鼻の届く距離にあった
    const reach = SPECIES[a.species].reach * a.scale
    expect(Math.abs(distance(ateAt!, food) - reach)).toBeLessThan(0.35)
    expect(Math.abs(wrapAngle(Math.atan2(food.x - ateAt!.x, food.z - ateAt!.z) - ateAt!.heading))).toBeLessThan(0.2)
  })

  test('ねている動物に えさをあげると、起きてから食べに行く', () => {
    const random = seeded(4)
    const world = createZoo(random)
    const a = world.animals[0]
    command(world, a.id, { kind: 'sleep' }, random)
    run(world, 6, random)
    expect(animalById(world, a.id)!.mode).toBe('sleep')
    dropFood(world, a.id, random)
    const { events } = run(world, 45, random)
    expect(events.some(e => e.type === 'wake' && e.animal === a.id)).toBe(true)
    expect(events.some(e => e.type === 'eat' && e.animal === a.id)).toBe(true)
  })

  test('アクション（固有の動き）を指示すると、その動きをする', () => {
    for (const id of SPECIES_ORDER) {
      for (const spec of SPECIES[id].specials) {
        const random = seeded(9)
        const world = createZoo(random)
        const a = world.animals.find(x => x.species === id)!
        command(world, a.id, { kind: 'special', clip: spec.clip }, random)
        const { events } = run(world, 30, random)
        expect(events, `${id} の ${spec.clip}`).toContainEqual({ type: 'special', animal: a.id, clip: spec.clip })
      }
    }
  })

  test('池で見せるアクションは、仲間が行く手をふさいでいても、しばらく待てば始まる', () => {
    for (const id of SPECIES_ORDER) {
      for (const spec of SPECIES[id].specials.filter(s => s.atPond)) {
        for (let seed = 1; seed <= 20; seed++) {
          const random = seeded(seed)
          const world = createZoo(random)
          for (const a of world.animals.filter(x => x.species === id)) {
            command(world, a.id, { kind: 'special', clip: spec.clip }, random)
            const { events } = run(world, 30, random)
            expect(events, `${a.id} の ${spec.clip}（seed ${seed}）`).toContainEqual({ type: 'special', animal: a.id, clip: spec.clip })
          }
        }
      }
    }
  })

  test('歩き回る目的地は、まっすぐ歩いて障害物に当たらない場所を選ぶ', () => {
    const random = seeded(13)
    const world = createZoo(random)
    for (const a of world.animals) {
      for (let i = 0; i < 40; i++) {
        const p = pickWanderTarget(world, a, random)
        const enclosure = enclosureById(a.species)
        expect(distance(p, enclosure.center)).toBeLessThan(enclosure.radius)
        for (const o of obstaclesOf(enclosure)) expect(distance(p, o)).toBeGreaterThan(o.r)
      }
    }
  })
})
