import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { CIRCUITS } from './circuit'
import { createRaceAtmosphere } from './atmosphere'

describe('race atmosphere', () => {
  it.each(CIRCUITS)('$id keeps its sky around the camera within three draws and releases GPU resources', circuit => {
    const atmosphere = createRaceAtmosphere(circuit)
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 900)
    camera.position.set(120, 400, -180)
    atmosphere.update(camera)
    const sky = atmosphere.group.getObjectByName('race-sky')!
    expect(sky.position.equals(camera.position)).toBe(true)
    expect(sky.scale.x).toBeLessThan(camera.far)
    expect(sky.frustumCulled).toBe(false)
    expect(atmosphere.group.children).toHaveLength(3)
    let triangles = 0
    const resources = new Set<THREE.BufferGeometry | THREE.Material | THREE.InstancedMesh>()
    atmosphere.group.traverse(child => {
      if (!(child instanceof THREE.Mesh)) return
      expect(child.castShadow).toBe(false)
      triangles += (child.geometry.index?.count ?? child.geometry.getAttribute('position').count) / 3
        * (child instanceof THREE.InstancedMesh ? child.count : 1)
      resources.add(child.geometry)
      resources.add(child.material as THREE.Material)
      if (child instanceof THREE.InstancedMesh) resources.add(child)
    })
    expect(triangles).toBeLessThan(6000)
    const disposers = [...resources].map(resource => vi.spyOn(resource, 'dispose'))
    atmosphere.dispose()
    disposers.forEach(dispose => expect(dispose).toHaveBeenCalledTimes(1))
  })
})
