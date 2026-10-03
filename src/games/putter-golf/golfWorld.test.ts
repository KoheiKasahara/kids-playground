import { beforeAll, describe, expect, it } from 'vitest'
import { initializeRapier } from '../../physics/rapierLoader'
import { GOLF_COURSES, type CourseDefinition, type HoleDefinition } from './golfCourses'
import { buildHoleGeometry } from './golfGeometry'
import { BALL_RADIUS, rollDistance, rollingDecel, shotSpeed, SWITCH, TRAMPOLINE, trampolineFlight, trampolineVelocity } from './golfPhysics'
import { createGolfWorld, type GolfEvent, type GolfWorld } from './golfWorld'

beforeAll(async () => { await initializeRapier() })

const [MEADOW, BEACH, MOON] = GOLF_COURSES as [CourseDefinition, CourseDefinition, CourseDefinition]
const courseById = (id: string) => GOLF_COURSES.find(course => course.id === id)!
const FOREST = courseById('forest')
const DOWNHILL = courseById('downhill')
const RIVER = courseById('river')
const CANYON = courseById('canyon')
const FACTORY = courseById('factory')
const SKY = courseById('sky')
const holeById = (id: string) => GOLF_COURSES.flatMap(course => course.holes).find(hole => hole.id === id)!

function open(course: CourseDefinition, hole: HoleDefinition): GolfWorld {
  return createGolfWorld(course, hole, buildHoleGeometry(hole))
}

/** 止まる・入る・落ちるまで進め、そのあいだの出来事を返す。 */
function roll(world: GolfWorld, onStep?: () => void): GolfEvent[] {
  const events: GolfEvent[] = []
  for (let i = 0; i < 120 * 25 && world.phase === 'rolling'; i++) {
    world.step()
    onStep?.()
    events.push(...world.consumeEvents())
  }
  return events
}

function withWorld<T>(world: GolfWorld, run: (world: GolfWorld) => T): T {
  try { return run(world) } finally { world.dispose() }
}

describe('パターゴルフの物理', () => {
  it('ティーのボールは、うつまで動かない', () => {
    withWorld(open(MEADOW, holeById('meadow-1')), world => {
      const start = world.ball().position
      for (let i = 0; i < 240; i++) world.step()
      expect(world.phase).toBe('ready')
      const now = world.ball().position
      expect(Math.hypot(now.x - start.x, now.y - start.y, now.z - start.z)).toBeLessThan(1e-6)
      expect(start.y).toBeCloseTo(BALL_RADIUS, 2)
    })
  })

  it('平らな芝では、うつ強さの目安どおりの距離を転がって止まる', () => {
    const flat: HoleDefinition = {
      id: 'flat', name: 'flat', par: 1, tee: { x: 0, z: 14 }, cup: { x: 0, z: -14 },
      floors: [{ corners: [{ x: -1.5, z: 15 }, { x: -1.5, z: -15 }, { x: 1.5, z: -15 }, { x: 1.5, z: 15 }] }],
      route: [{ x: 0, z: 14 }, { x: 0, z: -14 }], tip: '',
    }
    for (const power of [0.2, 0.5, 0.8]) {
      withWorld(open(MEADOW, flat), world => {
        expect(world.shoot({ x: 0, z: -1 }, power)).toBe(true)
        // うっている間はもう一度うてない。
        expect(world.shoot({ x: 0, z: -1 }, 1)).toBe(false)
        const events = roll(world)
        expect(world.phase).toBe('ready')
        expect(events.at(-1)?.kind).toBe('rest')
        const travelled = 14 - world.ball().position.z
        expect(travelled / rollDistance(shotSpeed(power), rollingDecel('green', MEADOW.gravity))).toBeCloseTo(1, 1)
        expect(Math.abs(world.ball().position.x)).toBeLessThan(0.01)
      })
    }
  })

  it.each(GOLF_COURSES.flatMap(course => course.holes.map(hole => [hole.id, course, hole] as const)))('%s: おすすめのうち方をくり返すと めやす+2打までに カップインする', (_, course, hole) => {
    withWorld(open(course, hole), world => {
      let strokes = 0
      while (world.phase !== 'holed' && strokes < hole.par + 2) {
        if (world.phase === 'out') world.returnToRest()
        const shot = world.suggestShot()
        expect(world.shoot(shot.direction, shot.power)).toBe(true)
        strokes++
        roll(world)
      }
      expect(world.phase).toBe('holed')
      // カップの底で落ち着く。
      for (let i = 0; i < 120; i++) world.step()
      const ball = world.ball().position
      expect(Math.hypot(ball.x - hole.cup.x, ball.z - hole.cup.z)).toBeLessThan(0.5)
    })
  })

  it('ふうしゃの はねは、うつタイミングしだいで ボールを はじいたり とおしたりする', () => {
    const hole = holeById('meadow-3')
    let blocked = 0
    let passed = 0
    for (let k = 0; k < 30; k++) {
      withWorld(open(MEADOW, hole), world => {
        for (let i = 0; i < k * 6; i++) world.step()
        world.shoot({ x: 0, z: -1 }, 0.62)
        let crossed = false
        const events = roll(world, () => { if (world.ball().position.z < 0.8) crossed = true })
        if (crossed) passed++
        else {
          expect(events.some(event => event.kind === 'windmill')).toBe(true)
          blocked++
        }
      })
    }
    expect(blocked).toBeGreaterThanOrEqual(6)
    expect(passed).toBeGreaterThanOrEqual(12)
  })

  it('うごくカベは、うつタイミングしだいで ボールを とめたり とおしたりする', () => {
    const hole = holeById('moon-4')
    let blocked = 0
    let passed = 0
    // とびらの ひとまわり（およそ7秒）ぜんたいから、うつ時刻を えらぶ。
    for (let k = 0; k < 24; k++) {
      withWorld(open(MOON, hole), world => {
        for (let i = 0; i < k * 36; i++) world.step()
        world.shoot({ x: 0, z: -1 }, 0.62)
        let crossed = false
        const events = roll(world, () => { if (world.ball().position.z < 2.0) crossed = true })
        if (crossed) passed++
        else {
          expect(events.some(event => event.kind === 'gate')).toBe(true)
          blocked++
        }
      })
    }
    expect(blocked).toBeGreaterThanOrEqual(3)
    expect(passed).toBeGreaterThanOrEqual(8)
  })

  it('うごくカベの 通り道に 置いたボールは、カベの 外へ どく', () => {
    const hole = holeById('moon-4')
    withWorld(open(MOON, hole), world => {
      const door = hole.gadgets!.find(gadget => gadget.kind === 'gate')!
      const rest = world.placeBall({ x: 0, z: door.z })
      expect(Math.abs(rest.z - door.z)).toBeGreaterThan(BALL_RADIUS)
      expect(rest.x).toBeCloseTo(0, 5)
    })
  })

  it('どかんに入ると、むこうの どかんから 勢いを のこして 出てくる', () => {
    const hole = holeById('beach-4')
    withWorld(open(BEACH, hole), world => {
      world.placeBall({ x: 0, z: 4.2 })
      world.shoot({ x: 0, z: -1 }, 0.6)
      const events = roll(world)
      const warp = events.find(event => event.kind === 'warp')
      expect(warp).toBeDefined()
      if (warp?.kind !== 'warp') throw new Error('warp')
      expect(Math.hypot(warp.to.x - 2.7, warp.to.z + 1.4)).toBeLessThan(0.05)
      // 出たあとも 転がって、むこうの 島で 止まる（すぐ 入口へ 戻らない）。
      const ball = world.ball().position
      expect(ball.x).toBeGreaterThan(1)
      expect(ball.z).toBeLessThan(-1.4)
    })
  })

  it('きに あたると、ボールは はねかえる', () => {
    const hole = holeById('forest-1')
    withWorld(open(FOREST, hole), world => {
      const tree = hole.gadgets!.find(gadget => gadget.kind === 'tree')!
      // きの まうしろから、みきへ まっすぐ うつ。
      world.placeBall({ x: tree.x, z: tree.z + 2.0 })
      world.shoot({ x: 0, z: -1 }, 0.5)
      const events = roll(world)
      const hit = events.find(event => event.kind === 'tree')
      expect(hit?.kind).toBe('tree')
      // みきの 手前で はねかえされ、むこうがわへは 行かない。
      expect(world.ball().position.z).toBeGreaterThan(tree.z + tree.radius)
    })
  })

  it('さかを くだると、同じ強さでも 遠くまで転がり、さかの上では 止まらない', () => {
    const lane = (features?: HoleDefinition['features']): HoleDefinition => ({
      id: 'lane', name: 'lane', par: 1, tee: { x: 0, z: 14 }, cup: { x: 0, z: -14 },
      floors: [{ corners: [{ x: -1.5, z: 15 }, { x: -1.5, z: -15 }, { x: 1.5, z: -15 }, { x: 1.5, z: 15 }] }],
      features, route: [{ x: 0, z: 14 }, { x: 0, z: -14 }], tip: '',
    })
    const travel = (features?: HoleDefinition['features']) => withWorld(open(MEADOW, lane(features)), world => {
      world.shoot({ x: 0, z: -1 }, 0.4)
      roll(world)
      return world.ball().position.z
    })
    const flat = travel()
    const slope = travel([{ kind: 'slope', from: { x: 0, z: 12 }, to: { x: 0, z: 10.8 }, drop: 0.5 }])
    // 0.5 おりたぶんの いきおいで、平らなときより先まで 転がる。
    expect(flat - slope).toBeGreaterThan(1.5)
    // さかの とちゅうでは 止まらない（さかの下まで おりている）。
    expect(slope).toBeLessThan(10.8)
  })

  it('だんさを おりると、ボールが ぴょんと はねる', () => {
    const hole = holeById('downhill-3')
    withWorld(open(DOWNHILL, hole), world => {
      world.shoot({ x: 0, z: -1 }, 0.5)
      const events = roll(world)
      expect(events.map(event => event.kind)).toEqual(expect.arrayContaining(['takeoff', 'land']))
      // だんだんを おりきって、下の ひろばで 止まる。
      expect(world.phase).toBe('ready')
      expect(world.ball().position.y).toBeLessThan(-0.5)
    })
  })

  it('こおりは よく すべり、ふかふかは すぐ止まる', () => {
    const lane = (zones?: HoleDefinition['zones']): HoleDefinition => ({
      id: 'lane', name: 'lane', par: 1, tee: { x: 0, z: 14 }, cup: { x: 0, z: -14 },
      floors: [{ corners: [{ x: -1.5, z: 15 }, { x: -1.5, z: -15 }, { x: 1.5, z: -15 }, { x: 1.5, z: 15 }] }],
      zones, route: [{ x: 0, z: 14 }, { x: 0, z: -14 }], tip: '',
    })
    const travel = (zones?: HoleDefinition['zones']) => withWorld(open(MEADOW, lane(zones)), world => {
      world.shoot({ x: 0, z: -1 }, 0.5)
      const events = roll(world)
      return { distance: 14 - world.ball().position.z, surfaces: events.flatMap(event => (event.kind === 'surface' ? [event.surface] : [])) }
    })
    const plain = travel()
    const ice = travel([{ kind: 'ice', x: 0, z: 10, radius: 3 }])
    const rough = travel([{ kind: 'rough', x: 0, z: 10, radius: 3 }])
    expect(plain.surfaces).toEqual([])
    expect(ice.surfaces).toContain('ice')
    expect(rough.surfaces).toContain('rough')
    expect(ice.distance).toBeGreaterThan(plain.distance * 1.3)
    expect(rough.distance).toBeLessThan(plain.distance * 0.8)
  })

  it('歩く どうぶつに あたると、ボールは はねかえる', () => {
    const hole = holeById('meadow-4')
    withWorld(open(MEADOW, hole), world => {
      // どうぶつの 歩く線の 上から うつ（よけられない ように）。
      const duck = world.motion().critters[0]!
      world.placeBall({ x: 1.5, z: duck.z })
      world.shoot({ x: -1, z: 0 }, 0.4)
      const events = roll(world)
      const hit = events.find(event => event.kind === 'critter')
      expect(hit?.kind).toBe('critter')
      // ぶつかった所より うった がわへ もどされる。
      expect(world.ball().position.x).toBeGreaterThan(hit!.position.x)
    })
  })

  it.each(GOLF_COURSES.flatMap(course => course.holes.map(hole => [hole.id, course, hole] as const)))('%s: みちすじの どの点からも、先の点が見通せる', (_, course, hole) => {
    withWorld(open(course, hole), world => {
      hole.route.slice(0, -1).forEach((point, index) => {
        world.placeBall(point)
        const { target } = world.suggestShot()
        const targetIndex = hole.route.findIndex(item => item.x === target.x && item.z === target.z)
        expect(targetIndex, `${index}ばんめの点から`).toBeGreaterThan(index)
      })
    })
  })

  it('ふうしゃの ホールは、はねに はじかれて柱のかげに止まっても、おすすめで ぬけられる', () => {
    const hole = holeById('meadow-3')
    for (let delay = 0; delay < 12; delay++) {
      withWorld(open(MEADOW, hole), world => {
        let strokes = 0
        while (world.phase !== 'holed' && strokes < 8) {
          // うつ前に待つ時間を毎回かえて、はねの当たり方をいろいろにする。
          for (let i = 0; i < ((delay * 37 + strokes * 23) % 90) + 10; i++) world.step()
          const shot = world.suggestShot()
          world.shoot(shot.direction, shot.power)
          strokes++
          roll(world)
        }
        expect(world.phase, `待ち時間の種 ${delay}`).toBe('holed')
      })
    }
  })

  it('柱のかげからは、トンネルの入口へ戻るように ねらう', () => {
    withWorld(open(MEADOW, holeById('meadow-3')), world => {
      world.placeBall({ x: -1.03, z: 1.24 })
      const shot = world.suggestShot()
      expect(shot.target).toEqual({ x: 0, z: 1.6 })
    })
  })

  it('すなばを通ると、同じ強さでも早く止まる', () => {
    const hole = holeById('beach-1')
    const through = withWorld(open(BEACH, hole), world => {
      world.placeBall({ x: 0.35, z: 2.8 })
      world.shoot({ x: 0, z: -1 }, 0.5)
      const events = roll(world)
      expect(events.some(event => event.kind === 'surface' && event.surface === 'sand')).toBe(true)
      return 2.8 - world.ball().position.z
    })
    const around = withWorld(open(BEACH, hole), world => {
      world.placeBall({ x: -1.4, z: 2.8 })
      world.shoot({ x: 0, z: -1 }, 0.5)
      const events = roll(world)
      expect(events.some(event => event.kind === 'surface')).toBe(false)
      return 2.8 - world.ball().position.z
    })
    expect(through).toBeLessThan(around * 0.7)
  })

  it('バンパーは ゆっくり当たっても ぽよんと はね返す', () => {
    withWorld(open(MEADOW, holeById('meadow-2')), world => {
      world.placeBall({ x: 1.7, z: -1.55 })
      // 0.87 先のバンパーへ、ぎりぎり届くくらいの弱さでうつ。
      world.shoot({ x: 1, z: 0 }, 0.2)
      const events = roll(world)
      expect(events.some(event => event.kind === 'bumper')).toBe(true)
      // 当たる前より遠くまで はね返っている。
      expect(world.ball().position.x).toBeLessThan(1.3)
    })
  })

  it('ジャンプ台: よわいと水に落ちて元の場所へ戻り、つよいと向こう岸へ とぶ', () => {
    const hole = holeById('beach-2')
    withWorld(open(BEACH, hole), world => {
      const tee = world.ball().position
      world.shoot({ x: 0, z: -1 }, 0.6)
      const events = roll(world)
      expect(events.map(event => event.kind)).toEqual(expect.arrayContaining(['takeoff', 'splash']))
      expect(world.phase).toBe('out')
      const back = world.returnToRest()
      expect(world.phase).toBe('ready')
      expect(Math.hypot(back.x - tee.x, back.z - tee.z)).toBeLessThan(1e-6)
    })
    withWorld(open(BEACH, hole), world => {
      world.shoot({ x: 0, z: -1 }, 0.9)
      const events = roll(world)
      expect(events.map(event => event.kind)).toEqual(expect.arrayContaining(['takeoff', 'land']))
      expect(world.phase).toBe('ready')
      expect(world.ball().position.z).toBeLessThan(-0.4)
    })
  })

  it('おつきさまでは 同じこぶでも ボールが長く ふわっと とぶ', () => {
    const hole = holeById('moon-1')
    const airtime = (course: CourseDefinition) => withWorld(open(course, hole), world => {
      const geometry = buildHoleGeometry(hole)
      let air = 0
      world.shoot({ x: 0, z: -1 }, 0.7)
      roll(world, () => {
        const p = world.ball().position
        const ground = geometry.heightAt(p.x, p.z)
        if (ground !== null && p.y - ground - BALL_RADIUS > 0.03) air++
      })
      return air
    })
    expect(airtime(MOON)).toBeGreaterThan(airtime(MEADOW) * 2)
  })

  it('ダッシュパネルに乗ると、弱いうち方でも いきおいよく とびだす', () => {
    withWorld(open(MOON, holeById('moon-3')), world => {
      world.shoot({ x: 0, z: -1 }, 0.4)
      const events = roll(world)
      expect(events.map(event => event.kind)).toEqual(expect.arrayContaining(['boost', 'takeoff', 'land']))
      expect(world.ball().position.z).toBeLessThan(-1.4)
    })
  })

  it('いけに ころがりこむと ぽちゃんと おちて、うつ前の ばしょへ もどる', () => {
    const hole = holeById('river-1')
    withWorld(open(RIVER, hole), world => {
      const start = world.placeBall({ x: 1.2, z: 9.5 })
      world.shoot({ x: 0, z: -1 }, 0.5)
      const events = roll(world)
      const splash = events.find(event => event.kind === 'splash')
      expect(splash).toMatchObject({ kind: 'splash', pond: true })
      expect(world.phase).toBe('out')
      // いけの ふちで おちる（いけの 中まで ころがりつづけない）。
      if (splash?.kind !== 'splash') throw new Error('splash')
      expect(Math.hypot(splash.position.x - 1.2, splash.position.z - 5.0)).toBeLessThan(2.6)
      const back = world.returnToRest()
      expect(Math.hypot(back.x - start.x, back.z - start.z)).toBeLessThan(1e-6)
    })
  })

  it('はしの上は おちずに わたれ、はしを はずすと かわに おちる', () => {
    const hole = holeById('river-2')
    withWorld(open(RIVER, hole), world => {
      world.shoot({ x: 0, z: -1 }, 0.8)
      const events = roll(world)
      expect(events.some(event => event.kind === 'splash')).toBe(false)
      expect(world.phase).toBe('ready')
      // かわ（z = 3.7〜6.3）を こえた むこう岸で 止まる。
      expect(world.ball().position.z).toBeLessThan(3.7)
    })
    withWorld(open(RIVER, hole), world => {
      world.placeBall({ x: 1.0, z: 9.0 })
      world.shoot({ x: 0, z: -1 }, 0.8)
      const events = roll(world)
      expect(events.at(-1)?.kind).toBe('splash')
      expect(world.phase).toBe('out')
    })
  })

  it('ダッシュパネルと ジャンプ台で、かわを とびこえられる', () => {
    const hole = holeById('river-3')
    withWorld(open(RIVER, hole), world => {
      world.placeBall({ x: 2.5, z: 12 })
      world.shoot({ x: 0, z: -1 }, 0.6)
      const events = roll(world)
      expect(events.map(event => event.kind)).toEqual(expect.arrayContaining(['boost', 'takeoff', 'land']))
      expect(events.some(event => event.kind === 'splash')).toBe(false)
      expect(world.phase).toBe('ready')
      expect(world.ball().position.z).toBeLessThan(0)
    })
  })

  it('はねかえし いたに あたると、いきおいを のこして 90ど まがる', () => {
    const hole = holeById('canyon-2')
    withWorld(open(CANYON, hole), world => {
      // ティーから まっすぐ下へ。ふかふかを とおらずに いたで みぎへ まがる。
      world.shoot({ x: 0, z: -1 }, 0.95)
      const events = roll(world)
      expect(events.some(event => event.kind === 'reflector')).toBe(true)
      expect(events.some(event => event.kind === 'surface')).toBe(false)
      const ball = world.ball().position
      expect(ball.x).toBeGreaterThan(-1)
      expect(Math.abs(ball.z + 9.4)).toBeLessThan(0.6)
    })
  })

  it('かべの ない がけの みちから はみだすと、たにへ おちて もどる', () => {
    const hole = holeById('canyon-1')
    withWorld(open(CANYON, hole), world => {
      world.placeBall({ x: 0, z: 3 })
      world.shoot({ x: 1, z: -0.2 }, 0.4)
      const events = roll(world)
      expect(events.at(-1)?.kind).toBe('splash')
      expect(world.phase).toBe('out')
      expect(world.returnToRest().x).toBeCloseTo(0, 5)
    })
  })

  it('おすすめは がけの そとへ はみだす線を えらばない', () => {
    withWorld(open(CANYON, holeById('canyon-3')), world => {
      // ティーから つりばしの むこうは まっすぐ見えるが、ななめに わたると おちるので まず はしの まえへ。
      expect(world.suggestShot().target).toEqual({ x: 0, z: 9.0 })
    })
  })

  it('ベルトコンベアに のると、よわく うっても すぐ ベルトの はやさで はこばれ、つよく うつと もっと とおくまで いく', () => {
    const hole = holeById('factory-1')
    const belt = hole.gadgets!.find(gadget => gadget.kind === 'conveyor')!
    if (belt.kind !== 'conveyor') throw new Error('conveyor')
    const ride = (power: number) => withWorld(open(FACTORY, hole), world => {
      world.placeBall({ x: belt.x - belt.halfLength - 0.6, z: belt.z })
      world.shoot({ x: 1, z: 0 }, power)
      let onBelt: number | null = null
      let time = 0
      const events = roll(world, () => {
        time++
        const ball = world.ball()
        if (onBelt === null && ball.position.x > belt.x) onBelt = Math.hypot(ball.velocity.x, ball.velocity.z)
      })
      return { onBelt: onBelt ?? 0, seconds: time / 120, events, x: world.ball().position.x, phase: world.phase }
    })
    // ベルトに やっと とどくくらいの よわさ。
    const weak = ride(0.12)
    expect(weak.events.some(event => event.kind === 'conveyor')).toBe(true)
    // ベルトの まんなかでは ほぼ ベルトと おなじ はやさで はこばれている。
    expect(Math.abs(weak.onBelt - belt.speed)).toBeLessThan(0.15)
    // ベルトの おわりを こえて、カップの そばまで ころがる。まちくたびれる ほど かからない。
    expect(weak.x).toBeGreaterThan(belt.x + belt.halfLength + 0.8)
    expect(weak.seconds).toBeLessThan(6)
    // つよく うつと、ベルトの はやさに たされて はやく すすみ、もっと とおくまで いく。
    const strong = ride(0.7)
    expect(strong.onBelt).toBeGreaterThan(belt.speed + 0.8)
    if (strong.phase !== 'holed') expect(strong.x).toBeGreaterThan(weak.x)
  })

  it('ベルトに さからって よわく うつと、おしもどされる', () => {
    const hole = holeById('factory-1')
    const belt = hole.gadgets!.find(gadget => gadget.kind === 'conveyor')!
    if (belt.kind !== 'conveyor') throw new Error('conveyor')
    withWorld(open(FACTORY, hole), world => {
      const start = belt.x + belt.halfLength - 0.5
      world.placeBall({ x: start, z: belt.z })
      world.shoot({ x: -1, z: 0 }, 0.3)
      roll(world)
      expect(world.ball().position.x).toBeGreaterThan(start)
    })
  })

  it('シャッターは スイッチを ふむまで とおれず、ふむと ひらいて とおれる', () => {
    const hole = holeById('factory-2')
    const button = hole.gadgets!.find(gadget => gadget.kind === 'switch')!
    if (button.kind !== 'switch') throw new Error('switch')
    withWorld(open(FACTORY, hole), world => {
      // ひらく まえは、おすすめも まず スイッチを ねらう。
      expect(world.suggestShot().target).toEqual({ x: button.x, z: button.z })
      world.placeBall({ x: 0, z: 0.4 })
      world.shoot({ x: 0, z: -1 }, 0.6)
      const blocked = roll(world)
      expect(blocked.some(event => event.kind === 'door')).toBe(true)
      expect(world.ball().position.z).toBeGreaterThan(button.door.z)
      expect(world.motion().doors).toEqual([0])
      // スイッチを ふむ。
      world.placeBall({ x: button.x, z: button.z + 1.2 })
      world.shoot({ x: 0, z: -1 }, 0.25)
      const pressed = roll(world)
      expect(pressed.some(event => event.kind === 'switch')).toBe(true)
      for (let i = 0; i < 120 * SWITCH.openSeconds + 2; i++) world.step()
      expect(world.motion().doors).toEqual([1])
      world.placeBall({ x: 0, z: 0.4 })
      world.shoot({ x: 0, z: -1 }, 0.6)
      roll(world)
      expect(world.phase).toBe('holed')
    })
  })

  it('トランポリンは、のる つよさで とぶ きょりが、のる むきで とぶ むきが かわる', () => {
    const hole = holeById('sky-1')
    const pad = hole.gadgets!.find(gadget => gadget.kind === 'trampoline')!
    if (pad.kind !== 'trampoline') throw new Error('trampoline')
    const jump = (from: { x: number; z: number }, power: number) => withWorld(open(SKY, hole), world => {
      world.placeBall(from)
      world.shoot({ x: pad.x - from.x, z: pad.z - from.z }, power)
      const events = roll(world)
      expect(events.some(event => event.kind === 'trampoline')).toBe(true)
      // とびあがりは ジャンプの できごとに しない。
      expect(events.some(event => event.kind === 'takeoff')).toBe(false)
      const end = events.find(event => event.kind === 'land' || event.kind === 'splash' || event.kind === 'cup')
      expect(end, `${from.x},${from.z} ${power}`).toBeDefined()
      return end!
    })
    const tee = { x: 0, z: 6.4 }
    const soft = jump(tee, 0.7)
    const hard = jump(tee, 0.78)
    expect(soft.kind).toBe('land')
    expect(hard.kind).toBe('land')
    // つよく のるほど とおくへ とぶ。
    expect(hard.position.z).toBeLessThan(soft.position.z - 0.8)
    // ななめに のると、そちらへ それて とぶ（すこしだけ ちゃくちてんの ほうへ まがる）。
    const slanted = jump({ x: -0.5, z: 6.3 }, 0.75)
    expect(slanted.kind).toBe('land')
    expect(slanted.position.x).toBeGreaterThan(pad.to.x + 0.4)
    // おおきく ななめに のると、しまから それて くもの 下へ おちる。
    expect(jump({ x: -1.2, z: 5.6 }, 0.62).kind).toBe('splash')
    // よわすぎると とどかず、くもの 下へ おちる。
    expect(jump(tee, 0.5).kind).toBe('splash')
  })

  it('トランポリンの おすすめの つよさで のると、ちゃくちてんの ちかくに おりる', () => {
    for (const id of ['sky-1', 'sky-2']) {
      const hole = holeById(id)
      withWorld(open(SKY, hole), world => {
        const shot = world.suggestShot()
        const pad = hole.gadgets!.find(gadget => gadget.kind === 'trampoline' && gadget.x === shot.target.x && gadget.z === shot.target.z)!
        if (pad.kind !== 'trampoline') throw new Error('trampoline')
        world.shoot(shot.direction, shot.power)
        const land = roll(world).find(event => event.kind === 'land')
        expect(land, id).toBeDefined()
        expect(Math.hypot(land!.position.x - pad.to.x, land!.position.z - pad.to.z), id).toBeLessThan(0.5)
      })
    }
  })

  it('トランポリンで たかい しまへ のぼり、ぽすっと おりて ころがりすぎない', () => {
    const hole = holeById('sky-2')
    const pad = hole.gadgets!.find(gadget => gadget.kind === 'trampoline')!
    if (pad.kind !== 'trampoline') throw new Error('trampoline')
    withWorld(open(SKY, hole), world => {
      world.placeBall(hole.tee)
      const shot = world.suggestShot()
      world.shoot(shot.direction, shot.power)
      roll(world)
      const ball = world.ball().position
      expect(world.phase).toBe('ready')
      expect(ball.y).toBeGreaterThan(0.9)
      expect(Math.hypot(ball.x - pad.to.x, ball.z - pad.to.z)).toBeLessThan(1.8)
    })
  })

  it('トランポリンから トランポリンへ おりると、いきおいを おとさずに また とぶ', () => {
    const hole = holeById('sky-4')
    withWorld(open(SKY, hole), world => {
      const shot = world.suggestShot()
      world.shoot(shot.direction, shot.power)
      const events = roll(world)
      expect(events.filter(event => event.kind === 'trampoline').map(event => event.kind === 'trampoline' && event.id)).toEqual(['hop-1', 'hop-2'])
      expect(events.some(event => event.kind === 'splash')).toBe(false)
    })
  })

  it('トランポリンの とぶ はやさは、のる はやさの carry ばいで、ちゃくちてんの ほうへ すこしだけ まがる', () => {
    const straight = trampolineVelocity({ x: 0, z: -2 }, { x: 0, z: -1 })
    expect(straight.x).toBeCloseTo(0, 6)
    expect(straight.z).toBeCloseTo(-2 * TRAMPOLINE.carry, 6)
    // 40ど ずれて のると、まがるのは maxSteer まで。
    const slant = trampolineVelocity({ x: Math.sin((40 * Math.PI) / 180), z: -Math.cos((40 * Math.PI) / 180) }, { x: 0, z: -1 })
    expect(Math.atan2(slant.x, -slant.z)).toBeCloseTo((40 * Math.PI) / 180 - TRAMPOLINE.maxSteer, 6)
    // つづけて とぶときは はやさを ふやさない。
    expect(Math.hypot(trampolineVelocity({ x: 0, z: -3 }, { x: 0, z: -1 }, true).z)).toBeCloseTo(3, 6)
    // lift だけ あがって、toY に おりる。
    const flight = trampolineFlight(0.15, 1.05, 9.81)
    const apex = 0.15 + (flight.up * flight.up) / (2 * 9.81)
    expect(apex).toBeCloseTo(1.05 + TRAMPOLINE.lift, 6)
    expect(0.15 + flight.up * flight.time - (9.81 * flight.time * flight.time) / 2).toBeCloseTo(1.05, 6)
  })

  it('おいかぜは とおくまで、むかいかぜは ちかくまでしか ころがさない', () => {
    const lane = (gadgets?: HoleDefinition['gadgets']): HoleDefinition => ({
      id: 'lane', name: 'lane', par: 1, tee: { x: 0, z: 14 }, cup: { x: 0, z: -14 },
      floors: [{ corners: [{ x: -1.5, z: 15 }, { x: -1.5, z: -15 }, { x: 1.5, z: -15 }, { x: 1.5, z: 15 }] }],
      gadgets, route: [{ x: 0, z: 14 }, { x: 0, z: -14 }], tip: '',
    })
    const travel = (gadgets?: HoleDefinition['gadgets']) => withWorld(open(MEADOW, lane(gadgets)), world => {
      world.shoot({ x: 0, z: -1 }, 0.5)
      const events = roll(world)
      return { distance: 14 - world.ball().position.z, wind: events.some(event => event.kind === 'wind') }
    })
    const calm = travel()
    const tail = travel([{ kind: 'fan', id: 'tail', x: 0, z: 6, dir: { x: 0, z: -1 }, halfLength: 7, halfWidth: 1.5, strength: 0.6 }])
    const head = travel([{ kind: 'fan', id: 'head', x: 0, z: 6, dir: { x: 0, z: 1 }, halfLength: 7, halfWidth: 1.5, strength: 0.6 }])
    expect(calm.wind).toBe(false)
    expect(tail.wind && head.wind).toBe(true)
    expect(tail.distance).toBeGreaterThan(calm.distance * 1.4)
    expect(head.distance).toBeLessThan(calm.distance * 0.8)
    // おすすめの つよさも、かぜを かんがえて かわる。
    const power = (gadgets?: HoleDefinition['gadgets']) => withWorld(open(MEADOW, lane(gadgets)), world => {
      world.placeBall({ x: 0, z: 0 })
      return world.suggestShot().power
    })
    const still = power()
    expect(power([{ kind: 'fan', id: 'head', x: 0, z: -7, dir: { x: 0, z: 1 }, halfLength: 7, halfWidth: 1.5, strength: 0.4 }])).toBeGreaterThan(still + 0.05)
    expect(power([{ kind: 'fan', id: 'tail', x: 0, z: -7, dir: { x: 0, z: -1 }, halfLength: 7, halfWidth: 1.5, strength: 0.4 }])).toBeLessThan(still - 0.05)
  })

  it('かぜの 中でも、止まりかけた ボールは すぐ止まり、かぜに おしもどされない', () => {
    const lane: HoleDefinition = {
      id: 'lane', name: 'lane', par: 1, tee: { x: 0, z: 14 }, cup: { x: 0, z: -14 },
      floors: [{ corners: [{ x: -1.5, z: 15 }, { x: -1.5, z: -15 }, { x: 1.5, z: -15 }, { x: 1.5, z: 15 }] }],
      // おいかぜも むかいかぜも、ころがり抵抗より つよい。
      gadgets: [{ kind: 'fan', id: 'strong', x: 0, z: 0, dir: { x: 0, z: 1 }, halfLength: 15, halfWidth: 1.5, strength: 1.4 }],
      route: [{ x: 0, z: 14 }, { x: 0, z: -14 }], tip: '',
    }
    withWorld(open(MEADOW, lane), world => {
      world.placeBall({ x: 0, z: 0 })
      // むかいかぜに さからって よわく うつ。
      world.shoot({ x: 0, z: -1 }, 0.2)
      let time = 0
      let farthest = 0
      roll(world, () => { time++; farthest = Math.min(farthest, world.ball().position.z) })
      expect(world.phase).toBe('ready')
      expect(time / 120).toBeLessThan(2.5)
      // かぜに おされて うしろへ もどりつづけない。
      expect(world.ball().position.z - farthest).toBeLessThan(0.3)
      // おいかぜの むきへ よわく うっても、止まりかけたら すぐ止まる。
      world.shoot({ x: 0, z: 1 }, 0.1)
      time = 0
      roll(world, () => { time++ })
      expect(world.phase).toBe('ready')
      expect(time / 120).toBeLessThan(3)
    })
  })

  it('ねらいの道すじは、壁で1回はね返る', () => {
    withWorld(open(MEADOW, holeById('meadow-1')), world => {
      const path = world.aimPath({ x: 1, z: -1 }, 0.6)
      expect(path.length).toBeGreaterThanOrEqual(3)
      const bounce = path[1]!
      // 右の壁（x=1.1）の手前でボールの半径ぶん離れて当たる。
      expect(bounce.x).toBeCloseTo(1.1 - BALL_RADIUS, 1)
      const after = path[2]!
      expect(after.x).toBeLessThan(bounce.x)
      expect(after.z).toBeLessThan(bounce.z)
    })
  })

  it('おすすめは見通せる点をねらい、すなばを横切らない', () => {
    withWorld(open(BEACH, holeById('beach-1')), world => {
      const shot = world.suggestShot()
      expect(shot.target).toEqual({ x: -1.3, z: 0.4 })
    })
    withWorld(open(MEADOW, holeById('meadow-2')), world => {
      // 曲がり角の壁でカップは見えない。まず角をねらう。
      expect(world.suggestShot().target).toEqual({ x: 0, z: -2.0 })
      world.placeBall({ x: 0.2, z: -2.1 })
      expect(world.suggestShot().target).toEqual({ x: 4.5, z: -2.15 })
    })
  })
})
