import { describe, expect, it } from 'vitest'
import {
  COMPLETE_RATIO,
  FALLEN_TILT_RAD,
  HARD_TIMEOUT_MS,
  countFallen,
  evaluateCompletion,
  isFallen,
  type DominoRuntimeState,
} from './dominoCompletion'

function createStates(total: number, fallenCount: number, sleeping = true): DominoRuntimeState[] {
  return Array.from({ length: total }, (_, index) => ({
    tilt: index < fallenCount ? FALLEN_TILT_RAD : 0,
    sleeping,
  }))
}

describe('isFallen', () => {
  it('閾値の直前は立ったままで、閾値ちょうどと直後は倒れたと判定する', () => {
    expect(isFallen({ tilt: FALLEN_TILT_RAD - 0.001, sleeping: true })).toBe(false)
    expect(isFallen({ tilt: FALLEN_TILT_RAD, sleeping: true })).toBe(true)
    expect(isFallen({ tilt: FALLEN_TILT_RAD + 0.001, sleeping: true })).toBe(true)
  })
})

describe('evaluateCompletion', () => {
  it('空配列でもfallenRatio 0で返す', () => {
    const result = evaluateCompletion([], 0)

    expect(result.fallenRatio).toBe(0)
    expect(result.complete).toBe(false)
  })

  it('全部立っていると未完成である', () => {
    const result = evaluateCompletion(createStates(100, 0), 0)

    expect(result.fallenRatio).toBe(0)
    expect(result.complete).toBe(false)
  })

  it('全部倒れてsleepしていると完成する', () => {
    const result = evaluateCompletion(createStates(100, 100), 0)

    expect(result.settled).toBe(true)
    expect(result.complete).toBe(true)
  })

  it('92%倒れてsleepしていれば完成する', () => {
    const fallenCount = Math.floor(100 * COMPLETE_RATIO)
    const result = evaluateCompletion(createStates(100, fallenCount), 0)

    expect(result.fallenRatio).toBe(COMPLETE_RATIO)
    expect(result.complete).toBe(true)
  })

  it('90%倒れてsleepしていても閾値未満なので未完成である', () => {
    const result = evaluateCompletion(createStates(100, 90), 0)

    expect(result.complete).toBe(false)
  })

  it('全部倒れていてもsleepしていなければ未完成である', () => {
    const result = evaluateCompletion(createStates(100, 100, false), 0)

    expect(result.settled).toBe(false)
    expect(result.complete).toBe(false)
  })

  it('85%倒れたまま制限時間に達するとタイムアウトで完成扱いにする', () => {
    const states = createStates(100, 85)
    const result = evaluateCompletion(states, HARD_TIMEOUT_MS)

    expect(countFallen(states)).toBe(85)
    expect(result.complete).toBe(true)
  })
})
