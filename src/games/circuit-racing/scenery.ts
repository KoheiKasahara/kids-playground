import * as THREE from 'three'
import { CIRCUIT_SCENERY, type CircuitDefinition } from './circuit'
import { addCircuitDetails, type SceneryShape } from './sceneryDetails'

type Shape = SceneryShape
type Batch = { shape: Shape; colors: THREE.Color[]; matrices: THREE.Matrix4[] }
export type SceneryFootprint = { x: number; z: number; radius: number; kind: string }

/** Static, low-poly scenery; repeated parts share one instanced draw per shape with instance colors. */
export function createCircuitScenery(circuit: CircuitDefinition) {
  const group = new THREE.Group()
  group.name = `scenery-${circuit.scenery}`
  const palette = CIRCUIT_SCENERY[circuit.scenery]
  const batches = new Map<string, Batch>()
  const footprints: SceneryFootprint[] = []
  const road = circuit.curve.getSpacedPoints(1024)
  const dummy = new THREE.Object3D()
  const geometries = new Map<Shape, THREE.BufferGeometry>()
  const material = new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true })

  function part(parent: THREE.Matrix4, shape: Shape, color: string,
    x: number, y: number, z: number, sx: number, sy: number, sz: number, rz = 0) {
    dummy.position.set(x, y, z)
    dummy.rotation.set(0, 0, rz)
    dummy.scale.set(sx, sy, sz)
    dummy.updateMatrix()
    const key = shape
    let batch = batches.get(key)
    if (!batch) {
      batch = { shape, colors: [], matrices: [] }
      batches.set(key, batch)
    }
    batch.colors.push(new THREE.Color(color))
    batch.matrices.push(new THREE.Matrix4().multiplyMatrices(parent, dummy.matrix))
  }

  // Check the entire road, including the opposite side of a hairpin. The
  // bounding disc also keeps neighboring scenery from intersecting each other.
  function place(t: number, radius: number, build: (matrix: THREE.Matrix4) => void, side = 1, kind = 'landmark') {
    const point = circuit.curve.getPointAt(t)
    const tangent = circuit.curve.getTangentAt(t)
    for (let offset = circuit.width / 2 + radius + 5; offset < 125; offset += 6) {
      const x = point.x + tangent.z * offset * side
      const z = point.z - tangent.x * offset * side
      const clearance = radius + circuit.width / 2 + 3
      if (road.some((p) => Math.hypot(p.x - x, p.z - z) < clearance)) continue
      if (footprints.some((p) => Math.hypot(p.x - x, p.z - z) < p.radius + radius + 2)) continue
      footprints.push({ x, z, radius, kind })
      const matrix = new THREE.Matrix4().makeRotationY(Math.atan2(tangent.x, tangent.z))
      matrix.setPosition(x, 0, z)
      build(matrix)
      return
    }
  }

  function stand(matrix: THREE.Matrix4, color: string, length = 26) {
    for (let row = 0; row < 4; row++) {
      part(matrix, 'box', '#dedfd9', row * 1.8 - 3, (row + 1) * 0.65, 0, 1.9, (row + 1) * 1.3, length)
      part(matrix, 'box', color, row * 1.8 - 3, (row + 1) * 1.3 + 0.12, 0, 1.6, 0.24, length)
      for (let seat = 0; seat < 12; seat++) {
        const shirt = ['#e55a4f', '#ffc94e', '#418ac1', '#f9f3de'][(seat + row) % 4]!
        part(matrix, 'sphere', shirt, row * 1.8 - 3, (row + 1) * 1.3 + 0.8,
          (seat - 5.5) * (length / 13), 0.65, 0.85, 0.65)
      }
    }
    for (const z of [-length / 2 + 1, length / 2 - 1]) {
      part(matrix, 'box', '#677680', 4.8, 4.5, z, 0.45, 9, 0.45)
    }
    part(matrix, 'box', '#f2eee2', 0.5, 9, 0, 11, 0.45, length + 2)
    part(matrix, 'box', color, -5, 8.7, 0, 0.35, 0.9, length + 2)
  }

  function pit(matrix: THREE.Matrix4) {
    part(matrix, 'box', '#e6e9e7', 0, 3, 0, 8, 6, 30)
    part(matrix, 'box', '#445c6b', -4.08, 4.7, 0, 0.15, 1.4, 28)
    for (let bay = 0; bay < 6; bay++) {
      part(matrix, 'box', '#3e4750', -4.1, 1.6, (bay - 2.5) * 4.7, 0.2, 2.7, 3.7)
      part(matrix, 'box', ['#df5555', '#e6b642', '#448dc4'][bay % 3]!, -4.25, 3.2, (bay - 2.5) * 4.7, 0.3, 0.5, 4.4)
    }
    part(matrix, 'box', '#ecf1ef', 0, 6.3, 0, 9, 0.6, 32)
    part(matrix, 'box', '#647f8d', 0, 9, 8, 6, 5, 6)
    part(matrix, 'box', '#b1dfec', -3.1, 9.5, 8, 0.2, 2.5, 5.4)
    part(matrix, 'box', '#eef4f1', 0, 11.7, 8, 7.2, 0.4, 7.2)
  }

  function wheel(matrix: THREE.Matrix4) {
    // A full-size landmark that can be recognized from chase and overview views.
    for (const z of [-2, 2]) {
      part(matrix, 'box', '#f0efe3', -4, 9, z, 0.7, 19, 0.7, -0.43)
      part(matrix, 'box', '#f0efe3', 4, 9, z, 0.7, 19, 0.7, 0.43)
    }
    part(matrix, 'ring', '#e15b57', 0, 18, 0, 12, 12, 12)
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 6
      const x = Math.cos(angle) * 12
      const y = Math.sin(angle) * 12
      part(matrix, 'box', '#f0efe3', x / 2, 18 + y / 2, 0, 12, 0.24, 0.24, angle)
      const color = ['#ec625b', '#f7c745', '#4b9cd7', '#63b994'][i % 4]!
      part(matrix, 'box', color, x, 17 + y, 0, 2, 2.5, 2.5)
      part(matrix, 'box', '#c2eafa', x, 17.3 + y, -1.27, 1.4, 1.1, 0.06)
      part(matrix, 'box', '#c2eafa', x, 17.3 + y, 1.27, 1.4, 1.1, 0.06)
    }
    part(matrix, 'sphere', '#f8c747', 0, 18, 0, 1.8, 1.8, 1.8)
  }

  function tree(matrix: THREE.Matrix4, index: number, pine: boolean) {
    const height = 5 + (index % 4) * 1.2
    part(matrix, 'cylinder', '#84654a', 0, height / 3, 0, 0.65, height * 2 / 3, 0.65)
    const color = ['#44865a', '#65a35c', '#86b760'][index % 3]!
    // Low, opaque ground islands add color without textures or extra shadow passes.
    part(matrix, 'cylinder', '#91b96c', 0, -0.16, 0, 7.4, 0.06, 6.4)
    if (pine) {
      part(matrix, 'cone', color, 0, height * 0.64, 0, 5, height, 5)
      part(matrix, 'cone', color, 0, height, 0, 3.5, height * 0.7, 3.5)
    } else {
      part(matrix, 'sphere', color, -0.7, height * 0.85, 0, 4.6, 5.4, 4.6)
      part(matrix, 'sphere', '#86b760', 1.3, height * 0.92, 0.5, 3.5, 3.8, 3.5)
    }
  }

  // Start gantry: its only ground-level parts stand outside both road edges.
  const start = circuit.curve.getPointAt(0)
  const direction = circuit.curve.getTangentAt(0)
  const gantry = new THREE.Matrix4().makeRotationY(Math.atan2(direction.x, direction.z))
  gantry.setPosition(start)
  for (const side of [-1, 1]) {
    part(gantry, 'box', '#e6e9e7', side * (circuit.width / 2 + 2), 4, 0, 0.7, 8, 0.7)
  }
  part(gantry, 'box', palette.curb, 0, 8.5, 0, circuit.width + 5, 1.8, 0.8)
  for (let i = 0; i < 14; i++) {
    for (let row = 0; row < 2; row++) {
      for (const side of [-1, 1]) {
        part(gantry, 'box', (i + row) % 2 ? '#303943' : '#fff7e9',
          (i - 6.5) * 0.8, 8.1 + row * 0.8, side * 0.43, 0.8, 0.8, 0.06)
      }
    }
  }

  if (circuit.scenery === 'grandPrix') {
    place(0.075, 18, pit)
    place(0.98, 17, (m) => stand(m, '#dd6058'))
    place(0.21, 16, wheel)
    place(0.59, 17, (m) => stand(m, '#438ac3'))
  } else if (circuit.scenery === 'stadium') {
    for (const t of [0.06, 0.18, 0.45, 0.57, 0.69, 0.91]) {
      place(t, 22, (m) => stand(m, '#408dcc', 38))
    }
    place(0.32, 10, (m) => {
      part(m, 'box', '#566674', 0, 8, 0, 1.2, 16, 1.2)
      part(m, 'box', '#293c51', 0, 15, 0, 2, 9, 16)
      for (let row = 0; row < 3; row++) {
        part(m, 'box', ['#ef6961', '#f7cd5c', '#6fcbd5'][row]!, -1.1, 17 - row * 2, 0, 0.2, 0.8, 12 - row * 2)
      }
    })
    for (let i = 0; i < 10; i++) place((i + 0.4) / 10, 4, (m) => {
      part(m, 'cylinder', '#6a7886', 0, 10, 0, 0.6, 20, 0.6)
      part(m, 'box', '#f9f2d5', 0, 20, 0, 1.2, 1.8, 6)
    })
  } else if (circuit.scenery === 'forest') {
    place(0.42, 10, (m) => {
      part(m, 'box', '#aa7850', 0, 3, 0, 8, 6, 10)
      part(m, 'cone', '#963f39', 0, 7.5, 0, 13, 5, 15)
      part(m, 'box', '#f2dba0', -4.1, 3.5, 0, 0.2, 2, 6)
    })
  } else {
    for (let i = 0; i < 16; i++) place((i + 0.2) / 16, 13, (m) => {
      const height = 16 + (i % 4) * 6
      part(m, 'cone', i % 2 ? '#8b9196' : '#9ca29e', 0, height / 2, 0, 24, height, 24)
      // Keep the snow cap slightly outside the mountain slope. Matching both
      // cone surfaces exactly makes the depth buffer alternate between them.
      part(m, 'cone', '#f2f2e6', 0, height * 0.86, 0, 7.6, height * 0.32, 7.6)
    })
  }

  // Keep the existing major landmarks, then reserve space for new landscape
  // clusters before the small trees and rocks occupy the remaining gaps.
  addCircuitDetails(circuit, { part, place })
  const treeCount = circuit.scenery === 'forest' ? 62 : circuit.scenery === 'alpine' ? 20 : 18
  if (circuit.scenery !== 'stadium') {
    for (let i = 0; i < treeCount; i++) {
      const offset = circuit.scenery === 'forest' ? 0.3 : circuit.scenery === 'alpine' ? 0.6 : 0.5
      const side = circuit.scenery === 'forest' && i % 3 === 0 ? -1 : 1
      place((i + offset) / treeCount, 4, (m) => tree(m, i, circuit.scenery !== 'grandPrix'), side)
    }
  }

  // Small landmarks fill the roadside between larger course-specific structures.
  // The same placement check protects every arm of the S-bends and hairpin.
  for (let i = 0; i < 14; i++) {
    place((i + 0.65) / 14, 4.5, (m) => {
      part(m, 'cylinder', circuit.scenery === 'alpine' ? '#c6bba1' : '#91b96c',
        0, -0.16, 0, 8, 0.06, 7)
      for (let rock = 0; rock < 3; rock++) {
        part(m, 'sphere', ['#a5b0ad', '#c0c5b7', '#899b97'][rock]!,
          (rock - 1) * 1.7, 0.55 + rock * 0.15, rock % 2 ? 1 : -0.6,
          2.5, 1.4 + rock * 0.4, 2.2)
      }
    }, i % 2 ? -1 : 1)
  }
  for (let i = 0; i < 8; i++) {
    place((i + 0.35) / 8, 4, (m) => {
      for (const z of [-2.3, 2.3]) part(m, 'box', '#677680', 0, 1.3, z, 0.25, 2.8, 0.25)
      part(m, 'box', '#f2eee2', 0, 2.7, 0, 0.38, 2.4, 6.8)
      // Bold chevrons on both faces stay legible without text or canvas textures.
      for (const face of [-1, 1]) {
        for (const z of [-1.9, 0, 1.9]) {
          for (const arm of [-1, 1]) {
            const local = m.clone().multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2))
            part(local, 'box', palette.curb, z - 0.25, 2.7 + arm * 0.35,
              face * 0.21, 0.85, 0.25, 0.05, arm * -0.8)
          }
        }
      }
    })
  }

  function geometry(shape: Shape) {
    let value = geometries.get(shape)
    if (!value) {
      switch (shape) {
        case 'box': value = new THREE.BoxGeometry(1, 1, 1); break
        case 'sphere': value = new THREE.SphereGeometry(0.5, 8, 6); break
        case 'cone': value = new THREE.ConeGeometry(0.5, 1, 7); break
        case 'cylinder': value = new THREE.CylinderGeometry(0.5, 0.5, 1, 8); break
        case 'ring': value = new THREE.TorusGeometry(1, 0.026, 4, 48); break
      }
      geometries.set(shape, value)
    }
    return value
  }

  for (const { shape, colors, matrices } of batches.values()) {
    const mesh = new THREE.InstancedMesh(geometry(shape), material, matrices.length)
    mesh.name = `scenery-${shape}`
    matrices.forEach((matrix, index) => {
      mesh.setMatrixAt(index, matrix)
      mesh.setColorAt(index, colors[index]!)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
    // Scenery stays out of the dynamic shadow pass on mobile.
    group.add(mesh)
  }

  return {
    group,
    footprints,
    dispose() {
      group.children.forEach((child) => (child as THREE.InstancedMesh).dispose())
      geometries.forEach((value) => value.dispose())
      material.dispose()
      group.removeFromParent()
    },
  }
}
