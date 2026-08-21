import { describe, expect, it } from 'vitest'
import {
  calibrateDeviceTilt,
  deviceOrientationToScreenTilt,
  deviceTiltToInput,
} from './deviceTilt'

describe('device tilt conversion', () => {
  const reading = { beta: 12, gamma: 5 }

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
    expect(deviceTiltToInput({ beta: 1, gamma: 0 }, 0, calibration)).toEqual({ x: 0, y: 0 })
    const result = deviceTiltToInput({ beta: 100, gamma: 100 }, 0, calibration)
    expect(Math.hypot(result.x, result.y)).toBeCloseTo(1)
  })
})
