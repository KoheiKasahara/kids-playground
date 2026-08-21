import { describe, expect, it } from 'vitest'
import {
  applyTiltDeadzone,
  clampTiltMagnitude,
  isTiltKeyCode,
  NEUTRAL_TILT,
  smoothTilt,
  TILT_DEADZONE,
  tiltFromPressedKeys,
  tiltFromStickOffset,
} from './tiltInput'

const magnitudeOf = (tilt: { x: number; y: number }) => Math.hypot(tilt.x, tilt.y)

describe('clampTiltMagnitude', () => {
  it('1以下の入力はそのまま返す', () => {
    expect(clampTiltMagnitude({ x: 0.3, y: -0.4 })).toEqual({ x: 0.3, y: -0.4 })
  })

  it('1を超えても方向を変えずに大きさだけ1へ丸める', () => {
    const clamped = clampTiltMagnitude({ x: 3, y: 4 })
    expect(magnitudeOf(clamped)).toBeCloseTo(1, 6)
    expect(clamped.y / clamped.x).toBeCloseTo(4 / 3, 6)
  })
})

describe('applyTiltDeadzone', () => {
  it('デッドゾーン内はぴたりと中立になる', () => {
    expect(applyTiltDeadzone({ x: TILT_DEADZONE * 0.5, y: 0 })).toEqual(NEUTRAL_TILT)
  })

  it('デッドゾーン境界のすぐ外では力がほぼ0から立ち上がる', () => {
    const justOutside = applyTiltDeadzone({ x: TILT_DEADZONE + 0.001, y: 0 })
    expect(justOutside.x).toBeGreaterThan(0)
    expect(justOutside.x).toBeLessThan(0.01)
  })

  it('最大まで倒した入力は1のまま残る', () => {
    expect(magnitudeOf(applyTiltDeadzone({ x: 0, y: 1 }))).toBeCloseTo(1, 6)
  })

  it('デッドゾーンを掛けても方向は変わらない', () => {
    const tilt = applyTiltDeadzone({ x: 0.6, y: 0.8 })
    expect(tilt.y / tilt.x).toBeCloseTo(0.8 / 0.6, 6)
  })
})

describe('tiltFromStickOffset', () => {
  it('画面右へ引くと+X、画面下へ引くと+Zになる', () => {
    expect(tiltFromStickOffset(60, 0, 60).x).toBeGreaterThan(0)
    expect(tiltFromStickOffset(0, 60, 60).y).toBeGreaterThan(0)
  })

  it('画面上へ引くと奥（-Z）向きになる', () => {
    expect(tiltFromStickOffset(0, -60, 60).y).toBeLessThan(0)
  })

  it('半径より外まで引いても大きさは1を超えない', () => {
    expect(magnitudeOf(tiltFromStickOffset(400, -300, 60))).toBeLessThanOrEqual(1 + 1e-9)
  })

  it('半径が取れないときは中立を返す', () => {
    expect(tiltFromStickOffset(30, 30, 0)).toEqual(NEUTRAL_TILT)
  })
})

describe('smoothTilt', () => {
  it('目標へ近づくが1フレームでは到達しない', () => {
    const next = smoothTilt(NEUTRAL_TILT, { x: 1, y: 0 }, 1 / 60)
    expect(next.x).toBeGreaterThan(0)
    expect(next.x).toBeLessThan(1)
  })

  it('十分な時間が経てば目標へ収束する', () => {
    let tilt = { ...NEUTRAL_TILT }
    for (let frame = 0; frame < 120; frame += 1) {
      tilt = smoothTilt(tilt, { x: 1, y: -0.5 }, 1 / 60)
    }
    expect(tilt.x).toBeCloseTo(1, 3)
    expect(tilt.y).toBeCloseTo(-0.5, 3)
  })

  it('経過時間が0なら値は動かない', () => {
    expect(smoothTilt({ x: 0.2, y: 0.2 }, { x: 1, y: 1 }, 0)).toEqual({ x: 0.2, y: 0.2 })
  })
})

describe('tiltFromPressedKeys', () => {
  it('矢印キーとWASDが同じ向きを指す', () => {
    expect(tiltFromPressedKeys(['ArrowUp'])).toEqual(tiltFromPressedKeys(['KeyW']))
    expect(tiltFromPressedKeys(['ArrowRight'])).toEqual(tiltFromPressedKeys(['KeyD']))
  })

  it('上キーは奥（-Z）へ倒す', () => {
    expect(tiltFromPressedKeys(['ArrowUp'])).toEqual({ x: 0, y: -1 })
  })

  it('斜め同時押しでも直線より速くならない', () => {
    expect(magnitudeOf(tiltFromPressedKeys(['ArrowUp', 'ArrowRight']))).toBeCloseTo(1, 6)
  })

  it('反対向きの同時押しは打ち消し合う', () => {
    expect(tiltFromPressedKeys(['ArrowLeft', 'ArrowRight'])).toEqual(NEUTRAL_TILT)
  })

  it('関係ないキーは無視する', () => {
    expect(tiltFromPressedKeys(['Space', 'Enter'])).toEqual(NEUTRAL_TILT)
    expect(isTiltKeyCode('Space')).toBe(false)
    expect(isTiltKeyCode('ArrowLeft')).toBe(true)
  })
})
