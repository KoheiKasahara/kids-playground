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

/** Elevated local shots keep the sightline away from distant infield scenery. */
export function createTracksideAnchors(
  curve: { getPointAt: (t: number) => RaceCameraVector; getTangentAt: (t: number) => RaceCameraVector },
  roadWidth: number,
): RaceCameraVector[] {
  return Array.from({ length: 12 }, (_, index) => {
    const point = curve.getPointAt(index / 12)
    const tangent = curve.getTangentAt(index / 12)
    const direction = normalise(tangent.x, tangent.z)
    // Stay in the clear strip next to the road, above barriers and stand roofs.
    const offset = roadWidth / 2 + 2
    return { x: point.x - direction.z * offset, y: 18, z: point.z + direction.x * offset }
  })
}

/** Hold each shot until another camera is at least eight metres closer. */
export function selectTracksideAnchor(
  anchors: readonly RaceCameraVector[],
  target: RaceCameraVector,
  previous = -1,
): number {
  const distance = (anchor: RaceCameraVector) => Math.hypot(anchor.x - target.x, anchor.z - target.z)
  let nearest = -1
  let nearestDistance = Infinity
  anchors.forEach((anchor, index) => {
    const candidateDistance = distance(anchor)
    if (candidateDistance < nearestDistance) {
      nearest = index
      nearestDistance = candidateDistance
    }
  })
  const current = anchors[previous]
  return current && distance(current) <= nearestDistance + 8 ? previous : nearest
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
