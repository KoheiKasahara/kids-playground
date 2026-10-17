import { describe, expect, test } from 'vitest'
import {
  CONTACT, FENCE_HEIGHT, FIRST_WINDUP, HIT_WINDOW, MITT_PROGRESS, RELEASE, STOP_AT, STOP_TIME, WINDUP,
  arrivalTime, ballsLeft, canSwing, createDerby, drainEvents, fenceDistance, flightDuration, flightPoint,
  hitFromTiming, homerunsNeeded, pitchKind, pitchPoint, pitchProgress, standHeight, starsFor, stepDerby, swingBat,
  type Derby, type DerbyEvent,
} from './derby'
import { BALLS, PITCH_SPEED, STAGES, type PitchKind } from './stages'

const KINDS = Object.keys(PITCH_SPEED) as PitchKind[]
const DT = 1 / 60

function run(derby: Derby, seconds: number): DerbyEvent[] {
  const events: DerbyEvent[] = []
  for (let t = 0; t < seconds - 1e-9; t += DT) {
    stepDerby(derby, DT)
    events.push(...drainEvents(derby))
  }
  return events
}

/** つぎの ボールが はなれるまで すすめる。 */
function untilRelease(derby: Derby) {
  for (let i = 0; i < 600 && derby.phase !== 'pitch'; i++) stepDerby(derby, DT)
  drainEvents(derby)
}

/** いまの ボールの けっかが でて、つぎに すすむまで すすめる。 */
function untilNext(derby: Derby): DerbyEvent[] {
  const events: DerbyEvent[] = []
  const index = derby.index
  for (let i = 0; i < 1200 && derby.index === index && derby.phase !== 'done'; i++) {
    stepDerby(derby, DT)
    events.push(...drainEvents(derby))
  }
  return events
}

/** ボールが とどく ちょうど その ときに ふる。 */
function swingOnTime(derby: Derby, offset = 0) {
  untilRelease(derby)
  const arrival = arrivalTime(pitchKind(derby), derby.stage.travel) + offset
  while (derby.t + DT <= arrival) stepDerby(derby, DT)
  stepDerby(derby, arrival - derby.t)
  return swingBat(derby)
}

describe('pitch paths', () => {
  test('every pitch leaves the hand and arrives at the bat when the timing says so', () => {
    for (const kind of KINDS) {
      const start = pitchPoint(kind, 0), end = pitchPoint(kind, 1)
      expect(start.x, kind).toBeCloseTo(RELEASE.x, 5)
      expect(start.y, kind).toBeCloseTo(RELEASE.y, 5)
      expect(start.z, kind).toBeCloseTo(RELEASE.z, 5)
      expect(end.x, kind).toBeCloseTo(CONTACT.x, 5)
      expect(end.y, kind).toBeCloseTo(CONTACT.y, 5)
      expect(end.z, kind).toBeCloseTo(CONTACT.z, 5)
      expect(end.alpha, kind).toBe(1)
      for (const travel of [1, 1.35]) expect(pitchProgress(kind, travel, arrivalTime(kind, travel)), kind).toBeCloseTo(1, 6)
    }
  })

  test('tricky pitches move differently from the straight ball', () => {
    expect(pitchPoint('hop', 1 / 6).y).toBeGreaterThan(pitchPoint('straight', 1 / 6).y + .5)
    expect(Math.abs(pitchPoint('wave', 1 / 8).x - pitchPoint('straight', 1 / 8).x)).toBeGreaterThan(.5)
    expect(pitchPoint('curve', .5).x).toBeGreaterThan(pitchPoint('straight', .5).x + 1)
    expect(pitchPoint('ghost', .6).alpha).toBe(0)
    expect(pitchPoint('ghost', .1).alpha).toBe(1)
    expect(arrivalTime('fast', 1)).toBeLessThan(arrivalTime('straight', 1))
    expect(arrivalTime('slow', 1)).toBeGreaterThan(arrivalTime('straight', 1))
  })

  test('the stop ball waits in the air before coming on', () => {
    const travel = 1.1
    const stopStart = travel * STOP_AT
    expect(pitchProgress('stop', travel, stopStart + .01)).toBe(STOP_AT)
    expect(pitchProgress('stop', travel, stopStart + STOP_TIME - .01)).toBe(STOP_AT)
    expect(pitchProgress('stop', travel, stopStart + STOP_TIME + .1)).toBeGreaterThan(STOP_AT)
    expect(arrivalTime('stop', travel)).toBeGreaterThan(travel + STOP_TIME * .5)
  })
})

describe('hitting', () => {
  test('just timing is a long home run to center that clears the fence', () => {
    const hit = hitFromTiming(0, .5)
    expect(hit.outcome).toBe('homerun')
    expect(hit.timing).toBe('just')
    expect(Math.abs(hit.angle)).toBeLessThan(.1)
    expect(hit.distance).toBeGreaterThan(fenceDistance(0) + 20)
    // フェンスを こえる ところで フェンスより たかく、さいごは スタンドに おちる。
    const atFence = flightPoint(hit, hit.time * (hit.fence / hit.distance))
    expect(atFence.y).toBeGreaterThan(FENCE_HEIGHT)
    const landed = flightPoint(hit, flightDuration(hit))
    const landedDistance = Math.hypot(landed.x, landed.z)
    expect(landedDistance).toBeGreaterThan(hit.fence)
    expect(landed.y).toBeLessThanOrEqual(standHeight(landedDistance, hit.fence) + .5)
  })

  test('early swings pull to the left, late swings go to the right', () => {
    expect(hitFromTiming(-.06, .5).angle).toBeLessThan(0)
    expect(hitFromTiming(.06, .5).angle).toBeGreaterThan(0)
    expect(hitFromTiming(-.03, .5).timing).toBe('just')
    expect(hitFromTiming(-.08, .5).timing).toBe('early')
    expect(hitFromTiming(.08, .5).timing).toBe('late')
  })

  test('the further from just timing, the shorter the ball flies until it becomes foul', () => {
    const errors = [0, .04, .08, .12, .15]
    const distances = errors.map(e => hitFromTiming(e, .5).distance)
    for (let i = 1; i < distances.length; i++) expect(distances[i]).toBeLessThan(distances[i - 1])
    const hit = hitFromTiming(.13, .5)
    expect(hit.outcome).toBe('hit')
    expect(hit.distance).toBeLessThan(hit.fence)
    expect(flightPoint(hit, hit.time).y).toBeCloseTo(0, 5)
    expect(hitFromTiming(-HIT_WINDOW, .5).outcome).toBe('foul')
    expect(hitFromTiming(HIT_WINDOW, .5).outcome).toBe('foul')
  })

  test('stars grow with home runs above the goal', () => {
    const stage = STAGES[0]
    expect(starsFor(stage, stage.goal - 1)).toBe(0)
    expect(starsFor(stage, stage.goal)).toBe(1)
    expect(starsFor(stage, stage.goal + 2)).toBe(2)
    expect(starsFor(stage, stage.goal + 4)).toBe(3)
    expect(starsFor(stage, BALLS)).toBe(3)
  })
})

describe('derby loop', () => {
  test('a swing on time becomes a home run, then the next pitch starts', () => {
    const derby = createDerby(STAGES[0], () => .5)
    expect(drainEvents(derby)).toEqual([{ type: 'windup' }])
    expect(canSwing(derby)).toBe(false)
    expect(swingBat(derby)).toBe(false)
    run(derby, FIRST_WINDUP - .1)
    expect(derby.phase).toBe('windup')
    expect(swingOnTime(derby)).toBe(true)
    // 1かいの ボールで ふれるのは 1かいだけ。
    expect(swingBat(derby)).toBe(false)
    const events = untilNext(derby)
    const types = events.map(event => event.type)
    expect(types).toEqual(['swing', 'contact', 'land', 'windup'])
    expect(events.find(event => event.type === 'land')).toMatchObject({ hit: { outcome: 'homerun' }, homeruns: 1 })
    expect(derby).toMatchObject({ index: 1, homeruns: 1, results: ['homerun'], phase: 'windup', swing: null, hit: null })
    expect(homerunsNeeded(derby)).toBe(STAGES[0].goal - 1)
    expect(ballsLeft(derby)).toBe(BALLS - 1)
  })

  test('not swinging, swinging early and swinging late are strikes with a reason', () => {
    const derby = createDerby(STAGES[0], () => .5)
    untilRelease(derby)
    let events = untilNext(derby)
    expect(events.map(event => event.type)).toEqual(['miss', 'windup'])
    expect(events[0]).toEqual({ type: 'miss', reason: 'looking' })
    // ミットに おさまるのは とどいた すこし あと。
    expect(MITT_PROGRESS).toBeGreaterThan(1)

    swingOnTime(derby, -.6)
    events = untilNext(derby)
    expect(events[0]).toEqual({ type: 'swing', contact: false })
    expect(events[1]).toEqual({ type: 'miss', reason: 'early' })

    swingOnTime(derby, .3 * STAGES[0].assist)
    events = untilNext(derby)
    expect(events[0]).toEqual({ type: 'swing', contact: false })
    expect(events[1]).toEqual({ type: 'miss', reason: 'late' })
    expect(derby.results).toEqual(['miss', 'miss', 'miss'])
    expect(derby.homeruns).toBe(0)
  })

  test('an early swing that still touches the ball meets it when it arrives', () => {
    const derby = createDerby(STAGES[3], () => .5)
    swingOnTime(derby, -.08)
    expect(derby.swing?.contactAt).toBeCloseTo(arrivalTime(pitchKind(derby), derby.stage.travel), 5)
    const events = untilNext(derby)
    const land = events.find(event => event.type === 'land')
    expect(land).toMatchObject({ hit: { timing: 'early' } })
  })

  test('the stop ball tells when it stops and starts again', () => {
    const stage = STAGES.find(s => s.pitches[1] === 'stop')!
    const derby = createDerby(stage, () => .5)
    untilNext(derby)
    untilRelease(derby)
    expect(pitchKind(derby)).toBe('stop')
    const events = untilNext(derby).map(event => event.type)
    expect(events.slice(0, 3)).toEqual(['pause', 'resume', 'miss'])
  })

  test('after every ball the derby is done and gives stars', () => {
    const derby = createDerby(STAGES[0], () => .5)
    const events: DerbyEvent[] = []
    for (let i = 0; i < BALLS; i++) {
      swingOnTime(derby)
      events.push(...untilNext(derby))
    }
    expect(derby.phase).toBe('done')
    expect(derby.homeruns).toBe(BALLS)
    expect(events.at(-1)).toEqual({ type: 'done', homeruns: BALLS, stars: 3 })
    // おわった あとは なにも おきない。
    run(derby, WINDUP * 3)
    expect(drainEvents(derby)).toEqual([])
    expect(swingBat(derby)).toBe(false)
  })
})
