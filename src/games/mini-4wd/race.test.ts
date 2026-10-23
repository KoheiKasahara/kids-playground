import { describe, expect, test } from 'vitest'
import { COURSES, DEFAULT_BUILD, PARTS } from './data'
import { CHEER_COOLDOWN_SECONDS, cheerRace, COUNTDOWN_SECONDS, createRace, getRank, stepRace } from './race'
import type { Build, RaceEvent, RaceState } from './types'

const SAFE: Build = { body: 'buggy', motor: 'torque', tires: 'sponge', rollers: 'wide', color: 'mint' }
const FAST: Build = { body: 'arrow', motor: 'dash', tires: 'slick', rollers: 'bearing', color: 'red' }

function finish(race: RaceState, dt = 1 / 60) {
  const events: RaceEvent[] = []
  for (let frame = 0; frame < 70 / dt && race.phase !== 'finished'; frame++) {
    stepRace(race, dt)
    events.push(...race.events)
  }
  return events
}

describe('mini-4wd automatic race', () => {
  test('countdown does not move cars; go, laps and finish are each emitted once', () => {
    const race = createRace(COURSES[0], DEFAULT_BUILD)
    for (let i = 0; i < (COUNTDOWN_SECONDS - .2) * 60; i++) stepRace(race, 1 / 60)
    expect(race.phase).toBe('countdown')
    expect(race.elapsed).toBe(0)
    expect(race.racers.every(racer => racer.distance === 0)).toBe(true)
    const events = finish(race).filter(event => event.racer === 0)
    expect(events.filter(event => event.kind === 'go')).toHaveLength(1)
    expect(events.filter(event => event.kind === 'lap')).toHaveLength(2)
    expect(events.filter(event => event.kind === 'finish')).toHaveLength(1)
    expect(race.racers[0].distance).toBeCloseTo(race.course.length * 3)
    expect(race.elapsed).toBe(race.racers[0].finishTime)
  })

  test('fast builds pay for unstable corners and jumps but recover without input', () => {
    const safe = createRace(COURSES[3], SAFE)
    const fast = createRace(COURSES[3], FAST)
    const safeEvents = finish(safe)
    const fastEvents = finish(fast)
    expect(safeEvents.filter(event => event.kind === 'bump' && event.racer === 0)).toHaveLength(0)
    expect(fastEvents.filter(event => event.kind === 'bump' && event.racer === 0).length).toBeGreaterThan(3)
    expect(safe.phase).toBe('finished')
    expect(fast.phase).toBe('finished')
    expect(safe.elapsed).toBeLessThan(fast.elapsed)
  })

  test('fast straight-line parts beat the safe build on the beginner course', () => {
    const safe = createRace(COURSES[0], SAFE)
    const fast = createRace(COURSES[0], FAST)
    finish(safe)
    finish(fast)
    expect(fast.elapsed).toBeLessThan(safe.elapsed)
  })

  test.each(COURSES)('$id: tuning can win, and different builds change the finishing rank', course => {
    const ranks = new Set<number>()
    for (const body of PARTS.body) for (const motor of PARTS.motor) {
      for (const tires of PARTS.tires) for (const rollers of PARTS.rollers) {
        const build = { ...DEFAULT_BUILD, body: body.id, motor: motor.id, tires: tires.id, rollers: rollers.id }
        const race = createRace(course, build)
        finish(race, .1)
        expect(race.phase, JSON.stringify(build)).toBe('finished')
        ranks.add(getRank(race))
      }
    }
    expect(ranks, 'At least one available parts combination must be able to win').toContain(1)
    expect(ranks.size, 'Parts choices must affect the outcome, rather than always winning or losing').toBeGreaterThan(1)
  })

  test('cheering boosts the player, shakes off a bump and must charge before the next boost', () => {
    const quiet = createRace(COURSES[0], DEFAULT_BUILD)
    const cheered = createRace(COURSES[0], DEFAULT_BUILD)
    expect(cheerRace(cheered)).toBe(false)
    let accepted = 0
    for (let frame = 0; frame < 80 * 60 && cheered.phase !== 'finished'; frame++) {
      if (cheered.phase === 'racing' && cheerRace(cheered)) accepted++
      stepRace(cheered, 1 / 60)
    }
    finish(quiet)
    expect(cheered.racers[0].finishTime!).toBeLessThan(quiet.racers[0].finishTime! - 1)
    expect(accepted).toBeLessThanOrEqual(Math.ceil(cheered.elapsed / CHEER_COOLDOWN_SECONDS) + 1)
    expect(cheerRace(cheered)).toBe(false)

    const bumped = createRace(COURSES[0], DEFAULT_BUILD)
    bumped.phase = 'racing'
    bumped.racers[0].recovery = .5
    expect(cheerRace(bumped)).toBe(true)
    expect(bumped.racers[0].recovery).toBe(0)
    expect(cheerRace(bumped)).toBe(false)
    stepRace(bumped, .1)
    expect(bumped.racers[0].boost).toBeGreaterThan(0)
  })

  test('completed times determine the result, even when cars cross in the same step', () => {
    const race = createRace(COURSES[0], DEFAULT_BUILD)
    race.phase = 'racing'
    race.elapsed = 30
    const finishLine = race.course.length * race.lapCount
    race.racers.forEach((racer, i) => {
      racer.distance = finishLine - [.6, .2, .9][i]
      racer.speed = 160
    })
    stepRace(race, 1 / 60)
    expect(race.phase).toBe('finished')
    expect(getRank(race)).toBe(2)
    const frozen = structuredClone(race)
    stepRace(race, 60)
    expect(race.elapsed).toBe(frozen.elapsed)
    expect(race.racers).toEqual(frozen.racers)
    expect(race.events).toEqual([])
  })

  test('large, negative and non-finite deltas cannot skip or corrupt a race', () => {
    const race = createRace(COURSES[0], DEFAULT_BUILD)
    for (const dt of [-1, 0, NaN, Infinity]) stepRace(race, dt)
    expect(race.countdown).toBe(COUNTDOWN_SECONDS)
    stepRace(race, 120)
    expect(race.countdown).toBeCloseTo(COUNTDOWN_SECONDS - .1)
    race.phase = 'racing'
    stepRace(race, 120)
    expect(race.elapsed).toBeCloseTo(.1)
  })

  test('simulation is deterministic and paint is cosmetic at different frame rates', () => {
    const a = createRace(COURSES[2], DEFAULT_BUILD)
    const b = createRace(COURSES[2], DEFAULT_BUILD)
    const painted = createRace(COURSES[2], { ...DEFAULT_BUILD, color: 'violet' })
    finish(a)
    finish(b)
    finish(painted, 1 / 30)
    expect(a).toEqual(b)
    expect(painted.elapsed).toBeCloseTo(a.elapsed, 7)
    expect(getRank(painted)).toBe(getRank(a))
  })
})
