import { describe, expect, test } from 'vitest'
import { applyWave, createInitialState, stepGame, toggleBoard, toggleDrain, toggleGate, waterSurfaceYOf, type PukupukaGameState } from './pukupukaGame'
import { PUKUPUKA_STAGES } from './stageDefinitions'
import type { StageDefinition } from './types'

function run(stage: StageDefinition, state: PukupukaGameState, seconds: number, fill = false) {
  for (let i = 0; i < Math.round(seconds * 60); i++) state = stepGame(stage, state, 1000 / 60, fill ? 'fill' : null).state
  return state
}

function solve(stage: StageDefinition, initial = createInitialState(stage)) {
  let state = run(stage, initial, 8, true)
  if (stage.board && state.boardFlowDirection === 'back') state = toggleBoard(state)
  if (stage.gate && !state.gateOpen) state = toggleGate(state)
  state = run(stage, state, 10, true)
  state = toggleDrain(state)
  if (stage.levelMarkerY) {
    for (let i = 0; i < 600 && waterSurfaceYOf(stage, state, 'right') < stage.levelMarkerY; i++) state = run(stage, state, 1 / 60)
    state = run(stage, toggleDrain(state), 8)
    state = toggleDrain(state)
  }
  return run(stage, state, 12)
}

describe('救助パークの配置', () => {
  test('全6面で蛇口は壁付け、栓は露出した床か壁の内面にあり、全操作が全景に収まる', () => {
    expect(PUKUPUKA_STAGES).toHaveLength(6)
    expect(new Set(PUKUPUKA_STAGES.map(s => s.id)).size).toBe(6)
    for (const stage of PUKUPUKA_STAGES) {
      expect(stage.viewportWidth ?? stage.width).toBe(stage.width)
      expect(stage.faucet).toBeDefined()
      expect(stage.drain).toBeDefined()
      const faucet = stage.faucet!
      expect(stage.solids.some(s => s.x + s.width === faucet.x - 8 && faucet.y > s.y && faucet.y < s.y + s.height)).toBe(true)
      const drain = stage.drain!
      const water = stage.waterBodies.find(b => b.id === drain.sourceBodyId)!
      expect(water).toBeDefined()
      expect(drain.x).toBeGreaterThanOrEqual(water.left)
      expect(drain.x).toBeLessThanOrEqual(water.right)
      // 栓のすぐ内側が水に露出し、台や壁に埋まっていない。
      const insideX = drain.x + (drain.orientation === 'left-wall' ? 0.1 : drain.orientation === 'right-wall' ? -0.1 : 0)
      const insideY = drain.y - (drain.orientation && drain.orientation !== 'floor' ? 0 : 0.1)
      expect(stage.solids.some(s => insideX > s.x && insideX < s.x + s.width && insideY > s.y && insideY < s.y + s.height)).toBe(false)
      for (const f of stage.floaters) {
        expect(stage.goal.floaterIds).toContain(f.id)
        expect(stage.solids.some(s => f.startX > s.x && f.startX < s.x + s.width && f.startY > s.y && f.startY < s.y + s.height)).toBe(false)
      }
    }
  })
  test('水門を壁上にも壁の途中にも設置し、後半の仲間は途中の足場で待つ', () => {
    expect(PUKUPUKA_STAGES[2].gate!.y).toBe(22)
    for (const stage of PUKUPUKA_STAGES.slice(4)) {
      const gate = stage.gate!
      expect(stage.solids.some(s => s.x === gate.x && s.y + s.height === gate.y)).toBe(true)
      expect(stage.solids.some(s => s.x === gate.x && s.y === gate.y + gate.height)).toBe(true)
    }
    for (const stage of PUKUPUKA_STAGES.slice(1)) {
      const bear = stage.floaters.find(f => f.kind === 'ringBear')!
      const idle = run(stage, createInitialState(stage), 10).floaters.find(f => f.id === bear.id)!
      expect(idle.y).toBeCloseTo(bear.startY, 1)
      expect(idle.x).toBeCloseTo(bear.startX, 1)
    }
  })
})

describe('全ステージの攻略と操作の必要性', () => {
  test.each(PUKUPUKA_STAGES)('$id は放置では終わらず、注水・水門・排水の手順で全員救助できる', stage => {
    expect(run(stage, createInitialState(stage), 20).phase).toBe('playing')
    const solved = solve(stage)
    expect(solved.phase).toBe('cleared')
    expect(solved.rescuedIds).toHaveLength(stage.floaters.length)
    expect(run(stage, solved, 2).rescuedIds).toEqual(solved.rescuedIds)
  })
  test.each(PUKUPUKA_STAGES.slice(1))('$id は満水で流すだけでは桟橋へ着地できない', stage => {
    let state = createInitialState(stage)
    if (stage.gate) state = toggleGate(state)
    if (stage.board) state = toggleBoard(state)
    expect(run(stage, state, 25, true).phase).toBe('playing')
  })
  test.each(PUKUPUKA_STAGES.slice(2))('$id は閉門のままでは救助できない', stage => {
    let state = run(stage, createInitialState(stage), 10, true)
    state = run(stage, toggleDrain(state), 12)
    expect(state.rescuedIds).not.toContain('duck')
  })
  test('循環板は水位差を使い切った後も効き、逆向きでは波の連打でも抜けられず、切替後に回復できる', () => {
    const stage = PUKUPUKA_STAGES[3]
    let state = run(stage, toggleGate(createInitialState(stage)), 15, true)
    for (let i = 0; i < 600; i++) {
      state = applyWave(stage, state, 55, 40)
      state = run(stage, state, 1 / 60)
    }
    expect(state.floaters.every(f => f.x < 71)).toBe(true)
    expect(state.rescuedIds).toHaveLength(0)
    expect(solve(stage, state).phase).toBe('cleared')
  })
  test('トンネルは高水位では頭上の壁に止まり、排水しすぎても注水し直してやり直せる', () => {
    const stage = PUKUPUKA_STAGES[4]
    let state = run(stage, createInitialState(stage), 8, true)
    state = run(stage, toggleGate(state), 10, true)
    expect(state.floaters.every(f => f.x < stage.gate!.x)).toBe(true)
    state = run(stage, toggleDrain(state), 15)
    expect(state.phase).toBe('playing')
    state = toggleDrain(state)
    expect(solve(stage, state).phase).toBe('cleared')
  })
})
