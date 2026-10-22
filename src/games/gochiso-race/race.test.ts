import { describe, expect, test } from 'vitest'
import { COURSES, buildCourse, type Piece, type RivalStyle } from './courses'
import { FOODS } from './foods'
import {
  BOOST_MUL, BOOST_TIME, GOAL_BONUS, READY_TIME, RIVAL_GOAL_LIMIT, RUNNER_H, RUNNER_W, RUN_SPEED, SLIDE_H, SLIDE_TIME,
  createRace, drainEvents, heightOf, pressJump, pressSlide, raceResult, stepRace,
  type Race, type RaceEvent,
} from './race'

const DT = 1 / 60
const SLOW_RIVAL: RivalStyle = { speed: .5, greed: 0, hesitate: 0, appetite: 1 }
const EXPERT = { speed: 1, greed: 1, hesitate: 0 }

function course(pieces: Piece[], rival: RivalStyle = SLOW_RIVAL) {
  return buildCourse({ id: 'meadow', name: 'テスト', lead: '', rival, pieces })
}

function newRace(pieces: Piece[], rival?: RivalStyle) {
  return createRace(course(pieces, rival), { player: 'dog', rival: 'cat', seed: 7 })
}

function run(race: Race, seconds: number): RaceEvent[] {
  const events: RaceEvent[] = []
  for (let t = 0; t < seconds - 1e-9; t += DT) {
    stepRace(race, DT)
    events.push(...drainEvents(race))
  }
  return events
}

/** 「どん！」の すぐ あとまで すすめる。 */
function go(race: Race): RaceEvent[] {
  return run(race, READY_TIME + DT)
}

function untilDone(race: Race, limit = 300): RaceEvent[] {
  const events: RaceEvent[] = []
  for (let i = 0; i < limit * 60 && race.phase !== 'done'; i++) {
    stepRace(race, DT)
    events.push(...drainEvents(race))
  }
  return events
}

/** プレイヤーの まえはしが x の てまえ d に くるまで すすめる。 */
function runUntilFront(race: Race, x: number, d = 0) {
  for (let i = 0; i < 1200 && race.player.x + RUNNER_W < x - d; i++) run(race, DT)
}

/** じっと して いると ここで とまる（ジャンプ しないと こえられない だん）。 */
const WALL: Piece = { t: 'hurdle', h: 60 }

const ofType = <T extends RaceEvent['type']>(events: RaceEvent[], type: T) => events.filter((e): e is Extract<RaceEvent, { type: T }> => e.type === type)

describe('gochiso-race: はしる・とぶ・すべる', () => {
  test('waits during よーい and starts running by itself on どん', () => {
    const race = newRace([{ t: 'run', len: 2000 }])
    run(race, READY_TIME - .1)
    pressJump(race)
    expect(race.phase).toBe('ready')
    expect(race.player.x).toBe(race.course.start)
    expect(ofType(run(race, .2), 'go')).toHaveLength(1)
    expect(race.phase).toBe('run')
    run(race, 1)
    expect(race.player.x).toBeGreaterThan(race.course.start + 120)
    expect(race.player.vx).toBeCloseTo(RUN_SPEED)
    expect(race.rival.vx).toBeLessThan(RUN_SPEED)
  })

  test('jumps from the ground, once more in the air, and not a third time', () => {
    const race = newRace([{ t: 'run', len: 2000 }])
    go(race)
    run(race, .3)
    pressJump(race)
    let events = run(race, DT)
    expect(ofType(events, 'jump')).toEqual([{ type: 'jump', who: 'player', air: false }])
    expect(race.player.vy).toBeGreaterThan(0)
    run(race, .15)
    pressJump(race)
    events = run(race, DT)
    expect(ofType(events, 'jump')).toEqual([{ type: 'jump', who: 'player', air: true }])
    run(race, .1)
    pressJump(race)
    expect(ofType(run(race, .1), 'jump')).toEqual([])
    run(race, 1.5)
    expect(race.player.onGround).toBe(true)
    expect(race.player.y).toBe(0)
  })

  test('sliding keeps running low for a moment, then stands up again', () => {
    const race = newRace([{ t: 'run', len: 2000 }])
    pressSlide(race)
    expect(race.player.slideBuffer).toBe(0)
    go(race)
    run(race, .5)
    pressSlide(race)
    expect(ofType(run(race, DT), 'slide')).toEqual([{ type: 'slide', who: 'player' }])
    expect(heightOf(race.player)).toBe(SLIDE_H)
    run(race, SLIDE_TIME / 2)
    expect(race.player.slide).toBeGreaterThan(0)
    expect(race.player.vx).toBeCloseTo(RUN_SPEED)
    run(race, SLIDE_TIME / 2 + .05)
    expect(heightOf(race.player)).toBe(RUNNER_H)
  })

  test('a slide pressed just before landing starts when the feet touch the ground', () => {
    const race = newRace([{ t: 'run', len: 2000 }])
    go(race)
    pressJump(race)
    run(race, .6)
    expect(race.player.onGround).toBe(false)
    pressSlide(race)
    const events = run(race, .3)
    expect(ofType(events, 'slide')).toHaveLength(1)
    expect(race.player.onGround).toBe(true)
  })

  test('a tunnel bonks a runner who is standing, and sliding goes under it', () => {
    const race = newRace([{ t: 'run', len: 300 }, { t: 'tunnel', len: 300 }, { t: 'run', len: 800 }])
    const tunnel = race.course.blocks[0]
    go(race)
    const events = run(race, 2.5)
    expect(ofType(events, 'bump')).toEqual([{ type: 'bump', who: 'player', cause: 'bonk' }])
    expect(race.player.x + RUNNER_W).toBeLessThanOrEqual(tunnel.x0)
    // ぶつかった あとは とまって まつ（なんども ごつんと しない）。
    expect(ofType(run(race, 2), 'bump')).toEqual([])
    expect(race.player.x + RUNNER_W).toBeLessThanOrEqual(tunnel.x0)

    pressSlide(race)
    run(race, .3)
    expect(race.player.x + RUNNER_W).toBeGreaterThan(tunnel.x0 + 10)
    // トンネルは スライディングより ながいので、なかでは でるまで すべりつづける。ジャンプも できない。
    run(race, SLIDE_TIME)
    expect(race.player.x).toBeLessThan(tunnel.x1)
    expect(race.player.slide).toBeGreaterThan(0)
    pressJump(race)
    const inside = run(race, 2)
    expect(ofType(inside, 'jump')).toEqual([])
    expect(ofType(inside, 'bump')).toEqual([])
    expect(race.player.x).toBeGreaterThan(tunnel.x1)
    expect(heightOf(race.player)).toBe(RUNNER_H)
  })

  test('a slide started in time passes a tunnel without stopping', () => {
    const race = newRace([{ t: 'run', len: 400 }, { t: 'tunnel', len: 160, row: 'cake', n: 1 }, { t: 'run', len: 800 }])
    const tunnel = race.course.blocks[0]
    go(race)
    runUntilFront(race, tunnel.x0, 40)
    pressSlide(race)
    const events = run(race, 1.5)
    expect(ofType(events, 'bump')).toEqual([])
    expect(ofType(events, 'eat')).toEqual([expect.objectContaining({ who: 'player', kind: 'cake' })])
    expect(race.player.x).toBeGreaterThan(tunnel.x1)
    expect(race.player.vx).toBeCloseTo(RUN_SPEED)
  })

  test('a spring throws the runner up high, but sliding over it does not', () => {
    const pieces: Piece[] = [{ t: 'run', len: 200 }, { t: 'spring', at: 100 }, { t: 'run', len: 1200 }]
    const race = newRace(pieces)
    go(race)
    let top = 0
    const events: RaceEvent[] = []
    for (let i = 0; i < 150; i++) {
      events.push(...run(race, DT))
      top = Math.max(top, race.player.y)
    }
    expect(ofType(events, 'spring').map(e => e.who)).toContain('player')
    expect(top).toBeGreaterThan(200)

    const slid = newRace(pieces)
    const spring = slid.course.springs[0]
    go(slid)
    runUntilFront(slid, spring.x0, 30)
    pressSlide(slid)
    const passed = run(slid, 1)
    expect(ofType(passed, 'spring').filter(e => e.who === 'player')).toEqual([])
    expect(slid.player.x).toBeGreaterThan(spring.x1)
    expect(slid.player.y).toBe(0)
  })

  test('a boost pad makes the runner faster for a while, then it eases back', () => {
    const race = newRace([{ t: 'run', len: 200 }, { t: 'boost', at: 100 }, { t: 'run', len: 2000 }])
    go(race)
    runUntilFront(race, race.course.boosts[0].x0)
    const events = run(race, .5)
    expect(ofType(events, 'boost').filter(e => e.who === 'player')).toHaveLength(1)
    expect(race.player.vx).toBeCloseTo(RUN_SPEED * BOOST_MUL)
    run(race, BOOST_TIME + .6)
    expect(race.player.vx).toBeCloseTo(RUN_SPEED)
  })

  test('at a fork the spring leads up to the cloud road, and sliding stays on the road below', () => {
    const pieces: Piece[] = [{ t: 'run', len: 300 }, { t: 'fork', len: 600, row: 'cake', n: 3 }, { t: 'run', len: 900, row: 'apple', n: 3 }]
    const up = newRace(pieces)
    const road = up.course.clouds[0]
    go(up)
    runUntilFront(up, road.x0 + 200)
    expect(up.player.y).toBe(road.top)
    run(up, 2.5)
    expect(up.player.food).toBe(15)

    const down = newRace(pieces)
    const spring = down.course.springs[0]
    expect(spring.fork).toBe(true)
    go(down)
    runUntilFront(down, spring.x0, 20)
    pressSlide(down)
    const events = run(down, 4.5)
    expect(ofType(events, 'spring').filter(e => e.who === 'player')).toEqual([])
    expect(ofType(events, 'bump')).toEqual([])
    expect(down.player.y).toBe(0)
    expect(down.player.x).toBeGreaterThan(road.x1)
    expect(down.player.food).toBe(3)
  })

  test('a step that is too high blocks the way until you jump over it', () => {
    const blocked = newRace([{ t: 'run', len: 300 }, { t: 'hurdle', h: 60 }, { t: 'run', len: 800 }])
    const wall = blocked.course.spans.find(span => span.top === 60)!
    go(blocked)
    run(blocked, 3)
    expect(blocked.player.x + RUNNER_W).toBeLessThanOrEqual(wall.x0)

    const jumped = newRace([{ t: 'run', len: 300 }, { t: 'hurdle', h: 60 }, { t: 'run', len: 800 }])
    go(jumped)
    for (let i = 0; i < 600 && jumped.player.x + RUNNER_W < wall.x0 - 30; i++) run(jumped, DT)
    pressJump(jumped)
    run(jumped, 1.5)
    expect(jumped.player.x).toBeGreaterThan(wall.x1)
  })

  test('falling into a pit lands you on the far side after a short wait', () => {
    const race = newRace([{ t: 'run', len: 300 }, { t: 'gap', w: 120 }, { t: 'run', len: 800 }])
    const far = race.course.spans[1]
    go(race)
    const events = run(race, 4)
    expect(ofType(events, 'fall').map(e => e.who)).toContain('player')
    expect(ofType(events, 'respawn').map(e => e.who)).toContain('player')
    expect(race.player.x).toBeGreaterThan(far.x0)
    expect(race.player.y).toBe(far.top)
    expect(race.player.fall).toBe(0)
  })
})

describe('gochiso-race: はち', () => {
  test('a bee makes the runner dizzy for a moment, then it cannot hurt again right away', () => {
    const race = newRace([{ t: 'run', len: 200 }, { t: 'bee', y: 20, amp: .01 }, { t: 'run', len: 600 }])
    go(race)
    let events: RaceEvent[] = []
    for (let i = 0; i < 300 && !ofType(events, 'bump').length; i++) events = run(race, DT)
    expect(ofType(events, 'bump')).toEqual([{ type: 'bump', who: 'player', cause: 'bee' }])
    expect(race.player.stun).toBeGreaterThan(0)
    expect(race.player.vx).toBeLessThan(0)
    expect(ofType(run(race, 1.2), 'bump').filter(e => e.who === 'player')).toEqual([])
    expect(race.player.stun).toBeLessThanOrEqual(0)
  })
})

describe('gochiso-race: ごちそう と かちまけ', () => {
  test('food is eaten once by whoever gets there first', () => {
    const race = newRace([{ t: 'run', len: 600, row: 'cake', n: 1 }, { t: 'run', len: 600 }])
    go(race)
    const events = run(race, 3)
    expect(ofType(events, 'eat')).toEqual([expect.objectContaining({ who: 'player', kind: 'cake', points: FOODS.cake.points })])
    expect(race.player.food).toBe(5)
    expect(race.player.eaten).toBe(1)
    expect(race.eatenBy).toEqual(['player'])
    run(race, 4)
    expect(race.rival.food).toBe(0)
  })

  test('the rival eats food in front of a player who is stuck, unless it is picky', () => {
    const pieces: Piece[] = [{ t: 'run', len: 200 }, WALL, { t: 'run', len: 600, row: 'apple', n: 3 }, { t: 'run', len: 1200 }]
    const hungry = newRace(pieces)
    go(hungry)
    run(hungry, 8)
    expect(hungry.rival.food).toBe(3)
    hungry.player.x = hungry.course.spans[2].x0 + 10
    expect(ofType(run(hungry, 3), 'eat').filter(e => e.who === 'player')).toEqual([])

    const picky = newRace(pieces, { ...SLOW_RIVAL, appetite: 0 })
    go(picky)
    run(picky, 8)
    expect(picky.rival.food).toBe(0)
    picky.player.x = picky.course.spans[2].x0 + 10
    run(picky, 3)
    expect(picky.player.food).toBe(3)
  })

  test('finishing first adds the goal bonus to the food points', () => {
    const race = newRace([{ t: 'run', len: 900, row: 'banana' }])
    go(race)
    const events = untilDone(race)
    expect(ofType(events, 'goal')[0]).toEqual({ type: 'goal', who: 'player', place: 1 })
    const result = race.result!
    expect(ofType(events, 'done')).toEqual([{ type: 'done', result }])
    expect(result.player).toEqual({ food: race.course.foodTotal, eaten: race.course.foods.length, bonus: GOAL_BONUS, total: race.course.foodTotal + GOAL_BONUS, place: 1 })
    expect(result.rival.bonus).toBe(0)
    expect(result.outcome).toBe('win')
    expect(result.stars).toBe(3)
  })

  test('lots of food can beat a rival that reaches the goal first', () => {
    const race = newRace([{ t: 'run', len: 1200, row: 'cake' }], { speed: 1.3, greed: 0, hesitate: 0, appetite: 0 })
    expect(race.course.foodTotal).toBeGreaterThan(GOAL_BONUS)
    go(race)
    untilDone(race)
    const result = race.result!
    expect(result.rival).toEqual(expect.objectContaining({ place: 1, bonus: GOAL_BONUS, total: GOAL_BONUS }))
    expect(result.player.place).toBe(2)
    expect(result.outcome).toBe('win')
    // さきに ゴール できなかった ぶん、★は ひとつ へる。
    expect(result.stars).toBe(2)
  })

  test('equal totals are a draw without stars', () => {
    const race = newRace([{ t: 'run', len: 600 }])
    race.player.food = GOAL_BONUS
    race.rival.place = 1
    expect(raceResult(race)).toEqual(expect.objectContaining({ outcome: 'draw', stars: 0 }))
  })

  test('the race ends a while after the rival finishes, even if the player never gets there', () => {
    const race = newRace([{ t: 'run', len: 200 }, WALL, { t: 'run', len: 600 }])
    go(race)
    const events = untilDone(race)
    const goal = ofType(events, 'goal')
    expect(goal).toEqual([{ type: 'goal', who: 'rival', place: 1 }])
    expect(ofType(events, 'timeup')).toHaveLength(1)
    expect(race.t - race.rival.finishedAt!).toBeGreaterThanOrEqual(RIVAL_GOAL_LIMIT - DT)
    expect(race.result).toEqual(expect.objectContaining({ outcome: 'lose', stars: 0 }))
  })
})

describe('gochiso-race: コンピューターの はしりかた', () => {
  test.each(COURSES.map(c => [c.id, c] as const))('%s: the rival finishes the course without getting stuck', (_, c) => {
    for (const seed of [1, 2, 3]) {
      // プレイヤーは なにも しないので さいしょの だんで とまっている。
      const race = createRace(c, { player: 'dog', rival: 'cat', seed })
      const events = untilDone(race)
      const fell = ofType(events, 'fall').filter(e => e.who === 'rival').length
      const back = ofType(events, 'respawn').filter(e => e.who === 'rival').length
      // おちて もどった とき いがいに はこばれて いない（すすめなく なって いない）。
      expect(back, `seed ${seed}`).toBe(fell)
      expect(race.rival.place, `seed ${seed}`).toBe(1)
      expect(race.rival.finishedAt!, `seed ${seed}`).toBeLessThan(80)
    }
  })

  test.each(COURSES.map(c => [c.id, c] as const))('%s: a careful player can win with stars', (_, c) => {
    for (const seed of [1, 2, 3]) {
      const race = createRace(c, { player: 'dog', rival: 'cat', seed, autoPlayer: EXPERT })
      const events = untilDone(race)
      expect(ofType(events, 'fall').filter(e => e.who === 'player'), `seed ${seed}`).toEqual([])
      expect(race.result, `seed ${seed}`).toEqual(expect.objectContaining({ outcome: 'win' }))
      expect(race.result!.stars, `seed ${seed}`).toBeGreaterThanOrEqual(2)
    }
  })

  test('at a fork the computer takes the upper road when greedy, and slides into the lower road otherwise', () => {
    const pieces: Piece[] = [{ t: 'run', len: 300 }, { t: 'fork', len: 600, row: 'cake', n: 3 }, { t: 'run', len: 900, row: 'apple', n: 3 }]
    for (const greed of [0, 1]) {
      const race = createRace(course(pieces), { player: 'dog', rival: 'cat', seed: 3, autoPlayer: { speed: 1, greed, hesitate: 0 } })
      const events = untilDone(race)
      const mine = <T extends RaceEvent['type']>(type: T) => ofType(events, type).filter(e => 'who' in e && e.who === 'player')
      expect(mine('spring'), `greed ${greed}`).toHaveLength(greed)
      expect(mine('bump'), `greed ${greed}`).toEqual([])
      expect(race.player.food, `greed ${greed}`).toBe(greed ? 15 : 3)
    }
  })

  test('the same seed runs the same race', () => {
    const a = createRace(COURSES[1], { player: 'panda', rival: 'fox', seed: 42, autoPlayer: EXPERT })
    const b = createRace(COURSES[1], { player: 'panda', rival: 'fox', seed: 42, autoPlayer: EXPERT })
    untilDone(a)
    untilDone(b)
    expect(a.result).toEqual(b.result)
    expect(a.eatenBy).toEqual(b.eatenBy)
  })
})
