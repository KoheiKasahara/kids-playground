import { describe, expect, it } from 'vitest'
import {
  SEESAW_MAX_TILT_RAD,
  SEESAW_PLANK_HALF_LENGTH,
  advanceSeesawTilt,
  createDominoSeesawSection,
  seesawLocalOffset,
  seesawPlankRotation,
} from './dominoSeesaw'

const STRAIGHT_PATH = Array.from({ length: 10 }, (_, index) => ({
  x: 0,
  z: index * 0.82,
  yaw: 0,
}))

describe('createDominoSeesawSection', () => {
  it('支点を叩く側のドミノから半長ぶん手前へ置く', () => {
    const section = createDominoSeesawSection(STRAIGHT_PATH, 5)
    const strike = STRAIGHT_PATH[5]!
    expect(section.strikeDominoId).toBe('approach-5')
    expect(section.pivot.z).toBeCloseTo(strike.z - SEESAW_PLANK_HALF_LENGTH, 10)
    expect(section.pivot.x).toBeCloseTo(0, 10)
    expect(section.yaw).toBeCloseTo(0, 10)
  })
})

describe('seesawLocalOffset', () => {
  it('受け側(支点より手前)に乗ると負のオフセットを返す', () => {
    const section = createDominoSeesawSection(STRAIGHT_PATH, 5)
    const receivingEnd = {
      x: section.pivot.x,
      y: section.pivot.y,
      z: section.pivot.z - SEESAW_PLANK_HALF_LENGTH * 0.9,
    }
    const offset = seesawLocalOffset(section, 0, receivingEnd)
    expect(offset).not.toBeNull()
    expect(offset!).toBeLessThan(0)
  })

  it('叩く側(支点より奥)に乗ると正のオフセットを返す', () => {
    const section = createDominoSeesawSection(STRAIGHT_PATH, 5)
    const strikeEnd = {
      x: section.pivot.x,
      y: section.pivot.y,
      z: section.pivot.z + SEESAW_PLANK_HALF_LENGTH * 0.9,
    }
    const offset = seesawLocalOffset(section, 0, strikeEnd)
    expect(offset).not.toBeNull()
    expect(offset!).toBeGreaterThan(0)
  })

  it('板から離れた位置ではnullを返す', () => {
    const section = createDominoSeesawSection(STRAIGHT_PATH, 5)
    const farAway = { x: 10, y: section.pivot.y, z: section.pivot.z }
    expect(seesawLocalOffset(section, 0, farAway)).toBeNull()
  })
})

describe('advanceSeesawTilt', () => {
  it('1フレームでは目標角度へ到達しないが、方向へ近づく', () => {
    const next = advanceSeesawTilt(0, -SEESAW_MAX_TILT_RAD, 0.001)
    expect(next).toBeLessThan(0)
    expect(next).toBeGreaterThan(-SEESAW_MAX_TILT_RAD)
  })

  it('十分な時間が経てば目標角度に到達する', () => {
    const next = advanceSeesawTilt(0, -SEESAW_MAX_TILT_RAD, 10)
    expect(next).toBe(-SEESAW_MAX_TILT_RAD)
  })

  it('最大角度を絶対に超えない', () => {
    const next = advanceSeesawTilt(SEESAW_MAX_TILT_RAD, SEESAW_MAX_TILT_RAD * 5, 10)
    expect(next).toBeLessThanOrEqual(SEESAW_MAX_TILT_RAD)
    const negativeNext = advanceSeesawTilt(-SEESAW_MAX_TILT_RAD, -SEESAW_MAX_TILT_RAD * 5, 10)
    expect(negativeNext).toBeGreaterThanOrEqual(-SEESAW_MAX_TILT_RAD)
  })
})

describe('seesawPlankRotation', () => {
  it('傾き0・ヨー0では単位クォータニオンになる', () => {
    const rotation = seesawPlankRotation(0, 0)
    expect(rotation.x).toBe(0)
    expect(rotation.y).toBe(0)
    expect(rotation.z).toBeCloseTo(0, 10)
    expect(rotation.w).toBe(1)
  })

  it('単位クォータニオンを保つ', () => {
    const rotation = seesawPlankRotation(0.4, -0.3)
    const normSquared =
      rotation.x ** 2 + rotation.y ** 2 + rotation.z ** 2 + rotation.w ** 2
    expect(normSquared).toBeCloseTo(1, 10)
  })
})
