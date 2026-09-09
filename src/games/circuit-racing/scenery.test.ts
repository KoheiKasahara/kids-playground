import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { CIRCUITS } from './circuit'
import { createCircuitScenery } from './scenery'

describe('circuit scenery', () => {
  it.each(CIRCUITS)('$id keeps scenery off every part of the road, including hairpins', (circuit) => {
    const scenery = createCircuitScenery(circuit)
    const road = circuit.curve.getSpacedPoints(2048)
    expect(scenery.footprints.length).toBeGreaterThan(10)
    for (const footprint of scenery.footprints) {
      const closest = Math.min(...road.map((p) => Math.hypot(p.x - footprint.x, p.z - footprint.z)))
      expect(closest - footprint.radius).toBeGreaterThan(circuit.width / 2 + 2.5)
    }
    // Also inspect real low-lying vertices: this catches incorrectly sized
    // structures that extend past their declared footprint and gantry posts.
    const matrix = new THREE.Matrix4()
    const point = new THREE.Vector3()
    for (const child of scenery.group.children) {
      const mesh = child as THREE.InstancedMesh
      const positions = mesh.geometry.getAttribute('position')
      for (let instance = 0; instance < mesh.count; instance++) {
        mesh.getMatrixAt(instance, matrix)
        for (let vertex = 0; vertex < positions.count; vertex++) {
          point.fromBufferAttribute(positions, vertex).applyMatrix4(matrix)
          if (point.y > 6) continue
          // Avoid allocating a 2049-entry array for every instanced vertex.
          let closestSquared = Infinity
          for (const p of road) {
            const dx = p.x - point.x
            const dz = p.z - point.z
            closestSquared = Math.min(closestSquared, dx * dx + dz * dz)
          }
          expect(closestSquared).toBeGreaterThan((circuit.width / 2 + 0.5) ** 2)
        }
      }
    }
    scenery.dispose()
  })

  it.each(CIRCUITS)('$id batches scenery within a mobile draw budget and releases all resources', (circuit) => {
    const scenery = createCircuitScenery(circuit)
    expect(scenery.group.children.length).toBeLessThanOrEqual(5)
    const bounds = new THREE.Box3().setFromObject(scenery.group)
    expect(bounds.min.x).toBeGreaterThan(-350)
    expect(bounds.max.x).toBeLessThan(350)
    expect(bounds.min.z).toBeGreaterThan(-350)
    expect(bounds.max.z).toBeLessThan(350)
    expect(bounds.max.y).toBeGreaterThan(9)
    const resources = new Set<THREE.BufferGeometry | THREE.Material | THREE.InstancedMesh>()
    scenery.group.children.forEach((child) => {
      const mesh = child as THREE.InstancedMesh
      resources.add(mesh)
      resources.add(mesh.geometry)
      resources.add(mesh.material as THREE.Material)
    })
    const disposers = [...resources].map((resource) => vi.spyOn(resource, 'dispose'))
    scenery.dispose()
    disposers.forEach((dispose) => expect(dispose).toHaveBeenCalledTimes(1))
  })
})
