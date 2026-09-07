import { Box3, PerspectiveCamera, Vector3 } from 'three'
import { CIRCUIT } from './circuit'
import { describe, expect, test } from 'vitest'
import { chaseCameraPose, tracksideCameraPose, overviewCameraPose } from './raceCamera'

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
