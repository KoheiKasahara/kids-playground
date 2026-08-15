import {
  DOMINO_DEPTH,
  DOMINO_HEIGHT,
  FLAG_PITCH_Z,
  FLAG_ROWS,
} from './dominoLayout'

export type CameraSetup = {
  position: { x: number; y: number; z: number }
  target: { x: number; y: number; z: number }
  fov: number
}

const CAMERA_FOV = 50
const CAMERA_ELEVATION_RAD = (50 * Math.PI) / 180
const CAMERA_MARGIN = 1.12
const CAMERA_TARGET_Y = 0.32

/**
 * レイアウト境界と画面アスペクト比から、全体が収まる固定カメラを決める。
 * X/Z平面の四隅に、ドミノの高さと旗が倒れる+Z側の余白を加えてから投影条件を解く。
 */
export function computeCameraSetup(
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  aspect: number,
): CameraSetup {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1
  const target = {
    x: (bounds.minX + bounds.maxX) / 2,
    // 最大Z側は旗エリアなので、全体の中心ではなく旗の中心付近を見る。
    z: bounds.maxZ - ((FLAG_ROWS - 1) * FLAG_PITCH_Z + DOMINO_DEPTH) / 2,
    y: CAMERA_TARGET_Y,
  }

  const extendedMaxZ = bounds.maxZ + DOMINO_HEIGHT
  const tanVertical = Math.tan((CAMERA_FOV * Math.PI) / 360)
  const horizontalFov = 2 * Math.atan(tanVertical * safeAspect)
  const tanHorizontal = Math.tan(horizontalFov / 2)
  const sinElevation = Math.sin(CAMERA_ELEVATION_RAD)
  const cosElevation = Math.cos(CAMERA_ELEVATION_RAD)
  const cameraUp = { x: 0, y: cosElevation, z: -sinElevation }
  const cameraDirection = { x: 0, y: sinElevation, z: cosElevation }

  let requiredDistance = 0
  for (const x of [bounds.minX, bounds.maxX]) {
    for (const z of [bounds.minZ, extendedMaxZ]) {
      for (const y of [0, DOMINO_HEIGHT]) {
        const relative = { x: x - target.x, y: y - target.y, z: z - target.z }
        const distanceAlongCamera =
          relative.x * cameraDirection.x +
          relative.y * cameraDirection.y +
          relative.z * cameraDirection.z
        const vertical =
          relative.x * cameraUp.x + relative.y * cameraUp.y + relative.z * cameraUp.z
        const horizontalRequirement =
          distanceAlongCamera + Math.abs(relative.x) / tanHorizontal
        const verticalRequirement =
          distanceAlongCamera + Math.abs(vertical) / tanVertical
        requiredDistance = Math.max(
          requiredDistance,
          horizontalRequirement,
          verticalRequirement,
        )
      }
    }
  }

  // 最低距離も設け、極端に小さいテスト用boundsでもnear面に入らないようにする。
  const distance = Math.max(2, requiredDistance * CAMERA_MARGIN + 0.25)

  return {
    position: {
      x: target.x,
      y: target.y + distance * sinElevation,
      z: target.z + distance * cosElevation,
    },
    target,
    fov: CAMERA_FOV,
  }
}
