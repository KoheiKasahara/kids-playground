import { describe, expect, it } from 'vitest'
import { bowlingCameraSetup } from './bowlingCamera'
import { LAUNCH_HEIGHT, LAUNCH_Z } from './bowlingPhysics'
import { laneSurfaceY } from './bowlingStage'

/** 玉と積み木の上端。どの画面比でも、この2つが画面に入っていなければならない。 */
const BALL_POINT = { x: 0, y: laneSurfaceY(LAUNCH_Z) + LAUNCH_HEIGHT, z: LAUNCH_Z }
const TOWER_TOP = { x: 1.6, y: laneSurfaceY(-5.6) + 2.73, z: -5.6 }

/** その点がカメラの画角の内側に入っているか（縦・横の両方）。 */
function isVisible(aspect: number, point: { x: number; y: number; z: number }): boolean {
  const setup = bowlingCameraSetup(aspect)
  const forward = {
    x: setup.target.x - setup.position.x,
    y: setup.target.y - setup.position.y,
    z: setup.target.z - setup.position.z,
  }
  const forwardLength = Math.hypot(forward.x, forward.y, forward.z)
  const f = { x: forward.x / forwardLength, y: forward.y / forwardLength, z: forward.z / forwardLength }
  // 右方向 = forward × up(0,1,0) を正規化したもの。
  const right = { x: f.z, y: 0, z: -f.x }
  const rightLength = Math.hypot(right.x, right.z)
  const r = { x: right.x / rightLength, y: 0, z: right.z / rightLength }
  // 上方向 = right × forward。
  const u = {
    x: r.y * f.z - r.z * f.y,
    y: r.z * f.x - r.x * f.z,
    z: r.x * f.y - r.y * f.x,
  }
  const view = {
    x: point.x - setup.position.x,
    y: point.y - setup.position.y,
    z: point.z - setup.position.z,
  }
  const depth = view.x * f.x + view.y * f.y + view.z * f.z
  if (depth <= 0) return false
  const vertical = view.x * u.x + view.y * u.y + view.z * u.z
  const horizontal = view.x * r.x + view.y * r.y + view.z * r.z
  const halfFovTan = Math.tan(((setup.fov / 2) * Math.PI) / 180)
  return (
    Math.abs(vertical) <= depth * halfFovTan &&
    Math.abs(horizontal) <= depth * halfFovTan * aspect
  )
}

describe('固定カメラ', () => {
  it('玉の後ろ上から見下ろす位置にある', () => {
    const setup = bowlingCameraSetup(0.5)
    expect(setup.position.z).toBeGreaterThan(LAUNCH_Z)
    expect(setup.position.y).toBeGreaterThan(BALL_POINT.y)
    expect(setup.target.z).toBeLessThan(0)
  })

  it('どの画面比でも、玉と積み木の上端が画面に入る', () => {
    for (const aspect of [0.42, 0.46, 0.55, 0.75, 1, 1.6, 2.2]) {
      expect(isVisible(aspect, BALL_POINT), `縦横比 ${aspect} で玉が見えない`).toBe(true)
      expect(isVisible(aspect, TOWER_TOP), `縦横比 ${aspect} で積み木が見えない`).toBe(true)
    }
  })

  it('縦画面ほど画角を広げ、横画面では広げすぎない', () => {
    const portrait = bowlingCameraSetup(0.46)
    const square = bowlingCameraSetup(1)
    const landscape = bowlingCameraSetup(2)
    expect(portrait.fov).toBeGreaterThan(square.fov)
    expect(square.fov).toBeGreaterThanOrEqual(landscape.fov)
  })

  it('画面比が壊れた値でも破綻しない', () => {
    for (const aspect of [Number.NaN, 0, -3, Number.POSITIVE_INFINITY]) {
      const setup = bowlingCameraSetup(aspect)
      expect(Number.isFinite(setup.fov)).toBe(true)
      expect(setup.fov).toBeGreaterThan(0)
      expect(setup.fov).toBeLessThan(90)
    }
  })

  it('同じ画面比なら必ず同じ結果（固定カメラでぶれない）', () => {
    expect(bowlingCameraSetup(0.5)).toEqual(bowlingCameraSetup(0.5))
  })
})
