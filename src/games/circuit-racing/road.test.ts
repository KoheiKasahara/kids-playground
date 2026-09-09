import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { CIRCUITS } from './circuit'
import { createCircuitRoad, ROAD_Y } from './road'

describe('circuit road environment', () => {
  it.each(CIRCUITS)('$id has upward surfaces, visible red/white curbs and safe rails', (circuit) => {
    const original = circuit.curve.getSpacedPoints(32)
    const road = createCircuitRoad(circuit)
    const surface = road.group.getObjectByName('road-surface') as THREE.Mesh
    const positions = surface.geometry.getAttribute('position')
    const normals = surface.geometry.getAttribute('normal')
    const colors = surface.geometry.getAttribute('color')
    const red = new THREE.Color('#e65450')
    const white = new THREE.Color('#fff7e9')
    let redCount = 0
    let whiteCount = 0
    for (let i = 0; i < positions.count; i++) {
      expect(normals.getY(i)).toBeGreaterThan(0)
      expect(Number.isFinite(positions.getX(i) + positions.getY(i) + positions.getZ(i))).toBe(true)
      if (positions.getY(i) > ROAD_Y + 0.06) {
        if (Math.abs(colors.getX(i) - red.r) < 0.001) redCount++
        if (Math.abs(colors.getX(i) - white.r) < 0.001) whiteCount++
      }
    }
    expect(redCount).toBeGreaterThan(100)
    expect(whiteCount).toBe(redCount)
    const sampled = circuit.curve.getSpacedPoints(2048)
    expect(road.railVertices.length).toBeGreaterThan(100)
    for (const p of road.railVertices) {
      expect(Math.min(...sampled.map((q) => q.distanceTo(p)))).toBeGreaterThan(circuit.width / 2 + 1)
    }
    // Building decorative geometry must not mutate the motion curve or its sampling.
    expect(circuit.curve.getSpacedPoints(32)).toEqual(original)
    road.dispose()
  })

  it('keeps road draws bounded and disposes shared GPU resources once', () => {
    const road = createCircuitRoad(CIRCUITS[0]!)
    expect(road.group.children).toHaveLength(2)
    const resources = new Set<THREE.BufferGeometry | THREE.Material | THREE.InstancedMesh>()
    let triangles = 0
    road.group.children.forEach((child) => {
      const mesh = child as THREE.Mesh
      resources.add(mesh.geometry)
      resources.add(mesh.material as THREE.Material)
      const instances = mesh instanceof THREE.InstancedMesh ? mesh.count : 1
      triangles += (mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count) / 3 * instances
      if (mesh instanceof THREE.InstancedMesh) {
        resources.add(mesh)
        expect(mesh.instanceColor?.count).toBe(mesh.count)
      }
      expect(mesh.castShadow).toBe(false)
    })
    expect(triangles).toBeLessThan(25000)
    const disposers = [...resources].map((resource) => vi.spyOn(resource, 'dispose'))
    road.dispose()
    disposers.forEach((dispose) => expect(dispose).toHaveBeenCalledTimes(1))
  })
})
