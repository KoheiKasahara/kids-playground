import { describe, expect, it } from 'vitest'
import { COURSES, islandAt, sampleTrack } from './courses'
import { activateItem, createRace, getRank, stepRace } from './engine'
import type { ItemId, RaceState } from './types'

const neutral = { steer: 0, useItem: false }
const widthAt = (state: RaceState, distance = state.racers[0].distance) => sampleTrack(state.course, distance).width
const tick = (state: RaceState, seconds: number, steer = 0) => {
  for (let frame = 0; frame < Math.ceil(seconds * 60); frame++) stepRace(state, { steer, useItem: false }, 1 / 60)
}
function running(assist = true) {
  const state = createRace(COURSES[0], assist)
  state.countdown = 0
  state.phase = 'racing'
  for (const racer of state.racers) racer.speed = 242
  return state
}
function equip(state: RaceState, item: ItemId) {
  state.racers[0].item = item
  activateItem(state)
}

describe('pixel kart courses', () => {
  it('provides four closed, uniformly sampled, distinct circuits with smooth tangents', () => {
    expect(COURSES.map(course => course.id)).toEqual(['forest', 'coast', 'crystal', 'sky'])
    for (const course of COURSES) {
      expect(course.points.length).toBe(512)
      const lengths = course.points.map((point, index) => {
        const next = course.points[(index + 1) % course.points.length]
        expect(Number.isFinite(point.angle)).toBe(true)
        expect(Math.abs(point.curve)).toBeLessThan(0.06)
        return Math.hypot(next.x - point.x, next.y - point.y)
      })
      expect(Math.max(...lengths) / Math.min(...lengths)).toBeLessThan(1.02)
      expect(sampleTrack(course, course.length)).toEqual(sampleTrack(course, 0))
      expect(sampleTrack(course, -40)).toEqual(sampleTrack(course, course.length - 40))
      const beforeSeam = sampleTrack(course, course.length - 1)
      const afterSeam = sampleTrack(course, 1)
      expect(Math.hypot(beforeSeam.x - afterSeam.x, beforeSeam.y - afterSeam.y)).toBeLessThan(2.1)
    }
  })

  it('never crosses its own road centerline', () => {
    const cross = (ax: number, ay: number, bx: number, by: number) => ax * by - ay * bx
    for (const course of COURSES) {
      const points = course.points.filter((_, index) => index % 4 === 0)
      for (let a = 0; a < points.length; a++) {
        const p = points[a]
        const q = points[(a + 1) % points.length]
        for (let b = a + 2; b < points.length; b++) {
          if (a === 0 && b === points.length - 1) continue
          const r = points[b]
          const s = points[(b + 1) % points.length]
          const side1 = cross(q.x - p.x, q.y - p.y, r.x - p.x, r.y - p.y)
          const side2 = cross(q.x - p.x, q.y - p.y, s.x - p.x, s.y - p.y)
          const side3 = cross(s.x - r.x, s.y - r.y, p.x - r.x, p.y - r.y)
          const side4 = cross(s.x - r.x, s.y - r.y, q.x - r.x, q.y - r.y)
          expect(side1 * side2 < 0 && side3 * side4 < 0).toBe(false)
        }
      }
    }
  })
})

describe('a forgiving two-lap race', () => {
  it('starts behind a staggered pack and gives the player room when a rival passes', () => {
    const state = running()
    expect(getRank(state)).toBe(4)
    expect(state.racers.slice(1).map(racer => racer.distance)).toEqual([70, 140, 210])
    expect(state.racers.slice(1).map(racer => racer.lane)).toEqual([-55, 55, -55])
    // A straight road isolates passing clearance from the outward force of a bend.
    state.course = { ...state.course, points: state.course.points.map(point => ({ ...point, curve: 0 })) }
    state.racers[1].lane = 0
    tick(state, 1.1)
    expect(Math.abs(state.racers[1].lane - state.racers[0].lane)).toBeGreaterThan(52)
    expect(state.racers[0].stun).toBe(0)
  })

  it.each(COURSES)('$id finishes on auto accelerator with no input', course => {
    const state = createRace(course)
    tick(state, 62)
    expect(state.phase).toBe('finished')
    expect(state.racers[0].distance).toBe(course.length * 2)
    expect(state.racers[0].finishTime).toBeGreaterThan(35)
    expect(state.racers[0].finishTime).toBeLessThan(55)
  })

  it.each(COURSES.flatMap(course => [-1, 1].map(steer => ({ course, steer }))))('keeps a held $steer stick on $course.id road for the whole race', ({ course, steer }) => {
    const state = createRace(course)
    let maximumLane = 0
    let closestEdge = Infinity
    let maximumDrift = 0
    for (let frame = 0; frame < 60 * 62; frame++) {
      stepRace(state, { steer, useItem: false }, 1 / 60)
      const racer = state.racers[0]
      maximumLane = Math.max(maximumLane, Math.abs(racer.lane))
      closestEdge = Math.min(closestEdge, widthAt(state) - Math.abs(racer.lane))
      const island = islandAt(course, racer.distance)
      if (island) expect(Math.abs(racer.lane - island.lane)).toBeGreaterThanOrEqual(island.half + 15.9)
      maximumDrift = Math.max(maximumDrift, Math.abs(racer.drift))
    }
    // The road narrows and widens, but the kart always stays clear of the curb.
    expect(closestEdge).toBeGreaterThan(8)
    expect(maximumLane).toBeGreaterThan(60)
    expect(maximumDrift).toBeGreaterThan(0.3)
    expect(state.phase).toBe('finished')
  })

  it('allows off-road exploration with assist off and lets the stick bring the kart back', () => {
    const state = running(false)
    tick(state, 2, 1)
    expect(state.racers[0].lane).toBeGreaterThan(widthAt(state))
    expect(state.racers[0].speed).toBeLessThan(150)
    for (let frame = 0; frame < 240 && Math.abs(state.racers[0].lane) > 50; frame++) stepRace(state, { steer: -1, useItem: false }, 1 / 60)
    expect(Math.abs(state.racers[0].lane)).toBeLessThanOrEqual(50)
    tick(state, 0.5)
    expect(state.racers[0].speed).toBeGreaterThan(230)
  })

  it('leaves the racers at the starting line until the countdown ends', () => {
    const state = createRace(COURSES[0])
    tick(state, 2.5, 1)
    expect(state.phase).toBe('countdown')
    expect(state.racers[0].distance).toBe(0)
    expect(state.racers[0].lane).toBe(0)
    tick(state, 1)
    expect(state.phase).toBe('racing')
    expect(state.racers[0].distance).toBeGreaterThan(30)
  })

  it('smoothly guides an off-road kart back when assistance is enabled mid-race', () => {
    const state = running(false)
    tick(state, 3, 1)
    const outsideLane = state.racers[0].lane
    expect(outsideLane).toBeGreaterThan(widthAt(state))
    state.assist = true
    stepRace(state, { steer: 1, useItem: false }, 1 / 60)
    expect(state.racers[0].lane).toBeLessThan(outsideLane)
    expect(outsideLane - state.racers[0].lane).toBeLessThan(4)
    tick(state, 3, 1)
    expect(Math.abs(state.racers[0].lane)).toBeLessThan(widthAt(state) - 18)
  })

  it('produces identical seeded races and freezes final standings', () => {
    const a = createRace(COURSES[2])
    const b = createRace(COURSES[2])
    tick(a, 60)
    tick(b, 60)
    expect(a).toEqual(b)
    const racers = structuredClone(a.racers)
    const rank = getRank(a)
    tick(a, 10, -1)
    expect(a.racers).toEqual(racers)
    expect(getRank(a)).toBe(rank)
    expect(rank).toBeGreaterThanOrEqual(1)
    expect(rank).toBeLessThanOrEqual(4)
  })
})

describe('items and quick recovery', () => {
  it('awards each box once per crossing and again on the next lap', () => {
    const state = running()
    const racer = state.racers[0]
    const box = state.course.boxes[1]
    racer.lane = box.lane
    racer.distance = box.distance - 1
    stepRace(state, neutral, 1 / 60)
    expect(racer.item).not.toBeNull()
    expect(state.events.some(event => event.kind === 'pickup' && event.racer === 0)).toBe(true)
    racer.item = null
    stepRace(state, neutral, 1 / 60)
    expect(racer.item).toBeNull()
    racer.lane = box.lane
    racer.distance = state.course.length + box.distance - 1
    stepRace(state, neutral, 1 / 60)
    expect(racer.item).not.toBeNull()
  })

  it('only gives an item when the kart drives over a box', () => {
    const state = running()
    const racer = state.racers[0]
    const box = state.course.boxes.find(candidate => !state.course.boxes.some(other => other !== candidate
      && Math.abs(other.distance - candidate.distance) < 60 && Math.abs(other.lane + 60 - candidate.lane) < 60))!
    racer.lane = box.lane - 60
    racer.distance = box.distance - 1
    stepRace(state, neutral, 1 / 60)
    expect(racer.item).toBeNull()
  })

  it('boosts immediately, jumps over puddles, and lets a star clear a stun', () => {
    const state = running()
    equip(state, 'boost')
    tick(state, 0.3)
    expect(state.racers[0].speed).toBeGreaterThan(320)
    equip(state, 'jump')
    state.hazards.push({ id: 500, owner: 1, distance: state.racers[0].distance + 10, lane: state.racers[0].lane, life: 10 })
    tick(state, 0.1)
    expect(state.racers[0].stun).toBe(0)
    expect(state.hazards).toHaveLength(1)
    state.racers[0].stun = 0.2
    equip(state, 'star')
    expect(state.racers[0].stun).toBe(0)
    expect(state.racers[0].star).toBeGreaterThan(3)
    expect(state.racers[0].item).toBeNull()
  })

  it('drops a hazard behind the kart without hurting its owner', () => {
    const state = running()
    equip(state, 'puddle')
    expect(state.hazards[0].distance).toBeLessThan(state.racers[0].distance)
    state.hazards[0].distance = state.racers[0].distance + 4
    state.racers.slice(1).forEach(racer => { racer.distance = -1000 - racer.id * 80 })
    tick(state, 0.1)
    expect(state.racers[0].stun).toBe(0)
    expect(state.hazards).toHaveLength(1)
  })

  it('homes on the next racer across the lap seam and collides with them', () => {
    const state = running()
    state.racers[0].distance = state.course.length - 65
    state.racers[1].distance = state.course.length + 50
    state.racers[1].lane = 46
    state.racers[2].distance = state.course.length + 400
    state.racers[3].distance = state.course.length - 150
    equip(state, 'bomb')
    expect(state.projectiles[0].target).toBe(1)
    let hitTarget = false
    for (let frame = 0; frame < 80; frame++) {
      stepRace(state, neutral, 1 / 60)
      hitTarget ||= state.events.some(event => event.kind === 'hit' && event.racer === 1)
    }
    expect(hitTarget).toBe(true)
    expect(state.projectiles).toHaveLength(0)
  })

  it.each(['jump', 'star'] as const)('%s protects against a homing bomb', item => {
    const state = running()
    equip(state, item)
    state.projectiles.push({ id: 501, owner: 1, target: 0, distance: -8, lane: 0, life: 3 })
    stepRace(state, neutral, 1 / 60)
    expect(state.racers[0].stun).toBe(0)
    expect(state.events.some(event => event.kind === 'hit' && event.racer === 0)).toBe(false)
  })

  it('turns into a nearby target on the opposite side without flying past them', () => {
    const state = running(false)
    state.course = { ...state.course, points: state.course.points.map(point => ({ ...point, curve: 0 })) }
    state.racers[0].lane = -80
    state.racers[1].distance = 20
    state.racers[1].lane = 80
    state.racers[2].distance = 900
    state.racers[3].distance = 1200
    equip(state, 'bomb')
    let hitTarget = false
    for (let frame = 0; frame < 60; frame++) {
      stepRace(state, neutral, 1 / 60)
      hitTarget ||= state.events.some(event => event.kind === 'hit' && event.racer === 1)
    }
    expect(hitTarget).toBe(true)
    expect(state.projectiles).toHaveLength(0)
  })

  it('recovers from a hit in under a second with protection from repeated hits', () => {
    const state = running()
    state.hazards.push({ id: 502, owner: 1, distance: 5, lane: 0, life: 3 })
    stepRace(state, neutral, 1 / 60)
    expect(state.racers[0].stun).toBeLessThanOrEqual(0.3)
    expect(state.racers[0].stun).toBeGreaterThan(0)
    expect(state.racers[0].protection).toBeGreaterThanOrEqual(1.5)
    const firstHitId = state.events.find(event => event.kind === 'hit')!.id
    tick(state, 0.8)
    expect(state.racers[0].stun).toBe(0)
    expect(state.racers[0].speed).toBeGreaterThanOrEqual(240)
    state.hazards.push({ id: 503, owner: 1, distance: state.racers[0].distance + 5, lane: state.racers[0].lane, life: 3 })
    stepRace(state, neutral, 1 / 60)
    expect(state.events.some(event => event.kind === 'hit')).toBe(false)
    tick(state, 1.3)
    state.hazards.push({ id: 504, owner: 1, distance: state.racers[0].distance + 5, lane: state.racers[0].lane, life: 3 })
    stepRace(state, neutral, 1 / 60)
    expect(state.events.find(event => event.kind === 'hit')!.id).toBeGreaterThan(firstHitId)
  })

  it('lets CPU racers collect and use items', () => {
    const state = running()
    let used = false
    let collected = false
    for (let frame = 0; frame < 60 * 20; frame++) {
      stepRace(state, neutral, 1 / 60)
      collected ||= state.events.some(event => event.racer !== 0 && event.kind === 'pickup')
      used ||= state.events.some(event => event.racer !== 0 && ['boost', 'star', 'jump', 'bomb', 'puddle'].includes(event.kind))
    }
    expect(collected).toBe(true)
    expect(used).toBe(true)
  })
})

describe('course features', () => {
  const place = (state: RaceState, distance: number, lane: number) => {
    const racer = state.racers[0]
    racer.distance = distance
    racer.lane = lane
    state.racers.slice(1).forEach(rival => { rival.distance = distance - 2000 - rival.id * 80 })
    return racer
  }

  it('gives every course narrow and wide sections, rough patches, dash panels, an island and scattered boxes', () => {
    for (const course of COURSES) {
      const widths = course.points.map(point => point.width)
      expect(Math.min(...widths)).toBeLessThan(90)
      expect(Math.max(...widths)).toBeGreaterThan(125)
      for (const kind of ['rough', 'dash', 'island'] as const) expect(course.zones.some(zone => zone.kind === kind)).toBe(true)
      for (const zone of course.zones) {
        expect(zone.start).toBeLessThan(zone.end)
        const width = Math.min(sampleTrack(course, zone.start).width, sampleTrack(course, zone.end).width)
        expect(Math.abs(zone.lane) + zone.half).toBeLessThanOrEqual(width)
      }
      for (const box of course.boxes) expect(Math.abs(box.lane)).toBeLessThan(sampleTrack(course, box.distance).width - 10)
      expect(new Set(course.boxes.map(box => box.lane)).size).toBeGreaterThan(6)
    }
  })

  it('slows karts on rough ground unless they jump over it', () => {
    const state = running()
    const rough = state.course.zones.find(zone => zone.kind === 'rough' && zone.end - zone.start > 120)!
    place(state, rough.start + 5, rough.lane)
    state.course = { ...state.course, points: state.course.points.map(point => ({ ...point, curve: 0 })) }
    tick(state, 0.4)
    expect(state.racers[0].rough).toBe(true)
    expect(state.racers[0].speed).toBeLessThan(170)
    const jumping = running()
    jumping.course = state.course
    place(jumping, rough.start + 5, rough.lane)
    equip(jumping, 'jump')
    tick(jumping, 0.4)
    expect(jumping.racers[0].speed).toBeGreaterThan(240)
  })

  it('boosts a kart that drives over a dash panel', () => {
    const state = running()
    const dash = state.course.zones.find(zone => zone.kind === 'dash')!
    place(state, dash.start - 4, dash.lane)
    tick(state, 0.1)
    expect(state.events.some(event => event.kind === 'dash') || state.racers[0].boost > 0).toBe(true)
    tick(state, 0.3)
    expect(state.racers[0].speed).toBeGreaterThan(300)
  })

  it('splits the road at an island that no kart can drive through', () => {
    for (const assist of [true, false]) {
      const state = running(assist)
      const island = state.course.zones.find(zone => zone.kind === 'island')!
      place(state, island.start - 30, island.lane)
      for (let frame = 0; frame < 60 * 2; frame++) {
        stepRace(state, neutral, 1 / 60)
        const at = islandAt(state.course, state.racers[0].distance)
        if (at) expect(Math.abs(state.racers[0].lane - at.lane)).toBeGreaterThanOrEqual(at.half + 15.9)
      }
      expect(state.racers[0].distance).toBeGreaterThan(island.end)
      // Glancing off the tip costs a little speed, which comes straight back.
      expect(state.racers[0].speed).toBeGreaterThan(190)
      if (assist) {
        tick(state, 1)
        expect(state.racers[0].speed).toBeGreaterThan(230)
      }
    }
  })

  it('rewards the inside line of a bend', () => {
    const progress = (lane: number) => {
      const state = running()
      const bend = state.course.points.reduce((best, point, index) => point.curve > state.course.points[best].curve ? index : best, 0)
      const start = bend / state.course.points.length * state.course.length - 60
      state.course = { ...state.course, zones: [] }
      const racer = place(state, start, lane)
      stepRace(state, neutral, 1 / 60)
      return racer.distance - start
    }
    expect(progress(60)).toBeGreaterThan(progress(0))
    expect(progress(0)).toBeGreaterThan(progress(-60))
  })

  it('lets a steering driver beat a hands-off one on every course', () => {
    for (const course of COURSES) {
      const idle = createRace(course)
      tick(idle, 62)
      const driven = createRace(course)
      for (let frame = 0; frame < 60 * 62 && driven.phase !== 'finished'; frame++) {
        const racer = driven.racers[0]
        const ahead = sampleTrack(course, racer.distance + 120)
        let target = Math.sign(ahead.curve) * ahead.width * 0.6
        for (const zone of course.zones) {
          const gap = zone.start - racer.distance % course.length
          if (gap < -(zone.end - zone.start) || gap > 200) continue
          if (zone.kind === 'rough' && Math.abs(target - zone.lane) < zone.half + 20) target = target < zone.lane ? zone.lane - zone.half - 22 : zone.lane + zone.half + 22
          if (zone.kind === 'dash') target = zone.lane
        }
        stepRace(driven, { steer: Math.max(-1, Math.min(1, (target - racer.lane) / 30)), useItem: false }, 1 / 60)
      }
      expect(driven.racers[0].finishTime!).toBeLessThan(idle.racers[0].finishTime! - 3)
    }
  })
})
