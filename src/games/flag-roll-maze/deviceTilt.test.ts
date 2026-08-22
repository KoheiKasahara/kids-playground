import { describe, expect, it } from 'vitest'
import {
  calibrateDeviceTilt,
  DEVICE_TILT_DEADZONE,
  DEVICE_TILT_RANGE_DEGREES,
  deviceOrientationToScreenTilt,
  deviceTiltToInput,
} from './deviceTilt'

describe('device tilt conversion', () => {
  const reading = { beta: 12, gamma: 5 }

  it('子どもが細かく向きを直しやすい新しい調整値を使う', () => {
    expect(DEVICE_TILT_RANGE_DEGREES).toBe(22)
    expect(DEVICE_TILT_DEADZONE).toBe(0.14)
  })

  it('portrait maps sensor axes to screen axes', () => {
    expect(deviceOrientationToScreenTilt(reading, 0)).toEqual({ x: 5, y: 12 })
  })

  it('landscape-left keeps screen directions intuitive', () => {
    expect(deviceOrientationToScreenTilt(reading, 90)).toEqual({ x: 12, y: -5 })
  })

  it('landscape-right keeps screen directions intuitive', () => {
    expect(deviceOrientationToScreenTilt(reading, 270)).toEqual({ x: -12, y: 5 })
  })

  it('uses the starting pose as the neutral calibration', () => {
    const calibration = calibrateDeviceTilt(reading, 0)
    expect(deviceTiltToInput(reading, 0, calibration)).toEqual({ x: 0, y: 0 })
  })

  it('applies deadzone, normalization and clamping', () => {
    const calibration = { x: 0, y: 0 }
    expect(deviceTiltToInput({ beta: 22 * 0.14 * 0.9, gamma: 0 }, 0, calibration)).toEqual({ x: 0, y: 0 })
    const result = deviceTiltToInput({ beta: 100, gamma: 100 }, 0, calibration)
    expect(Math.hypot(result.x, result.y)).toBeCloseTo(1)
  })

  it('デッドゾーンの外側はカーブで穏やかになり、方向は保たれる', () => {
    const result = deviceTiltToInput({ beta: 11, gamma: 5.5 }, 0, { x: 0, y: 0 })

    expect(result.y / result.x).toBeCloseTo(2, 6)
    expect(Math.hypot(result.x, result.y)).toBeLessThan(0.5)
  })
})
