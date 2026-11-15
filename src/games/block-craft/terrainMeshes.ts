import * as THREE from 'three'
import { PLANT_WIDTH_SCALE, plantCenterY } from './raycast'
import { definitionAt, materialCode, MATERIAL_DEFS, type Changes, type World } from './world'

export const CHUNK_SIZE = 16
export const WALK_DRAW_DISTANCE = 48
/** Matches the view-space depth used by Three's fog shader. */
export function viewDepth(camera: THREE.Camera, x: number, y: number, z: number) {
  const m = camera.matrixWorldInverse.elements
  return -(m[2] * x + m[6] * y + m[10] * z + m[14])
}
const water = materialCode('water') - 1
const lava = materialCode('lava') - 1
const lamp = materialCode('lamp') - 1

/** まわりを すきまなく かくす ブロック（くさばな・すける ブロックは かくさない）。 */
const SOLID = Uint8Array.from([0, ...MATERIAL_DEFS.map(m => Number(!m.plant && m.opacity === undefined))])
const SIDES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, -1]] as const
/** 6めんとも ブロックに かこまれて、どこからも みえない。せかいの そこは みえない ものと する。 */
export function isBuried(world: World, x: number, y: number, z: number) {
  if (y > 0 && !SOLID[world.codeAt(x, y - 1, z)]) return false
  return SIDES.every(([dx, dy, dz]) => SOLID[world.codeAt(x + dx, y + dy, z + dz)])
}

type Chunk = {
  group: THREE.Group
  meshes: (THREE.InstancedMesh | undefined)[]
  bounds: THREE.Box3
}

/** Draws every cell with an exposed face. Buried cells get their geometry back when a neighbour is dug out. */
export function createTerrainMeshes(scene: THREE.Scene, geometry: THREE.BoxGeometry, materials: readonly THREE.Material[]) {
  const chunks = new Map<number, Chunk>()
  const dirty = new Set<number>()
  const counts = new Uint32Array(materials.length)
  const matrix = new THREE.Matrix4()
  let world: World | undefined
  let span = 0
  let unsubscribe: (() => void) | undefined
  const markCell = (x: number, z: number) => {
    if (x >= 0 && z >= 0 && x < span * CHUNK_SIZE && z < span * CHUNK_SIZE) dirty.add(Math.floor(x / CHUNK_SIZE) + Math.floor(z / CHUNK_SIZE) * span)
  }
  const mark = (changes: Changes) => {
    for (const { x, z } of changes) {
      // となりの チャンクの ブロックが みえるように なることが ある
      markCell(x, z); markCell(x + 1, z); markCell(x - 1, z); markCell(x, z + 1); markCell(x, z - 1)
    }
  }

  const dispose = () => {
    unsubscribe?.()
    unsubscribe = undefined
    for (const chunk of chunks.values()) {
      for (const mesh of chunk.meshes) mesh?.dispose()
      scene.remove(chunk.group)
    }
    chunks.clear()
    dirty.clear()
    world = undefined
  }

  const rebuild = (grid: World, key: number) => {
    const x0 = key % span * CHUNK_SIZE, z0 = Math.floor(key / span) * CHUNK_SIZE
    const x1 = Math.min(grid.size, x0 + CHUNK_SIZE), z1 = Math.min(grid.size, z0 + CHUNK_SIZE)
    const visit = (block: (x: number, y: number, z: number, code: number) => void) => {
      for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) {
        const top = grid.topY(x, z)
        for (let y = 0; y <= top; y++) {
          const code = grid.codeAt(x, y, z)
          if (code && !(SOLID[code] && isBuried(grid, x, y, z))) block(x, y, z, code)
        }
      }
    }
    let top = 0
    counts.fill(0)
    visit((_x, y, _z, code) => { counts[code - 1]++; top = Math.max(top, y) })
    let chunk = chunks.get(key)
    if (!chunk) {
      chunk = { group: new THREE.Group(), meshes: [], bounds: new THREE.Box3() }
      chunks.set(key, chunk)
      scene.add(chunk.group)
    }
    const { group, meshes, bounds } = chunk
    bounds.min.set(x0 - 0.5, -0.5, z0 - 0.5)
    bounds.max.set(x1 - 0.5, top + 0.5, z1 - 0.5)
    for (let i = 0; i < materials.length; i++) {
      const mesh = meshes[i]
      if (mesh && (!counts[i] || counts[i] > mesh.instanceMatrix.count)) {
        group.remove(mesh)
        mesh.dispose()
        meshes[i] = undefined
      }
      if (!counts[i]) continue
      if (!meshes[i]) {
        const capacity = 2 ** Math.ceil(Math.log2(counts[i]))
        const added = new THREE.InstancedMesh(geometry, materials[i], capacity)
        added.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
        if (definitionAt(i + 1).opacity !== undefined) added.renderOrder = 1
        meshes[i] = added
        group.add(added)
      }
      meshes[i]!.count = 0
    }
    visit((x, y, z, code) => {
      const mesh = meshes[code - 1]!
      const { plant, height = 0.6 } = definitionAt(code)
      if (plant) matrix.makeScale(PLANT_WIDTH_SCALE, height, PLANT_WIDTH_SCALE).setPosition(x, plantCenterY(y, height), z)
      else matrix.makeTranslation(x, y, z)
      mesh.setMatrixAt(mesh.count++, matrix)
    })
    for (const mesh of meshes) {
      if (!mesh) continue
      mesh.instanceMatrix.clearUpdateRanges()
      mesh.instanceMatrix.addUpdateRange(0, mesh.count * 16)
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
    }
  }

  return {
    update(grid: World) {
      if (world !== grid) {
        dispose()
        world = grid
        span = Math.ceil(grid.size / CHUNK_SIZE)
        for (let key = 0; key < span ** 2; key++) dirty.add(key)
        unsubscribe = grid.subscribe(mark)
      }
      for (const key of dirty) rebuild(grid, key)
      const changed = dirty.size > 0
      dirty.clear()
      return changed
    },
    /** Uses a shared box for chunk culling; Three also culls each material mesh. */
    setVisibility(camera: THREE.Camera, frustum: THREE.Frustum, walking: boolean, night: boolean) {
      let animated = false
      const m = camera.matrixWorldInverse.elements
      for (const { group, meshes, bounds } of chunks.values()) {
        const { min, max } = bounds
        // Cull only when even the nearest corner is fully fogged.
        const near = viewDepth(camera, m[2] > 0 ? max.x : min.x, m[6] > 0 ? max.y : min.y, m[10] > 0 ? max.z : min.z)
        group.visible = (!walking || near <= WALK_DRAW_DISTANCE) && frustum.intersectsBox(bounds)
        if (group.visible && (meshes[water] || meshes[lava] || (night && meshes[lamp]))) animated = true
      }
      return animated
    },
    dispose,
  }
}
