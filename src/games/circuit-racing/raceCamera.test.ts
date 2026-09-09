import { Box3, PerspectiveCamera, Raycaster, Vector3 } from 'three'
import { CIRCUIT, CIRCUITS } from './circuit'
import { createCircuitScenery } from './scenery'
import { createMotionProfile, sampleMotion } from './motion'
import { RACE_CARS } from './raceConfig'
import { describe, expect, test } from 'vitest'
import { chaseCameraPose, tracksideCameraPose, overviewCameraPose, createTracksideAnchor, createTracksideLift, tracksideDistancePosition, sampleTracksideLift } from './raceCamera'

describe('サーキットレースの カメラ計算', () => {
  test('おいかけるカメラは車のうしろ、見る先は車のまえになる', () => {
    const pose = chaseCameraPose({ x: 10, y: 0, z: 20 }, { x: 0, z: 1 })
    expect(pose.position.x).toBeCloseTo(10)
    expect(pose.position.z).toBeCloseTo(11)
    expect(pose.position.y).toBeGreaterThan(0)
    expect(pose.target.z).toBeGreaterThan(20)
  })

  test('向きが変わっても追いかける位置は接線のうしろになる', () => {
    const pose = chaseCameraPose({ x: 0, y: 0, z: 0 }, { x: 1, z: 0 }, { distance: 6, lookAhead: 4 })
    expect(pose.position.x).toBeCloseTo(-6)
    expect(pose.position.z).toBeCloseTo(0)
    expect(pose.target.x).toBeCloseTo(4)
  })

  test('みちばたカメラは場所を固定し、対象だけを追う', () => {
    const first = tracksideCameraPose({ x: 12, y: 0, z: 8 }, { x: 0, y: 0, z: 0 })
    const second = tracksideCameraPose({ x: 12, y: 0, z: 8 }, { x: 30, y: 0, z: -20 })
    expect(first.position).toEqual({ x: 12, y: 4.6, z: 8 })
    expect(second.position).toEqual(first.position)
    expect(second.target).not.toEqual(first.target)
  })

  test('ゼロ長の接線でもNaNを返さない', () => {
    const pose = chaseCameraPose({ x: 0, y: 0, z: 0 }, { x: 0, z: 0 })
    expect(Object.values(pose.position).every(Number.isFinite)).toBe(true)
    expect(Object.values(pose.target).every(Number.isFinite)).toBe(true)
  })
})

describe('全体表示のフレーミング', () => {
  test.each([0.45, 0.8, 1, 2.2])('画面比率 %s で道路全体が余白つきで収まる', (aspect) => {
    const bounds = new Box3().setFromPoints(CIRCUIT.curve.getPoints(1024)).expandByScalar(CIRCUIT.width / 2 + 1)
    const pose = overviewCameraPose(bounds, aspect)
    const camera = new PerspectiveCamera(48, aspect, 2, 2000)
    camera.position.set(pose.position.x, pose.position.y, pose.position.z)
    camera.lookAt(pose.target.x, pose.target.y, pose.target.z)
    camera.updateMatrixWorld()
    for (const x of [bounds.min.x, bounds.max.x]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        const projected = new Vector3(x, 0, z).project(camera)
        expect(Math.abs(projected.x)).toBeLessThan(0.95)
        expect(Math.abs(projected.y)).toBeLessThan(0.95)
        expect(Math.abs(projected.z)).toBeLessThan(1)
      }
    }
  })
})

describe('ひとつの定位置から自然に見る', () => {
  test('近い車では動かず、遠くても移動は24m以内', () => {
    const anchor = { x: 0, y: 100, z: 0 }
    expect(tracksideDistancePosition(anchor, { x: 100, z: 0 })).toEqual(anchor)
    const far = tracksideDistancePosition(anchor, { x: 1000, z: 0 })
    expect(far.x).toBeGreaterThan(0)
    expect(far.x).toBeLessThanOrEqual(24)
    expect(far.y).toBe(100)
  })

  test('障害物がなければ高さを変えず、避けきれなくても大きく飛び回らない', () => {
    const anchor = createTracksideAnchor(CIRCUIT.curve, CIRCUIT.width)
    expect(createTracksideLift(CIRCUIT.curve, anchor, () => false).every(h => h === 0)).toBe(true)
    const blocked = createTracksideLift(CIRCUIT.curve, anchor, () => true)
    expect(blocked.every(h => h === 0)).toBe(true)
    expect(sampleTracksideLift(blocked, NaN)).toBe(0)
  })

  test('周回境界の遮蔽物に備えてなめらかに上がり、その後は定位置へ戻る', () => {
    const curve = { getPointAt: (t: number) => ({ x: Math.cos(t * 2 * Math.PI) * 100, z: Math.sin(t * 2 * Math.PI) * 100 }) }
    const lifts = createTracksideLift(curve, { x: 0, y: 100, z: -150 }, pose => pose.target.x > 99 && pose.position.y < 119)
    expect(sampleTracksideLift(lifts, 0)).toBeGreaterThan(15)
    expect(sampleTracksideLift(lifts, 0.5)).toBe(0)
    const epsilon = 0.00001
    const left = (sampleTracksideLift(lifts, 0) - sampleTracksideLift(lifts, -epsilon)) / epsilon
    const right = (sampleTracksideLift(lifts, epsilon) - sampleTracksideLift(lifts, 0)) / epsilon
    expect(left).toBeCloseTo(right, 2)
  })

  test.each(CIRCUITS)('$id は全レーン・周回境界でもカットせず、移動量と見通しを保つ', circuit => {
    const scenery = createCircuitScenery(circuit)
    scenery.group.updateMatrixWorld(true)
    const ray = new Raycaster()
    const blocked = (pose: ReturnType<typeof tracksideCameraPose>) => {
      const origin = new Vector3(pose.position.x, pose.position.y, pose.position.z)
      const direction = new Vector3(pose.target.x, pose.target.y, pose.target.z).sub(origin)
      ray.far = direction.length() - 0.5
      ray.set(origin, direction.normalize())
      return ray.intersectObject(scenery.group, true).length > 0
    }
    try {
      const anchor = createTracksideAnchor(circuit.curve, circuit.width)
      const lifts = createTracksideLift(circuit.curve, anchor, blocked)
      for (const lane of [-3, 0, 3]) {
        const profile = createMotionProfile(RACE_CARS[0], circuit.curve, lane)
        let previous: Vector3 | undefined
        let hidden = 0
        let fixedHidden = 0
        for (let step = 0; step <= 1024; step++) {
          const sample = sampleMotion(profile, profile.duration * step / 1024)
          const position = tracksideDistancePosition(anchor, sample.position)
          position.y = anchor.y! + sampleTracksideLift(lifts, sample.distance / profile.length)
          const pose = tracksideCameraPose(position, sample.position)
          const current = new Vector3(pose.position.x, pose.position.y, pose.position.z)
          expect(Math.hypot(position.x - anchor.x, position.z - anchor.z)).toBeLessThanOrEqual(24)
          expect(position.y - anchor.y!).toBeGreaterThanOrEqual(-0.00001)
          expect(position.y - anchor.y!).toBeLessThanOrEqual(24.00001)
          expect(Math.hypot(position.x - sample.position.x, position.z - sample.position.z)).toBeGreaterThan(25)
          if (previous) expect(current.distanceTo(previous)).toBeLessThan(1.5)
          previous = current
          if (step % 8 === 0) {
            if (blocked(pose)) hidden++
            if (blocked(tracksideCameraPose(tracksideDistancePosition(anchor, sample.position), sample.position))) fixedHidden++
          }
        }
        expect(hidden).toBeLessThanOrEqual(fixedHidden)
        expect(hidden).toBeLessThanOrEqual(16)
      }
      expect(sampleTracksideLift(lifts, 1 - 0.000001)).toBeCloseTo(sampleTracksideLift(lifts, 0), 2)
      expect(sampleTracksideLift(lifts, -0.000001)).toBeCloseTo(sampleTracksideLift(lifts, 0), 2)
    } finally {
      scenery.dispose()
    }
  })
})
