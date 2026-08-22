import {
  CAMERA_ELEVATION_RAD,
  CAMERA_FOV,
  CAMERA_TARGET_Y,
  cameraDistanceOf,
  computeCameraSetup,
} from './dominoCamera'
import { LINE_COUNT } from './dominoLayout'

export type RailVec3 = { x: number; y: number; z: number }

/** 進行度に対応する注視点と距離。カメラの向きは固定カメラと同じ式で求める。 */
export type CameraRailAnchor = {
  progress: number
  target: RailVec3
  distance: number
}

export type CameraRailPose = { target: RailVec3; distance: number }

export type CameraRailBuildOptions = {
  reducedMotion?: boolean
  /** reduced-motion時に使うロングコース全体の俯瞰ポーズ。 */
  wideCamera?: CameraRailPose
  /** aspect比から求めた道中カメラの距離。 */
  approachDistance?: number
  /** 道中と共有直線を含むカメラ進行度の対象数。 */
  cameraProgressCount?: number
}

export type BigCameraRailBuildOptions = {
  reducedMotion?: boolean
  /** テストと将来の演出調整で補間の細かさを差し替えられる。 */
  transitionCount?: number
}

/** 道中の中心線を少し先まで画面中央に置く距離。 */
export const LOOK_AHEAD = 2.0

/** 道中カメラの基準距離。縦画面では最低横幅の条件でさらに引く。 */
export const APPROACH_CAMERA_DISTANCE = 14

/** 縦画面でも注視点の左右に確保する最低限の世界幅。 */
export const APPROACH_MIN_HALF_WIDTH = 5.0

/** 道中終盤8枚から共有直線12枚までを国旗カメラへの移行区間にする。 */
export const CAMERA_BLEND_APPROACH_COUNT = 8

/**
 * エンジンとテストが同じ全体俯瞰カメラを使うための純粋な変換。
 * computeCameraSetupが持つ余白をそのまま使い、別の倍率を重ねない。
 */
export function wideCameraPoseFor(
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  aspect: number,
  flagRows?: number,
): CameraRailPose {
  const setup = computeCameraSetup(bounds, aspect, flagRows)
  return {
    target: { ...setup.target },
    distance: cameraDistanceOf(setup),
  }
}

/** aspect比から、注視点の横幅条件を満たす道中カメラ距離を求める。 */
export function approachCameraDistanceFor(aspect: number): number {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1
  const halfWidthPerUnit = Math.tan((CAMERA_FOV * Math.PI) / 360) * safeAspect
  return Math.max(
    APPROACH_CAMERA_DISTANCE,
    APPROACH_MIN_HALF_WIDTH / halfWidthPerUnit,
  )
}

/** ドミノの段階的な倒伏へ追従し、急な加速を避ける進行度の減衰率。 */
export const PROGRESS_LAMBDA = 2.5

/** 注視点と距離の変化をさらに丸め、カメラの急な動きを避ける減衰率。 */
export const CAMERA_LAMBDA = 3.2

/** 完成判定より手前の倒れ始めをカメラ進行度へ反映する傾き。 */
export const CAMERA_PROGRESS_TILT_RAD = 0.35

/** 導線から国旗全体へ2.5秒かけて引く。連鎖の詰まりがあっても全体を見失わないための時間下限。 */
export const BIG_CAMERA_PULLOUT_MS = 2_500

const REDUCED_WIDE_DISTANCE = APPROACH_CAMERA_DISTANCE * 2.5

function cloneVec3(value: RailVec3): RailVec3 {
  return { x: value.x, y: value.y, z: value.z }
}

function clonePose(value: CameraRailPose): CameraRailPose {
  return { target: cloneVec3(value.target), distance: value.distance }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

function forwardFor(yaw: number) {
  return { x: Math.sin(yaw), z: Math.cos(yaw) }
}

function approachPoseFor(
  point: { x: number; z: number; yaw: number },
  distance: number,
): CameraRailPose {
  const forward = forwardFor(point.yaw)
  return {
    target: {
      x: point.x + forward.x * LOOK_AHEAD,
      y: CAMERA_TARGET_Y,
      z: point.z + forward.z * LOOK_AHEAD,
    },
    distance,
  }
}

/**
 * 両端を二次で立ち上げ・収束させ、中央を線形にして傾きを頭打ちにする。
 * 最大傾き1.2は、引き区間のピーク速度を70/進行度以下に収めるために選ぶ。
 */
const CAMERA_BLEND_MAX_SLOPE = 1.2

function easeWithCappedSlope(value: number): number {
  const t = clamp01(value)
  const maximumSlope = CAMERA_BLEND_MAX_SLOPE
  const ramp = 1 - 1 / maximumSlope
  const rampArea = (maximumSlope * ramp) / 2
  if (t <= ramp) return (maximumSlope * (t * t)) / (2 * ramp)
  if (t >= 1 - ramp) {
    const remaining = 1 - t
    return 1 - (maximumSlope * (remaining * remaining)) / (2 * ramp)
  }
  return rampArea + maximumSlope * (t - ramp)
}

function blendPose(
  from: CameraRailPose,
  to: CameraRailPose,
  ratio: number,
): CameraRailPose {
  const t = clamp01(ratio)
  return {
    target: {
      x: from.target.x + (to.target.x - from.target.x) * t,
      y: from.target.y + (to.target.y - from.target.y) * t,
      z: from.target.z + (to.target.z - from.target.z) * t,
    },
    distance: from.distance + (to.distance - from.distance) * t,
  }
}

function fallbackWideCamera(
  approachPath: readonly { x: number; z: number; yaw: number }[],
  flagCamera: CameraRailPose,
): CameraRailPose {
  let minX = flagCamera.target.x
  let maxX = flagCamera.target.x
  let minZ = flagCamera.target.z
  let maxZ = flagCamera.target.z
  for (const point of approachPath) {
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minZ = Math.min(minZ, point.z)
    maxZ = Math.max(maxZ, point.z)
  }
  return {
    target: {
      x: (minX + maxX) / 2,
      y: CAMERA_TARGET_Y,
      z: (minZ + maxZ) / 2,
    },
    // 呼び出し側が全体boundsから距離を渡せない場合にも、最低限の俯瞰を確保する。
    distance: Math.max(flagCamera.distance, REDUCED_WIDE_DISTANCE),
  }
}

/** 共有直線の各進行度に対応する、傾きを制限した引きのアンカーを作る。 */
function transitionAnchors(
  startIndex: number,
  progressCount: number,
  transitionCount: number,
  from: CameraRailPose,
  to: CameraRailPose,
): CameraRailAnchor[] {
  return Array.from({ length: transitionCount }, (_, index) => {
    const ratio =
      transitionCount <= 1
        ? 1
        : easeWithCappedSlope(index / transitionCount)
    const pose = blendPose(from, to, ratio)
    return {
      progress: (startIndex + index) / progressCount,
      ...pose,
    }
  })
}

/** 道中の中心線と国旗固定カメラから、ロング専用の純粋なカメラレールを作る。 */
export function buildLongCameraRail(
  approachPath: readonly { x: number; z: number; yaw: number }[],
  flagCamera: CameraRailPose,
  options: CameraRailBuildOptions = {},
): CameraRailAnchor[] {
  if (approachPath.length === 0) {
    throw new Error('ロングカメラレールには道中の中心線が必要です')
  }

  const progressCount = options.cameraProgressCount ?? approachPath.length + LINE_COUNT
  if (!Number.isInteger(progressCount) || progressCount <= approachPath.length) {
    throw new Error('カメラ進行度の対象数が不正です')
  }
  const blendStartIndex = Math.max(
    0,
    approachPath.length - CAMERA_BLEND_APPROACH_COUNT,
  )
  const transitionCount = progressCount - blendStartIndex
  const approachDistance =
    Number.isFinite(options.approachDistance) && options.approachDistance! > 0
      ? options.approachDistance!
      : APPROACH_CAMERA_DISTANCE
  const wideCamera = options.wideCamera
    ? clonePose(options.wideCamera)
    : fallbackWideCamera(approachPath, flagCamera)
  const finalCamera = clonePose(flagCamera)

  if (options.reducedMotion === true) {
    return [
      { progress: 0, target: cloneVec3(wideCamera.target), distance: wideCamera.distance },
      // reduced-motionでは全行程を同じ俯瞰で見せ、カメラ移動を完全になくす。
      { progress: 1, target: cloneVec3(wideCamera.target), distance: wideCamera.distance },
    ]
  }

  const anchors: CameraRailAnchor[] = approachPath
    .slice(0, blendStartIndex)
    .map((point, index) => ({
      progress: index / progressCount,
      ...approachPoseFor(point, approachDistance),
    }))
  const blendStartPose = approachPoseFor(
    approachPath[blendStartIndex]!,
    approachDistance,
  )
  anchors.push(
    ...transitionAnchors(
      blendStartIndex,
      progressCount,
      transitionCount,
      blendStartPose,
      finalCamera,
    ),
  )
  anchors.push({
    progress: 1,
    target: cloneVec3(finalCamera.target),
    distance: finalCamera.distance,
  })
  return anchors.map((anchor) => ({
    ...anchor,
    target: cloneVec3(anchor.target),
  }))
}

/**
 * ビッグ専用の引きカメラレールを、寄り姿勢と全体姿勢だけから構築する純粋関数。
 * 実際の進行度はエンジン側で連鎖と経過時間の大きい方を渡し、ここでは滑らかな姿勢補間だけを担う。
 */
export function buildBigCameraRail(
  nearPose: CameraRailPose,
  widePose: CameraRailPose,
  options: BigCameraRailBuildOptions = {},
): CameraRailAnchor[] {
  const transitionCount = Number.isInteger(options.transitionCount)
    ? Math.max(2, options.transitionCount!)
    : 9
  const near = clonePose(nearPose)
  const wide = clonePose(widePose)

  if (options.reducedMotion === true) {
    return [
      { progress: 0, target: cloneVec3(wide.target), distance: wide.distance },
      { progress: 1, target: cloneVec3(wide.target), distance: wide.distance },
    ]
  }

  return Array.from({ length: transitionCount }, (_, index) => {
    const linearProgress = index / (transitionCount - 1)
    const pose = blendPose(near, wide, easeWithCappedSlope(linearProgress))
    return {
      progress: linearProgress,
      target: cloneVec3(pose.target),
      distance: pose.distance,
    }
  })
}

/** レールのアンカー間を線形補間し、範囲外の進行度は端に丸める。 */
export function sampleCameraRail(
  anchors: readonly CameraRailAnchor[],
  progress: number,
): CameraRailPose {
  if (anchors.length === 0) throw new Error('カメラレールのアンカーが空です')

  const clampedProgress = clamp01(progress)
  const first = anchors[0]!
  const last = anchors[anchors.length - 1]!
  if (clampedProgress <= first.progress) return clonePose(first)
  if (clampedProgress >= last.progress) return clonePose(last)

  for (let index = 1; index < anchors.length; index += 1) {
    const upper = anchors[index]!
    if (clampedProgress > upper.progress) continue
    const lower = anchors[index - 1]!
    const span = upper.progress - lower.progress
    if (span <= 0) return clonePose(upper)
    const ratio = (clampedProgress - lower.progress) / span
    return blendPose(lower, upper, ratio)
  }
  return clonePose(last)
}

/** フレーム間隔に依存しない指数減衰の補間係数。 */
export function dampFactor(lambda: number, deltaSeconds: number): number {
  if (!Number.isFinite(lambda) || !Number.isFinite(deltaSeconds)) return 0
  if (lambda <= 0 || deltaSeconds <= 0) return 0
  return Math.min(1, Math.max(0, 1 - Math.exp(-lambda * deltaSeconds)))
}

/** 生の進行度へ近づけるが、単調な進行度ポインタが後退することはない。 */
export function advanceRailProgress(
  current: number,
  raw: number,
  deltaSeconds: number,
  lambda: number,
): number {
  const currentProgress = clamp01(current)
  const target = Math.max(currentProgress, clamp01(raw))
  const next = currentProgress + (target - currentProgress) * dampFactor(lambda, deltaSeconds)
  return Math.min(target, Math.max(currentProgress, next))
}

/** 固定カメラと同じ仰角・方位角で、注視点と距離からカメラ位置を求める。 */
export function cameraPositionFor(target: RailVec3, distance: number): RailVec3 {
  return {
    x: target.x,
    y: target.y + Math.sin(CAMERA_ELEVATION_RAD) * distance,
    z: target.z + Math.cos(CAMERA_ELEVATION_RAD) * distance,
  }
}
