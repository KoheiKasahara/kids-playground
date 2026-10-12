import { describe, expect, test } from 'vitest'
import {
  BOX_HALF, RING_RADIUS, START_X, STAT_LEVELS, TAP_COOLDOWN_MS, WRESTLERS,
  behindPoint, clampToBox, computerTapPoint, createSumoState, isSettled, stepSumo, tapSide, tapSumo,
  type Side, type SumoState,
} from './sumoGame'
import { clientToView, project, unproject, WIDE_VIEW } from './projection'

const steady = () => 0.5
function settle(state: SumoState, seconds = 2) {
  for (let n = 0; n < seconds * 60 && !isSettled(state); n++) state = stepSumo(state)
  return state
}
/** Taps just behind one wrestler until the bout is decided. */
function driveOut(side: Side, left = 0, right = 1) {
  let state = createSumoState(left, right)
  for (let tap = 0, frame = 0; tap < 200 && !state.winner; frame++) {
    if (frame % 15 === 0) state = tapSumo(state, behindPoint(state, side), side, frame * 1000 / 60, steady)
    state = stepSumo(state)
    if (frame % 15 === 0) tap++
  }
  return state
}

describe('paper sumo physics', () => {
  test('characters have unique keys and names and sensible stats', () => {
    expect(new Set(WRESTLERS.map((w) => w.key)).size).toBe(WRESTLERS.length)
    expect(new Set(WRESTLERS.map((w) => w.name)).size).toBe(WRESTLERS.length)
    expect(WRESTLERS.length).toBeGreaterThanOrEqual(8)
    for (const { stats } of WRESTLERS) {
      for (const value of Object.values(stats)) expect(value).toBeGreaterThan(0)
      expect(stats.width * 2).toBeLessThan(START_X * 2 + 0.2)
    }
  })

  test('size and weight are shown as levels and shape how each figure moves', () => {
    for (const { size, weight } of WRESTLERS) {
      for (const level of [size, weight]) expect(Number.isInteger(level) && level >= 1 && level <= STAT_LEVELS).toBe(true)
    }
    const index = (key: string) => WRESTLERS.findIndex((w) => w.key === key)
    const frog = WRESTLERS[index('frog')]!
    const bear = WRESTLERS[index('bear')]!
    expect(bear.stats.scale).toBeGreaterThan(frog.stats.scale)
    expect(bear.stats.mass).toBeGreaterThan(frog.stats.mass)
    // The same tap sends a light figure farther and higher than a heavy one.
    const tapped = (who: number) => settle(tapSumo(createSumoState(who, who), { x: -1.2, z: 0 }, 'left', 0, steady), 0.15).bodies.left
    const light = tapped(index('frog'))
    const heavy = tapped(index('bear'))
    expect(light.x).toBeGreaterThan(heavy.x)
    expect(light.y).toBeGreaterThan(heavy.y)
    // A heavy figure shoves a light one back harder than the other way round.
    const shove = (a: number, b: number) => {
      const state = createSumoState(a, b)
      const reach = WRESTLERS[a]!.stats.width + WRESTLERS[b]!.stats.width
      let pair: SumoState = { ...state, bodies: {
        left: { ...state.bodies.left, x: -reach / 2, vx: 2 },
        right: { ...state.bodies.right, x: reach / 2 },
      } }
      for (let n = 0; n < 20; n++) pair = stepSumo(pair)
      return pair.bodies.right.x - reach / 2
    }
    expect(shove(index('bear'), index('frog'))).toBeGreaterThan(shove(index('frog'), index('bear')))
  })

  test('bouts end both by falling over and by being pushed out', () => {
    const finishes = { out: 0, fall: 0 }
    let seed = 7
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    for (let left = 0; left < WRESTLERS.length; left += 2) {
      for (let right = 1; right < WRESTLERS.length; right += 2) {
        let state = createSumoState(left, right)
        for (let frame = 0; frame < 60 * 40 && !state.winner; frame++) {
          if (frame % 14 === 0) state = tapSumo(state, behindPoint(state, 'left', random, 2), 'left', frame * 1000 / 60, random)
          if (frame % 14 === 7) state = tapSumo(state, behindPoint(state, 'right', random, 2), 'right', frame * 1000 / 60, random)
          state = stepSumo(state)
        }
        if (state.finish) finishes[state.finish]++
      }
    }
    expect(finishes.fall).toBeGreaterThanOrEqual(6)
    expect(finishes.out).toBeGreaterThanOrEqual(6)
  }, 30_000)

  test('a fresh bout is at rest, face to face, and nothing moves without a tap', () => {
    const state = createSumoState(2, 5)
    expect(state.fighters).toEqual({ left: 2, right: 5 })
    expect(state.bodies.left.x).toBeLessThan(0)
    expect(state.bodies.right.x).toBeGreaterThan(0)
    expect(isSettled(state)).toBe(true)
    const later = settle(stepSumo(state))
    expect(later.bodies.left.x).toBeCloseTo(state.bodies.left.x)
    expect(later.winner).toBeNull()
  })

  test.each<Side>(['left', 'right'])('tapping behind %s drives it forward and pushes the other out', (side) => {
    const state = driveOut(side)
    expect(state.winner).toBe(side)
    expect(state.finish).not.toBeNull()
    const loser = state.bodies[side === 'left' ? 'right' : 'left']
    expect(loser.fallen || Math.hypot(loser.x, loser.z) > RING_RADIUS).toBe(true)
    expect(tapSumo(state, { x: 0, z: 0 }, 'left', 1e9)).toBe(state)
  })

  test('the tap position changes how the figures move', () => {
    const start = createSumoState(0, 0)
    const fromBehind = settle(tapSumo(start, { x: -1.2, z: 0 }, 'left', 0, steady))
    const fromFront = settle(tapSumo(start, { x: start.bodies.left.x, z: -0.9 }, 'left', 0, steady))
    const fromMiddle = settle(tapSumo(start, { x: 0, z: 0 }, 'left', 0, steady))
    expect(fromBehind.bodies.left.x).toBeGreaterThan(start.bodies.left.x + 0.05)
    expect(fromFront.bodies.left.z).toBeGreaterThan(0.03)
    // A tap between them makes both hop apart.
    expect(fromMiddle.bodies.right.x).toBeGreaterThan(start.bodies.right.x)
    expect(fromMiddle.bodies.left.x - start.bodies.left.x).toBeLessThan(fromBehind.bodies.left.x - start.bodies.left.x)
    // Every tap bounces the paper.
    expect(stepSumo(tapSumo(start, { x: 1.2, z: 0.8 }, 'left', 0, steady)).bodies.right.y).toBeGreaterThan(0)
  })

  test('cooldown is per player, so two players can tap at the same moment', () => {
    const first = tapSumo(createSumoState(), { x: -1, z: 0 }, 'left', 0, steady)
    expect(tapSumo(first, { x: -1, z: 0 }, 'left', TAP_COOLDOWN_MS - 1, steady)).toBe(first)
    expect(tapSumo(first, { x: -1, z: 0 }, 'left', TAP_COOLDOWN_MS, steady).taps).toBe(2)
    expect(tapSumo(first, { x: 1, z: 0 }, 'right', 0, steady).taps).toBe(2)
  })

  test('a mirrored bout stays mirrored', () => {
    let state = createSumoState(3, 3)
    for (let frame = 0; frame < 600 && !state.winner; frame++) {
      if (frame % 20 === 0) {
        state = tapSumo(state, behindPoint(state, 'left'), 'left', frame * 17, steady)
        state = tapSumo(state, behindPoint(state, 'right'), 'right', frame * 17, steady)
      }
      state = stepSumo(state)
    }
    expect(state.bodies.left.x).toBeCloseTo(-state.bodies.right.x, 5)
    expect(state.bodies.left.lean).toBeCloseTo(state.bodies.right.lean, 5)
  })

  test('figures that meet lean on each other and push as a pair instead of bouncing apart', () => {
    const state = createSumoState(0, 0)
    const reach = WRESTLERS[0]!.stats.width * 2
    let pair: SumoState = { ...state, bodies: {
      left: { ...state.bodies.left, x: -reach / 2, vx: 3 },
      right: { ...state.bodies.right, x: reach / 2 },
    } }
    for (let n = 0; n < 30; n++) {
      pair = stepSumo(pair)
      expect(pair.bodies.right.x - pair.bodies.left.x).toBeLessThan(reach + 0.005)
    }
    expect(pair.bodies.right.x).toBeGreaterThan(reach / 2 + 0.02)
    expect(pair.winner).toBeNull()
  })

  test('knocked far enough over, a figure falls and loses', () => {
    const state = createSumoState()
    const wobbling = { ...state, bodies: { ...state.bodies, right: { ...state.bodies.right, leanVel: -12 } } }
    const after = settle(wobbling)
    expect(after.winner).toBe('left')
    expect(after.finish).toBe('fall')
    expect(after.bodies.right.fallen).toBe(true)
    expect(Math.abs(after.bodies.right.lean)).toBeCloseTo(1.5)
  })

  test('figures cannot leave the box and topple over its rim', () => {
    const state = createSumoState()
    const flung = { ...state, bodies: { ...state.bodies, left: { ...state.bodies.left, vx: -40 } } }
    const after = settle(flung)
    expect(after.bodies.left.x).toBeGreaterThanOrEqual(-BOX_HALF.x)
    expect(after.bodies.left.fallen).toBe(true)
    expect(after.winner).toBe('right')
  })

  test('taps off the box land on its rim; each half belongs to one player', () => {
    expect(clampToBox({ x: -9, z: 9 })).toEqual({ x: -BOX_HALF.x, z: BOX_HALF.z })
    expect(tapSide({ x: -0.1, z: 0 })).toBe('left')
    expect(tapSide({ x: 0.1, z: 0 })).toBe('right')
    const state = createSumoState()
    const cpu = computerTapPoint(state, steady)
    expect(cpu.x).toBeGreaterThan(state.bodies.right.x)
  })

  test('screen ↔ box projection round-trips through the letterboxed SVG', () => {
    const p = project(0.4, -0.3)
    const back = unproject(p.x, p.y)
    expect(back.x).toBeCloseTo(0.4)
    expect(back.z).toBeCloseTo(-0.3)
    const rect = { left: 10, top: 0, width: WIDE_VIEW.width, height: WIDE_VIEW.height + 200 }
    expect(clientToView(WIDE_VIEW, rect, 10, 100)).toEqual({ x: WIDE_VIEW.x, y: WIDE_VIEW.y })
    expect(clientToView(WIDE_VIEW, { left: 0, top: 0, width: 0, height: 0 }, 1, 1)).toBeNull()
  })
})
