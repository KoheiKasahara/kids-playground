import * as THREE from 'three'
import { CIRCUIT_SCENERY, type CircuitDefinition } from './circuit'

export const ROAD_Y = 0.024
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

/** Track furniture is six draws regardless of the number of circuit samples. */
export function createTrackVisuals(circuit: CircuitDefinition, points: readonly THREE.Vector3[]) {
  const group = new THREE.Group()
  group.name = 'circuit-track'
  const resources: Array<THREE.BufferGeometry | THREE.Material | THREE.Texture | THREE.InstancedMesh> = []
  function own<T extends typeof resources[number]>(resource: T): T {
    resources.push(resource)
    return resource
  }
  const palette = CIRCUIT_SCENERY[circuit.scenery]
  const roadEdge = circuit.width / 2
  const grass = own(surfaceTexture(true, circuit.scenery === 'grandPrix' || circuit.scenery === 'stadium'))
  const asphalt = own(surfaceTexture(false))
  const groundGeometry = own(new THREE.PlaneGeometry(700, 700))
  // World-space UVs match the road tile size without scaling either texture.
  const groundUv = groundGeometry.getAttribute('uv')
  for (let i = 0; i < groundUv.count; i++) {
    groundUv.setXY(i, groundUv.getX(i) * 700 / SURFACE_TILE_METRES, groundUv.getY(i) * 700 / SURFACE_TILE_METRES)
  }
  const ground = new THREE.Mesh(groundGeometry,
    own(new THREE.MeshStandardMaterial({ color: palette.ground, map: grass, roughness: 0.96 })))
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.2
  ground.receiveShadow = true
  group.add(ground)

  function ribbon(halfWidth: number, y: number, color: string, map?: THREE.Texture) {
    const positions: number[] = []
    const uvs: number[] = []
    const indices: number[] = []
    points.forEach((point, index) => {
      const previous = points[(index + points.length - 1) % points.length]!
      const next = points[(index + 1) % points.length]!
      const dx = next.x - previous.x
      const dz = next.z - previous.z
      const length = Math.hypot(dx, dz) || 1
      for (const side of [-1, 1]) {
        const x = point.x - dz / length * halfWidth * side
        const z = point.z + dx / length * halfWidth * side
        positions.push(x, y, z)
        uvs.push(x / SURFACE_TILE_METRES, z / SURFACE_TILE_METRES)
      }
      const nextIndex = (index + 1) % points.length
      indices.push(index * 2, index * 2 + 1, nextIndex * 2,
        index * 2 + 1, nextIndex * 2 + 1, nextIndex * 2)
    })
    const geometry = own(new THREE.BufferGeometry())
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    const mesh = new THREE.Mesh(geometry, own(new THREE.MeshStandardMaterial({
      color, map: map ?? null, roughness: 0.94, metalness: 0.02,
    })))
    mesh.name = map ? 'asphalt' : 'shoulder'
    mesh.receiveShadow = true
    group.add(mesh)
  }
  ribbon(roadEdge + 0.85, ROAD_Y - 0.018, '#b1ac93')
  ribbon(roadEdge, ROAD_Y, palette.road, asphalt)

  function batch(name: string, geometry: THREE.BufferGeometry, color: string, count: number, metalness = 0) {
    const material = own(new THREE.MeshStandardMaterial({ color, roughness: metalness ? 0.48 : 0.82, metalness }))
    const mesh = own(new THREE.InstancedMesh(own(geometry), material, count))
    mesh.name = name
    mesh.receiveShadow = true
    group.add(mesh)
    return mesh
  }
  const red = batch('curbs-color', new THREE.BoxGeometry(0.46, 0.12, 1), palette.curb, Math.ceil(points.length / 2) * 2)
  const white = batch('curbs-white', new THREE.BoxGeometry(0.46, 0.12, 1), '#fff8ec', Math.floor(points.length / 2) * 2)
  const lines = batch('center-lines', new THREE.BoxGeometry(0.14, 0.012, 1), '#ffe99a', Math.ceil(points.length / 3))
  const posts = batch('rail-posts', new THREE.CylinderGeometry(0.07, 0.09, 0.9, 8), '#f7fbff', Math.ceil(points.length / 8) * 2)
  const caps = batch('post-reflectors', new THREE.BoxGeometry(0.26, 0.1, 0.08), '#f15b5b', posts.count)
  const rails = batch('guardrails', new THREE.BoxGeometry(0.12, 0.5, 1), '#c9d2da', Math.ceil(points.length / 16) * 2, 0.35)
  const dummy = new THREE.Object3D()
  function instance(mesh: THREE.InstancedMesh, index: number, x: number, y: number, z: number, angle: number, length = 1) {
    dummy.position.set(x, y, z)
    dummy.rotation.set(0, angle, 0)
    dummy.scale.set(1, 1, length)
    dummy.updateMatrix()
    mesh.setMatrixAt(index, dummy.matrix)
  }
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length]!
    const dx = next.x - point.x
    const dz = next.z - point.z
    const length = Math.hypot(dx, dz) || 1
    const tx = dx / length
    const tz = dz / length
    const angle = Math.atan2(tx, tz)
    for (const [sideIndex, side] of [-1, 1].entries()) {
      instance(index % 2 === 0 ? red : white, Math.floor(index / 2) * 2 + sideIndex,
        (point.x + next.x) / 2 - tz * side * (roadEdge + 0.27), ROAD_Y + 0.07,
        (point.z + next.z) / 2 + tx * side * (roadEdge + 0.27), angle, Math.min(length * 1.03, 6))
      if (index % 8 === 0) {
        const x = point.x - tz * side * (roadEdge + 1.15)
        const z = point.z + tx * side * (roadEdge + 1.15)
        instance(posts, index / 8 * 2 + sideIndex, x, 0.45, z, angle)
        instance(caps, index / 8 * 2 + sideIndex, x, 0.82, z, angle)
        if (index % 16 === 0) {
          const railLength = Math.min(length * 6, 9)
          instance(rails, index / 16 * 2 + sideIndex, x + tx * railLength / 2, 0.54, z + tz * railLength / 2, angle, railLength)
        }
      }
    }
    if (index % 3 === 0) instance(lines, index / 3, point.x, ROAD_Y + 0.014, point.z, angle, Math.min(length * 0.58, 2.5))
  })
  for (const mesh of [red, white, lines, posts, caps, rails]) {
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }
  return {
    group,
    setAnisotropy(value: number) { grass.anisotropy = asphalt.anisotropy = Math.min(4, value) },
    dispose() {
      resources.forEach(resource => resource.dispose())
      group.removeFromParent()
    },
  }
}
