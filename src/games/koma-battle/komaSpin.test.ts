import { describe, expect, it } from 'vitest'
import {
  clampedVector,
  MAX_ASSIST_TORQUE,
  spinSpeedOf,
  stabilizationStrength,
  stabilizationTorque,
  STABLE_SPIN_SPEED,
  tiltAngleOf,
  upVectorOf,
  wobbleStrength,
  WOBBLE_SPIN_SPEED,
} from './komaSpin'

const UPRIGHT = { x: 0, y: 1, z: 0 }

describe('stabilizationStrength', () => {
  it('高速回転中は最大、低速では完全に0になる', () => {
    expect(stabilizationStrength(STABLE_SPIN_SPEED + 20)).toBe(1)
    expect(stabilizationStrength(WOBBLE_SPIN_SPEED)).toBe(0)
    expect(stabilizationStrength(WOBBLE_SPIN_SPEED - 5)).toBe(0)
  })

  it('回転が落ちるほど単調に弱くなる', () => {
    const middle = (STABLE_SPIN_SPEED + WOBBLE_SPIN_SPEED) / 2
    const strengths = [middle - 4, middle, middle + 4].map(stabilizationStrength)
    expect(strengths[0]!).toBeLessThan(strengths[1]!)
    expect(strengths[1]!).toBeLessThan(strengths[2]!)
  })

  it('回転の向きによらない', () => {
    expect(stabilizationStrength(-40)).toBe(stabilizationStrength(40))
  })

  it('ふらつきの強さは補正の裏返しになる', () => {
    expect(wobbleStrength(STABLE_SPIN_SPEED + 10)).toBe(0)
    expect(wobbleStrength(WOBBLE_SPIN_SPEED - 1)).toBe(1)
  })

  it('NaNでも補正を掛けない', () => {
    expect(stabilizationStrength(Number.NaN)).toBe(0)
  })
})

describe('upVectorOf / tiltAngleOf', () => {
  it('無回転なら真上を向き、傾きは0', () => {
    const up = upVectorOf({ x: 0, y: 0, z: 0, w: 1 })
    expect(up.y).toBeCloseTo(1, 6)
    expect(tiltAngleOf(up)).toBeCloseTo(0, 6)
  })

  it('X軸まわりに90度倒すと傾きはπ/2になる', () => {
    const half = Math.PI / 4
    const up = upVectorOf({ x: Math.sin(half), y: 0, z: 0, w: Math.cos(half) })
    expect(tiltAngleOf(up)).toBeCloseTo(Math.PI / 2, 6)
  })

  it('Y軸まわりの自転では傾かない', () => {
    const half = 1.1
    const up = upVectorOf({ x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) })
    expect(tiltAngleOf(up)).toBeCloseTo(0, 6)
  })
})

describe('spinSpeedOf', () => {
  it('コマ自身の軸まわりの成分だけを取り出す', () => {
    // 軸に垂直な首振り成分は自転速度に含めない。
    expect(spinSpeedOf({ x: 5, y: 40, z: -3 }, UPRIGHT)).toBe(40)
  })

  it('倒れたコマでも、その軸まわりの回転を測れる', () => {
    const sideways = { x: 1, y: 0, z: 0 }
    expect(spinSpeedOf({ x: 30, y: 2, z: 0 }, sideways)).toBe(30)
  })
})

describe('stabilizationTorque', () => {
  it('高速回転中の直立したコマには、ほとんど何もしない', () => {
    const torque = stabilizationTorque({
      up: UPRIGHT,
      angularVelocity: { x: 0, y: 70, z: 0 },
      spinSpeed: 70,
      wobblePhase: 0,
    })
    expect(Math.hypot(torque.x, torque.y, torque.z)).toBeCloseTo(0, 6)
  })

  it('高速回転中に傾くと、起き上がる向きのトルクが出る', () => {
    // +Z方向へ傾いたコマ。起き上がるにはX軸まわりのトルクが必要。
    const up = { x: 0, y: Math.cos(0.3), z: Math.sin(0.3) }
    const torque = stabilizationTorque({
      up,
      angularVelocity: { x: 0, y: 70, z: 0 },
      spinSpeed: 70,
      wobblePhase: 0,
    })
    // up × (0,1,0) は -X 方向。傾きを戻す向き。
    expect(torque.x).toBeLessThan(0)
  })

  it('低速では起き上がりトルクが働かず、素の不安定さがそのまま残る', () => {
    const up = { x: 0, y: Math.cos(0.3), z: Math.sin(0.3) }
    const slow = stabilizationTorque({
      up,
      angularVelocity: { x: 0, y: 2, z: 0 },
      spinSpeed: 2,
      wobblePhase: 0,
    })
    const fast = stabilizationTorque({
      up,
      angularVelocity: { x: 0, y: 70, z: 0 },
      spinSpeed: 70,
      wobblePhase: 0,
    })
    expect(Math.abs(slow.x)).toBeLessThan(Math.abs(fast.x))
  })

  it('補正トルクは重力による転倒トルクより小さく、物理を上書きしない', () => {
    // この寸法のコマに重力がかける最大の転倒トルクは約0.44N・m。
    // 姿勢が大きく乱れ、補正が最も効く状況を作っても超えないことを確かめる。
    const up = { x: 0, y: Math.cos(0.5), z: Math.sin(0.5) }
    const torque = stabilizationTorque({
      up,
      angularVelocity: { x: 0, y: 70, z: 0 },
      spinSpeed: 70,
      wobblePhase: 0,
    })
    expect(Math.hypot(torque.x, torque.y, torque.z)).toBeLessThanOrEqual(MAX_ASSIST_TORQUE)
    expect(MAX_ASSIST_TORQUE).toBeLessThan(0.44)
  })

  it('自転そのものは減らさない', () => {
    // 軸に平行な成分だけを持つ角速度には、首振り減衰が働かない。
    const torque = stabilizationTorque({
      up: UPRIGHT,
      angularVelocity: { x: 0, y: 70, z: 0 },
      spinSpeed: 70,
      wobblePhase: 0,
    })
    expect(torque.y).toBeCloseTo(0, 6)
  })

  it('高速時は首振りを抑える向きのトルクが出る', () => {
    const torque = stabilizationTorque({
      up: UPRIGHT,
      angularVelocity: { x: 3, y: 70, z: 0 },
      spinSpeed: 70,
      wobblePhase: 0,
    })
    expect(torque.x).toBeLessThan(0)
  })
})

describe('clampedVector', () => {
  it('安全域の中ならnullを返し、値を書き換えない', () => {
    expect(clampedVector({ x: 1, y: 2, z: 2 }, 9)).toBeNull()
  })

  it('上限を超えたら向きを保ったまま丸める', () => {
    const clamped = clampedVector({ x: 30, y: 0, z: 0 }, 9)
    expect(clamped).toEqual({ x: 9, y: 0, z: 0 })
  })

  it('NaNやInfinityは0へ落として伝播を止める', () => {
    expect(clampedVector({ x: Number.NaN, y: 0, z: 0 }, 9)).toEqual({ x: 0, y: 0, z: 0 })
    expect(clampedVector({ x: 0, y: Number.POSITIVE_INFINITY, z: 0 }, 9)).toEqual({
      x: 0,
      y: 0,
      z: 0,
    })
  })
})
