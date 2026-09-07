import { describe, expect, test } from 'vitest'
import { applyWave, createInitialState, FIXED_STEP_MS, stepGame, toggleDrain, toggleGate, type PukupukaGameState } from './pukupukaGame'
import { PUKUPUKA_STAGES } from './stageDefinitions'
import type { StageDefinition } from './types'

function run(stage: StageDefinition, state: PukupukaGameState, frames = 60) {
  for (let i = 0; i < frames; i++) state = stepGame(stage, state, FIXED_STEP_MS).state
  return state
}
const pool: StageDefinition = {
  ...PUKUPUKA_STAGES[0], solids: [], ambientDriftScale: 0,
  waterBodies: [{ id: 'main', label: 'みず', left: 0, right: 100, floorY: 126, ceilingY: 30, initialLevel: 50 }],
  floaters: [{ id: 'duck', kind: 'duck', radius: 8, startX: 50, startY: 74 }],
  goal: { area: { x: 85, y: 65, width: 10, height: 20 }, floaterIds: ['duck'] },
  stars: [{ id: 'near', x: 60, y: 74 }, { id: 'far', x: 80, y: 74 }],
}

describe('波で運ぶレスキュー', () => {
  test('左をタップすると右へ、右をタップすると左へ移動し、波は消える', () => {
    const initial = createInitialState(pool)
    const right = run(pool, applyWave(pool, initial, 36, 80))
    const left = run(pool, applyWave(pool, initial, 64, 80))
    expect(right.floaters[0].x).toBeGreaterThan(57)
    expect(left.floaters[0].x).toBeLessThan(43)
    expect(run(pool, right, 1).wave).toBeNull()
    expect(run(pool, initial).floaters[0].x).toBe(50)
  })
  test('乾いた水槽、空、壁、範囲外、クリア後は波が起きない', () => {
    const state = createInitialState(pool)
    for (const [x, y] of [[50, 20], [-1, 80], [50, 140], [NaN, 80]]) {
      expect(applyWave(pool, state, x, y)).toBe(state)
    }
    const dry = { ...pool, waterBodies: pool.waterBodies.map((body) => ({ ...body, initialLevel: 0 })) }
    const dryState = createInitialState(dry)
    expect(applyWave(dry, dryState, 50, 124)).toBe(dryState)
    const wall = { ...pool, solids: [{ id: 'wall', kind: 'wall' as const, x: 30, y: 30, width: 10, height: 96 }] }
    expect(applyWave(wall, state, 35, 80)).toBe(state)
    const cleared = { ...state, phase: 'cleared' as const }
    expect(applyWave(pool, cleared, 36, 80)).toBe(cleared)
  })
  test('閉じた水門を波の連打で通り抜けず、向こうの水域へ力を伝えない', () => {
    const stage = PUKUPUKA_STAGES[2]
    let state = createInitialState(stage)
    for (let i = 0; i < 300; i++) state = stepGame(stage, state, FIXED_STEP_MS, 'fill').state
    for (let i = 0; i < 300; i++) {
      state = applyWave(stage, state, 25, 40)
      state = stepGame(stage, state, FIXED_STEP_MS).state
    }
    expect(state.floaters.every((item) => item.x < stage.gate!.x)).toBe(true)
    const remote = { ...state, floaters: [{ ...state.floaters[0], x: 80, y: 110, vx: 0, vy: 0 }] }
    expect(run(stage, applyWave(stage, remote, 40, 40)).floaters).toEqual(run(stage, { ...remote, wave: null }).floaters)
  })
  test('波に乗って星を拾い、1回だけ記録する。星なしでも救助できる', () => {
    let state = run(pool, applyWave(pool, createInitialState(pool), 36, 80))
    expect(state.collectedStarIds).toContain('near')
    state = run(pool, state, 120)
    expect(state.collectedStarIds.filter((id) => id === 'near')).toHaveLength(1)
    const atGoal = { ...createInitialState(pool), floaters: [{ ...state.floaters[0], x: 94, y: 75 }] }
    const result = stepGame(pool, atGoal, FIXED_STEP_MS)
    expect(result.goalReached).toBe(true)
    expect(result.state.collectedStarIds).toHaveLength(0)
  })
  test('1人ずつ救助して固定し、後の排水・逆向きの波でも取り消さない', () => {
    const stage = { ...pool, floaters: [...pool.floaters, { id: 'bear', kind: 'ringBear' as const, radius: 7, startX: 20, startY: 74 }], goal: { ...pool.goal, floaterIds: ['duck', 'bear'] } }
    const initial = createInitialState(stage)
    let state = run(stage, { ...initial, floaters: initial.floaters.map((item) => item.id === 'duck' ? { ...item, x: 90 } : item) }, 1)
    expect(state.phase).toBe('playing')
    expect(state.rescuedIds).toEqual(['duck'])
    const saved = state.floaters[0]
    state = run(stage, applyWave(stage, toggleDrain(state), 97, 80), 120)
    expect(state.floaters[0]).toEqual(saved)
    state = { ...state, floaters: state.floaters.map((item) => item.id === 'bear' ? { ...item, x: 90, y: 75 } : item) }
    const result = stepGame(stage, state, FIXED_STEP_MS)
    expect(result.goalReached).toBe(true)
    expect(stepGame(stage, result.state, FIXED_STEP_MS).goalReached).toBe(false)
    expect(createInitialState(stage).rescuedIds).toEqual([])
    expect(createInitialState(stage).collectedStarIds).toEqual([])
  })
  test('途中で水門を開閉しても波の強さは連打で蓄積しない', () => {
    let state = createInitialState(pool)
    for (let i = 0; i < 120; i++) {
      state = stepGame(pool, applyWave(pool, toggleGate(state), 36, 80), FIXED_STEP_MS).state
      expect(Math.abs(state.floaters[0].vx)).toBeLessThan(110)
      expect(Number.isFinite(state.floaters[0].y)).toBe(true)
    }
  })
})
