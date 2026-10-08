import { DirectionalLight, WebGLRenderTarget } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { getCraneShadowMapSize, resizeCraneShadowMap } from './craneRenderBudget'

describe('crane shadow render budget', () => {
  it.each([[390, 844], [844, 390], [640, 900], [900, 640], [0, 0]])('uses a bounded shadow map for a %i × %i scene', (width, height) => {
    expect(getCraneShadowMapSize(width, height)).toBe(1024)
  })

  it.each([[641, 900], [900, 641], [1280, 900]])('retains desktop shadow detail for a %i × %i scene', (width, height) => {
    expect(getCraneShadowMapSize(width, height)).toBe(2048)
  })

  it('sets the budget before the first shadow texture is allocated', () => {
    const shadow = new DirectionalLight().shadow
    resizeCraneShadowMap(shadow, 390, 844)
    expect(shadow.mapSize.toArray()).toEqual([1024, 1024])
    expect(shadow.map).toBeNull()
  })

  it('resizes an allocated target in both directions without reallocating on portrait/landscape rotation', () => {
    const shadow = new DirectionalLight().shadow
    shadow.mapSize.set(2048, 2048)
    shadow.map = new WebGLRenderTarget(2048, 2048)
    const resize = vi.spyOn(shadow.map, 'setSize')
    try {
      resizeCraneShadowMap(shadow, 390, 844)
      expect(shadow.mapSize.toArray()).toEqual([1024, 1024])
      expect([shadow.map.width, shadow.map.height]).toEqual([1024, 1024])
      resizeCraneShadowMap(shadow, 844, 390)
      expect(resize).toHaveBeenCalledTimes(1)
      resizeCraneShadowMap(shadow, 1280, 900)
      expect(shadow.mapSize.toArray()).toEqual([2048, 2048])
      expect([shadow.map.width, shadow.map.height]).toEqual([2048, 2048])
      expect(resize).toHaveBeenCalledTimes(2)
    } finally {
      shadow.map.dispose()
    }
  })
})
