import { describe, expect, it } from 'vitest'
import {
  advanceCannonCapture,
  beginCannonCapture,
  canCaptureCannonBall,
  cannonCaptureKey,
  cannonDirectionVector,
  cannonLaunchVelocity,
  createCannonCaptureState,
  CANNON_COOLDOWN_MS,
  CANNON_HOLD_DURATION_MS,
  CANNON_LAUNCH_SPEED,
  finishCannonCooldown,
  setCannonSensorContact,
} from './cannonPhysics'

describe('cannonPhysics', () => {
  it('8方向の発射ベクトルは向きだけで固定速度になる', () => {
    const directions = [
      ['cannon', { x: 1, y: 0 }],
      ['cannonDownRight', { x: Math.SQRT1_2, y: Math.SQRT1_2 }],
      ['cannonDown', { x: 0, y: 1 }],
      ['cannonDownLeft', { x: -Math.SQRT1_2, y: Math.SQRT1_2 }],
      ['cannonLeft', { x: -1, y: 0 }],
      ['cannonUpLeft', { x: -Math.SQRT1_2, y: -Math.SQRT1_2 }],
      ['cannonUp', { x: 0, y: -1 }],
      ['cannonUpRight', { x: Math.SQRT1_2, y: -Math.SQRT1_2 }],
    ] as const

    for (const [typeId, expectedDirection] of directions) {
      const direction = cannonDirectionVector(typeId)
      const velocity = cannonLaunchVelocity(typeId)
      expect(direction?.x).toBeCloseTo(expectedDirection.x, 8)
      expect(direction?.y).toBeCloseTo(expectedDirection.y, 8)
      expect(velocity?.x).toBeCloseTo(expectedDirection.x * CANNON_LAUNCH_SPEED, 8)
      expect(velocity?.y).toBeCloseTo(expectedDirection.y * CANNON_LAUNCH_SPEED, 8)
      expect(Math.hypot(velocity?.x ?? 0, velocity?.y ?? 0)).toBeCloseTo(CANNON_LAUNCH_SPEED, 8)
    }
    expect(cannonDirectionVector('spinner')).toBeNull()
    expect(cannonCaptureKey('ball-a', 'part-1')).toBe('ball-a:part-1')
  })

  it('捕獲は保持後に1回だけ発射し、cooldown中は再入場を拒否する', () => {
    const initial = createCannonCaptureState()
    expect(initial.phase).toBe('ready')
    const holding = beginCannonCapture(initial, 100)
    expect(advanceCannonCapture(holding, 100 + CANNON_HOLD_DURATION_MS - 1).shouldFire).toBe(false)

    const fired = advanceCannonCapture(holding, 100 + CANNON_HOLD_DURATION_MS)
    expect(fired.shouldFire).toBe(true)
    expect(fired.state.phase).toBe('cooldown')
    expect(advanceCannonCapture(fired.state, 1000).shouldFire).toBe(false)

    const leftSensor = setCannonSensorContact(fired.state, false)
    expect(finishCannonCooldown(leftSensor, 100 + CANNON_HOLD_DURATION_MS + CANNON_COOLDOWN_MS - 1).phase).toBe('cooldown')
    expect(finishCannonCooldown(leftSensor, 100 + CANNON_HOLD_DURATION_MS + CANNON_COOLDOWN_MS).phase).toBe('ready')
  })

  it('センサー接触中はcooldownが終わっても同じ球を再捕獲しない', () => {
    const holding = beginCannonCapture(createCannonCaptureState(), 0)
    const fired = advanceCannonCapture(holding, CANNON_HOLD_DURATION_MS).state
    const availableAfterCooldown = finishCannonCooldown(fired, CANNON_HOLD_DURATION_MS + CANNON_COOLDOWN_MS)
    expect(availableAfterCooldown.phase).toBe('cooldown')
    expect(setCannonSensorContact(availableAfterCooldown, false).phase).toBe('cooldown')
  })

  it('別キャノンと別ボールは、それぞれ独立して捕獲できる', () => {
    const states = new Map([
      [cannonCaptureKey('ball-a', 'cannon-a'), beginCannonCapture(createCannonCaptureState(), 0)],
    ])

    const samePair = states.get(cannonCaptureKey('ball-a', 'cannon-a'))!
    const otherCannon = states.get(cannonCaptureKey('ball-a', 'cannon-b')) ?? createCannonCaptureState()
    const otherBall = states.get(cannonCaptureKey('ball-b', 'cannon-a')) ?? createCannonCaptureState()

    expect(canCaptureCannonBall(samePair, 0, true)).toBe(false)
    expect(canCaptureCannonBall(otherCannon, 0)).toBe(true)
    expect(canCaptureCannonBall(otherBall, 0)).toBe(true)
    expect(cannonCaptureKey('ball-a', 'cannon-b')).not.toBe(cannonCaptureKey('ball-b', 'cannon-a'))
  })
})
