import { Plane, Raycaster, Vector2, Vector3, type Camera } from 'three'
import { aimAtTarget, type LaunchAim } from './bowlingLaunch'
import type { BowlingBallSpec } from './bowlingBalls'

/** カメラ投影を逆変換し、指で触れた左右位置をステージ前面の狙いへ戻す。 */
export function aimFromScreen(
  point: { x: number; y: number },
  rect: { left: number; top: number; width: number; height: number },
  camera: Camera,
  target: { frontZ: number; halfWidth: number; launchZ: number },
  ball: BowlingBallSpec,
): LaunchAim | null {
  if (rect.width <= 0 || rect.height <= 0 || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null
  camera.updateMatrixWorld()
  const raycaster = new Raycaster()
  raycaster.setFromCamera(new Vector2(
    ((point.x - rect.left) / rect.width) * 2 - 1,
    1 - ((point.y - rect.top) / rect.height) * 2,
  ), camera)
  const hit = raycaster.ray.intersectPlane(new Plane(new Vector3(0, 0, 1), -target.frontZ), new Vector3())
  return hit ? aimAtTarget(hit.x, target.launchZ - target.frontZ, target.halfWidth, ball) : null
}
