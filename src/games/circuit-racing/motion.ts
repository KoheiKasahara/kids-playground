import * as THREE from 'three'
import type { RaceCarDefinition } from './raceConfig'

/** A point in the precomputed, lane-offset motion table. */
export type MotionSample = {
  distance: number
  position: THREE.Vector3
  tangent: THREE.Vector3
  curvature: number
  speed: number
}

export type MotionProfile = {
  readonly car: RaceCarDefinition
  readonly curve: THREE.Curve<THREE.Vector3>
  readonly laneOffset: number
  /** Length of one lane centre line in metres. */
  readonly length: number
  /** Duration of one flying-start lap in seconds. */
  readonly duration: number
  readonly samples: readonly MotionSample[]
  /** Segment boundaries in seconds, with timeAtDistance[0] = 0. */
  readonly timeAtDistance: readonly number[]
  readonly segmentDurations: readonly number[]
}

export type MotionState = {
  position: THREE.Vector3
  tangent: THREE.Vector3
  speed: number
  distance: number
}

const DENSE_SAMPLE_COUNT = 4096
const MOTION_SAMPLE_COUNT = 1024
const MIN_CURVATURE = 1e-8

function horizontalTangent(tangent: THREE.Vector3, fallback: THREE.Vector3): THREE.Vector3 {
  const result = tangent.clone()
  result.y = 0
  if (result.lengthSq() < 1e-12) {
    result.copy(fallback)
    result.y = 0
  }
  if (result.lengthSq() < 1e-12) {
    result.set(1, 0, 0)
  }
  return result.normalize()
}

function laneOffsetPoint(
  curve: THREE.Curve<THREE.Vector3>,
  t: number,
  laneOffset: number,
  fallbackTangent: THREE.Vector3,
): { position: THREE.Vector3; tangent: THREE.Vector3 } {
  const position = curve.getPointAt(t)
  const tangent = horizontalTangent(curve.getTangentAt(t), fallbackTangent)
  const normal = new THREE.Vector3(tangent.z, 0, -tangent.x)
  position.addScaledVector(normal, laneOffset)
  return { position, tangent }
}

function locateDistance(distances: readonly number[], target: number): number {
  let low = 0
  let high = distances.length - 1
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2)
    if (distances[middle] <= target) {
      low = middle
    } else {
      high = middle
    }
  }
  return low
}

function interpolateDensePoint(
  positions: readonly THREE.Vector3[],
  distances: readonly number[],
  target: number,
): THREE.Vector3 {
  const index = locateDistance(distances, target)
  const startDistance = distances[index]
  const endDistance = distances[index + 1]
  const span = endDistance - startDistance
  const fraction = span > 0 ? (target - startDistance) / span : 0
  return positions[index].clone().lerp(positions[index + 1], fraction)
}

function cyclicCurvature(
  previous: THREE.Vector3,
  current: THREE.Vector3,
  next: THREE.Vector3,
  spacing: number,
): number {
  const before = current.clone().sub(previous).normalize()
  const after = next.clone().sub(current).normalize()
  if (before.lengthSq() < 1e-12 || after.lengthSq() < 1e-12) {
    return 0
  }
  const angle = Math.atan2(before.clone().cross(after).length(), THREE.MathUtils.clamp(before.dot(after), -1, 1))
  return angle / Math.max(spacing, 1e-6)
}

/**
 * Build a deterministic speed and time table for one car in one lane.
 *
 * The source curve is sampled once at high resolution, then resampled at
 * equal distances after the lateral lane offset has been applied. A pair of
 * cyclic passes applies the acceleration and braking limits, so braking starts
 * before a bend instead of only at its tightest point.
 */
export function createMotionProfile(
  car: RaceCarDefinition,
  curve: THREE.Curve<THREE.Vector3>,
  laneOffset = 0,
): MotionProfile {
  if (!Number.isFinite(laneOffset)) {
    throw new Error('laneOffset must be finite')
  }
  if (!Number.isFinite(car.maxSpeed) || car.maxSpeed <= 0) {
    throw new Error('car.maxSpeed must be positive')
  }
  if (
    !Number.isFinite(car.acceleration) ||
    !Number.isFinite(car.braking) ||
    !Number.isFinite(car.cornering) ||
    car.acceleration <= 0 ||
    car.braking <= 0 ||
    car.cornering <= 0
  ) {
    throw new Error('car acceleration, braking and cornering must be positive')
  }

  // Curve.getPointAt() uses this cache for arc-length mapping. The default of
  // 200 divisions is visibly uneven on a long circuit with several bends.
  curve.arcLengthDivisions = DENSE_SAMPLE_COUNT
  curve.updateArcLengths()

  const densePositions: THREE.Vector3[] = []
  const denseDistances: number[] = [0]
  const previousTangent = new THREE.Vector3(1, 0, 0)
  for (let index = 0; index <= DENSE_SAMPLE_COUNT; index += 1) {
    const t = index / DENSE_SAMPLE_COUNT
    const point = laneOffsetPoint(curve, t, laneOffset, previousTangent)
    previousTangent.copy(point.tangent)
    if (index === DENSE_SAMPLE_COUNT) {
      // CatmullRomCurve3 is closed for the circuit; using the exact first point
      // removes any floating-point seam gap from the offset polyline.
      point.position.copy(densePositions[0])
      point.tangent.copy(previousTangent)
    }
    densePositions.push(point.position)
    if (index > 0) {
      denseDistances.push(denseDistances[index - 1] + point.position.distanceTo(densePositions[index - 1]))
    }
  }

  const length = denseDistances[DENSE_SAMPLE_COUNT]
  if (!Number.isFinite(length) || length <= 1) {
    throw new Error('curve must have a non-zero closed length')
  }

  const spacing = length / MOTION_SAMPLE_COUNT
  const positions = Array.from({ length: MOTION_SAMPLE_COUNT }, (_, index) =>
    interpolateDensePoint(densePositions, denseDistances, spacing * index),
  )
  const tangents: THREE.Vector3[] = []
  const curvatures: number[] = []
  for (let index = 0; index < MOTION_SAMPLE_COUNT; index += 1) {
    const previous = positions[(index + MOTION_SAMPLE_COUNT - 1) % MOTION_SAMPLE_COUNT]
    const current = positions[index]
    const next = positions[(index + 1) % MOTION_SAMPLE_COUNT]
    tangents.push(next.clone().sub(previous).normalize())
    curvatures.push(cyclicCurvature(previous, current, next, spacing))
  }

  const speeds = curvatures.map((curvature) => {
    const cornerSpeed = Math.sqrt(car.cornering / Math.max(curvature, MIN_CURVATURE))
    return Math.min(car.maxSpeed, cornerSpeed)
  })

  // More than one cycle is intentional: a speed change can need to propagate
  // over a long straight before it reaches the next corner. Values never rise
  // above the local corner/max-speed cap during relaxation.
  for (let pass = 0; pass < 8; pass += 1) {
    for (let index = 0; index < MOTION_SAMPLE_COUNT; index += 1) {
      const previousIndex = (index + MOTION_SAMPLE_COUNT - 1) % MOTION_SAMPLE_COUNT
      const reachable = Math.sqrt(speeds[previousIndex] ** 2 + 2 * car.acceleration * spacing)
      if (speeds[index] > reachable) {
        speeds[index] = reachable
      }
    }
    for (let index = MOTION_SAMPLE_COUNT - 1; index >= 0; index -= 1) {
      const nextIndex = (index + 1) % MOTION_SAMPLE_COUNT
      const reachable = Math.sqrt(speeds[nextIndex] ** 2 + 2 * car.braking * spacing)
      if (speeds[index] > reachable) {
        speeds[index] = reachable
      }
    }
  }

  const samples: MotionSample[] = positions.map((position, index) => ({
    distance: spacing * index,
    position,
    tangent: tangents[index],
    curvature: curvatures[index],
    speed: Math.max(0.1, speeds[index]),
  }))
  const segmentDurations: number[] = []
  const timeAtDistance: number[] = [0]
  for (let index = 0; index < MOTION_SAMPLE_COUNT; index += 1) {
    const nextIndex = (index + 1) % MOTION_SAMPLE_COUNT
    const meanSpeed = Math.max(0.1, (samples[index].speed + samples[nextIndex].speed) / 2)
    const segmentDuration = spacing / meanSpeed
    segmentDurations.push(segmentDuration)
    timeAtDistance.push(timeAtDistance[index] + segmentDuration)
  }
  const duration = timeAtDistance[MOTION_SAMPLE_COUNT]

  return {
    car,
    curve,
    laneOffset,
    length,
    duration,
    samples,
    timeAtDistance,
    segmentDurations,
  }
}

/** Sample the same flying-start lap at any elapsed time, independent of frame rate. */
export function sampleMotion(profile: MotionProfile, elapsedSeconds: number): MotionState {
  const duration = profile.duration
  const length = profile.length
  const elapsed = Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0
  const wrappedTime = ((elapsed % duration) + duration) % duration
  const segment = Math.min(
    profile.segmentDurations.length - 1,
    locateDistance(profile.timeAtDistance, wrappedTime),
  )
  const segmentStartTime = profile.timeAtDistance[segment]
  const segmentDuration = profile.segmentDurations[segment]
  const localTime = Math.max(0, wrappedTime - segmentStartTime)
  const currentSample = profile.samples[segment]
  const next = (segment + 1) % profile.samples.length
  const nextSample = profile.samples[next]
  const acceleration = segmentDuration > 0 ? (nextSample.speed - currentSample.speed) / segmentDuration : 0
  // Speeds are linearly relaxed over each segment. Integrating that speed
  // keeps the reported distance and speed frame-rate independent and makes the
  // mean-speed segment duration used to build the profile exact.
  const travelled = Math.min(
    profile.length / profile.samples.length,
    Math.max(0, currentSample.speed * localTime + 0.5 * acceleration * localTime ** 2),
  )
  const fraction = travelled / (profile.length / profile.samples.length)
  const position = currentSample.position.clone().lerp(nextSample.position, fraction)
  const tangent = currentSample.tangent.clone().lerp(nextSample.tangent, fraction).normalize()
  const speed = Math.max(0.1, currentSample.speed + acceleration * localTime)
  const distance = (currentSample.distance + travelled) % length
  return { position, tangent, speed, distance }
}
