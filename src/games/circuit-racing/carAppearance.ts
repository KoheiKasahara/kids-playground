import * as THREE from 'three'
import { ROAD_Y } from './trackVisuals'

/** A tiny sky/horizon reflection gives curved paint and glass readable highlights. */
export function createRaceEnvironment(): THREE.DataTexture {
  const width = 128
  const height = 64
  const pixels = new Uint8Array(width * height * 4)
  const sky = new THREE.Color('#9fc9e5')
  const horizon = new THREE.Color('#f4f3df')
  const earth = new THREE.Color('#53624f')
  const color = new THREE.Color()
  for (let y = 0; y < height; y++) {
    const elevation = y / (height - 1)
    color.copy(elevation < 0.5 ? earth : sky).lerp(horizon, Math.exp(-Math.pow((elevation - 0.5) / 0.13, 2)))
    color.convertLinearToSRGB()
    for (let x = 0; x < width; x++) {
      pixels.set([Math.round(color.r * 255), Math.round(color.g * 255), Math.round(color.b * 255), 255], (y * width + x) * 4)
    }
  }
  const texture = new THREE.DataTexture(pixels, width, height)
  texture.mapping = THREE.EquirectangularReflectionMapping
  texture.colorSpace = THREE.SRGBColorSpace
  texture.magFilter = texture.minFilter = THREE.LinearFilter
  texture.needsUpdate = true
  return texture
}

/** Models own their materials; styling here only affects the racing game. */
export function styleRaceCar(object: THREE.Object3D): void {
  const seen = new Set<THREE.Material>()
  object.traverse(child => {
    if (!(child instanceof THREE.Mesh)) return
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    for (const material of materials) {
      if (!(material instanceof THREE.MeshStandardMaterial) || seen.has(material)) continue
      seen.add(material)
      switch (material.name) {
        case 'Body':
          material.roughness = 0.3
          material.metalness = 0.16
          break
        case 'BodyLower':
          material.color.multiplyScalar(0.65)
          material.roughness = 0.58
          material.metalness = 0.12
          break
        case 'Glass':
          material.color.set('#244958')
          material.roughness = 0.16
          material.metalness = 0.28
          material.emissive.set('#53869b')
          material.emissiveIntensity = 0.18
          material.envMapIntensity = 1.25
          break
        case 'LightFront':
          material.color.set('#fff4cf')
          material.emissive.set('#fff1bf')
          material.emissiveIntensity = 0.65
          material.roughness = 0.22
          break
        case 'LightRear':
          material.color.set('#9e1025')
          material.emissive.set('#ff2439')
          material.emissiveIntensity = 0.32
          material.roughness = 0.24
          break
        case 'TrimDark':
          material.color.set('#182530')
          material.roughness = 0.78
          break
        case 'Trim':
          material.color.set('#91a6b2')
          material.roughness = 0.32
          material.metalness = 0.55
          break
      }
    }
  })
}

/** One transparent draw for all three cars, independent of shadow-map coverage. */
export function createCarContactShadows() {
  const size = 64
  const pixels = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size * 2 - 1
      const v = (y + 0.5) / size * 2 - 1
      // Rounded rectangle follows the footprint better than a circular blob.
      const distance = Math.pow(Math.pow(u, 4) + Math.pow(v, 4), 0.25)
      const alpha = 1 - THREE.MathUtils.smoothstep(distance, 0.35, 1)
      pixels.set([14, 21, 29, Math.round(alpha * 125)], (y * size + x) * 4)
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size)
  texture.magFilter = texture.minFilter = THREE.LinearFilter
  texture.needsUpdate = true
  const geometry = new THREE.PlaneGeometry(1, 1)
  geometry.rotateX(-Math.PI / 2)
  const material = new THREE.MeshBasicMaterial({
    map: texture, transparent: true, depthWrite: false, toneMapped: false,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  })
  const mesh = new THREE.InstancedMesh(geometry, material, 3)
  mesh.name = 'car-contact-shadows'
  mesh.count = 0
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  // Only three moving quads: skip stale static bounds and per-frame bounds work.
  mesh.frustumCulled = false
  const dummy = new THREE.Object3D()
  return {
    mesh,
    update(cars: readonly { root: THREE.Group; shadowSize: THREE.Vector3; shadowCenter: THREE.Vector3 }[]) {
      mesh.count = Math.min(cars.length, 3)
      for (let i = 0; i < mesh.count; i++) {
        const car = cars[i]!
        dummy.position.copy(car.shadowCenter).applyAxisAngle(THREE.Object3D.DEFAULT_UP, car.root.rotation.y).add(car.root.position)
        dummy.position.y = ROAD_Y + 0.004
        dummy.rotation.set(0, car.root.rotation.y, 0)
        dummy.scale.set(car.shadowSize.x * 1.2, 1, car.shadowSize.z * 1.12)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      }
      mesh.instanceMatrix.needsUpdate = true
    },
    dispose() {
      mesh.dispose()
      geometry.dispose()
      material.dispose()
      texture.dispose()
      mesh.removeFromParent()
    },
  }
}
