import { describe, expect, test } from 'vitest'
import { createFloaterState, stepFloater, type FloaterState } from './floatModel'
import {
  createInitialTrail,
  FOLLOW_GAP,
  recordTrail,
  restingY,
  sampleTrail,
  slotDistances,
  stepFollowers,
  TRAIL_STEP,
  type FollowEnvironment,
  type TrailPoint,
} from './followModel'
import { createWaterField } from './waterModel'
import type { WaterBodyDefinition } from './types'

const pool: WaterBodyDefinition = { id: 'main', label: 'みず', left: 0, right: 200, floorY: 126, ceilingY: 30, initialLevel: 40 }
const environment: FollowEnvironment = {
  solids: [{ x: 0, y: 126, width: 200, height: 14 }],
  waterBodies: [pool],
  water: createWaterField([pool]),
}
const SURFACE = 126 - 40
const DT = 1 / 60

function floater(id: string, x: number, y: number, facing: -1 | 1 = 1): FloaterState {
  return { id, x, y, vx: 0, vy: 0, submergedRatio: 0.4, facing }
}

/** 隊長を x へ動かしながら道すじを記録し、仲間を毎ステップついてこさせる。 */
function walk(
  leaderStart: FloaterState,
  toX: number,
  speed: number,
  followers: FloaterState[],
  trail: readonly TrailPoint[],
  radii = followers.map(() => 5),
) {
  let leader = leaderStart
  let party = followers
  const frames: { leader: FloaterState; party: FloaterState[] }[] = []
  const direction = Math.sign(toX - leader.x)
  while (Math.abs(toX - leader.x) > 0.01) {
    const x = Math.abs(toX - leader.x) < speed * DT ? toX : leader.x + direction * speed * DT
    leader = { ...leader, x, facing: direction > 0 ? 1 : -1 }
    trail = recordTrail(trail, leader, false, 200)
    party = stepFollowers(leader, 5.5, false, trail, party.map((state, index) => ({ state, radius: radii[index] })), environment, DT)
    frames.push({ leader, party })
  }
  for (let i = 0; i < 60; i++) {
    party = stepFollowers(leader, 5.5, false, trail, party.map((state, index) => ({ state, radius: radii[index] })), environment, DT)
  }
  return { leader, party, trail, frames }
}

describe('隊列の道すじ', () => {
  test('となりどうしの間隔は半径の和とすきまで決まる', () => {
    expect(slotDistances(5.5, [4, 5])).toEqual([5.5 + 4 + FOLLOW_GAP, 5.5 + 4 + FOLLOW_GAP + 4 + 5 + FOLLOW_GAP])
  })

  test('小さな揺れでは点を増やさず、先頭の高さだけ今の隊長にそろえる', () => {
    const trail = recordTrail([], { x: 50, y: 80 }, false, 100)
    const wobble = recordTrail(trail, { x: 50 + TRAIL_STEP / 2, y: 70 }, false, 100)
    expect(wobble).toHaveLength(1)
    expect(wobble[0].y).toBe(70)
    const moved = recordTrail(wobble, { x: 50 + TRAIL_STEP * 2, y: 70 }, false, 100)
    expect(moved).toHaveLength(2)
  })

  test('水位で上下するだけ（横に動かない）の間は道すじが伸びない。ジャンプ中は高さも長さに数える', () => {
    let trail = recordTrail([], { x: 50, y: 100 }, false, 100)
    trail = recordTrail(trail, { x: 50, y: 60 }, false, 100)
    expect(trail).toHaveLength(1)
    trail = recordTrail(trail, { x: 50, y: 40 }, true, 100)
    expect(trail).toHaveLength(2)
    expect(sampleTrail({ x: 50, y: 40 }, true, trail, 10)).toMatchObject({ x: 50, y: 50, exact: true })
  })

  test('古い点は保つ長さをこえたら捨てる', () => {
    let trail: readonly TrailPoint[] = []
    for (let x = 0; x <= 200; x += 1) trail = recordTrail(trail, { x, y: 80 }, false, 30)
    expect(trail.length).toBeLessThan(40)
    expect(sampleTrail({ x: 200, y: 80 }, false, trail, 500).x).toBeGreaterThan(160)
  })

  test('始まりの道すじは水域の中だけで後ろへのびる', () => {
    const trail = createInitialTrail({ x: 30, y: 80 }, -1, 20, 180, 60)
    expect(Math.min(...trail.map((point) => point.x))).toBeGreaterThanOrEqual(20)
    expect(trail[0]).toMatchObject({ x: 30, y: 80 })
  })
})

describe('仲間の高さ', () => {
  test('水面に浮き、水のない台では台の上に立ち、天井はこえない', () => {
    expect(restingY(environment, 50, 60, 5)).toBeCloseTo(SURFACE - 5 * 0.2, 5)
    const island = { ...environment, solids: [...environment.solids, { x: 40, y: 70, width: 20, height: 56 }] }
    expect(restingY(island, 50, 60, 5)).toBe(65)
    const tunnel = { ...environment, solids: [...environment.solids, { x: 40, y: 0, width: 20, height: 90 }] }
    expect(restingY(tunnel, 50, 100, 5)).toBe(95)
  })
})

describe('隊列でついてくる', () => {
  test('隊長のうしろに間隔をあけて1列に並ぶ', () => {
    const leader = floater('duck', 40, SURFACE - 1.1)
    const trail = createInitialTrail(leader, -1, 5, 195, 60)
    const { leader: end, party } = walk(leader, 120, 24, [floater('a', 30, 90), floater('b', 20, 90)], trail)
    const [first, second] = party
    expect(end.x - first.x).toBeCloseTo(5.5 + 5 + FOLLOW_GAP, 0)
    expect(first.x - second.x).toBeCloseTo(5 + 5 + FOLLOW_GAP, 0)
    for (const member of party) {
      expect(member.y).toBeCloseTo(SURFACE - 1, 0)
      expect(member.facing).toBe(1)
    }
  })

  test('逆向きに進むと、仲間は来た道をたどって隊長とすれちがい、頭の上をとびこえて入れ替わる', () => {
    const leader = floater('duck', 40, SURFACE - 1.1)
    const trail = createInitialTrail(leader, -1, 5, 195, 60)
    const right = walk(leader, 120, 24, [floater('a', 30, 90), floater('b', 20, 90)], trail)
    const back = walk({ ...right.leader, facing: -1 }, 60, 24, right.party, right.trail)
    // 最後は隊長の右（うしろ）に同じ順番で並びなおす。
    expect(back.party[0].x).toBeGreaterThan(back.leader.x)
    expect(back.party[1].x).toBeGreaterThan(back.party[0].x)
    expect(back.party.every((member) => member.facing === -1)).toBe(true)
    // すれちがう瞬間、仲間は隊長に重ならず上へよける（ぴょんととびこえる）。
    let hopped = false
    for (const frame of back.frames) {
      for (const member of frame.party) {
        const dx = Math.abs(member.x - frame.leader.x)
        if (dx < 2) {
          expect(member.y).toBeLessThan(frame.leader.y - 5)
          hopped = true
        }
      }
    }
    expect(hopped).toBe(true)
    // 瞬間移動はしない（1ステップで動くのは最大速度まで）。
    for (let i = 1; i < back.frames.length; i++) {
      const before = back.frames[i - 1].party[0]
      const after = back.frames[i].party[0]
      expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThanOrEqual(95 * DT + 1e-9)
    }
  })

  test('ジャンプの軌道は高さまでなぞり、隊長が着水した後は宙に残らず後ろへおりる', () => {
    const start = floater('duck', 40, SURFACE - 1.1)
    let trail: readonly TrailPoint[] = createInitialTrail(start, -1, 5, 195, 60)
    let party = [floater('a', 30, SURFACE - 1)]
    let leader = start
    // 放物線のジャンプ。
    for (let t = 0; t <= 1; t += DT) {
      leader = { ...leader, x: 40 + 40 * t, y: SURFACE - 1.1 - 120 * t + 120 * t * t, facing: 1 }
      trail = recordTrail(trail, leader, true, 200)
      party = stepFollowers(leader, 5.5, true, trail, [{ state: party[0], radius: 5 }], environment, DT)
    }
    const midFlight = party[0]
    expect(midFlight.y).toBeLessThan(SURFACE - 10)
    for (let i = 0; i < 90; i++) {
      party = stepFollowers(leader, 5.5, false, trail, [{ state: party[0], radius: 5 }], environment, DT)
    }
    expect(party[0].y).toBeCloseTo(SURFACE - 1, 0)
    expect(leader.x - party[0].x).toBeCloseTo(5.5 + 5 + FOLLOW_GAP, 0)
  })
})

describe('打ち上げ', () => {
  const definition = { id: 'duck', kind: 'duck' as const, radius: 5.5, startX: 20, startY: 100 }
  const context = {
    surfaceY: 100,
    solids: [{ x: 30, y: 80, width: 8, height: 60 }],
    bounds: { width: 100, height: 150 },
    driftDirection: 0,
  }

  test('打ち上げ中は横の速さを保ち、壁ぞいに上がって上端をこえると向こうへ進む', () => {
    let state: FloaterState = { ...createFloaterState(definition), x: 24.5, vy: -110, launchMs: 2000, carryVx: 30 }
    let maxX = state.x
    for (let i = 0; i < 90; i++) {
      state = stepFloater(definition, state, { ...context, surfaceY: state.x > 38 ? 140 : 100 }, DT)
      maxX = Math.max(maxX, state.x)
    }
    expect(maxX).toBeGreaterThan(38 + 5.5)
    expect(state.facing).toBe(1)
  })

  test('下りながら水に入ると打ち上げが終わり、ふだんの浮き方にもどる', () => {
    let state: FloaterState = { ...createFloaterState(definition), y: 80, vy: 60, launchMs: 2000, carryVx: 0 }
    for (let i = 0; i < 40 && (state.launchMs ?? 0) > 0; i++) state = stepFloater(definition, state, context, DT)
    expect(state.launchMs ?? 0).toBe(0)
  })

  test('向きは横速度で決まり、ゆっくりな揺れでは変わらない', () => {
    const still = stepFloater(definition, { ...createFloaterState(definition), facing: -1, vx: 1 }, context, DT)
    expect(still.facing).toBe(-1)
    const moving = stepFloater(definition, { ...createFloaterState(definition), facing: -1, vx: 20 }, context, DT)
    expect(moving.facing).toBe(1)
  })
})
