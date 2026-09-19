import * as THREE from 'three'
import { describe, expect, test } from 'vitest'
import { CIRCUITS } from '../circuit-racing/circuit'
import { createMotionProfile } from '../circuit-racing/motion'
import { CAR_CATEGORIES, DEFAULT_CAR_CONFIG, selectCarOption, type CarConfig } from './carConfig'
import { createDriveCourse, driveCarTuning, DRIVE_COURSE } from './driveCourse'
import { CAR_VEHICLE_ORDER } from './carVehicles'

function courseSize(curve: THREE.Curve<THREE.Vector3>): { x: number; z: number } {
  const bounds = new THREE.Box3().setFromPoints(curve.getPoints(512))
  return { x: bounds.max.x - bounds.min.x, z: bounds.max.z - bounds.min.z }
}

function lapSeconds(config: CarConfig): number {
  const course = createDriveCourse()
  return createMotionProfile(driveCarTuning(config), course.curve, 0).duration
}

describe('走るコース', () => {
  test('レース用のどのコースよりも小さい（まわりの配置物が近くに見える広さ）', () => {
    const drive = courseSize(createDriveCourse().curve)
    for (const circuit of CIRCUITS) {
      const race = courseSize(circuit.curve)
      expect(drive.x, circuit.id).toBeLessThan(race.x)
      expect(drive.z, circuit.id).toBeLessThan(race.z)
    }
  })

  test('閉じた輪になっていて、1周の長さが有限', () => {
    const curve = createDriveCourse().curve
    expect(curve.closed).toBe(true)
    const length = curve.getLength()
    expect(Number.isFinite(length)).toBe(true)
    expect(length).toBeGreaterThan(150)
    expect(curve.getPointAt(0).distanceTo(curve.getPointAt(1))).toBeLessThan(0.01)
  })

  test('呼ぶたびに別のカーブを返す（走行計算での破壊的な書き換えが他へ伝わらない）', () => {
    expect(createDriveCourse().curve).not.toBe(createDriveCourse().curve)
    expect(createDriveCourse().curve).not.toBe(DRIVE_COURSE.curve)
  })

  test('配置物の景色つき・1台ぶんの道幅で持つ', () => {
    const course = createDriveCourse()
    expect(course.scenery).toBe('grandPrix')
    expect(course.width).toBeGreaterThan(6)
    expect(course.width).toBeLessThan(CIRCUITS[0]!.width)
  })
})

describe('つくった車の走り方', () => {
  test('どの車種・タイヤ・車高でも、正の有限な性能になる', () => {
    for (const body of CAR_VEHICLE_ORDER) {
      for (const wheel of CAR_CATEGORIES.wheel.options) {
        for (const rideHeight of CAR_CATEGORIES.rideHeight.options) {
          const config: CarConfig = { ...DEFAULT_CAR_CONFIG, body, wheel: wheel.id, rideHeight: rideHeight.id }
          const tuning = driveCarTuning(config)
          const label = `${body}/${wheel.id}/${rideHeight.id}`
          for (const value of [tuning.maxSpeed, tuning.acceleration, tuning.braking, tuning.cornering]) {
            expect(Number.isFinite(value), label).toBe(true)
            expect(value, label).toBeGreaterThan(0)
          }
        }
      }
    }
  })

  test('どの組み合わせでも1周が短すぎず長すぎない（幼児が1周を見ていられる長さ）', () => {
    for (const body of CAR_VEHICLE_ORDER) {
      for (const wheel of CAR_CATEGORIES.wheel.options) {
        const seconds = lapSeconds({ ...DEFAULT_CAR_CONFIG, body, wheel: wheel.id })
        expect(seconds, `${body}/${wheel.id}`).toBeGreaterThan(10)
        expect(seconds, `${body}/${wheel.id}`).toBeLessThan(45)
      }
    }
  })

  test('レーシングタイヤは ちいさいタイヤより速く1周できる', () => {
    const racing = lapSeconds(selectCarOption(DEFAULT_CAR_CONFIG, 'wheel', 'racing'))
    const small = lapSeconds(selectCarOption(DEFAULT_CAR_CONFIG, 'wheel', 'small'))
    expect(racing).toBeLessThan(small)
  })

  test('車高が たかい ほどカーブが苦手になる', () => {
    const high = driveCarTuning(selectCarOption(DEFAULT_CAR_CONFIG, 'rideHeight', 'high'))
    const normal = driveCarTuning(DEFAULT_CAR_CONFIG)
    const low = driveCarTuning(selectCarOption(DEFAULT_CAR_CONFIG, 'rideHeight', 'low'))
    expect(high.cornering).toBeLessThan(normal.cornering)
    expect(normal.cornering).toBeLessThan(low.cornering)
  })

  test('大きいスクールバスはスポーツカーより遅い', () => {
    const bus = driveCarTuning(selectCarOption(DEFAULT_CAR_CONFIG, 'body', 'schoolBus'))
    const sports = driveCarTuning(selectCarOption(DEFAULT_CAR_CONFIG, 'body', 'sportsCar'))
    expect(bus.maxSpeed).toBeLessThan(sports.maxSpeed)
    expect(bus.cornering).toBeLessThan(sports.cornering)
  })

  test('色・かざり・ナンバー・フロント・やねでは走りが変わらない（見た目で遅くならない）', () => {
    const base = driveCarTuning(DEFAULT_CAR_CONFIG)
    for (const category of ['color', 'front', 'roof', 'decoration', 'mark'] as const) {
      for (const option of CAR_CATEGORIES[category].options) {
        const tuning = driveCarTuning(selectCarOption(DEFAULT_CAR_CONFIG, category, option.id))
        expect(tuning, `${category}/${option.id}`).toEqual(base)
      }
    }
  })
})
