import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { CIRCUITS } from './circuit'
import { createCircuitScenery } from './scenery'
import { createSceneryShadows, RACE_SUN_OFFSET } from './sceneryShadows'

function sample(texture: THREE.DataTexture, x: number, z: number) {
  const { width, height, data } = texture.image
  const u = Math.floor((x / 700 + 0.5) * width)
  const v = Math.floor((z / 700 + 0.5) * height)
  return data[(v * width + u) * 4]!
}

describe('static scenery shadows', () => {
  it('projects transformed instances away from the sun without shadowing empty ground', () => {
    const group = new THREE.Group()
    const geometry = new THREE.BoxGeometry(4, 2, 4)
    const material = new THREE.MeshStandardMaterial()
    const mesh = new THREE.InstancedMesh(geometry, material, 1)
    mesh.position.set(100, 0, -80)
    mesh.setMatrixAt(0, new THREE.Matrix4().makeTranslation(0, 10, 0))
    group.add(mesh)
    const shadows = createSceneryShadows(group)
    expect(sample(shadows.texture, 100 - 10 * RACE_SUN_OFFSET.x / RACE_SUN_OFFSET.y,
      -80 - 10 * RACE_SUN_OFFSET.z / RACE_SUN_OFFSET.y)).toBeGreaterThan(200)
    expect(sample(shadows.texture, 100, -80)).toBe(0)
    expect(mesh.castShadow).toBe(false)
    shadows.dispose()
    mesh.dispose()
    geometry.dispose()
    material.dispose()
  })

  it('does not bake water or ground slabs as opaque shadows', () => {
    const group = new THREE.Group()
    const geometry = new THREE.BoxGeometry(300, 0.1, 300)
    const material = new THREE.MeshStandardMaterial()
    const mesh = new THREE.InstancedMesh(geometry, material, 1)
    group.add(mesh)
    const shadows = createSceneryShadows(group)
    expect(sample(shadows.texture, 0, 0)).toBe(0)
    expect(sample(shadows.texture, 100, 100)).toBe(0)
    shadows.dispose()
    mesh.dispose()
    geometry.dispose()
    material.dispose()
  })

  it.each(CIRCUITS)('$id bakes populated scenery once without adding draws or live shadow casters', circuit => {
    const scenery = createCircuitScenery(circuit)
    const children = [...scenery.group.children]
    const shadows = createSceneryShadows(scenery.group)
    const data = shadows.texture.image.data
    let covered = 0
    for (let i = 0; i < data.length; i += 4) if (data[i]! > 0) covered++
    expect(covered).toBeGreaterThan(1000)
    expect(covered).toBeLessThan(1024 * 1024 / 2)
    expect(data.byteLength).toBeLessThanOrEqual(4 * 1024 * 1024)
    expect(scenery.group.children).toEqual(children)
    children.forEach(child => expect(child.castShadow).toBe(false))
    const dispose = vi.spyOn(shadows.texture, 'dispose')
    shadows.dispose()
    expect(dispose).toHaveBeenCalledTimes(1)
    scenery.dispose()
  })
})
