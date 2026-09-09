import * as THREE from 'three'
import { ROAD_Y } from './trackVisuals'

/** A tiny sky/horizon reflection gives curved paint and glass readable highlights. */
export function createRaceEnvironment(): THREE.DataTexture {
  const width = 128
  const height = 64
  const pixels = new Uint8Array(width * height * 4)
  const sky = new THREE.Color('#609dcc')
  const horizon = new THREE.Color('#ecf3ff')
  const earth = new THREE.Color('#172a32')
  const color = new THREE.Color()
  for (let y = 0; y < height; y++) {
    const elevation = y / (height - 1)
    color.copy(elevation < 0.5 ? earth : sky).lerp(horizon, Math.exp(-Math.pow((elevation - 0.5) / 0.13, 2)))
    for (let x = 0; x < width; x++) {
      // Wide bright patches produce highlights that move across curved bodywork.
      const azimuth = x / width * Math.PI * 2
      const reflection = Math.pow(Math.max(0, Math.cos(azimuth - 0.5)), 16)
        * Math.exp(-Math.pow((elevation - 0.67) / 0.16, 2))
      const pixel = color.clone().lerp(horizon, reflection * 0.9).convertLinearToSRGB()
      pixels.set([Math.round(pixel.r * 255), Math.round(pixel.g * 255), Math.round(pixel.b * 255), 255], (y * width + x) * 4)
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
  const bounds = new THREE.Box3().setFromObject(object)
  object.traverse(child => {
    if (!(child instanceof THREE.Mesh)) return
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    for (const material of materials) {
      if (!(material instanceof THREE.MeshStandardMaterial) || seen.has(material)) continue
      seen.add(material)
      switch (material.name) {
        case 'Body':
          material.roughness = 0.23
          material.metalness = 0.32
          break
        case 'BodyLower':
          material.color.multiplyScalar(0.65)
          material.roughness = 0.58
          material.metalness = 0.12
          break
        case 'Glass':
          material.color.set('#122c3d')
          material.roughness = 0.09
          material.metalness = 0.48
          material.emissive.set('#000000')
          material.emissiveIntensity = 0
          material.envMapIntensity = 1.6
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
      if (material.name === 'Body' || material.name === 'Glass') {
        const glass = material.name === 'Glass'
        material.onBeforeCompile = shader => {
          shader.uniforms.raceBodyHeight = { value: Math.max(0.1, bounds.max.y - bounds.min.y) }
          shader.vertexShader = 'varying float vRaceHeight;\n' + shader.vertexShader
          shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
            #include <begin_vertex>
            vRaceHeight = position.y;
          `)
          shader.fragmentShader = 'varying float vRaceHeight;\nuniform float raceBodyHeight;\n' + shader.fragmentShader
          shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
            #include <color_fragment>
            diffuseColor.rgb *= mix(${glass ? '0.5' : '0.62'}, 1.0, smoothstep(0.0, raceBodyHeight, vRaceHeight));
          `)
          if (glass) shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
            float glassRim = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 3.0);
            outgoingLight += vec3(0.12, 0.23, 0.31) * glassRim
              + vec3(0.025, 0.07, 0.10) * smoothstep(0.15, 0.95, vRaceHeight / raceBodyHeight);
            #include <opaque_fragment>
          `)
        }
        material.customProgramCacheKey = () => glass ? 'race-glass-v2' : 'race-paint-v2'
        material.needsUpdate = true
      }
    }
  })
}

/** Project two painted stripes onto the actual sports-car panels, skipping glass. */
export function createRacingStripes(object: THREE.Object3D): THREE.Mesh | null {
  object.updateWorldMatrix(true, true)
  const bounds = new THREE.Box3().setFromObject(object)
  const width = bounds.max.x - bounds.min.x
  const ray = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0))
  const vertices: number[] = []
  function sample(x: number, z: number): THREE.Vector3 | null {
    ray.ray.origin.set(x, bounds.max.y + 1, z)
    const hit = ray.intersectObject(object, true)[0]
    if (!hit || !hit.face) return null
    const mesh = hit.object as THREE.Mesh
    const material = Array.isArray(mesh.material) ? mesh.material[hit.face.materialIndex] : mesh.material
    if (material?.name !== 'Body' || hit.face.normal.y < 0.3) return null
    return hit.point.clone().add(new THREE.Vector3(0, 0.006, 0))
  }
  const steps = 64
  for (const side of [-1, 1]) {
    const x = side * width * 0.115
    for (let i = 0; i < steps; i++) {
      const z0 = THREE.MathUtils.lerp(bounds.min.z, bounds.max.z, i / steps)
      const z1 = THREE.MathUtils.lerp(bounds.min.z, bounds.max.z, (i + 1) / steps)
      const quad = [sample(x - width * 0.027, z0), sample(x + width * 0.027, z0),
        sample(x - width * 0.027, z1), sample(x + width * 0.027, z1)]
      if (quad.some(point => point === null)) continue
      const points = quad as THREE.Vector3[]
      if (Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y)) > 0.24) continue
      for (const index of [0, 2, 1, 1, 2, 3]) vertices.push(...points[index]!.toArray())
    }
  }
  if (vertices.length === 0) return null
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.computeVertexNormals()
  const material = new THREE.MeshStandardMaterial({ color: '#f9ecd0', roughness: 0.37, metalness: 0.08,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
  const stripes = new THREE.Mesh(geometry, material)
  stripes.name = 'racing-stripes'
  stripes.receiveShadow = true
  return stripes
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
