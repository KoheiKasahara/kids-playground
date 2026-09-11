import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { initializeRapier } from '../../physics/rapierLoader'
import { createPartGeometries } from './marbleGeometry'
import { appendPart, createPart, initialCourse, SEESAW_ANGLE, toLocal, toWorld, type Course, type GadgetKind } from './marbleModel'
import { createMarbleWorld, type MarbleEvent, type RunStatus } from './marbleWorld'

const geometries = createPartGeometries()
beforeAll(async () => { await initializeRapier() })
afterAll(() => { Object.values(geometries).forEach(geometry => geometry.dispose()) })

function courseFor(kind: GadgetKind, rotation = 0): Course {
  const initial = initialCourse()
  initial.parts[0]!.rotation = rotation
  return appendPart(appendPart(initial, kind, 'gadget', 'part-0'), 'goal', 'goal', 'gadget')
}

function simulate(course: Course, offset = 0) {
  const run = createMarbleWorld(course, geometries, offset)!
  const events: MarbleEvent[] = []
  const path: { x: number; y: number; z: number }[] = []
  let status: RunStatus = 'rolling'
  try {
    for (let i = 0; i < 4900 && status === 'rolling'; i++) {
      status = run.step()
      events.push(...run.consumeEvents())
      if (i % 12 === 0) path.push({ ...run.ball.translation() })
    }
    return { status, events, path, end: run.ball.translation() }
  } finally { run.dispose() }
}

describe('physical gadgets', () => {
  for (const kind of ['jump', 'spinner', 'funnel', 'booster', 'seesaw'] as const) {
    it(`${kind}: connects from the initial slope and reaches the next goal`, () => {
      const result = simulate(courseFor(kind))
      expect({ status: result.status, end: result.end }).toEqual({ status: 'goal', end: expect.anything() })
      if (kind === 'jump') expect(result.events.map(event => event.kind)).toEqual(['takeoff', 'land'])
      if (kind === 'spinner') expect(result.events.some(event => event.kind === 'hit')).toBe(true)
      if (kind === 'funnel') {
        const part = courseFor(kind).parts[1]!
        const local = result.path.map(point => toLocal(part, point))
        expect(local.some(point => point.z > 0.5)).toBe(true)
        expect(local.some(point => Math.hypot(point.x, point.z) < 0.7 && point.y < -0.7)).toBe(true)
      }
    })
  }
  it('boosts a straight start into a physical jump', () => {
    let course: Course = { parts: [createPart('straight', 'start')], startId: 'start' }
    course = appendPart(course, 'booster', 'boost', 'start')
    course = appendPart(course, 'jump', 'jump', 'boost')
    course = appendPart(course, 'goal', 'goal', 'jump')
    const result = simulate(course)
    expect(result.status).toBe('goal')
    expect(result.events.map(event => event.kind)).toEqual(['boost', 'takeoff', 'land'])
  })

  it('keeps the representative courses playable in every orientation across release offsets', () => {
    for (const kind of ['jump', 'spinner', 'funnel', 'booster', 'seesaw'] as const) for (let rotation = 0; rotation < 4; rotation++) for (const offset of [-0.08, 0.08]) {
      const result = simulate(courseFor(kind, rotation), offset)
      expect(result.status, `${kind}, rotation ${rotation}, offset ${offset}: ${JSON.stringify(result.end)}`).toBe('goal')
    }
  })

  it('launches from every gadget entrance without overlapping the mechanism', () => {
    for (const kind of ['jump', 'spinner', 'funnel', 'booster', 'seesaw'] as const) {
      const course = courseFor(kind)
      course.startId = 'gadget'
      const result = simulate(course)
      if (kind === 'seesaw') {
        // A slow release may roll back before crossing the pivot; it still exits cleanly for retry.
        expect(result.path.some(point => toLocal(course.parts[1]!, point).x > -1.8)).toBe(true)
        expect(result.status).toBe('ready')
      } else expect(result.status, `${kind}: ${JSON.stringify(result.end)}`).toBe('goal')
    }
  })

  it('resets both motor settings to the same starting pose and lets sphere contact change its path', () => {
    const deflections: number[] = []
    for (const speed of ['slow', 'fast'] as const) for (const reverse of [false, true]) {
      const course = courseFor('spinner')
      const part = course.parts[1]!
      if (part.kind !== 'spinner') throw new Error('spinner required')
      part.settings = { speed, reverse }
      let firstPose: unknown
      for (let attempt = 0; attempt < 2; attempt++) {
        const run = createMarbleWorld(course, geometries)!
        try {
          if (attempt === 0) firstPose = run.mechanismPoses()
          else expect(run.mechanismPoses()).toEqual(firstPose)
          for (let i = 0; i < 250; i++) run.step()
          deflections.push(toLocal(part, run.ball.translation()).z)
          expect(Math.hypot(...Object.values(run.ball.linvel()))).toBeLessThan(9)
        } finally { run.dispose() }
      }
      expect(simulate(course).status).toBe('goal')
    }
    expect(Math.max(...deflections) - Math.min(...deflections)).toBeGreaterThan(0.25)
  })

  it('tips a passive seesaw under the ball weight, respects stops and freezes on completion', () => {
    const course = courseFor('seesaw')
    const run = createMarbleWorld(course, geometries)!
    const angles: number[] = []
    try {
      const start = run.mechanismPoses()[0]!.rotation
      expect(2 * Math.atan2(start.z, start.w)).toBeCloseTo(SEESAW_ANGLE)
      let status: RunStatus = 'rolling'
      for (let i = 0; i < 4900 && status === 'rolling'; i++) {
        status = run.step()
        const q = run.mechanismPoses()[0]!.rotation
        angles.push(2 * Math.atan2(q.z, q.w))
      }
      expect(Math.min(...angles)).toBeLessThan(-0.06)
      expect(Math.max(...angles)).toBeLessThan(SEESAW_ANGLE + 0.02)
      expect(Math.min(...angles)).toBeGreaterThan(-SEESAW_ANGLE - 0.02)
      const stopped = run.mechanismPoses()
      for (let i = 0; i < 120; i++) run.step()
      expect(run.mechanismPoses()).toEqual(stopped)
    } finally { run.dispose() }
  })

  it('boosts only a real top contact, once per visit, in the rotated arrow direction', () => {
    for (let rotation = 0; rotation < 4; rotation++) {
      const part = { ...createPart('booster', 'boost'), rotation }
      const run = createMarbleWorld({ parts: [part], startId: part.id }, geometries)!
      try {
        const place = (x: number, y: number, z: number) => {
          run.ball.setTranslation(toWorld(part, { x, y, z }), true)
          run.ball.setLinvel({ x: 0, y: 0, z: 0 }, true)
          run.ball.setAngvel({ x: 0, y: 0, z: 0 }, true)
        }
        place(0, 1.6, 0)
        for (let i = 0; i < 10; i++) run.step()
        expect(run.consumeEvents()).toEqual([])
        place(0, 0.48, 0.9)
        for (let i = 0; i < 5; i++) run.step()
        expect(run.consumeEvents()).toEqual([])
        place(0, 0.27, 0)
        for (let i = 0; i < 5; i++) run.step()
        expect(run.consumeEvents().map(event => event.kind)).toEqual(['boost'])
        const velocity = toLocal({ ...part, position: { x: 0, y: 0, z: 0 } }, run.ball.linvel())
        expect(velocity.x).toBeGreaterThan(3)
        place(0, 0.27, 0)
        for (let i = 0; i < 5; i++) run.step()
        expect(run.consumeEvents()).toEqual([])
        place(-3, 0.5, 0)
        run.step()
        place(0, 0.27, 0)
        for (let i = 0; i < 5; i++) run.step()
        expect(run.consumeEvents().map(event => event.kind)).toEqual(['boost'])
      } finally { run.dispose() }
    }
  })

  it('feeds a funnel from a spinner and joins multiple descending funnels', () => {
    for (const sequence of [['spinner', 'funnel'], ['funnel', 'funnel']] as const) {
      let course = initialCourse()
      course.parts[0]!.position.y = 6
      for (const [i, kind] of sequence.entries()) course = appendPart(course, kind, `g${i}`, i === 0 ? 'part-0' : `g${i - 1}`)
      course = appendPart(course, 'goal', 'goal', 'g1')
      for (const offset of [-0.08, 0, 0.08]) {
        const result = simulate(course, offset)
        expect(result.status, `${sequence.join(' → ')} ${offset}: ${JSON.stringify(toLocal(course.parts[2]!, result.end))}`).toBe('goal')
      }
    }
  })

  it('leaves low-speed jumps free to roll back and airborne balls free to hit other pieces', () => {
    const course = courseFor('jump')
    course.startId = 'gadget'
    const part = course.parts[1]!
    const run = createMarbleWorld(course, geometries)!
    try {
      run.ball.setTranslation(toWorld(part, { x: -1.4, y: 0.3, z: 0 }), true)
      run.ball.setLinvel({ x: 0.4, y: 0, z: 0 }, true)
      let farthest = -1.4
      for (let i = 0; i < 400; i++) { run.step(); farthest = Math.max(farthest, toLocal(part, run.ball.translation()).x) }
      expect(farthest).toBeLessThan(-0.5)
      expect(run.consumeEvents().some(event => event.kind === 'land')).toBe(false)
    } finally { run.dispose() }
    const wall = createPart('straight', 'air-wall', toWorld(part, { x: 1, y: 0.25, z: 0 }))
    wall.rotation = 1
    const obstructed = simulate({ ...course, parts: [...course.parts, wall] })
    expect(obstructed.status).toBe('ready')
    expect(obstructed.events.some(event => event.kind === 'takeoff')).toBe(true)
  })

  it('caps boost speed for reverse entry and repeated beds without accelerating an already fast ball', () => {
    const part = createPart('booster', 'boost')
    for (const speed of [-2, 4.8, 7]) {
      const run = createMarbleWorld({ parts: [part], startId: part.id }, geometries)!
      try {
        run.ball.setTranslation(toWorld(part, { x: 0, y: 0.27, z: 0 }), true)
        run.ball.setLinvel({ x: speed, y: 0, z: 0 }, true)
        for (let i = 0; i < 2; i++) run.step()
        if (speed > 5.2) {
          expect(run.consumeEvents()).toEqual([])
          expect(run.ball.linvel().x).toBeLessThanOrEqual(speed)
        } else {
          expect(run.consumeEvents()).toHaveLength(1)
          expect(run.ball.linvel().x).toBeGreaterThan(0)
          expect(run.ball.linvel().x).toBeLessThanOrEqual(5.2)
        }
      } finally { run.dispose() }
    }
  })
})
