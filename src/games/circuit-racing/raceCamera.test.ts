import { describe, expect, test } from 'vitest'
import { chaseCameraPose, tracksideCameraPose } from './raceCamera'

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
