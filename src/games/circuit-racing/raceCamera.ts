/**
 * Camera calculations for Circuit Racing.
 *
 * These functions deliberately contain no Three.js or browser state.  The
 * renderer hook can therefore keep the camera responsive while the UI only
 * needs to choose a mode.
 */

export type RaceCameraMode = 'chase' | 'trackside' | 'free'

export type RaceCameraVector = {
  x: number
  y?: number
  z: number
}

export type RaceCameraPose = {
  position: { x: number; y: number; z: number }
  target: { x: number; y: number; z: number }
}

/** Two elevated fixed shots, each covering one half of the circuit. */
export function createTracksideAnchors(
  curve: { getPointAt: (t: number) => RaceCameraVector },
  roadWidth: number,
): RaceCameraVector[] {
  return [0, 1].map((sector) => {
    const points = Array.from({ length: 65 }, (_, step) => curve.getPointAt((sector + step / 64) / 2))
    const minX = Math.min(...points.map(point => point.x))
    const maxX = Math.max(...points.map(point => point.x))
    // Use sector bounds instead of a local tangent: an S-bend's normal can
    // point back onto another stretch of road and cause an overhead camera spin.
    const edgeZ = sector === 0
      ? Math.min(...points.map(point => point.z))
      : Math.max(...points.map(point => point.z))
    const offset = roadWidth / 2 + 35
    return { x: (minX + maxX) / 2, y: 100, z: edgeZ + (sector === 0 ? -offset : offset) }
  })
}

/** Half-lap sectors prevent hairpins or nearby straights from causing extra cuts. */
export function selectTracksideAnchor(progress: number): number {
  const wrapped = ((finite(progress, 0) % 1) + 1) % 1
  return wrapped < 0.5 ? 0 : 1
}

function finite(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? value! : fallback
}

function normalise(x: number, z: number): { x: number; z: number } {
  const length = Math.hypot(x, z)
  if (length < 0.0001) return { x: 0, z: 1 }
  return { x: x / length, z: z / length }
}

/** Camera position behind and above the selected car.  Cars face +Z. */
export function chaseCameraPose(
  position: RaceCameraVector,
  tangent: RaceCameraVector,
  options: { distance?: number; height?: number; lookAhead?: number; targetHeight?: number } = {},
): RaceCameraPose {
  const direction = normalise(tangent.x, tangent.z)
  const distance = Math.max(1, finite(options.distance, 9))
  const height = Math.max(0.5, finite(options.height, 4.3))
  const lookAhead = Math.max(0, finite(options.lookAhead, 6.5))
  const targetHeight = Math.max(0, finite(options.targetHeight, 0.75))
  const y = finite(position.y, 0)

  return {
    position: {
      x: position.x - direction.x * distance,
      y: y + height,
      z: position.z - direction.z * distance,
    },
    target: {
      x: position.x + direction.x * lookAhead,
      y: y + targetHeight,
      z: position.z + direction.z * lookAhead,
    },
  }
}

/** A fixed place just outside the circuit that watches the selected car. */
export function tracksideCameraPose(
  cameraPosition: RaceCameraVector,
  targetPosition: RaceCameraVector,
  options: { height?: number; targetHeight?: number } = {},
): RaceCameraPose {
  const height = Math.max(0.5, finite(options.height, 4.6))
  const targetHeight = Math.max(0, finite(options.targetHeight, 0.7))
  return {
    position: {
      x: cameraPosition.x,
      y: finite(cameraPosition.y, 0) + height,
      z: cameraPosition.z,
    },
    target: {
      x: targetPosition.x,
      y: finite(targetPosition.y, 0) + targetHeight,
      z: targetPosition.z,
    },
  }
}

/** Fit the circuit bounds with a margin, including perspective depth. */
export function overviewCameraPose(
  bounds: { min: RaceCameraVector; max: RaceCameraVector },
  aspect: number,
  fov = 48,
): RaceCameraPose {
  const target = {
    x: (bounds.min.x + bounds.max.x) / 2,
    y: 0,
    z: (bounds.min.z + bounds.max.z) / 2,
  }
  const halfWidth = (bounds.max.x - bounds.min.x) / 2
  const halfDepth = (bounds.max.z - bounds.min.z) / 2
  const elevation = Math.PI / 3
  const sin = Math.sin(elevation)
  const cos = Math.cos(elevation)
  const tan = Math.tan(fov * Math.PI / 360)
  const distance = halfDepth * cos + Math.max(
    halfWidth / (tan * Math.max(0.1, aspect)),
    halfDepth * sin / tan,
  ) * 1.12
  return {
    target,
    position: { x: target.x, y: distance * sin, z: target.z + distance * cos },
  }
}
