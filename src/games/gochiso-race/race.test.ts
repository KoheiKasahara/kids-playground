import { describe, expect, test } from 'vitest'
import { COURSES, buildCourse, type Piece, type RivalStyle } from './courses'
import { FOODS } from './foods'
import {
  GOAL_BONUS, READY_TIME, RIVAL_GOAL_LIMIT, RUNNER_W, RUN_SPEED,
  createRace, drainEvents, pounderGap, pressJump, raceResult, setStop, stepRace,
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

const ofType = <T extends RaceEvent['type']>(events: RaceEvent[], type: T) => events.filter((e): e is Extract<RaceEvent, { type: T }> => e.type === type)

describe('gochiso-race: はしる・とぶ・とまる', () => {
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

  test('holding stop brakes to a halt, and letting go runs again', () => {
    const race = newRace([{ t: 'run', len: 2000 }])
    go(race)
    run(race, .5)
    setStop(race, true)
    run(race, .4)
    expect(race.player.vx).toBe(0)
    expect(race.player.braking).toBe(true)
    const x = race.player.x
    run(race, 1)
    expect(race.player.x).toBe(x)
    setStop(race, false)
    run(race, .5)
    expect(race.player.vx).toBeGreaterThan(RUN_SPEED * .9)
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

describe('gochiso-race: ぺったん と はち', () => {
  test('the pounder is open at first, then drops to the ground', () => {
    const race = newRace([{ t: 'run', len: 200 }, { t: 'pounder', tempo: 'slow' }, { t: 'run', len: 600 }])
    const p = race.course.pounders[0]
    expect(pounderGap(p, 0)).toBe(p.height)
    expect(pounderGap(p, p.up + p.drop + p.down / 2)).toBe(0)
    expect(pounderGap(p, p.up + p.drop + p.down + p.rise / 2)).toBeCloseTo(p.height / 2)
  })

  test('the pounder squashes a runner under it and works as a wall while it is down', () => {
    const race = newRace([{ t: 'run', len: 200 }, { t: 'pounder', tempo: 'slow' }, { t: 'run', len: 600 }])
    const p = race.course.pounders[0]
    go(race)
    const cycle = p.up + p.drop + p.down + p.rise
    // つぎに おちる すこし まえに、した に いる ことに する。
    race.clock = Math.ceil(race.clock / cycle) * cycle + p.up - .05
    race.player.x = p.x + 10
    race.player.vx = 0
    setStop(race, true)
    const events = run(race, .3)
    expect(ofType(events, 'bump')).toEqual([{ type: 'bump', who: 'player', cause: 'pounder' }])
    expect(race.player.x + RUNNER_W).toBeLessThanOrEqual(p.x + 3)
    expect(race.player.stun).toBeGreaterThan(0)

    // じめんに おりている あいだは とおれない（ぶつかっても いたくない）。
    race.player.stun = 0
    race.player.invuln = 0
    setStop(race, false)
    const before = run(race, .4)
    expect(pounderGap(p, race.clock)).toBe(0)
    expect(ofType(before, 'bump')).toEqual([])
    expect(race.player.x + RUNNER_W).toBeLessThanOrEqual(p.x + 3)
  })

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

  test('the rival eats food in front of a stopped player, unless it is picky', () => {
    const hungry = newRace([{ t: 'run', len: 600, row: 'apple', n: 3 }, { t: 'run', len: 1200 }])
    setStop(hungry, true)
    go(hungry)
    run(hungry, 6)
    expect(hungry.rival.food).toBe(3)
    setStop(hungry, false)
    expect(ofType(run(hungry, 3), 'eat').filter(e => e.who === 'player')).toEqual([])

    const picky = newRace([{ t: 'run', len: 600, row: 'apple', n: 3 }, { t: 'run', len: 1200 }], { ...SLOW_RIVAL, appetite: 0 })
    setStop(picky, true)
    go(picky)
    run(picky, 6)
    expect(picky.rival.food).toBe(0)
    setStop(picky, false)
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
    const race = newRace([{ t: 'run', len: 600 }])
    setStop(race, true)
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
      const race = createRace(c, { player: 'dog', rival: 'cat', seed })
      setStop(race, true)
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

  test('the same seed runs the same race', () => {
    const a = createRace(COURSES[1], { player: 'panda', rival: 'fox', seed: 42, autoPlayer: EXPERT })
    const b = createRace(COURSES[1], { player: 'panda', rival: 'fox', seed: 42, autoPlayer: EXPERT })
    untilDone(a)
    untilDone(b)
    expect(a.result).toEqual(b.result)
    expect(a.eatenBy).toEqual(b.eatenBy)
  })
})
