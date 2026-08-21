import { MAX_TILT_RAD, VISUAL_TILT_RATIO, WALL_HEIGHT } from './mazePhysics'

/**
 * 盤面全体が常に見えている固定カメラ。
 * カメラが追いかけないので、幼児でも「どこにゴールがあるか」を見失わない。
 */

export const CAMERA_FOV = 50

/** 真上すぎると立体感が消え、低すぎると奥の通路が壁で隠れるため中間の仰角にする。 */
export const CAMERA_ELEVATION_RAD = (58 * Math.PI) / 180

/** 画面端に盤面が貼り付かないための余白。 */
const CAMERA_MARGIN = 1.1

/**
 * 見た目の盤面は中心まわりに傾くため、端は上下へ動く。
 * 最大まで傾けたときの持ち上がり量を求め、その状態でも画角から出ないようにする。
 */
export function visualTiltLift(bounds: {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}): number {
  const halfDiagonal = Math.hypot(
    (bounds.maxX - bounds.minX) / 2,
    (bounds.maxZ - bounds.minZ) / 2,
  )
  return halfDiagonal * Math.sin(MAX_TILT_RAD * VISUAL_TILT_RATIO)
}

export type MazeCameraSetup = {
  position: { x: number; y: number; z: number }
  target: { x: number; y: number; z: number }
  fov: number
  distance: number
}

/**
 * 盤面の四隅と壁の高さがすべて画角へ収まる距離を、縦横それぞれの条件から求める。
 * 縦画面でも横画面でも同じ関数で決まるので、リサイズのたびに呼べばよい。
 */
export function computeMazeCameraSetup(
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  aspect: number,
  wallHeight = WALL_HEIGHT,
): MazeCameraSetup {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1
  const target = {
    x: (bounds.minX + bounds.maxX) / 2,
    y: 0,
    z: (bounds.minZ + bounds.maxZ) / 2,
  }

  const tanVertical = Math.tan((CAMERA_FOV * Math.PI) / 360)
  // 水平方向の画角はThree.jsのPerspectiveCameraと同じくaspect倍で決まる。
  const tanHorizontal = tanVertical * safeAspect
  const sinElevation = Math.sin(CAMERA_ELEVATION_RAD)
  const cosElevation = Math.cos(CAMERA_ELEVATION_RAD)
  // targetからカメラへ向かう単位ベクトルと、その画面上向き。
  const toCamera = { x: 0, y: sinElevation, z: cosElevation }
  const cameraUp = { x: 0, y: cosElevation, z: -sinElevation }

  // 盤面が傾いた状態でも収まるよう、上下方向へ持ち上がり量ぶん広げて解く。
  const lift = visualTiltLift(bounds)

  let requiredDistance = 0
  for (const x of [bounds.minX, bounds.maxX]) {
    for (const z of [bounds.minZ, bounds.maxZ]) {
      for (const y of [-lift, wallHeight + lift]) {
        const relative = { x: x - target.x, y: y - target.y, z: z - target.z }
        const depthOffset =
          relative.x * toCamera.x + relative.y * toCamera.y + relative.z * toCamera.z
        const vertical =
          relative.x * cameraUp.x + relative.y * cameraUp.y + relative.z * cameraUp.z
        requiredDistance = Math.max(
          requiredDistance,
          depthOffset + Math.abs(relative.x) / tanHorizontal,
          depthOffset + Math.abs(vertical) / tanVertical,
        )
      }
    }
  }

  // 極端に小さい盤面でもnear面へ入り込まないよう最低距離を持たせる。
  const distance = Math.max(4, requiredDistance * CAMERA_MARGIN)

  return {
    position: {
      x: target.x,
      y: target.y + distance * sinElevation,
      z: target.z + distance * cosElevation,
    },
    target,
    fov: CAMERA_FOV,
    distance,
  }
}
