/**
 * Three.js に依存しない、Rail Builder の orthographic camera 計算。
 *
 * カメラの向きは cameraOffset の向きをそのまま使う。bounds は固定の
 * overviewTarget を基準に camera plane の軸へ投影し、current target は
 * camera distance/position にだけ使うことで、pan/follow でも framing が変わらない。
 */

export type RailCameraVector3 = {
  x: number
  y: number
  z: number
}

export type RailCameraBounds = {
  minX: number
  maxX: number
  minY: number
  maxY: number
  minZ: number
  maxZ: number
}

export type RailCameraFitOptions = {
  bounds: RailCameraBounds
  /** 投影/fog の基準にする固定 map center。pan で動かさない。 */
  overviewTarget: RailCameraVector3
  target: RailCameraVector3
  cameraOffset: RailCameraVector3
  aspect: number
  baseViewSize: number
  minZoom: number
}

export type RailCameraFit = {
  /** target から camera へ向かう正規化方向。 */
  direction: RailCameraVector3
  /** camera plane 上の right/up 軸。 */
  right: RailCameraVector3
  up: RailCameraVector3
  /** bounds の最前面から一定の余白を置いた plane の depth。 */
  cameraPlane: number
  cameraDistance: number
  cameraPosition: RailCameraVector3
  projectedMaxAbsX: number
  projectedMaxAbsY: number
  requiredWidth: number
  requiredHeight: number
  fitZoom: number
  overviewZoom: number
  minDepth: number
  maxDepth: number
  depthSpan: number
  centerDepth: number
  fogNear: number
  fogFar: number
}

/** bounds の投影に加える幅/高さの padding。 */
export const RAIL_CAMERA_FIT_PADDING = 1.05
/** bounds 最前面と camera の距離。near clip より十分に大きくする。 */
export const RAIL_CAMERA_FRONT_CLEARANCE = 4
/** center target から fog を開始する depth の割合。 */
export const RAIL_CAMERA_FOG_NEAR_SPAN_RATIO = 0.1
/** bounds の最深部から fog end までの割合。 */
export const RAIL_CAMERA_FOG_FAR_SPAN_RATIO = 0.2
export const RAIL_CAMERA_CLIP_NEAR = 0.1
export const RAIL_CAMERA_CLIP_FAR = 220

function add(a: RailCameraVector3, b: RailCameraVector3): RailCameraVector3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }
}

function subtract(a: RailCameraVector3, b: RailCameraVector3): RailCameraVector3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

function scale(vector: RailCameraVector3, amount: number): RailCameraVector3 {
  return { x: vector.x * amount, y: vector.y * amount, z: vector.z * amount }
}

function dot(a: RailCameraVector3, b: RailCameraVector3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

function cross(a: RailCameraVector3, b: RailCameraVector3): RailCameraVector3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }
}

function length(vector: RailCameraVector3): number {
  return Math.hypot(vector.x, vector.y, vector.z)
}

function normalize(vector: RailCameraVector3, fallback: RailCameraVector3): RailCameraVector3 {
  const magnitude = length(vector)
  if (!Number.isFinite(magnitude) || magnitude < Number.EPSILON) return fallback
  return scale(vector, 1 / magnitude)
}

function boundsCorners(bounds: RailCameraBounds): RailCameraVector3[] {
  const corners: RailCameraVector3[] = []
  for (const x of [bounds.minX, bounds.maxX]) {
    for (const y of [bounds.minY, bounds.maxY]) {
      for (const z of [bounds.minZ, bounds.maxZ]) {
        corners.push({ x, y, z })
      }
    }
  }
  return corners
}

/**
 * bounds の 8 隅を camera plane へ投影し、fit zoom・clip depth・fog depth
 * を求める。返り値は全て plain object のため、Three/DOM なしでテストできる。
 */
export function calculateRailCameraFit(options: RailCameraFitOptions): RailCameraFit {
  const direction = normalize(options.cameraOffset, { x: 0, y: 0, z: 1 })
  const worldUp = { x: 0, y: 1, z: 0 }

  // world up を camera plane に正射影すると、lookAt の up と一致する。
  // cameraOffset が真上/真下でも退化しないように補助軸を用意する。
  let upCandidate = subtract(worldUp, scale(direction, dot(worldUp, direction)))
  if (length(upCandidate) < Number.EPSILON) {
    const fallbackUp = Math.abs(direction.z) < 0.99
      ? { x: 0, y: 0, z: 1 }
      : { x: 1, y: 0, z: 0 }
    upCandidate = subtract(fallbackUp, scale(direction, dot(fallbackUp, direction)))
  }
  const up = normalize(upCandidate, { x: 0, y: 1, z: 0 })
  // Three の camera forward は direction の逆向きなので forward x up が right。
  const right = normalize(cross(scale(direction, -1), up), { x: 1, y: 0, z: 0 })

  const corners = boundsCorners(options.bounds)
  const safeAspect = Number.isFinite(options.aspect) && options.aspect > 0 ? options.aspect : 1
  let projectedMaxAbsX = 0
  let projectedMaxAbsY = 0
  let maxDirectionDepth = Number.NEGATIVE_INFINITY
  let minDirectionDepth = Number.POSITIVE_INFINITY
  for (const corner of corners) {
    const relative = subtract(corner, options.overviewTarget)
    projectedMaxAbsX = Math.max(projectedMaxAbsX, Math.abs(dot(relative, right)))
    projectedMaxAbsY = Math.max(projectedMaxAbsY, Math.abs(dot(relative, up)))
    const directionDepth = dot(corner, direction)
    maxDirectionDepth = Math.max(maxDirectionDepth, directionDepth)
    minDirectionDepth = Math.min(minDirectionDepth, directionDepth)
  }

  const requiredWidth = projectedMaxAbsX * 2 * RAIL_CAMERA_FIT_PADDING
  const requiredHeight = projectedMaxAbsY * 2 * RAIL_CAMERA_FIT_PADDING
  const widthScale = safeAspect >= 1 ? safeAspect : 1
  const heightScale = safeAspect >= 1 ? 1 : 1 / safeAspect
  const widthFitZoom = requiredWidth > 0
    ? options.baseViewSize * widthScale / requiredWidth
    : Number.POSITIVE_INFINITY
  const heightFitZoom = requiredHeight > 0
    ? options.baseViewSize * heightScale / requiredHeight
    : Number.POSITIVE_INFINITY
  const fitZoom = Math.min(widthFitZoom, heightFitZoom)
  const overviewZoom = Math.min(options.minZoom, fitZoom)

  const cameraPlane = maxDirectionDepth + RAIL_CAMERA_FRONT_CLEARANCE
  const cameraDistance = cameraPlane - dot(options.target, direction)
  const cameraPosition = add(options.target, scale(direction, cameraDistance))
  const minDepth = cameraPlane - maxDirectionDepth
  const maxDepth = cameraPlane - minDirectionDepth
  const depthSpan = Math.max(0, maxDepth - minDepth)
  const centerDepth = cameraPlane - dot(options.overviewTarget, direction)
  const fogNear = centerDepth + depthSpan * RAIL_CAMERA_FOG_NEAR_SPAN_RATIO
  const fogFar = maxDepth + depthSpan * RAIL_CAMERA_FOG_FAR_SPAN_RATIO

  return {
    direction,
    right,
    up,
    cameraPlane,
    cameraDistance,
    cameraPosition,
    projectedMaxAbsX,
    projectedMaxAbsY,
    requiredWidth,
    requiredHeight,
    fitZoom,
    overviewZoom,
    minDepth,
    maxDepth,
    depthSpan,
    centerDepth,
    fogNear,
    fogFar,
  }
}
