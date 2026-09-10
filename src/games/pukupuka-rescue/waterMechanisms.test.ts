import { describe, expect, test } from 'vitest'
import { activeSolids, createInitialState, isSettled, stepGame, toggleDrain, toggleGate, waterSurfaceYOf } from './pukupukaGame'
import { PUKUPUKA_STAGES } from './stageDefinitions'
import { createWaterField, transferWaterThroughGate, waterSurfaceY } from './waterModel'
import type { WaterBodyDefinition } from './types'

const tanks: WaterBodyDefinition[] = [
  { id: 'left', label: 'ひだり', left: 0, right: 30, floorY: 120, ceilingY: 20, initialLevel: 60 },
  { id: 'right', label: 'みぎ', left: 30, right: 90, floorY: 140, ceilingY: 20, initialLevel: 0 },
]

describe('設置高さと実際の水・扉の動き', () => {
  test('高い水門の敷居までしか排水せず、床の高さが違っても水量を保存する', () => {
    let water = createWaterField(tanks)
    const total = water.left.volume + water.right.volume
    for (let i = 0; i < 600; i++) water = transferWaterThroughGate(tanks, water, 'left', 'right', 1 / 60, { sillY: 80, fraction: 1 }).field
    expect(waterSurfaceY(tanks[0], water.left)).toBeCloseTo(80, 5)
    expect(waterSurfaceY(tanks[1], water.right)).toBeGreaterThan(80)
    expect(water.left.volume + water.right.volume).toBeCloseTo(total, 6)
    expect(water.left.targetVolume + water.right.targetVolume).toBeCloseTo(total, 6)
  })
  test('水門の底が水域の底より低くても、空の水域から水を作り出さない', () => {
    const dryTanks = tanks.map(b => ({ ...b, initialLevel: 0 }))
    const water = createWaterField(dryTanks)
    const moved = transferWaterThroughGate(dryTanks, water, 'left', 'right', 1, { sillY: 140, fraction: 1 })
    expect(moved.transferredVolume).toBe(0)
    expect(moved.field).toBe(water)
  })
  test('水面が開口より下なら流れず、半開の流量は全開より少ない', () => {
    const water = createWaterField(tanks)
    expect(transferWaterThroughGate(tanks, water, 'left', 'right', 1 / 60, { sillY: 50, fraction: 1 }).transferredVolume).toBe(0)
    const half = transferWaterThroughGate(tanks, water, 'left', 'right', 1 / 60, { sillY: 110, fraction: 0.5 })
    const full = transferWaterThroughGate(tanks, water, 'left', 'right', 1 / 60, { sillY: 110, fraction: 1 })
    expect(half.transferredVolume).toBeCloseTo(full.transferredVolume / 2, 6)
  })
  test('底からの深さではなく水面の高さで流れる向きを決める', () => {
    const sameDepth = tanks.map(b => ({ ...b, initialLevel: 60 }))
    const water = createWaterField(sameDepth)
    expect(transferWaterThroughGate(sameDepth, water, 'left', 'right', 1 / 60).direction).toBe(1)
  })
  test('扉は瞬間移動せず、アニメーション途中の実寸で通路をふさぐ。途中反転も連続する', () => {
    const stage = PUKUPUKA_STAGES[4]
    let state = toggleGate(createInitialState(stage))
    for (let i = 0; i < 15; i++) state = stepGame(stage, state, 1000 / 60).state
    expect(state.gateLift).toBeGreaterThan(0)
    expect(state.gateLift).toBeLessThan(1)
    expect(isSettled(stage, state)).toBe(false)
    const door = activeSolids(stage, state.gateOpen, false, state.gateLift).at(-1)!
    expect(door.height).toBeCloseTo(stage.gate!.height * (1 - state.gateLift))
    const heightBefore = state.gateLift
    state = stepGame(stage, toggleGate(state), 1000 / 60).state
    expect(state.gateLift).toBeLessThan(heightBefore)
    expect(state.gateLift).toBeGreaterThan(heightBefore - 0.05)
  })
  test('横の栓は取り付け高さで水が止まり、乾いた状態で開けても水を生まない', () => {
    const stage = PUKUPUKA_STAGES[1]
    let state = toggleDrain(createInitialState(stage))
    for (let i = 0; i < 600; i++) state = stepGame(stage, state, 1000 / 60).state
    expect(waterSurfaceYOf(stage, state, 'main')).toBeCloseTo(stage.drain!.y, 5)
    const dryStage = { ...stage, waterBodies: stage.waterBodies.map(b => ({ ...b, initialLevel: 0 })) }
    state = stepGame(dryStage, toggleDrain(createInitialState(dryStage)), 1000 / 60).state
    expect(state.water.main.volume).toBe(0)
    expect(state.water.main.targetVolume).toBe(0)
  })
})
