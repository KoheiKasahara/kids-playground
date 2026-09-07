import { describe, expect, test } from 'vitest'
import { createInitialState, stepGame, toggleBoard, toggleDrain, toggleGate, type PukupukaGameState } from './pukupukaGame'
import { PUKUPUKA_STAGES } from './stageDefinitions'
import type { StageDefinition } from './types'

const FRAME_MS = 1000 / 60

function run(stage: StageDefinition, state: PukupukaGameState, seconds: number, control: 'fill' | null = null) {
  let current = state
  let goalCount = 0
  for (let index = 0; index < Math.round(seconds * 60); index += 1) {
    const result = stepGame(stage, current, FRAME_MS, control)
    current = result.state
    if (result.goalReached) goalCount += 1
  }
  return { state: current, goalCount }
}

describe('ぷかぷかレスキューのステージ定義', () => {
  test('6ステージのIDが一意で、参照先と配置が成立している', () => {
    expect(PUKUPUKA_STAGES).toHaveLength(6)
    expect(new Set(PUKUPUKA_STAGES.map((stage) => stage.id)).size).toBe(PUKUPUKA_STAGES.length)

    for (const stage of PUKUPUKA_STAGES) {
      expect(stage.width).toBeGreaterThan(0)
      expect(stage.height).toBeGreaterThan(0)
      expect(stage.viewportWidth ?? stage.width).toBeGreaterThan(0)
      expect(stage.viewportWidth ?? stage.width).toBeLessThanOrEqual(stage.width)
      expect(stage.waterBodies.length).toBeGreaterThan(0)

      const bodyIds = new Set(stage.waterBodies.map((body) => body.id))
      expect(bodyIds.size).toBe(stage.waterBodies.length)
      for (const body of stage.waterBodies) {
        expect(body.left).toBeGreaterThanOrEqual(0)
        expect(body.right).toBeLessThanOrEqual(stage.width)
        expect(body.right).toBeGreaterThan(body.left)
        expect(body.ceilingY).toBeGreaterThanOrEqual(0)
        expect(body.floorY).toBeLessThanOrEqual(stage.height)
        expect(body.floorY).toBeGreaterThan(body.ceilingY)
        expect(body.initialLevel).toBeGreaterThanOrEqual(0)
        expect(body.initialLevel).toBeLessThanOrEqual(body.floorY - body.ceilingY)
      }

      const floaterIds = new Set(stage.floaters.map((floater) => floater.id))
      expect(floaterIds.size).toBe(stage.floaters.length)
      for (const floater of stage.floaters) {
        expect(floater.radius).toBeGreaterThan(0)
        expect(floater.startX).toBeGreaterThanOrEqual(floater.radius)
        expect(floater.startX).toBeLessThanOrEqual(stage.width - floater.radius)
        expect(floater.startY).toBeGreaterThanOrEqual(floater.radius)
        expect(floater.startY).toBeLessThanOrEqual(stage.height - floater.radius)
      }

      expect(stage.goal.floaterIds.length).toBeGreaterThan(0)
      expect(new Set(stage.goal.floaterIds).size).toBe(stage.goal.floaterIds.length)
      for (const id of stage.goal.floaterIds) expect(floaterIds.has(id)).toBe(true)
      expect(stage.goal.area.x).toBeGreaterThanOrEqual(0)
      expect(stage.goal.area.y).toBeGreaterThanOrEqual(0)
      expect(stage.goal.area.x + stage.goal.area.width).toBeLessThanOrEqual(stage.width)
      expect(stage.goal.area.y + stage.goal.area.height).toBeLessThanOrEqual(stage.height)

      for (const solid of stage.solids) {
        expect(solid.x).toBeGreaterThanOrEqual(0)
        expect(solid.y).toBeGreaterThanOrEqual(0)
        expect(solid.x + solid.width).toBeLessThanOrEqual(stage.width)
        expect(solid.y + solid.height).toBeLessThanOrEqual(stage.height)
      }

      const checkRect = (rect: { x: number; y: number; width: number; height: number }) => {
        expect(rect.width).toBeGreaterThan(0)
        expect(rect.height).toBeGreaterThan(0)
        expect(rect.x).toBeGreaterThanOrEqual(0)
        expect(rect.y).toBeGreaterThanOrEqual(0)
        expect(rect.x + rect.width).toBeLessThanOrEqual(stage.width)
        expect(rect.y + rect.height).toBeLessThanOrEqual(stage.height)
      }
      if (stage.gate) checkRect(stage.gate)
      if (stage.board) checkRect(stage.board)
      if (stage.waterWheel) {
        expect(stage.waterWheel.radius).toBeGreaterThan(0)
        expect(stage.waterWheel.x - stage.waterWheel.radius).toBeGreaterThanOrEqual(0)
        expect(stage.waterWheel.x + stage.waterWheel.radius).toBeLessThanOrEqual(stage.width)
        expect(stage.waterWheel.y - stage.waterWheel.radius).toBeGreaterThanOrEqual(0)
        expect(stage.waterWheel.y + stage.waterWheel.radius).toBeLessThanOrEqual(stage.height)
        checkRect(stage.waterWheel.linkedGate)
      }

      if (stage.faucet) expect(bodyIds.has(stage.faucet.targetBodyId)).toBe(true)
      if (stage.drain) expect(bodyIds.has(stage.drain.sourceBodyId)).toBe(true)
      for (const control of [stage.faucet, stage.drain]) {
        if (!control) continue
        expect(control.x).toBeGreaterThanOrEqual(0)
        expect(control.x).toBeLessThanOrEqual(stage.width)
        expect(control.y).toBeGreaterThanOrEqual(0)
        expect(control.y).toBeLessThanOrEqual(stage.height)
      }
      expect(stage.name.length).toBeGreaterThan(0)
      expect(stage.hint.length).toBeGreaterThan(0)
      expect(stage.icon.length).toBeGreaterThan(0)
    }
  })

  test('序盤は少ないギミック、後半は既習ギミックを組み合わせる', () => {
    const [first, second, third, fourth, fifth, sixth] = PUKUPUKA_STAGES
    expect(first.faucet).toBeDefined()
    expect(first.drain).toBeUndefined()
    expect(first.gate).toBeUndefined()
    expect(first.board).toBeUndefined()
    expect(first.waterWheel).toBeUndefined()
    expect(second.drain).toBeDefined()
    expect(second.gate).toBeUndefined()
    expect(second.board).toBeUndefined()
    expect(third.gate).toBeDefined()
    expect(third.board).toBeUndefined()
    expect(fourth.gate).toBeDefined()
    expect(fourth.board?.initialFlowDirection).toBe('back')
    expect(fourth.waterWheel).toBeDefined()
    expect(fifth.waterWheel?.linkedGateBlocksPassage).toBe(true)
    expect(fifth.gate).toBeUndefined()
    expect(sixth.width).toBeGreaterThan(sixth.viewportWidth ?? sixth.width)
    expect(sixth.gate).toBeDefined()
    expect(sixth.board?.initialFlowDirection).toBe('back')
  })
})

describe('ぷかぷかレスキューのステージ成立性', () => {
  test.each(PUKUPUKA_STAGES.map((stage) => [stage.id, stage] as const))(
    '%sは放置だけではクリアせず、想定操作で有限時間内にクリアできる',
    (_id, stage) => {
      const idle = run(stage, createInitialState(stage), 12)
      expect(idle.state.phase).toBe('playing')
      expect(idle.goalCount).toBe(0)

      let state = createInitialState(stage)
      if (stage.id === 'water-rise') {
        state = run(stage, state, 5, 'fill').state
      } else if (stage.id === 'land-on-platform') {
        state = run(stage, state, 8, 'fill').state
        state = toggleDrain(state)
        state = run(stage, state, 8).state
      } else if (stage.id === 'open-the-gate') {
        state = toggleGate(state)
        state = run(stage, state, 8, 'fill').state
        state = toggleDrain(state)
        state = run(stage, state, 8).state
      } else if (stage.id === 'change-the-flow') {
        state = toggleBoard(state)
        state = toggleGate(state)
        state = run(stage, state, 8, 'fill').state
        state = toggleDrain(state)
        state = run(stage, state, 8).state
      } else if (stage.id === 'water-wheel-gate') {
        state = run(stage, state, 6, 'fill').state
        state = run(stage, state, 6).state
        state = toggleDrain(state)
        state = run(stage, state, 8).state
      } else {
        state = run(stage, state, 6, 'fill').state
        state = run(stage, state, 12).state
        state = toggleGate(state)
        state = run(stage, state, 12).state
        state = toggleBoard(state)
        state = run(stage, state, 20).state
      }
      expect(state.phase).toBe('cleared')
    },
  )

  test('主役ギミックを使わない対照操作では簡単にクリアできない', () => {
    const stage2 = PUKUPUKA_STAGES[1]
    const stage3 = PUKUPUKA_STAGES[2]
    const stage4 = PUKUPUKA_STAGES[3]
    const stage5 = PUKUPUKA_STAGES[4]
    const stage6 = PUKUPUKA_STAGES[5]

    // 排水しないと台へ降りない。
    expect(run(stage2, createInitialState(stage2), 8, 'fill').state.phase).toBe('playing')

    // ゲートを閉じたままでは、いくら注水・排水しても右へ行けない。
    let stage3Closed = run(stage3, createInitialState(stage3), 8, 'fill').state
    stage3Closed = run(stage3, toggleDrain(stage3Closed), 8).state
    expect(stage3Closed.phase).toBe('playing')

    // 板を逆向きのままでは、ゲートを開けても板に押し戻される。
    let stage4Back = run(stage4, toggleGate(createInitialState(stage4)), 8, 'fill').state
    stage4Back = run(stage4, toggleDrain(stage4Back), 8).state
    expect(stage4Back.phase).toBe('playing')

    // 水車を回さなければ連動水門は実際の壁として通路をふさぐ。
    let stage5Stopped = run(stage5, createInitialState(stage5), 6, 'fill').state
    stage5Stopped = run(stage5, stage5Stopped, 12).state
    expect(stage5Stopped.phase).toBe('playing')
    expect(Math.max(...stage5Stopped.floaters.map((floater) => floater.x))).toBeLessThan(48)

    // 最初から排水するだけでは高さが足りず、先にじゃぐちで水をためる必要がある。
    const stage5DrainOnly = run(stage5, toggleDrain(createInitialState(stage5)), 12).state
    expect(stage5DrainOnly.phase).toBe('playing')

    // 長い水路はゲートと逆向きの板の両方を越えないとゴールできない。
    let stage6Blocked = run(stage6, createInitialState(stage6), 6, 'fill').state
    stage6Blocked = run(stage6, stage6Blocked, 16).state
    expect(stage6Blocked.phase).toBe('playing')
    expect(Math.max(...stage6Blocked.floaters.map((floater) => floater.x))).toBeLessThan(112)
  })

  test('ステージ3はゲートを閉じたまま注水しても、後から開けて回復できる', () => {
    const stage = PUKUPUKA_STAGES[2]
    let state = run(stage, createInitialState(stage), 8, 'fill').state
    expect(state.phase).toBe('playing')
    expect(state.gateOpen).toBe(false)

    state = toggleGate(state)
    state = run(stage, state, 4).state
    state = toggleDrain(state)
    state = run(stage, state, 8).state

    expect(state.phase).toBe('cleared')
  })

  test('ステージ4は板を逆向きのまま注水しても、後から板とゲートを直して回復できる', () => {
    const stage = PUKUPUKA_STAGES[3]
    let state = run(stage, createInitialState(stage), 8, 'fill').state
    expect(state.phase).toBe('playing')
    expect(state.boardFlowDirection).toBe('back')
    expect(state.gateOpen).toBe(false)

    state = toggleBoard(state)
    state = toggleGate(state)
    state = run(stage, state, 4).state
    state = toggleDrain(state)
    state = run(stage, state, 8).state

    expect(state.phase).toBe('cleared')
  })
})
