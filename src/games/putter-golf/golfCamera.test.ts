import { describe, expect, test } from 'vitest'
import { aimPose, canSee, followPose, lerpPose, lookTarget, MAX_VIEW_OFFSET, overviewPose, projectPoint, viewHeading } from './golfCamera'
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

  const holeById = (id: string) => GOLF_COURSES.flatMap(course => course.holes).find(hole => hole.id === id)!
  const onFloor = (geometry: ReturnType<typeof buildHoleGeometry>, point: { x: number; z: number }) => ({ x: point.x, y: geometry.heightAt(point.x, point.z)! + 0.15, z: point.z })

  test('まっすぐ 見とおせる ホールでは、カップの ほうを 見る', () => {
    const hole = GOLF_COURSES[0]!.holes[0]!
    const geometry = buildHoleGeometry(hole)
    expect(lookTarget(onFloor(geometry, hole.tee), hole.cup, hole.route, geometry)).toEqual(hole.cup)
  })

  test.each(['candy-3', 'canyon-2'])('コの字の %s では、かべや たにを こえず みちに そって 先を 見る', id => {
    const hole = holeById(id)
    const geometry = buildHoleGeometry(hole)
    const tee = onFloor(geometry, hole.tee)
    expect(canSee(tee, hole.cup, geometry)).toBe(false)
    const look = lookTarget(tee, hole.cup, hole.route, geometry)
    // ティーからは まっすぐ 下の みちの ほう（-z）を 見る。
    const d = { x: look.x - tee.x, z: look.z - tee.z }
    expect(d.z / Math.hypot(d.x, d.z)).toBeLessThan(-0.95)
    // みちの とちゅうでも、見る 点までは まっすぐ 見とおせる。
    for (let i = 0; i < hole.route.length - 1; i++) {
      const a = hole.route[i]!
      const b = hole.route[i + 1]!
      for (const t of [0.25, 0.5, 0.75]) {
        const at = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }
        if (geometry.heightAt(at.x, at.z) === null) continue
        const ball = onFloor(geometry, at)
        const point = lookTarget(ball, hole.cup, hole.route, geometry)
        expect(canSee(ball, point, geometry)).toBe(true)
        // みちの すすむ 向きと ぎゃくは 見ない。
        const toward = { x: point.x - ball.x, z: point.z - ball.z }
        expect(toward.x * (b.x - a.x) + toward.z * (b.z - a.z)).toBeGreaterThanOrEqual(-1e-6)
      }
    }
  })

  test('すみを まがったあとは、カップの ほうへ むきなおす', () => {
    const hole = holeById('candy-3')
    const geometry = buildHoleGeometry(hole)
    const ball = onFloor(geometry, { x: 2.55, z: -2.0 })
    expect(lookTarget(ball, hole.cup, hole.route, geometry)).toEqual(hole.cup)
  })
})
