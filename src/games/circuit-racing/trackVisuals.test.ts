import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { CIRCUITS } from './circuit'
import { createTrackVisuals } from './trackVisuals'

describe('track visuals', () => {
  it.each(CIRCUITS)('$id batches all furniture and keeps the road upward-facing and closed', circuit => {
    const points = Array.from({ length: 192 }, (_, index) => circuit.curve.getPointAt(index / 192))
    const track = createTrackVisuals(circuit, points)
    const batches = track.group.children.filter(child => child instanceof THREE.InstancedMesh)
    expect(batches).toHaveLength(6)
    expect(batches.reduce((count, mesh) => count + mesh.count, 0)).toBe(568)
    const matrix = new THREE.Matrix4()
    for (const mesh of batches) {
      expect(mesh.boundingSphere?.isEmpty()).toBe(false)
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, matrix)
        expect(matrix.elements.every(Number.isFinite)).toBe(true)
        expect(matrix.determinant()).toBeGreaterThan(0)
      }
    }
    const road = track.group.getObjectByName('asphalt') as THREE.Mesh
    const geometry = road.geometry
    const normals = geometry.getAttribute('normal')
    for (let i = 0; i < normals.count; i++) expect(normals.getY(i)).toBeCloseTo(1)
    expect([...geometry.index!.array].slice(-6)).toEqual([382, 383, 0, 383, 1, 0])
    // World-space mapping must not stretch grain or introduce a lap seam.
    const position = geometry.getAttribute('position')
    const uv = geometry.getAttribute('uv')
    for (let i = 0; i < position.count; i++) {
      expect(uv.getX(i) * 8).toBeCloseTo(position.getX(i), 4)
      expect(uv.getY(i) * 8).toBeCloseTo(position.getZ(i), 4)
    }
    const resources = new Set<THREE.BufferGeometry | THREE.Material | THREE.Texture | THREE.InstancedMesh>()
    track.group.children.forEach(child => {
      const mesh = child as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
      resources.add(mesh.geometry)
      resources.add(mesh.material)
      if (mesh.material.map) resources.add(mesh.material.map)
      if (mesh instanceof THREE.InstancedMesh) resources.add(mesh)
    })
    const disposers = [...resources].map(resource => vi.spyOn(resource, 'dispose'))
    track.dispose()
    disposers.forEach(dispose => expect(dispose).toHaveBeenCalledTimes(1))
  })
})
