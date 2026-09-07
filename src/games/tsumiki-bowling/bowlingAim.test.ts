import { describe, expect, it } from 'vitest'
import { PerspectiveCamera, Vector3 } from 'three'
import { aimFromScreen } from './bowlingAim'
import { bowlingCameraSetup } from './bowlingCamera'
import { getBowlingStage, stageBounds, laneSurfaceY } from './bowlingStage'
import { getBowlingBall } from './bowlingBalls'
import { aimAtTarget, automaticLaunchVelocity } from './bowlingLaunch'
import { LAUNCH_Z, LAUNCH_YAW_LIMIT_RAD } from './bowlingPhysics'

describe('指で示す左右の狙い', () => {
  it.each([0.55, 1.8])('画面比 %s でも表示された柱を触るとその左右位置を狙える', (aspect) => {
    const stage = getBowlingStage('gate')
    const bounds = stageBounds(stage)
    const setup = bowlingCameraSetup(aspect, stage)
    const camera = new PerspectiveCamera(setup.fov, aspect, 0.1, 100)
    camera.position.copy(new Vector3(setup.position.x, setup.position.y, setup.position.z))
    camera.lookAt(new Vector3(setup.target.x, setup.target.y, setup.target.z))
    camera.updateMatrixWorld()
    const rect = { left: 20, top: 60, width: 500 * aspect, height: 500 }
    for (const x of [-1.1, 0, 1.1]) {
      const screen = new Vector3(x, laneSurfaceY(bounds.frontZ) + 0.5, bounds.frontZ).project(camera)
      const aim = aimFromScreen({ x: rect.left + (screen.x + 1) * rect.width / 2, y: rect.top + (1 - screen.y) * rect.height / 2 }, rect, camera, { ...bounds, launchZ: LAUNCH_Z }, getBowlingBall('heavy'))!
      expect(Math.tan(aim.yaw) * (LAUNCH_Z - bounds.frontZ)).toBeCloseTo(x, 5)
      expect(aim.active).toBe(true)
      expect(aim.pull).toBe(0)
    }
  })

  it('狙いを大きく外へ動かしても左右上限を越えない', () => {
    for (const x of [-10000, 10000]) {
      const aim = aimAtTarget(x, 27, 4, getBowlingBall('small'))
      expect(Math.abs(aim.yaw)).toBeLessThanOrEqual(LAUNCH_YAW_LIMIT_RAD)
      expect(Math.sign(aim.yaw)).toBe(Math.sign(x))
    }
  })

  it('同じ玉では指の移動量にかかわらず速さと仰角が一定', () => {
    for (const id of ['heavy', 'bouncy', 'small']) {
      const ball = getBowlingBall(id)
      const a = automaticLaunchVelocity({ active: true, power: 0, yaw: 0, pull: 0 }, ball)
      const b = automaticLaunchVelocity({ active: true, power: 1, yaw: 0, pull: 0 }, ball)
      expect(a).toEqual(b)
      expect(a.z).toBeLessThan(0)
    }
  })

  it('まだサイズのないcanvasでは発射を作らない', () => {
    expect(aimFromScreen({ x: 0, y: 0 }, { left: 0, top: 0, width: 0, height: 0 }, new PerspectiveCamera(), { frontZ: -7, halfWidth: 2, launchZ: LAUNCH_Z }, getBowlingBall('heavy'))).toBeNull()
  })
})
