import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createSunSurfaceMaterial, updateSunSurfaceMaterial } from './sunVisual'

function createMaterial(): THREE.ShaderMaterial {
  const map = new THREE.CanvasTexture(document.createElement('canvas'))
  return createSunSurfaceMaterial({
    map,
    hotColor: '#fff3c4',
    flowStrength: 0.55,
    rimColor: '#ffb347',
  })
}

describe('createSunSurfaceMaterial', () => {
  it('CanvasTextureを保持し、表面ノイズ・明るい領域・内側のrim用uniformを持つ', () => {
    const material = createMaterial()

    expect(material).toBeInstanceOf(THREE.ShaderMaterial)
    expect(material.uniforms.uMap.value).toBeInstanceOf(THREE.CanvasTexture)
    expect(material.uniforms.uCoolColor.value).toBeInstanceOf(THREE.Color)
    expect(material.uniforms.uHotColor.value).toBeInstanceOf(THREE.Color)
    expect(material.uniforms.uRimColor.value).toBeInstanceOf(THREE.Color)
    expect(material.fragmentShader).toContain('granulationUv')
    expect(material.fragmentShader).toContain('brightRegions')
    // valueNoiseの定義 + 大きな流れ2回 + 細粒1回。追加サンプルは1回だけ。
    expect(material.fragmentShader.match(/valueNoise\(/g)).toHaveLength(4)

    material.dispose()
  })
})

describe('updateSunSurfaceMaterial', () => {
  it('uTimeだけを経過秒へ更新する', () => {
    const material = createMaterial()

    updateSunSurfaceMaterial(material, 12.5)

    expect(material.uniforms.uTime.value).toBe(12.5)
    material.dispose()
  })
})
