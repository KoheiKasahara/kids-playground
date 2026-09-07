import * as THREE from 'three'

export type CircuitDefinition = {
  id: string
  name: string
  width: number
  curve: THREE.CatmullRomCurve3
}

/**
 * Control points for a broad, closed circuit. Coordinates are metres in the XZ
 * plane; y=0 is the road surface. The long lower and upper straights give
 * children time to see the cars accelerate, while the east and north-west
 * groups make corners with different radii.
 */
const CONTROL_POINTS: readonly [number, number][] = [
  [-125, -55],
  [-65, -68],
  [45, -68],
  [110, -58],
  [132, -25],
  [132, 12],
  [116, 45],
  [75, 62],
  [25, 68],
  [-8, 45],
  [-38, 42],
  [-82, 52],
  [-120, 38],
  [-138, 10],
  [-136, -25],
]

function createCurve(): THREE.CatmullRomCurve3 {
  const points = CONTROL_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z))
  return new THREE.CatmullRomCurve3(points, true, 'centripetal', 0.5)
}

export function buildCircuit(): CircuitDefinition {
  return {
    id: 'classic-circuit',
    name: 'みんなのサーキット',
    width: 12,
    curve: createCurve(),
  }
}

export const CIRCUIT: CircuitDefinition = buildCircuit()
