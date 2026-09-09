import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { CIRCUITS } from './circuit'
import { createTrackVisuals } from './trackVisuals'

describe('track visuals', () => {
  it.each(CIRCUITS)('$id preserves the batched road and adds seamless world-space grain', circuit => {
    const track = createTrackVisuals(circuit)
    const batches: THREE.InstancedMesh[] = []
    let drawCount = 0
    track.group.traverse(child => {
      if (child instanceof THREE.InstancedMesh) batches.push(child)
      if (child instanceof THREE.Mesh) drawCount++
    })
    expect(drawCount).toBe(3)
    expect(batches).toHaveLength(1)
    const road = track.group.getObjectByName('road-surface') as THREE.Mesh
    const geometry = road.geometry
    const position = geometry.getAttribute('position')
    const uv = geometry.getAttribute('uv')
    expect(uv.count).toBe(position.count)
    let error = 0
    for (let i = 0; i < position.count; i++) {
      error = Math.max(error, Math.abs(uv.getX(i) * 8 - position.getX(i)), Math.abs(uv.getY(i) * 8 - position.getZ(i)))
    }
    expect(error).toBeLessThan(0.0001)
    const resources = new Set<THREE.BufferGeometry | THREE.Material | THREE.Texture | THREE.InstancedMesh>()
    track.group.traverse(child => {
      if (!(child instanceof THREE.Mesh)) return
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
