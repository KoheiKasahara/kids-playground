import * as THREE from 'three'
import { CIRCUIT_SCENERY, type CircuitDefinition } from './circuit'

type Shape = 'box' | 'cone' | 'sphere' | 'cylinder' | 'ring'
type Batch = { shape: Shape; colors: THREE.Color[]; matrices: THREE.Matrix4[] }
export type SceneryFootprint = { x: number; z: number; radius: number }

function variation(index: number): number {
  const value = Math.sin(index * 127.1 + 311.7) * 43758.5453
  return value - Math.floor(value)
}

/** Static, low-poly scenery; instance colors keep all variants in one draw per shape. */
export function createCircuitScenery(circuit: CircuitDefinition) {
  const group = new THREE.Group()
  group.name = `scenery-${circuit.scenery}`
  const palette = CIRCUIT_SCENERY[circuit.scenery]
  const batches = new Map<string, Batch>()
  const footprints: SceneryFootprint[] = []
  const road = circuit.curve.getSpacedPoints(1024)
  const dummy = new THREE.Object3D()
  const geometries = new Map<Shape, THREE.BufferGeometry>()
  const material = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.88, flatShading: true })

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
    batch.matrices.push(new THREE.Matrix4().multiplyMatrices(parent, dummy.matrix))
    batch.colors.push(new THREE.Color(color).multiplyScalar(0.92 + variation(batch.matrices.length + x * 3 + z * 7) * 0.16))
  }

  // Check the entire road, including the opposite side of a hairpin. The
  // bounding disc also keeps neighboring scenery from intersecting each other.
  function place(t: number, radius: number, build: (matrix: THREE.Matrix4) => void, side = 1) {
    const point = circuit.curve.getPointAt(t)
    const tangent = circuit.curve.getTangentAt(t)
    for (let offset = circuit.width / 2 + radius + 5; offset < 125; offset += 6) {
      const x = point.x + tangent.z * offset * side
      const z = point.z - tangent.x * offset * side
      const clearance = radius + circuit.width / 2 + 3
      if (road.some((p) => Math.hypot(p.x - x, p.z - z) < clearance)) continue
      if (footprints.some((p) => Math.hypot(p.x - x, p.z - z) < p.radius + radius + 2)) continue
      footprints.push({ x, z, radius })
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
        const seed = seat + row * 13 + length
        if (variation(seed) < 0.12) continue
        const shirt = ['#e55a4f', '#ffc94e', '#418ac1', '#f9f3de', '#6cb998'][Math.floor(variation(seed + 5) * 5)]!
        const height = 0.72 + variation(seed + 2) * 0.38
        const z = (seat - 5.5) * (length / 13) + (variation(seed + 1) - 0.5) * 0.4
        part(matrix, 'sphere', shirt, row * 1.8 - 3, (row + 1) * 1.3 + height / 2 + 0.22,
          z, 0.68, height, 0.62)
        part(matrix, 'sphere', ['#dfaa7c', '#915f43', '#f2cfaa'][seat % 3]!,
          row * 1.8 - 3, (row + 1) * 1.3 + height + 0.38, z, 0.44, 0.46, 0.44)
      }
    }
    for (const z of [-length / 2 + 1, length / 2 - 1]) {
      part(matrix, 'box', '#677680', 4.8, 4.5, z, 0.45, 9, 0.45)
    }
    part(matrix, 'box', '#f2eee2', 0.5, 9, 0, 11, 0.45, length + 2)
    part(matrix, 'box', color, -5, 8.7, 0, 0.35, 0.9, length + 2)
  }

  function pit(matrix: THREE.Matrix4) {
    part(matrix, 'box', '#7d8785', 0, 0.12, 0, 9.5, 0.24, 31.5)
    part(matrix, 'box', '#e6e9e7', 0, 3, 0, 8, 6, 30)
    part(matrix, 'box', '#445c6b', -4.08, 4.7, 0, 0.15, 1.4, 28)
    for (let bay = 0; bay < 6; bay++) {
      part(matrix, 'box', '#3e4750', -4.1, 1.6, (bay - 2.5) * 4.7, 0.2, 2.7, 3.7)
      part(matrix, 'box', ['#df5555', '#e6b642', '#448dc4'][bay % 3]!, -4.25, 3.2, (bay - 2.5) * 4.7, 0.3, 0.5, 4.4)
      part(matrix, 'box', '#eef1de', -4.23, 1.6, (bay - 2.5) * 4.7 - 1.95, 0.25, 3, 0.18)
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
    const height = 6 + variation(index) * 4
    const crown = 0.88 + variation(index + 50) * 0.22
    const rotated = matrix.clone().multiply(new THREE.Matrix4().makeRotationY(variation(index + 20) * Math.PI * 2))
    part(rotated, 'cylinder', '#795a40', 0, height / 3, 0, 0.65, height * 2 / 3, 0.65)
    const color = ['#39754b', '#4d8c52', '#669950', '#41846a'][index % 4]!
    const light = new THREE.Color(color).multiplyScalar(1.22).getStyle()
    if (pine) {
      part(rotated, 'cone', color, 0, height * 0.64, 0, 5.6 * crown, height, 5.6 * crown)
      part(rotated, 'cone', light, 0, height, 0, 3.7 * crown, height * 0.7, 3.7 * crown)
    } else {
      part(rotated, 'sphere', color, -0.65, height * 0.73, 0, 5.1 * crown, 4.8, 5.3 * crown)
      part(rotated, 'sphere', light, 0.6, height * 0.99, 0.3, 4.7 * crown, 4.6, 4.8 * crown)
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
    for (let i = 0; i < 18; i++) place((i + 0.5) / 18, 4, (m) => tree(m, i, false))
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
    for (let i = 0; i < 62; i++) place((i + 0.3) / 62, 4, (m) => tree(m, i, true), i % 3 === 0 ? -1 : 1)
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
    for (let i = 0; i < 20; i++) place((i + 0.6) / 20, 4, (m) => tree(m, i, true))
  }

  function geometry(shape: Shape) {
    let value = geometries.get(shape)
    if (!value) {
      switch (shape) {
        case 'box': value = new THREE.BoxGeometry(1, 1, 1); break
        case 'sphere': value = new THREE.IcosahedronGeometry(0.5, 1); break
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
