import { describe, expect, it } from 'vitest'
import {
  isRailCrossingApproached,
  RAIL_CROSSING_CLOSE_DISTANCE,
  RAIL_CROSSING_GATE_SPEED,
  railCrossingLitLamp,
  RAIL_CROSSING_BLINK_PERIOD,
  stepRailCrossingGate,
} from './railCrossingModel'
import { createRailPiece, CROSSING_LENGTH } from './railModel'

const center = { x: 10, y: 0, z: -4 }

describe('railCrossingModel', () => {
  it('踏切パーツは直線と同じくA-Bの2端をもつ', () => {
    const piece = createRailPiece('crossing', 'crossing-1')
    expect(piece.path).toEqual({ kind: 'straight', length: CROSSING_LENGTH })
    expect(piece.connectorC).toBeUndefined()
  })

  it('電車が近づくと遮断機を下げ、離れると上げる', () => {
    expect(isRailCrossingApproached(center, [])).toBe(false)
    expect(isRailCrossingApproached(center, [{ x: 10 + RAIL_CROSSING_CLOSE_DISTANCE - 0.1, y: 0, z: -4 }])).toBe(true)
    expect(isRailCrossingApproached(center, [{ x: 10 + RAIL_CROSSING_CLOSE_DISTANCE + 0.1, y: 0, z: -4 }])).toBe(false)
  })

  it('真上の橋を走る電車では下がらない', () => {
    expect(isRailCrossingApproached(center, [{ x: 10, y: 2.5, z: -4 }])).toBe(false)
  })

  it('遮断機はなめらかに動き、0〜1の範囲に収まる', () => {
    const halfway = stepRailCrossingGate(0, true, 0.5 / RAIL_CROSSING_GATE_SPEED)
    expect(halfway).toBeCloseTo(0.5)
    expect(stepRailCrossingGate(halfway, true, 10)).toBe(1)
    expect(stepRailCrossingGate(1, false, 10)).toBe(0)
    expect(stepRailCrossingGate(0.3, true, 0, true)).toBe(1)
    expect(stepRailCrossingGate(0.3, false, 0, true)).toBe(0)
  })

  it('警報灯は左右交互に点滅する', () => {
    expect(railCrossingLitLamp(0)).toBe(0)
    expect(railCrossingLitLamp(RAIL_CROSSING_BLINK_PERIOD * 0.75)).toBe(1)
    expect(railCrossingLitLamp(RAIL_CROSSING_BLINK_PERIOD * 1.1)).toBe(0)
  })
})
