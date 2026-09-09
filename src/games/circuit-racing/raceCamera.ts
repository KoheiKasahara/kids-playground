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

/** One elevated viewpoint outside the whole circuit, never over a hairpin. */
export function createTracksideAnchor(
  curve: { getPointAt: (t: number) => RaceCameraVector },
  roadWidth: number,
): RaceCameraPose['position'] {
  const points = Array.from({ length: 128 }, (_, step) => curve.getPointAt(step / 128))
  const minX = Math.min(...points.map(point => point.x))
  const maxX = Math.max(...points.map(point => point.x))
  const edgeZ = Math.min(...points.map(point => point.z))
  const offset = roadWidth / 2 + 35
  return { x: (minX + maxX) / 2, y: 100, z: edgeZ - offset }
}

/** Ease toward distant cars, within a small radius of the same viewpoint. */
export function tracksideDistancePosition(anchor: RaceCameraVector, target: RaceCameraVector): RaceCameraVector {
  const dx = target.x - anchor.x
  const dz = target.z - anchor.z
  const distance = Math.hypot(dx, dz)
  const excess = Math.max(0, distance - 150) / 90
  const shift = 24 * (1 - Math.exp(-excess * excess))
  return { x: anchor.x + dx / Math.max(1, distance) * shift,
    y: anchor.y, z: anchor.z + dz / Math.max(1, distance) * shift }
}

/** Bake gentle, periodic clearance adjustments once, without per-frame raycasts.
 * A broad envelope starts lifting before an obstruction. If 24m isn't enough,
 * accept brief occlusion instead of searching for another shot or circling cars.
 */
export function createTracksideLift(
  curve: { getPointAt: (t: number) => RaceCameraVector },
  anchor: RaceCameraVector,
  isBlocked: (pose: RaceCameraPose) => boolean,
): number[] {
  const lifts = Array.from({ length: 128 }, (_, step) => {
    const target = curve.getPointAt(step / 128)
    const position = tracksideDistancePosition(anchor, target)
    for (const lift of [0, 8, 16, 24]) {
      if (!isBlocked(tracksideCameraPose({ ...position, y: finite(anchor.y, 0) + lift }, target))) return lift
    }
    return 0
  })
  return lifts.map((_, index) => {
    let height = 0
    for (let offset = -16; offset <= 16; offset++) {
      // A flat center preserves clearance; cosine shoulders avoid sudden lifts.
      const weight = (1 + Math.cos(Math.PI * Math.max(0, Math.abs(offset) - 4) / 12)) / 2
      height = Math.max(height, lifts[(index + offset + lifts.length) % lifts.length] * weight)
    }
    return height
  })
}

/** Periodic cubic B-spline: bounded and smooth, including the lap boundary. */
export function sampleTracksideLift(lifts: readonly number[], progress: number): number {
  if (lifts.length === 0) return 0
  const sample = ((finite(progress, 0) % 1 + 1) % 1) * lifts.length
  const index = Math.floor(sample)
  const t = sample - index
  const at = (offset: number) => lifts[(index + offset + lifts.length) % lifts.length]
  return (at(-1) * (1 - t) ** 3 + at(0) * (3 * t ** 3 - 6 * t * t + 4)
    + at(1) * (-3 * t ** 3 + 3 * t * t + 3 * t + 1) + at(2) * t ** 3) / 6
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
