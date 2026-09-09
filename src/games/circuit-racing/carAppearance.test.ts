import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { createCarContactShadows, createRacingStripes, styleRaceCar } from './carAppearance'
import { ROAD_Y } from './trackVisuals'

describe('race car appearance', () => {
  it('projects stripes onto upward body panels while leaving glass clear', () => {
    const body = new THREE.MeshStandardMaterial()
    body.name = 'Body'
    const glass = new THREE.MeshStandardMaterial()
    glass.name = 'Glass'
    const bodyGeometry = new THREE.BoxGeometry(2, 1, 4).translate(0, 0.5, 0)
    const glassGeometry = new THREE.BoxGeometry(1, 0.2, 1).translate(0, 1.1, 0)
    const group = new THREE.Group()
    group.add(new THREE.Mesh(bodyGeometry, body), new THREE.Mesh(glassGeometry, glass))
    const stripes = createRacingStripes(group)!
    expect(stripes).not.toBeNull()
    const position = stripes.geometry.getAttribute('position')
    const normal = stripes.geometry.getAttribute('normal')
    expect(position.count).toBeGreaterThan(100)
    for (let i = 0; i < position.count; i++) {
      expect(Math.abs(position.getZ(i))).toBeGreaterThanOrEqual(0.5)
      expect(position.getY(i)).toBeCloseTo(1.006)
      expect(normal.getY(i)).toBeGreaterThan(0.99)
    }
    body.name = 'Glass'
    expect(createRacingStripes(group)).toBeNull()
    stripes.geometry.dispose()
    ;(stripes.material as THREE.Material).dispose()
    for (const resource of [body, glass, bodyGeometry, glassGeometry]) resource.dispose()
  })

  it('preserves the selected paint and shades shared lower panels only once', () => {
    const paint = new THREE.MeshStandardMaterial({ color: '#9333ea' })
    paint.name = 'Body'
    const lower = new THREE.MeshStandardMaterial({ color: '#9333ea' })
    lower.name = 'BodyLower'
    const group = new THREE.Group()
    const geometry = new THREE.BoxGeometry()
    group.add(new THREE.Mesh(geometry, [paint, lower]), new THREE.Mesh(geometry, lower))
    const before = paint.color.clone()
    styleRaceCar(group)
    expect(paint.color.equals(before)).toBe(true)
    expect(lower.color.r / before.r).toBeCloseTo(0.65)
    geometry.dispose()
    paint.dispose()
    lower.dispose()
  })

  it('moves, rotates and removes all three contact shadows in one batch', () => {
    const shadows = createCarContactShadows()
    const cars = Array.from({ length: 3 }, (_, index) => {
      const root = new THREE.Group()
      root.position.set(40 * index, ROAD_Y, -20 * index)
      root.rotation.y = Math.PI / 2
      return { root, shadowSize: new THREE.Vector3(2, 1.5, 4), shadowCenter: new THREE.Vector3(0, 0, 0.5) }
    })
    shadows.update(cars)
    expect(shadows.mesh.count).toBe(3)
    expect(shadows.mesh.frustumCulled).toBe(false)
    const matrix = new THREE.Matrix4()
    shadows.mesh.getMatrixAt(2, matrix)
    const point = new THREE.Vector3().setFromMatrixPosition(matrix)
    expect(point.x).toBeCloseTo(80.5)
    expect(point.z).toBeCloseTo(-40)
    expect(point.y).toBeGreaterThan(ROAD_Y)
    const forward = new THREE.Vector3(0, 0, 1).transformDirection(matrix)
    expect(forward.x).toBeCloseTo(1)
    shadows.update(cars.slice(0, 2))
    expect(shadows.mesh.count).toBe(2)
    shadows.update([])
    expect(shadows.mesh.count).toBe(0)
    const resources = [shadows.mesh, shadows.mesh.geometry, shadows.mesh.material, shadows.mesh.material.map!]
    const disposers = resources.map(resource => vi.spyOn(resource, 'dispose'))
    shadows.dispose()
    disposers.forEach(dispose => expect(dispose).toHaveBeenCalledTimes(1))
  })
})
