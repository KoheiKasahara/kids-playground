import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import {
  applyLighting,
  configureKeyLightShadow,
  createPlanetLights,
  DEFAULT_LIGHTING,
} from './planetLighting'

describe('DEFAULT_LIGHTING', () => {
  it('主光がほかのどの光よりも強い', () => {
    expect(DEFAULT_LIGHTING.keyIntensity).toBeGreaterThan(DEFAULT_LIGHTING.ambientIntensity)
    expect(DEFAULT_LIGHTING.keyIntensity).toBeGreaterThan(DEFAULT_LIGHTING.hemisphereIntensity)
    expect(DEFAULT_LIGHTING.keyIntensity).toBeGreaterThan(DEFAULT_LIGHTING.fillIntensity)
  })
})

describe('createPlanetLights', () => {
  it('4つのライトをまとめて作り、allに全て含める', () => {
    const lights = createPlanetLights()
    expect(lights.all).toHaveLength(4)
    expect(lights.all).toEqual(
      expect.arrayContaining([lights.ambient, lights.hemisphere, lights.key, lights.fill]),
    )
  })
})

describe('applyLighting', () => {
  it('4つの強度をそれぞれの光へ反映する', () => {
    const lights = createPlanetLights()
    applyLighting(lights, {
      keyIntensity: 1.1,
      ambientIntensity: 2.2,
      hemisphereIntensity: 3.3,
      fillIntensity: 4.4,
    })

    expect(lights.key.intensity).toBe(1.1)
    expect(lights.ambient.intensity).toBe(2.2)
    expect(lights.hemisphere.intensity).toBe(3.3)
    expect(lights.fill.intensity).toBe(4.4)
  })
})

describe('configureKeyLightShadow', () => {
  it('falseのときcastShadowがfalseになる', () => {
    const key = new THREE.DirectionalLight()
    configureKeyLightShadow(key, 100, false)
    expect(key.castShadow).toBe(false)
  })

  it('trueのときcastShadowが有効になり、影カメラの範囲が視野半径に比例する', () => {
    const key = new THREE.DirectionalLight()
    configureKeyLightShadow(key, 100, true)

    expect(key.castShadow).toBe(true)
    expect(key.shadow.camera.right).toBeCloseTo(125)
    expect(key.shadow.camera.left).toBeCloseTo(-125)
    expect(key.shadow.mapSize.x).toBe(1024)
  })
})
