import { beforeAll, describe, expect, it } from 'vitest'
import { initializeRapier } from '../../physics/rapierLoader'
import { GOLF_COURSES, type CourseDefinition, type HoleDefinition } from './golfCourses'
import { buildHoleGeometry } from './golfGeometry'
import { BALL_RADIUS, rollDistance, rollingDecel, shotSpeed } from './golfPhysics'
import { createGolfWorld, type GolfEvent, type GolfWorld } from './golfWorld'

beforeAll(async () => { await initializeRapier() })

const [MEADOW, BEACH, MOON] = GOLF_COURSES as [CourseDefinition, CourseDefinition, CourseDefinition]
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
