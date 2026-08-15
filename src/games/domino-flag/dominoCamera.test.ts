import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createDominoPlacements, getLayoutBounds } from './dominoLayout'
import { computeCameraSetup } from './dominoCamera'

function expectCornersInFrustum(aspect: number) {
  const bounds = getLayoutBounds(createDominoPlacements())
  const setup = computeCameraSetup(bounds, aspect)
  const camera = new THREE.PerspectiveCamera(setup.fov, aspect, 0.1, 1000)
  camera.position.set(setup.position.x, setup.position.y, setup.position.z)
  camera.lookAt(setup.target.x, setup.target.y, setup.target.z)
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld(true)

  for (const x of [bounds.minX, bounds.maxX]) {
    for (const z of [bounds.minZ, bounds.maxZ]) {
      const ndc = new THREE.Vector3(x, 0, z).project(camera)
      expect(Math.abs(ndc.x)).toBeLessThan(1)
      expect(Math.abs(ndc.y)).toBeLessThan(1)
      expect(ndc.z).toBeGreaterThan(-1)
      expect(ndc.z).toBeLessThan(1)
    }
  }
}

describe('computeCameraSetup', () => {
  it('縦画面でもレイアウト境界の四隅が視錐台に収まる', () => {
    expectCornersInFrustum(0.46)
  })

  it('横画面でもレイアウト境界の四隅が視錐台に収まる', () => {
    expectCornersInFrustum(1.8)
  })

  it('縦長になるほど横幅に合わせてカメラ距離が大きくなる', () => {
    const bounds = getLayoutBounds(createDominoPlacements())
    const portrait = computeCameraSetup(bounds, 0.46)
    const landscape = computeCameraSetup(bounds, 1.8)
    const portraitDistance = Math.hypot(
      portrait.position.x - portrait.target.x,
      portrait.position.y - portrait.target.y,
      portrait.position.z - portrait.target.z,
    )
    const landscapeDistance = Math.hypot(
      landscape.position.x - landscape.target.x,
      landscape.position.y - landscape.target.y,
      landscape.position.z - landscape.target.z,
    )

    expect(portraitDistance).toBeGreaterThan(landscapeDistance)
  })

  it('カメラは注視点より+Zかつ+Y側にある', () => {
    const bounds = getLayoutBounds(createDominoPlacements())
    const setup = computeCameraSetup(bounds, 1)

    expect(setup.position.z).toBeGreaterThan(setup.target.z)
    expect(setup.position.y).toBeGreaterThan(setup.target.y)
  })
})
