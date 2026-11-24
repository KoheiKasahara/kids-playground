import { describe, expect, test } from 'vitest'
import {
  activityOf, animalById, command, createZoo, dropFood, homeOfAnimal, pickWanderTarget, setVisitor, stepZoo, wrapAngle,
  type ZooEvent, type ZooWorld,
} from './behavior'
import { locomotionOf } from './motion'
import { SPECIES, SPECIES_ORDER, type SpeciesId } from './species'
import { AREAS, distance, homeOf, obstaclesOf, roamRadius, type Area } from './zooMap'

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

function worldOf(species: SpeciesId, random: () => number): ZooWorld {
  return createZoo(homeOf(species).area, random)
}

function checkInside(world: ZooWorld) {
  for (const a of world.animals) {
    const { enclosure, obstacles } = homeOfAnimal(world, a)
    expect(distance(a, enclosure.center), `${a.id} が柵の外`).toBeLessThanOrEqual(roamRadius(enclosure) - a.front * 0.9 + 1e-6)
    for (const o of obstacles) expect(distance(a, o), `${a.id} が障害物の中`).toBeGreaterThan(o.r + a.radius * 0.85 - 1e-6)
  }
  for (const a of world.animals) {
    for (const b of world.animals) {
      if (a !== b && a.enclosure === b.enclosure) expect(distance(a, b)).toBeGreaterThan((a.radius + b.radius) * 0.75)
    }
  }
}

const pondActions = SPECIES_ORDER.flatMap(id =>
  SPECIES[id].specials.filter(s => s.atPond).map(({ clip }) => ({ id, clip })),
)

describe('どうぶつの ふるまい', () => {
  test.each(AREAS)('$name: 動物はそれぞれの展示場の中に生まれ、障害物の中にいない', (area: Area) => {
    const world = createZoo(area, seeded(1))
    const species = new Set(world.animals.map(a => a.species))
    expect([...species].sort()).toEqual(area.enclosures.flatMap(e => e.species).sort())
    for (const a of world.animals) {
      const { enclosure } = homeOfAnimal(world, a)
      expect(enclosure.species).toContain(a.species)
      expect(distance(a, enclosure.center)).toBeLessThan(roamRadius(enclosure))
      for (const o of obstaclesOf(enclosure)) expect(distance(a, o)).toBeGreaterThanOrEqual(o.r)
    }
  })

  test.each(AREAS)('$name: 長く歩き回っても、柵の外へ出ず、障害物にも仲間にもめり込まない', (area: Area) => {
    const random = seeded(7)
    const world = createZoo(area, random)
    for (let i = 0; i < 4000; i++) {
      stepZoo(world, 1 / 30, random)
      checkInside(world)
    }
  }, 60_000)

  test('サバンナでは、ちがう種類の動物もおたがいをよけて暮らす', () => {
    const random = seeded(17)
    const world = worldOf('giraffe', random)
    const plains = world.animals.filter(a => a.enclosure === homeOf('giraffe').enclosure.id)
    expect(new Set(plains.map(a => a.species)).size).toBeGreaterThanOrEqual(3)
    for (let i = 0; i < 3000; i++) {
      stepZoo(world, 1 / 30, random)
      for (const a of plains) {
        for (const b of plains) if (a !== b) expect(distance(a, b)).toBeGreaterThan((a.radius + b.radius) * 0.75)
      }
    }
  })

  test('向きは旋回の速さの上限を超えて変わらない（瞬間的に向きを変えない）', () => {
    const random = seeded(3)
    const world = worldOf('elephant', random)
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
    const world = worldOf('rabbit', random)
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

  test('ボタンを押さなくても、自分で 歩く・食べる・とくいわざ・ねる をひととおり行う', () => {
    const random = seeded(5)
    const seen = new Set<string>()
    const specials = new Set<string>()
    for (const area of AREAS) {
      const world = createZoo(area, random)
      for (let i = 0; i < 30 * 300; i++) {
        for (const e of stepZoo(world, 1 / 30, random)) if (e.type === 'special') specials.add(`${animalById(world, e.animal)!.species}:${e.clip}`)
        for (const a of world.animals) seen.add(a.clip)
      }
    }
    for (const clip of ['Idle', 'Walk', 'Run', 'Eat', 'LieDown', 'Sleep', 'GetUp']) expect(seen).toContain(clip)
    expect([...seen].some(c => c === 'TurnLeft' || c === 'TurnRight')).toBe(true)
    // 観察して見つけられるよう、5分見ていれば、多くの動物が自分でとくいわざを見せる
    const showed = new Set([...specials].map(s => s.split(':')[0]))
    expect(showed.size).toBeGreaterThan(SPECIES_ORDER.length * 0.8)
  }, 60_000)

  test('子どもは親からはなれすぎず、親のそばへ戻ってくる', () => {
    const random = seeded(31)
    const world = worldOf('elephant', random)
    const baby = world.animals.find(a => a.id === 'elephant-baby')!
    const mom = world.animals.find(a => a.id === 'elephant-mom')!
    expect(baby.parent).toBe(mom.id)
    let far = 0
    let frames = 0
    for (let i = 0; i < 30 * 240; i++) {
      stepZoo(world, 1 / 30, random)
      frames += 1
      if (distance(baby, mom) > 6) far += 1
    }
    // ほとんどの時間、親の近くにいる
    expect(far / frames).toBeLessThan(0.25)
  })

  test('えさを あげると、歩いて行って食べ、そのあと喜ぶ', () => {
    const random = seeded(21)
    const world = worldOf('elephant', random)
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

  test('柵の外から投げ入れたえさは、柵の内側の人に近い所に落ち、食べたあとはお礼にとくいわざを見せることがある', () => {
    let thanks = 0
    for (let seed = 1; seed <= 12; seed++) {
      const random = seeded(seed)
      const world = worldOf('tiger', random)
      const { enclosure } = homeOfAnimal(world, animalById(world, 'tiger-mom')!)
      const visitor = { x: enclosure.center.x + Math.sin(enclosure.front) * (enclosure.radius + 1), z: enclosure.center.z + Math.cos(enclosure.front) * (enclosure.radius + 1) }
      const food = dropFood(world, 'tiger-mom', random, visitor)!
      expect(distance(food, enclosure.center)).toBeLessThan(roamRadius(enclosure))
      expect(distance(food, visitor)).toBeLessThan(enclosure.radius + 1.5)
      const { events } = run(world, 40, random)
      expect(events.some(e => e.type === 'eat' && e.animal === 'tiger-mom')).toBe(true)
      const happy = events.findIndex(e => e.type === 'happy' && e.animal === 'tiger-mom')
      if (events.slice(happy).some(e => e.type === 'special' && e.animal === 'tiger-mom')) thanks += 1
    }
    expect(thanks).toBeGreaterThan(1)
  })

  test('ねている動物に えさをあげると、起きてから食べに行く', () => {
    const random = seeded(4)
    const world = worldOf('lion', random)
    const a = world.animals[0]
    command(world, a.id, { kind: 'sleep' }, random)
    run(world, 6, random)
    expect(animalById(world, a.id)!.mode).toBe('sleep')
    expect(activityOf(a)).toBe('sleep')
    dropFood(world, a.id, random)
    const { events } = run(world, 45, random)
    expect(events.some(e => e.type === 'wake' && e.animal === a.id)).toBe(true)
    expect(events.some(e => e.type === 'eat' && e.animal === a.id)).toBe(true)
  })

  test('柵の前に人がいると、見に来る動物がいる', () => {
    const random = seeded(8)
    const world = worldOf('giraffe', random)
    const { enclosure } = homeOfAnimal(world, world.animals[0])
    const visitor = { x: enclosure.center.x + Math.sin(enclosure.front) * (enclosure.radius + 1.2), z: enclosure.center.z + Math.cos(enclosure.front) * (enclosure.radius + 1.2) }
    setVisitor(world, visitor)
    const { events } = run(world, 120, random)
    const visits = events.filter(e => e.type === 'visit')
    expect(visits.length).toBeGreaterThan(0)
    for (const v of visits) {
      const a = animalById(world, v.animal)!
      expect(a.enclosure).toBe(enclosure.id)
    }
  })

  test('ふれあい広場では、中に入った人をよけて歩く', () => {
    const random = seeded(12)
    const world = worldOf('rabbit', random)
    const { enclosure } = homeOf('rabbit')
    const visitor = { x: enclosure.center.x, z: enclosure.center.z + 2 }
    setVisitor(world, visitor)
    for (let i = 0; i < 30 * 60; i++) {
      stepZoo(world, 1 / 30, random)
      for (const a of world.animals.filter(x => x.enclosure === enclosure.id)) expect(distance(a, visitor)).toBeGreaterThan(0.45)
    }
  })

  test('アクション（固有の動き）を指示すると、その動きをする', () => {
    for (const id of SPECIES_ORDER) {
      for (const spec of SPECIES[id].specials) {
        const random = seeded(9)
        const world = worldOf(id, random)
        const a = world.animals.find(x => x.species === id)!
        command(world, a.id, { kind: 'special', clip: spec.clip }, random)
        const { events } = run(world, 30, random)
        expect(events, `${id} の ${spec.clip}`).toContainEqual({ type: 'special', animal: a.id, clip: spec.clip })
      }
    }
  }, 60_000)

  test.each(pondActions)('池で見せるアクションは、仲間が行く手をふさいでいても始まる（$id / $clip）', ({ id, clip }) => {
    const dt = 1 / 30
    for (let seed = 1; seed <= 20; seed++) {
      const random = seeded(seed)
      const world = worldOf(id, random)
      const animals = world.animals.filter(a => a.species === id)
      expect(animals.length, `${id}（seed ${seed}）の対象個体`).toBeGreaterThan(0)
      for (const [index, a] of animals.entries()) {
        command(world, a.id, { kind: 'special', clip }, random)
        let started = false
        for (let t = 0; t < 30; t += dt) {
          const events = stepZoo(world, dt, random)
          started ||= events.some(e => e.type === 'special' && e.animal === a.id && e.clip === clip)
          // 次の個体がいる場合は、30秒進めてワールドと乱数の状態を引き継ぐ。
          if (started && index === animals.length - 1) break
        }
        expect(started, `${a.id} の ${clip}（seed ${seed}）`).toBe(true)
      }
    }
  })

  test('歩き回る目的地は、まっすぐ歩いて障害物に当たらない場所を選ぶ', () => {
    const random = seeded(13)
    for (const area of AREAS) {
      const world = createZoo(area, random)
      for (const a of world.animals) {
        const { enclosure, obstacles } = homeOfAnimal(world, a)
        for (let i = 0; i < 20; i++) {
          const p = pickWanderTarget(world, a, random)
          if (!p) continue
          expect(distance(p, enclosure.center)).toBeLessThan(roamRadius(enclosure))
          for (const o of obstacles) expect(distance(p, o)).toBeGreaterThan(o.r)
        }
      }
    }
  })
})
