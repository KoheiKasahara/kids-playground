import { describe, expect, test } from 'vitest'
import { aimPose, angleHeading, ballPose, cupPose, followPose, headingAngle, lerpPose, MAX_VIEW_OFFSET, overviewPose, projectPoint, turnToward, viewHeading } from './golfCamera'
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

  test('ねらうカメラは 見る 点の ほうを 見て、ねらいが 大きく それたときだけ ねらいへ よる', () => {
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

  test('ねらう・おいかけるの あいだは、ボールの うしろに いたまま すこしずつ さがる', () => {
    const ball = { x: 2, y: 0.15, z: -3 }
    const heading = { x: 0.6, z: -0.8 }
    expect(ballPose(ball, heading, 1, 0)).toEqual(aimPose(ball, heading, 1))
    expect(ballPose(ball, heading, 1, 1)).toEqual(followPose(ball, heading, 1))
    const middle = ballPose(ball, heading, 1, 0.5)
    const back = { x: middle.position.x - ball.x, z: middle.position.z - ball.z }
    // ボールの まうしろ（むきと 反対の 線の 上）に いる。
    expect(back.x * heading.z - back.z * heading.x).toBeCloseTo(0, 6)
    expect(back.x * heading.x + back.z * heading.z).toBeLessThan(0)
    expect(middle.position.y).toBeGreaterThan(aimPose(ball, heading, 1).position.y)
    expect(middle.position.y).toBeLessThan(followPose(ball, heading, 1).position.y)
  })

  test('カメラの 向きは、近い ほうの まわり方で すこしずつ よせる', () => {
    for (const heading of [{ x: 0, z: -1 }, { x: 1, z: 0 }, { x: -0.6, z: 0.8 }]) {
      const back = angleHeading(headingAngle(heading))
      expect(back.x).toBeCloseTo(heading.x, 6)
      expect(back.z).toBeCloseTo(heading.z, 6)
    }
    // 170° と -170° の あいだは、0° を 通らず 180° を またいで 20° だけ まわる。
    const from = (170 * Math.PI) / 180
    const to = (-170 * Math.PI) / 180
    expect(turnToward(from, to, 0.5)).toBeCloseTo((180 * Math.PI) / 180, 6)
    expect(Math.sin(turnToward(from, to, 1))).toBeCloseTo(Math.sin(to), 6)
    expect(turnToward(from, to, 0)).toBe(from)
    // どれだけ 大きな 量を わたしても、行きすぎない。
    expect(Math.cos(turnToward(0.3, 1.2, 9))).toBeCloseTo(Math.cos(1.2), 6)
  })

  test('カップインの カメラは、カップを まん中に 見ながら まわりを まわる', () => {
    const cup = { x: 1, y: 0.2, z: -4 }
    for (const angle of [0, 1.3, 3.1, -2]) {
      const pose = cupPose(cup, angle, 0.7)
      const view = projectPoint(pose, cup, 0.7)!
      expect(Math.abs(view.x)).toBeLessThan(0.01)
      expect(Math.abs(view.y)).toBeLessThan(0.4)
      expect(pose.position.y).toBeGreaterThan(cup.y + 1.5)
    }
    const a = cupPose(cup, 0, 1).position
    const b = cupPose(cup, Math.PI, 1).position
    expect(Math.hypot(a.x - cup.x, a.z - cup.z)).toBeCloseTo(Math.hypot(b.x - cup.x, b.z - cup.z), 6)
    expect(a.z).toBeLessThan(cup.z)
    expect(b.z).toBeGreaterThan(cup.z)
  })
})
