import { describe, expect, test } from 'vitest'
import { CAMERA_LIMITS, cameraPosition, fovFor, overviewPose, pushOutOfSpheres } from './cameraRig'

describe('カメラ', () => {
  test('縦長の画面ほど視野を広げ、俯瞰の距離は制限の範囲に収まる', () => {
    expect(fovFor(0.46)).toBeGreaterThan(fovFor(1.8))
    for (const aspect of [0.46, 0.75, 1.0, 1.78, 2.2]) {
      const pose = overviewPose(aspect)
      expect(pose.distance).toBeGreaterThanOrEqual(18)
      expect(pose.distance).toBeLessThanOrEqual(CAMERA_LIMITS.maxDistance)
      expect(pose.polar).toBeGreaterThanOrEqual(CAMERA_LIMITS.minPolar)
      expect(pose.polar).toBeLessThanOrEqual(CAMERA_LIMITS.maxPolar)
    }
  })

  test('俯瞰のカメラは斜め上（地面より十分高い位置）から見下ろす', () => {
    const [, y] = cameraPosition(overviewPose(0.5))
    expect(y).toBeGreaterThan(8)
  })

  test('仰角の上限があるので、どれだけ回しても地面の下へ回り込まない', () => {
    const lowest = Math.cos(CAMERA_LIMITS.maxPolar) * CAMERA_LIMITS.minDistance
    expect(lowest).toBeGreaterThan(CAMERA_LIMITS.minHeight)
  })

  test('木の葉の中に入ったカメラは外へ押し出し、地面すれすれにもしない', () => {
    const canopy = { center: { x: 0, y: 3, z: 0 }, radius: 1.5 }
    const [x, y, z] = pushOutOfSpheres([0.2, 3.2, 0.1], [canopy])
    expect(Math.hypot(x, y - 3, z)).toBeCloseTo(1.5)
    expect(pushOutOfSpheres([5, 0.2, 5], [])[1]).toBe(CAMERA_LIMITS.minHeight)
  })
})

describe('追いかけるカメラの回り込み', () => {
  test('木が間に入らない方向を選び、さえぎるものがなければ斜め前から見る', async () => {
    const { followAzimuth, cameraPosition: pos, segmentHitsSphere } = await import('./cameraRig')
    const target: [number, number, number] = [0, 0.6, 0]
    expect(followAzimuth(target, 0, 6, 1, [])).toBeCloseTo(0.75)
    // 斜め前のカメラ位置と動物のあいだに竹やぶを置く
    const front = pos({ target, distance: 6, polar: 1, azimuth: 0.75 })
    const bamboo = { center: { x: front[0] * 0.5, y: 1.5, z: front[2] * 0.5 }, radius: 0.9 }
    expect(segmentHitsSphere(front, target, bamboo)).toBe(true)
    const az = followAzimuth(target, 0, 6, 1, [bamboo])
    expect(az).not.toBeCloseTo(0.75)
    expect(segmentHitsSphere(pos({ target, distance: 6, polar: 1, azimuth: az }), target, bamboo)).toBe(false)
  })
})
