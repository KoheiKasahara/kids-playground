import {
  applyTiltDeadzone,
  clampTiltMagnitude,
  NEUTRAL_TILT,
  type TiltInput,
} from './tiltInput'

export type DeviceOrientationReading = { beta: number; gamma: number }
export type ScreenOrientationAngle = 0 | 90 | 180 | 270

/** 小さな手ぶれを吸収しつつ、子どもが少し傾ければ十分に動く設定。 */
export const DEVICE_TILT_RANGE_DEGREES = 18
export const DEVICE_TILT_DEADZONE = 0.1

/** DeviceOrientation の軸を、現在見えている画面の右・下方向へ揃える。 */
export function deviceOrientationToScreenTilt(
  reading: DeviceOrientationReading,
  angle: ScreenOrientationAngle,
): TiltInput {
  switch (angle) {
    case 90:
      return { x: reading.beta, y: -reading.gamma }
    case 180:
      return { x: -reading.gamma, y: -reading.beta }
    case 270:
      return { x: -reading.beta, y: reading.gamma }
    default:
      return { x: reading.gamma, y: reading.beta }
  }
}

/** 最初に受け取った画面基準の姿勢。水平で持つ必要はない。 */
export type DeviceTiltCalibration = TiltInput

export function calibrateDeviceTilt(
  reading: DeviceOrientationReading,
  angle: ScreenOrientationAngle,
): DeviceTiltCalibration {
  return deviceOrientationToScreenTilt(reading, angle)
}

/** キャリブレーションからの差分だけを -1〜1 の共通入力に変換する。 */
export function deviceTiltToInput(
  reading: DeviceOrientationReading,
  angle: ScreenOrientationAngle,
  calibration: DeviceTiltCalibration | null,
): TiltInput {
  if (calibration === null) return { ...NEUTRAL_TILT }
  const screenTilt = deviceOrientationToScreenTilt(reading, angle)
  const normalized = clampTiltMagnitude({
    x: (screenTilt.x - calibration.x) / DEVICE_TILT_RANGE_DEGREES,
    y: (screenTilt.y - calibration.y) / DEVICE_TILT_RANGE_DEGREES,
  })
  return applyTiltDeadzone(normalized, DEVICE_TILT_DEADZONE)
}

export function getScreenOrientationAngle(): ScreenOrientationAngle {
  const angle = window.screen.orientation?.angle ?? (window as Window & { orientation?: number }).orientation ?? 0
  return angle === 90 || angle === 180 || angle === 270 ? angle : 0
}

export function supportsDeviceOrientation(): boolean {
  return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window
}
