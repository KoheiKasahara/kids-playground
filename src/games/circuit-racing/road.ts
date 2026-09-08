import * as THREE from 'three'
import { CIRCUIT_SCENERY, type CircuitDefinition } from './circuit'

export const ROAD_Y = 0.024
const SEGMENTS = 512

/** Static vertex-colored ribbons and one box batch; no textures or frame updates. */
export function createCircuitRoad(circuit: CircuitDefinition) {
  const group = new THREE.Group()
  group.name = 'circuit-road'
  const curve = circuit.curve.clone()
  curve.arcLengthDivisions = 4096
  curve.updateArcLengths()
  const points = curve.getSpacedPoints(SEGMENTS)
  const normals = points.map((_, i) => {
    const tangent = curve.getTangentAt(i / SEGMENTS)
    return new THREE.Vector3(-tangent.z, 0, tangent.x)
  })
  const curvature = points.map((_, i) => {
    const t = i / SEGMENTS
    const before = curve.getTangentAt((t + 1 - 0.001) % 1)
    const after = curve.getTangentAt((t + 0.001) % 1)
    return after.sub(before).dot(normals[i]!) / (curve.getLength() * 0.002)
  })
  const edge = circuit.width / 2
  const palette = CIRCUIT_SCENERY[circuit.scenery]
  const geometries: THREE.BufferGeometry[] = []
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94 })
  const positions: number[] = []
  const colors: number[] = []
  const color = new THREE.Color()

  function vertex(i: number, offset: number, y: number) {
    const p = points[i]!
    const n = normals[i]!
    // Inside a tight hairpin, wide offset curves can fold over themselves.
    // Taper only the decoration beyond the road; never change its driving width.
    const bend = curvature[i]!
    if (bend * offset > 0 && Math.abs(offset) > edge) {
      const available = THREE.MathUtils.clamp(0.8 / Math.abs(bend) - edge, 0.25, 2.25)
      offset = Math.sign(offset) * (edge + (Math.abs(offset) - edge) * available / 2.25)
    }
    positions.push(p.x + n.x * offset, y, p.z + n.z * offset)
    colors.push(color.r, color.g, color.b)
  }

  function strip(from: number, to: number, yFrom: number, yTo: number,
    tint: string | ((index: number) => string)) {
    for (let i = 0; i < SEGMENTS; i++) {
      color.set(typeof tint === 'string' ? tint : tint(i))
      // Winding faces upward, even on the negative-offset side of the track.
      vertex(i, from, yFrom); vertex(i, to, yTo); vertex(i + 1, from, yFrom)
      vertex(i, to, yTo); vertex(i + 1, to, yTo); vertex(i + 1, from, yFrom)
    }
  }

  // Adjacent bands share boundaries, avoiding coplanar overlays and flicker.
  strip(-edge + 0.35, edge - 0.35, ROAD_Y, ROAD_Y, palette.road)
  for (const side of [-1, 1]) {
    const bands: [number, number, number, number, string | ((i: number) => string)][] = [
      [edge - 0.35, edge - 0.19, ROAD_Y, ROAD_Y, '#f8f4df'],
      [edge - 0.19, edge + 0.12, ROAD_Y, ROAD_Y, '#535a5d'],
      [edge + 0.12, edge + 1.08, ROAD_Y + 0.07, ROAD_Y + 0.07,
        (i) => Math.floor(i / 2) % 2 ? '#fff7e9' : '#e65450'],
      [edge + 1.08, edge + 1.25, ROAD_Y + 0.07, -0.06,
        (i) => Math.floor(i / 2) % 2 ? '#dedbce' : '#bc4140'],
      [edge + 1.25, edge + 2.25, -0.06, -0.12,
        circuit.scenery === 'alpine' ? '#c6bba1' : '#9bb878'],
    ]
    for (const [a, b, ya, yb, tint] of bands) {
      if (side === 1) strip(a, b, ya, yb, tint)
      else strip(-b, -a, yb, ya, tint)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  geometries.push(geometry)
  const surface = new THREE.Mesh(geometry, material)
  surface.name = 'road-surface'
  surface.receiveShadow = true
  group.add(surface)

  const matrices: THREE.Matrix4[] = []
  const tints: THREE.Color[] = []
  const dummy = new THREE.Object3D()
  function box(x: number, y: number, z: number, sx: number, sy: number, sz: number, angle: number, tint: string) {
    dummy.position.set(x, y, z)
    dummy.rotation.set(0, angle, 0)
    dummy.scale.set(sx, sy, sz)
    dummy.updateMatrix()
    matrices.push(dummy.matrix.clone())
    tints.push(new THREE.Color(tint))
  }

  // Follow the actual offset curve, so rails join neatly through corners.
  // Gaps leave the course visible from trackside; all rails stay below car roofs.
  const railVertices: THREE.Vector3[] = []
  for (const side of [-1, 1]) {
    for (let i = 0; i < SEGMENTS; i += 2) {
      if (i % 64 >= 48) continue
      const a = points[i]!.clone().addScaledVector(normals[i]!, side * (edge + 2.9))
      const b = points[i + 2]!.clone().addScaledVector(normals[i + 2]!, side * (edge + 2.9))
      const mid = a.clone().add(b).multiplyScalar(0.5)
      const length = a.distanceTo(b)
      // Conservative full-segment clearance also accounts for another hairpin arm.
      if (points.some((p) => p.distanceTo(mid) < edge + 0.8 + length / 2)) continue
      const angle = Math.atan2(b.x - a.x, b.z - a.z)
      box(mid.x, 0.8, mid.z, 0.18, 0.48, length + 0.06, angle, '#cad8db')
      box(a.x, 0.43, a.z, 0.26, 1.05, 0.26, angle, '#748992')
      if (i % 8 === 0) box(a.x, 1, a.z, 0.3, 0.15, 0.32, angle, '#fff0b2')
      railVertices.push(a, b)
    }
  }

  // A crisp checker stripe and small starting boxes give the straight a purpose.
  const start = points[0]!
  const normal = normals[0]!
  const tangent = curve.getTangentAt(0)
  const angle = Math.atan2(tangent.x, tangent.z)
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 12; col++) {
      const p = start.clone().addScaledVector(normal, (col - 5.5) * circuit.width / 12)
        .addScaledVector(tangent, (row - 0.5) * 0.65)
      box(p.x, ROAD_Y + 0.008, p.z, circuit.width / 12, 0.012, 0.65, angle,
        (row + col) % 2 ? '#fff7e9' : '#252d33')
    }
  }
  for (let i = 0; i < 6; i++) {
    const t = 1 - (7 + Math.floor(i / 2) * 7) / curve.getLength()
    const p = curve.getPointAt(t)
    const direction = curve.getTangentAt(t)
    const n = new THREE.Vector3(-direction.z, 0, direction.x)
    p.addScaledVector(n, i % 2 ? 3 : -3)
    const yaw = Math.atan2(direction.x, direction.z)
    box(p.x, ROAD_Y + 0.008, p.z, 2, 0.012, 0.15, yaw, '#e5e4d8')
    for (const side of [-1, 1]) {
      const end = p.clone().addScaledVector(n, side).addScaledVector(direction, -0.55)
      box(end.x, ROAD_Y + 0.008, end.z, 0.12, 0.012, 1.1, yaw, '#e5e4d8')
    }
  }
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1)
  geometries.push(boxGeometry)
  // Instance colors are used without a vertex-color attribute on the box geometry.
  const boxMaterial = new THREE.MeshStandardMaterial({ roughness: 0.86 })
  const details = new THREE.InstancedMesh(boxGeometry, boxMaterial, matrices.length)
  details.name = 'rails-and-grid'
  matrices.forEach((matrix, i) => { details.setMatrixAt(i, matrix); details.setColorAt(i, tints[i]!) })
  details.computeBoundingSphere()
  group.add(details)

  return {
    group,
    railVertices,
    dispose() {
      details.dispose()
      geometries.forEach((value) => value.dispose())
      material.dispose()
      boxMaterial.dispose()
      group.removeFromParent()
    },
  }
}
