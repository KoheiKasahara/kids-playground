import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { CIRCUITS } from './circuit'
import { createCircuitScenery } from './scenery'

// Avoid allocating a road-sized array for every vertex in the denser scenery.
// Keep the same exhaustive vertex/sample coverage, without a timeout increase.
function roadDistanceSquared(road: THREE.Vector3[], x: number, z: number) {
  let closest = Infinity
  for (const p of road) {
    const dx = p.x - x
    const dz = p.z - z
    closest = Math.min(closest, dx * dx + dz * dz)
  }
  return closest
}

describe('circuit scenery', () => {
  it.each(CIRCUITS)('$id keeps scenery off every part of the road, including hairpins', (circuit) => {
    const scenery = createCircuitScenery(circuit)
    const road = circuit.curve.getSpacedPoints(2048)
    expect(scenery.footprints.length).toBeGreaterThan(10)
    for (const footprint of scenery.footprints) {
      const closest = Math.sqrt(roadDistanceSquared(road, footprint.x, footprint.z))
      expect(closest - footprint.radius).toBeGreaterThan(circuit.width / 2 + 2.5)
    }
    // Also inspect real low-lying vertices: this catches incorrectly sized
    // structures that extend past their declared footprint and gantry posts.
    const matrix = new THREE.Matrix4()
    const point = new THREE.Vector3()
    let closestVertexSquared = Infinity
    for (const child of scenery.group.children) {
      const mesh = child as THREE.InstancedMesh
      const positions = mesh.geometry.getAttribute('position')
      for (let instance = 0; instance < mesh.count; instance++) {
        mesh.getMatrixAt(instance, matrix)
        for (let vertex = 0; vertex < positions.count; vertex++) {
          point.fromBufferAttribute(positions, vertex).applyMatrix4(matrix)
          // Below-surface water and bridge foundations cannot obstruct cars.
          if (point.y > 6 || point.y < 0) continue
          closestVertexSquared = Math.min(closestVertexSquared, roadDistanceSquared(road, point.x, point.z))
        }
      }
    }
    expect(Math.sqrt(closestVertexSquared)).toBeGreaterThan(circuit.width / 2 + 0.5)
    scenery.dispose()
  })

  it.each(CIRCUITS)('$id batches scenery within a mobile draw budget and releases all resources', (circuit) => {
    const scenery = createCircuitScenery(circuit)
    const parent = new THREE.Group()
    parent.add(scenery.group)
    expect(scenery.group.children.length).toBeLessThanOrEqual(5)
    const bounds = new THREE.Box3().setFromObject(scenery.group)
    expect(bounds.min.x).toBeGreaterThan(-350)
    expect(bounds.max.x).toBeLessThan(350)
    expect(bounds.min.z).toBeGreaterThan(-350)
    expect(bounds.max.z).toBeLessThan(350)
    expect(bounds.max.y).toBeGreaterThan(9)
    const resources = new Set<THREE.BufferGeometry | THREE.Material | THREE.InstancedMesh>()
    const materials = new Set<THREE.Material>()
    let triangles = 0
    let instances = 0
    scenery.group.children.forEach((child) => {
      const mesh = child as THREE.InstancedMesh
      const material = mesh.material as THREE.MeshStandardMaterial
      resources.add(mesh)
      resources.add(mesh.geometry)
      resources.add(material)
      materials.add(material)
      triangles += (mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count) / 3 * mesh.count
      instances += mesh.count
      expect(mesh.instanceColor?.count).toBe(mesh.count)
      expect(mesh.instanceMatrix.usage).toBe(THREE.StaticDrawUsage)
      expect(mesh.castShadow).toBe(false)
      expect(mesh.receiveShadow).toBe(false)
      expect(material.map).toBeNull()
      expect(material.transparent).toBe(false)
    })
    expect(triangles).toBeLessThan(50000)
    expect(instances).toBeLessThanOrEqual(1200)
    expect(materials.size).toBe(1)
    const disposers = [...resources].map((resource) => vi.spyOn(resource, 'dispose'))
    scenery.dispose()
    disposers.forEach((dispose) => expect(dispose).toHaveBeenCalledTimes(1))
    expect(parent.children).toHaveLength(0)
  })
})
