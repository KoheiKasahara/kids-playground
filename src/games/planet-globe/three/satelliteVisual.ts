import * as THREE from 'three'
import type { SatelliteSpec } from '../types'

const TEXTURE_SIZE = 96

/** 低負荷で再現可能な衛星テクスチャ。外部素材やCDNには依存しない。 */
export function createSatelliteTexture(satellite: SatelliteSpec): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = TEXTURE_SIZE
  canvas.height = TEXTURE_SIZE
  const context = canvas.getContext('2d')
  if (context === null) return null

  const { appearance } = satellite
  const gradient = context.createRadialGradient(30, 26, 4, 54, 54, 60)
  gradient.addColorStop(0, appearance.accentColor)
  gradient.addColorStop(0.48, appearance.baseColor)
  gradient.addColorStop(1, appearance.darkColor ?? appearance.baseColor)
  context.fillStyle = gradient
  context.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)

  const seed = Array.from(satellite.id).reduce((value, char) => value + char.charCodeAt(0), 0)
  let state = seed || 1
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
  if (appearance.pattern === 'icy') {
    context.strokeStyle = appearance.accentColor + 'aa'
    context.lineWidth = 2
    for (let i = 0; i < 7; i += 1) {
      context.beginPath()
      context.moveTo(random() * TEXTURE_SIZE, random() * TEXTURE_SIZE)
      context.bezierCurveTo(random() * TEXTURE_SIZE, random() * TEXTURE_SIZE, random() * TEXTURE_SIZE, random() * TEXTURE_SIZE, random() * TEXTURE_SIZE, random() * TEXTURE_SIZE)
      context.stroke()
    }
  } else {
    context.fillStyle = appearance.accentColor + '88'
    const count = appearance.shape === 'irregular' ? 8 : 13
    for (let i = 0; i < count; i += 1) {
      context.beginPath()
      context.arc(random() * TEXTURE_SIZE, random() * TEXTURE_SIZE, 2 + random() * 7, 0, Math.PI * 2)
      context.fill()
    }
  }
  if (appearance.pattern === 'atmosphere') {
    const atmosphere = context.createRadialGradient(48, 48, 24, 48, 48, 48)
    const atmosphereColor = appearance.atmosphere?.color ?? '#f6d79c'
    atmosphere.addColorStop(0, 'rgba(255,255,255,0)')
    atmosphere.addColorStop(0.76, atmosphereColor + '22')
    atmosphere.addColorStop(1, atmosphereColor + 'aa')
    context.fillStyle = atmosphere
    context.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

export function createSatelliteMaterial(
  satellite: SatelliteSpec,
  texture: THREE.CanvasTexture | null,
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: texture === null ? satellite.appearance.baseColor : '#ffffff',
    roughness: satellite.appearance.pattern === 'icy' ? 0.78 : 0.92,
    metalness: 0,
    map: texture ?? undefined,
  })
}

export function applySatelliteSelection(material: THREE.MeshStandardMaterial, selected: boolean): void {
  material.emissive.set(selected ? material.color : '#000000')
  material.emissiveIntensity = selected ? 0.32 : 0
}
