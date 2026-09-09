import * as THREE from 'three'

const SIZE = 1024
const WORLD_SIZE = 700
export const RACE_SUN_OFFSET = new THREE.Vector3(-75, 150, 65)

/** Bake static silhouettes once. Scenery never enters the per-frame shadow pass. */
export function createSceneryShadows(group: THREE.Group) {
  const mask = new Uint8Array(SIZE * SIZE)
  const matrix = new THREE.Matrix4()
  const points = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
  const projected = [new THREE.Vector2(), new THREE.Vector2(), new THREE.Vector2()]
  group.updateWorldMatrix(true, true)
  group.traverse(child => {
    if (!(child instanceof THREE.InstancedMesh)) return
    const positions = child.geometry.getAttribute('position')
    const indices = child.geometry.index
    const count = indices?.count ?? positions.count
    for (let instance = 0; instance < child.count; instance++) {
      child.getMatrixAt(instance, matrix)
      matrix.premultiply(child.matrixWorld)
      for (let vertex = 0; vertex < count; vertex += 3) {
        for (let corner = 0; corner < 3; corner++) {
          const point = points[corner]!
          point.fromBufferAttribute(positions, indices?.getX(vertex + corner) ?? vertex + corner).applyMatrix4(matrix)
          projected[corner]!.set(
            ((point.x - point.y * RACE_SUN_OFFSET.x / RACE_SUN_OFFSET.y) / WORLD_SIZE + 0.5) * SIZE,
            ((point.z - point.y * RACE_SUN_OFFSET.z / RACE_SUN_OFFSET.y) / WORLD_SIZE + 0.5) * SIZE,
          )
        }
        // Ground islands, water and paving are receivers, not shadow casters.
        if (Math.max(points[0]!.y, points[1]!.y, points[2]!.y) < 0.4) continue
        const [a, b, c] = projected as [THREE.Vector2, THREE.Vector2, THREE.Vector2]
        const area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
        if (Math.abs(area) < 0.01) continue
        const minX = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x)))
        const maxX = Math.min(SIZE - 1, Math.ceil(Math.max(a.x, b.x, c.x)))
        const minY = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y)))
        const maxY = Math.min(SIZE - 1, Math.ceil(Math.max(a.y, b.y, c.y)))
        const sign = Math.sign(area)
        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            const px = x + 0.5
            const py = y + 0.5
            if (((b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x)) * sign < 0) continue
            if (((c.x - b.x) * (py - b.y) - (c.y - b.y) * (px - b.x)) * sign < 0) continue
            if (((a.x - c.x) * (py - c.y) - (a.y - c.y) * (px - c.x)) * sign < 0) continue
            mask[y * SIZE + x] = 255
          }
        }
      }
    }
  })
  // A small separable blur softens the baked edge without losing the silhouette.
  const horizontal = new Uint8Array(mask.length)
  const pixels = new Uint8Array(mask.length * 4)
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = y * SIZE + x
      horizontal[i] = (mask[y * SIZE + Math.max(0, x - 1)]! + mask[i]! * 2 + mask[y * SIZE + Math.min(SIZE - 1, x + 1)]!) / 4
    }
  }
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = y * SIZE + x
      const value = (horizontal[Math.max(0, y - 1) * SIZE + x]! + horizontal[i]! * 2 + horizontal[Math.min(SIZE - 1, y + 1) * SIZE + x]!) / 4
      pixels.set([value, value, value, 255], i * 4)
    }
  }
  const texture = new THREE.DataTexture(pixels, SIZE, SIZE)
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true

  function apply(material: THREE.MeshStandardMaterial) {
    material.onBeforeCompile = shader => {
      shader.uniforms.sceneryShadow = { value: texture }
      shader.vertexShader = 'varying vec3 vSceneryWorld;\n' + shader.vertexShader
      shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `
        vec4 sceneryWorld = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          sceneryWorld = instanceMatrix * sceneryWorld;
        #endif
        vSceneryWorld = (modelMatrix * sceneryWorld).xyz;
        #include <project_vertex>
      `)
      shader.fragmentShader = 'uniform sampler2D sceneryShadow;\nvarying vec3 vSceneryWorld;\n' + shader.fragmentShader
      shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
        vec2 shadowUv = vSceneryWorld.xz / ${WORLD_SIZE.toFixed(1)} + 0.5;
        float inBounds = step(0.0, shadowUv.x) * step(shadowUv.x, 1.0) * step(0.0, shadowUv.y) * step(shadowUv.y, 1.0);
        float groundWeight = 1.0 - smoothstep(0.45, 0.9, vSceneryWorld.y);
        float shade = texture2D(sceneryShadow, shadowUv).r * inBounds * groundWeight;
        outgoingLight *= mix(vec3(1.0), vec3(0.53, 0.59, 0.66), shade);
        #include <opaque_fragment>
      `)
    }
    material.customProgramCacheKey = () => 'circuit-static-shadows-v1'
    material.needsUpdate = true
  }
  return { texture, apply, dispose: () => texture.dispose() }
}
