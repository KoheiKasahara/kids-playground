import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { findFlagBall } from './flagBalls'
import {
  configureFlagSphereTexture,
  createFlagSphereMaterial,
  createFlagSphereResource,
  createFlagSphereTexture,
  disposeFlagSphereResource,
  FLAG_SPHERE_DEFAULT_ANISOTROPY,
  FLAG_SPHERE_FLAG_ASPECT_RATIO,
  FLAG_SPHERE_HORIZONTAL_REPEAT,
  getFlagSphereTextureConfig,
  getFlagSphereTextureOffsetX,
  getFlagSphereTextureUrl,
} from './flagSphere'

function flag(id: string) {
  const value = findFlagBall(id)
  if (!value) throw new Error(`test flag is missing: ${id}`)
  return value
}

describe('flag sphere texture mapping', () => {
  it('maps a 4:3 flag to the UV sphere with a 1.5x horizontal repeat', () => {
    expect(FLAG_SPHERE_FLAG_ASPECT_RATIO).toBe(4 / 3)
    expect(FLAG_SPHERE_HORIZONTAL_REPEAT).toBeCloseTo(1.5)

    const config = getFlagSphereTextureConfig(flag('jp'))
    expect(config.repeatX).toBeCloseTo(1.5)
    expect(config.repeatY).toBe(1)
    // +Z-facing front of SphereGeometry is U=.25; center of a flag is then U=.5.
    expect(config.offsetX).toBeCloseTo(0.125)
  })

  it('keeps representative centered flags on the same front-facing setup', () => {
    const ids = ['jp', 'kr', 'bd', 'br', 'ca', 'gb', 'us']
    const entries = ids.map((id) => ({ id, config: getFlagSphereTextureConfig(flag(id)) }))

    expect(new Set(entries.map(({ config }) => config.offsetX))).toHaveLength(1)
    for (const { id, config } of entries) {
      expect(config.url).toMatch(new RegExp(`flags/${id}\\.svg$`))
    }
  })

  it('uses the existing ballPositionX adjustment to shift the visible image', () => {
    const centered = getFlagSphereTextureOffsetX(flag('jp'))
    const leftAligned = getFlagSphereTextureOffsetX(flag('sg'))

    expect(centered).toBeCloseTo(0.125)
    expect(leftAligned).toBeCloseTo(0)
    expect(leftAligned).toBeLessThan(centered)
  })

  it('resolves public flag URLs under either root or a configured base path', () => {
    expect(getFlagSphereTextureUrl(flag('jp'), '/')).toBe('/flags/jp.svg')
    expect(getFlagSphereTextureUrl(flag('jp'), '/kids-playground')).toBe(
      '/kids-playground/flags/jp.svg',
    )
    expect(getFlagSphereTextureUrl(flag('jp'), '/kids-playground/')).toBe(
      '/kids-playground/flags/jp.svg',
    )
  })

  it('configures sRGB, wrapping, filters, and a mobile-safe anisotropy cap', () => {
    const config = getFlagSphereTextureConfig(flag('us'))

    expect(config.colorSpace).toBe(THREE.SRGBColorSpace)
    expect(config.wrapS).toBe(THREE.RepeatWrapping)
    expect(config.wrapT).toBe(THREE.ClampToEdgeWrapping)
    expect(config.minFilter).toBe(THREE.LinearMipmapLinearFilter)
    expect(config.magFilter).toBe(THREE.LinearFilter)
    expect(config.generateMipmaps).toBe(true)
    expect(config.anisotropy).toBe(FLAG_SPHERE_DEFAULT_ANISOTROPY)
    expect(getFlagSphereTextureConfig(flag('us'), { maxAnisotropy: 1 }).anisotropy).toBe(1)
    expect(getFlagSphereTextureConfig(flag('us'), { anisotropy: 99 }).anisotropy).toBe(4)
  })
})

describe('flag sphere texture/material lifecycle', () => {
  it('applies config to a Texture and returns the same instance', () => {
    const texture = new THREE.Texture()
    const config = getFlagSphereTextureConfig(flag('jp'))

    expect(configureFlagSphereTexture(texture, config)).toBe(texture)
    expect(texture.repeat.x).toBeCloseTo(config.repeatX)
    expect(texture.repeat.y).toBe(config.repeatY)
    expect(texture.offset.x).toBeCloseTo(config.offsetX)
    expect(texture.wrapS).toBe(config.wrapS)
    expect(texture.wrapT).toBe(config.wrapT)
    expect(texture.colorSpace).toBe(config.colorSpace)
    expect(texture.anisotropy).toBe(config.anisotropy)
  })

  it('creates a Lambert material that references the loaded texture', () => {
    const texture = new THREE.Texture()
    const material = createFlagSphereMaterial(texture)

    expect(material).toBeInstanceOf(THREE.MeshLambertMaterial)
    expect(material.map).toBe(texture)
    material.dispose()
    texture.dispose()
  })

  it('lets the engine load and dispose texture/material together', () => {
    const texture = new THREE.Texture()
    const load = vi.fn(() => texture)
    const resource = createFlagSphereResource(flag('jp'), {
      baseUrl: '/app/',
      loader: { load },
    })

    expect(load).toHaveBeenCalledWith('/app/flags/jp.svg')
    expect(resource.material.map).toBe(texture)

    const materialDispose = vi.spyOn(resource.material, 'dispose')
    const textureDispose = vi.spyOn(resource.texture, 'dispose')
    disposeFlagSphereResource(resource)
    expect(materialDispose).toHaveBeenCalledTimes(1)
    expect(textureDispose).toHaveBeenCalledTimes(1)
  })

  it('supports creating only a texture with a test loader', () => {
    const texture = new THREE.Texture()
    const load = vi.fn(() => texture)

    const result = createFlagSphereTexture(flag('kr'), {
      loader: { load },
    })

    expect(result).toBe(texture)
    expect(load).toHaveBeenCalledWith('/flags/kr.svg')
  })
})
