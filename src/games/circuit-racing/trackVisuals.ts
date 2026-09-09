import * as THREE from 'three'
import { CIRCUIT_SCENERY, type CircuitDefinition } from './circuit'

import { createCircuitRoad } from './road'
import { createCoastalWater } from './ocean'
export { ROAD_Y } from './road'
const SURFACE_TILE_METRES = 8

/** Small, deterministic tiles: no downloads and mipmaps keep distant grain stable. */
function surfaceTexture(grass: boolean, mown = false): THREE.DataTexture {
  const size = 64
  const pixels = new Uint8Array(size * size * 4)
  let seed = grass ? 731 : 197
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      const grain = (seed / 0x100000000 - 0.5) * (grass ? 18 : 12)
      // A seamless, broad mowing variation remains readable from the overview.
      const stripe = grass ? (mown
        ? Math.sin(y / size * Math.PI * 2) * 3
        : Math.sin(y / size * Math.PI * 2) * Math.cos(x / size * Math.PI * 2) * 3) : 0
      const value = Math.round(239 + grain + stripe)
      const offset = (y * size + x) * 4
      pixels.set([value, value, value, 255], offset)
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.generateMipmaps = true
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.needsUpdate = true
  return texture
}

/** Add texture to the shared continuous road without replacing its safe edge geometry. */
export function createTrackVisuals(circuit: CircuitDefinition) {
  const group = new THREE.Group()
  group.name = 'circuit-track'
  const road = createCircuitRoad(circuit)
  group.add(road.group)
  const palette = CIRCUIT_SCENERY[circuit.scenery]
  const grass = surfaceTexture(true, circuit.scenery === 'grandPrix' || circuit.scenery === 'stadium')
  const asphalt = surfaceTexture(false)
  const groundSize = 1400
  const groundGeometry = new THREE.PlaneGeometry(groundSize, groundSize, 64, 64)
  const groundUv = groundGeometry.getAttribute('uv')
  const groundPositions = groundGeometry.getAttribute('position')
  const groundColors = new Float32Array(groundPositions.count * 3)
  for (let i = 0; i < groundUv.count; i++) {
    groundUv.setXY(i, groundUv.getX(i) * groundSize / SURFACE_TILE_METRES, groundUv.getY(i) * groundSize / SURFACE_TILE_METRES)
    const x = groundPositions.getX(i)
    const z = groundPositions.getY(i)
    const shade = 0.91 + Math.sin(x / 37) * Math.cos(z / 53) * 0.06 + Math.sin((x + z) / 81) * 0.03
    groundColors.set([shade * 0.98, shade, shade * 0.97], i * 3)
  }
  groundGeometry.setAttribute('color', new THREE.BufferAttribute(groundColors, 3))
  const groundMaterial = new THREE.MeshStandardMaterial({ color: palette.ground, vertexColors: true, map: grass, roughness: 0.96 })
  const ground = new THREE.Mesh(groundGeometry, groundMaterial)
  ground.name = 'ground'
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.2
  ground.receiveShadow = true
  group.add(ground)
  const water = circuit.scenery === 'coast' ? createCoastalWater() : undefined
  if (water) group.add(water.mesh)

  const surface = road.group.getObjectByName('road-surface') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
  const positions = surface.geometry.getAttribute('position')
  const uvs = new Float32Array(positions.count * 2)
  for (let i = 0; i < positions.count; i++) {
    uvs[i * 2] = positions.getX(i) / SURFACE_TILE_METRES
    uvs[i * 2 + 1] = positions.getZ(i) / SURFACE_TILE_METRES
  }
  surface.geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  surface.material.map = asphalt
  surface.material.needsUpdate = true

  return {
    group,
    update(seconds: number) { water?.update(seconds) },
    setAnisotropy(value: number) { grass.anisotropy = asphalt.anisotropy = Math.min(4, value) },
    dispose() {
      road.dispose()
      groundGeometry.dispose()
      groundMaterial.dispose()
      grass.dispose()
      asphalt.dispose()
      water?.dispose()
      group.removeFromParent()
    },
  }
}
