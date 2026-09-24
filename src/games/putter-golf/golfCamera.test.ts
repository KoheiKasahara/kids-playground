import { describe, expect, test } from 'vitest'
import { aimPose, followPose, lerpPose, MAX_VIEW_OFFSET, overviewPose, projectPoint, viewHeading } from './golfCamera'
import { GOLF_COURSES } from './golfCourses'
import { buildHoleGeometry } from './golfGeometry'

describe('パターゴルフのカメラ', () => {
  test('ねらうカメラは、うつ向きのうしろ上からボールの先を見る', () => {
    const ball = { x: 1, y: 0.15, z: 2 }
    for (const direction of [{ x: 0, z: -1 }, { x: 1, z: 0 }, { x: -0.6, z: 0.8 }]) {
      const pose = aimPose(ball, direction, 1.6)
      const back = { x: pose.position.x - ball.x, z: pose.position.z - ball.z }
      expect(back.x * direction.x + back.z * direction.z).toBeLessThan(0)
      expect(pose.position.y).toBeGreaterThan(ball.y + 2)
      const view = projectPoint(pose, ball, 1.6)!
      // ボールは画面の下半分に、左右の真ん中に見える。
      expect(Math.abs(view.x)).toBeLessThan(0.01)
      expect(view.y).toBeLessThan(0)
      expect(view.y).toBeGreaterThan(-0.9)
    }
  })

  test('縦長の画面では少し下がって、ボールのまわりを広く見せる', () => {
    const ball = { x: 0, y: 0, z: 0 }
    const wide = aimPose(ball, { x: 0, z: -1 }, 1.8)
    const tall = aimPose(ball, { x: 0, z: -1 }, 0.6)
    expect(tall.position.z).toBeGreaterThan(wide.position.z)
    expect(followPose(ball, { x: 0, z: -1 }, 0.6).position.y).toBeGreaterThan(followPose(ball, { x: 0, z: -1 }, 1.8).position.y)
  })

  test.each([0.62, 1, 2.2])('ぜんたいカメラは、縦横比 %s でもどのホールも丸ごと入る', aspect => {
    for (const hole of GOLF_COURSES.flatMap(course => course.holes)) {
      const { bounds } = buildHoleGeometry(hole)
      const pose = overviewPose(bounds, aspect)
      for (const x of [bounds.minX, bounds.maxX]) for (const z of [bounds.minZ, bounds.maxZ]) {
        const p = projectPoint(pose, { x, y: bounds.maxY, z }, aspect)!
        expect(Math.abs(p.x)).toBeLessThanOrEqual(0.91)
        expect(Math.abs(p.y)).toBeLessThanOrEqual(0.91)
      }
      // ぴったり入る所まで寄っている（むだに遠くない）。
      const nearer = { target: pose.target, position: { x: pose.position.x, y: pose.target.y + (pose.position.y - pose.target.y) * 0.85, z: pose.target.z + (pose.position.z - pose.target.z) * 0.85 } }
      const anyOutside = [bounds.minX, bounds.maxX].some(x => [bounds.minZ, bounds.maxZ].some(z => [bounds.minY, bounds.maxY].some(y => {
        const p = projectPoint(nearer, { x, y, z }, aspect)
        return p === null || Math.abs(p.x) > 0.9 || Math.abs(p.y) > 0.9
      })))
      expect(anyOutside).toBe(true)
    }
  })

  test('カメラの切りかえは、途中の位置を線でつなぐ', () => {
    const a = { position: { x: 0, y: 0, z: 0 }, target: { x: 0, y: 0, z: -1 } }
    const b = { position: { x: 2, y: 4, z: 6 }, target: { x: 2, y: 0, z: -3 } }
    expect(lerpPose(a, b, 0.5)).toEqual({ position: { x: 1, y: 2, z: 3 }, target: { x: 1, y: 0, z: -2 } })
    expect(lerpPose(a, b, 4)).toEqual(b)
  })

  test('ねらうカメラは カップの ほうを 見て、ねらいが 大きく それたときだけ ねらいへ よる', () => {
    const ball = { x: 0, z: 0 }
    const cup = { x: 0, z: -10 }
    // すこし ずらした ねらいでは、カップの ほうを 見たまま。
    expect(viewHeading(ball, cup, { x: 0.3, z: -1 })).toEqual({ x: 0, z: -1 })
    // うしろ向きの ねらいでも、矢じるしが 見える 角度までしか まわらない。
    for (const aim of [{ x: 0, z: 1 }, { x: 1, z: 0 }, { x: -1, z: 0.2 }]) {
      const view = viewHeading(ball, cup, aim)
      const length = Math.hypot(aim.x, aim.z)
      const between = Math.acos(Math.min(1, (view.x * aim.x + view.z * aim.z) / length))
      expect(between).toBeCloseTo(MAX_VIEW_OFFSET, 5)
      expect(Math.hypot(view.x, view.z)).toBeCloseTo(1, 6)
      expect(view.z).toBeLessThan(0.6)
    }
  })
})
