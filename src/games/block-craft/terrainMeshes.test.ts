import * as THREE from 'three'
import { expect, it, vi } from 'vitest'
import { BLOCK_WIDTH } from './raycast'
import { createBlockGeometries, createTerrainMeshes, isBuried } from './terrainMeshes'
import { createWorld, editWorld, materialCode, MATERIALS, undoChanges, World, type Material } from './world'

it('keeps one instance per visible cell, allocates for the used meshes and updates only dirty chunks', () => {
  const grid = createWorld({ size: 64, height: 12 })
  const scene = new THREE.Scene()
  const geo = new THREE.BoxGeometry(BLOCK_WIDTH, BLOCK_WIDTH, BLOCK_WIDTH)
  const materials = MATERIALS.map(() => new THREE.MeshBasicMaterial())
  const terrain = createTerrainMeshes(scene, MATERIALS.map(() => geo), materials)
  terrain.update(grid)
  const chunks = scene.children.map(group => group.children as THREE.InstancedMesh[])
  expect(chunks).toHaveLength(16)
  const meshes = chunks.flat()
  const visible = () => [...grid.blocks()].filter(b => !isBuried(grid, b.x, b.y, b.z)).length
  const drawn = () => scene.children.flatMap(group => group.children as THREE.InstancedMesh[]).reduce((sum, mesh) => sum + mesh.count, 0)
  const count = visible()
  // じめんの したの かくれた ブロックは えがかない
  expect(count).toBeLessThan([...grid.blocks()].length / 2)
  expect(drawn()).toBe(count)
  expect(meshes.reduce((sum, mesh) => sum + mesh.instanceMatrix.array.byteLength, 0)).toBeLessThan(2 * count * 64)
  const setMatrixAt = vi.spyOn(THREE.InstancedMesh.prototype, 'setMatrixAt')
  const oldVersions = meshes.map(mesh => mesh.instanceMatrix.version)
  const changes = editWorld(grid, { x: 8, y: 3, z: 8 }, 'glass', 'place')
  expect(changes).toHaveLength(1)
  expect(terrain.update(grid)).toBe(true)
  expect(setMatrixAt.mock.instances.every(mesh => mesh instanceof THREE.InstancedMesh && chunks[0].includes(mesh))).toBe(true)
  expect(meshes.slice(chunks[0].length - 1).map(mesh => mesh.instanceMatrix.version)).toEqual(oldVersions.slice(chunks[0].length - 1))
  const glass = chunks[0].find(mesh => mesh.renderOrder === 1)!
  expect(glass.count).toBe(1)
  expect(glass.instanceMatrix.updateRanges).toEqual([{ start: 0, count: 16 }])
  const dispose = vi.spyOn(glass, 'dispose')
  undoChanges(grid, changes)
  terrain.update(grid)
  expect(dispose).toHaveBeenCalledOnce()
  expect(terrain.update(grid)).toBe(false)
  // ほると、となりの チャンクに かくれていた ブロックも みえるように なる
  const dug = editWorld(grid, [{ x: 16, y: 2, z: 20 }, { x: 16, y: 1, z: 20 }], 'stone', 'remove')
  expect(visible()).toBeGreaterThan(count)
  terrain.update(grid)
  expect(drawn()).toBe(visible())
  undoChanges(grid, dug)
  terrain.update(grid)
  expect(drawn()).toBe(count)

  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 250)
  camera.position.set(8, 6, -4)
  camera.lookAt(8, 4, 60)
  // あるく ときは とおくの チャンクを えがかない
  camera.updateMatrixWorld()
  const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse))
  terrain.setVisibility(camera, frustum, false, false)
  expect(scene.children[12].visible).toBe(true)
  terrain.setVisibility(camera, frustum, true, false)
  expect(scene.children[12].visible).toBe(false)
  expect(scene.children[4].visible).toBe(true)
  expect(scene.children[3].visible).toBe(false)
  terrain.dispose()
  expect(scene.children).toHaveLength(0)
  geo.dispose()
  for (const material of materials) material.dispose()
  setMatrixAt.mockRestore()
})

it('keeps a block visible next to see-through, passable or small blocks', () => {
  const center = { x: 8, y: 5, z: 8 }
  const around = (material: Material) => {
    const blocks = [{ ...center, material: 'gold' as Material }]
    for (const axis of ['x', 'y', 'z'] as const) for (const side of [-1, 1]) blocks.push({ ...center, [axis]: center[axis] + side, material: 'stone' })
    blocks[1] = { ...blocks[1], material }
    return new World({ size: 16, height: 12 }, blocks)
  }
  expect(isBuried(around('stone'), center.x, center.y, center.z)).toBe(true)
  for (const material of ['fence', 'door_open', 'bed', 'cake', 'torch', 'slab', 'stairs_2', 'carpet', 'flower'] as const) expect(isBuried(around(material), center.x, center.y, center.z)).toBe(false)
  expect(isBuried(around('door'), center.x, center.y, center.z)).toBe(true)
})

it('draws flowers as two crossed planes, stairs as two steps turned to face their way, and slabs half high', () => {
  const geometries = createBlockGeometries()
  const shape = (id: Material) => geometries.forMaterial[materialCode(id) - 1]
  expect(shape('flower')).toBe(geometries.cross)
  expect(shape('wheat')).toBe(geometries.cross)
  expect(shape('torch')).toBe(geometries.box)
  for (const id of ['stairs', 'stairs_1', 'stairs_2', 'stairs_3'] as const) expect(shape(id)).toBe(geometries.stairs)
  // ばってんの いたは 2まいで、どちらも たて
  const normals = geometries.cross.getAttribute('normal')
  expect(normals.count).toBe(8)
  for (let i = 0; i < normals.count; i++) expect(normals.getY(i)).toBeCloseTo(0)
  geometries.stairs.computeBoundingBox()
  expect(geometries.stairs.boundingBox!.min.toArray().map(v => v * 2 / BLOCK_WIDTH)).toEqual([-1, -1, -1].map(v => expect.closeTo(v)))
  expect(geometries.stairs.boundingBox!.max.toArray().map(v => v * 2 / BLOCK_WIDTH)).toEqual([1, 1, 1].map(v => expect.closeTo(v)))

  const scene = new THREE.Scene()
  const materials = MATERIALS.map(() => new THREE.MeshBasicMaterial())
  const terrain = createTerrainMeshes(scene, geometries.forMaterial, materials)
  terrain.update(new World({ size: 16, height: 12 }, [
    { x: 4, y: 1, z: 4, material: 'stairs' }, { x: 6, y: 1, z: 4, material: 'stairs_1' }, { x: 8, y: 1, z: 4, material: 'slab' },
  ]))
  const matrixOf = (id: Material) => {
    const mesh = scene.children[0].children.find(m => (m as THREE.InstancedMesh).material === materials[materialCode(id) - 1]) as THREE.InstancedMesh
    expect(mesh.geometry).toBe(shape(id))
    const matrix = new THREE.Matrix4()
    mesh.getMatrixAt(0, matrix)
    return matrix
  }
  // たかい ほう（+z）が むきに あわせて まわる
  const back = (id: Material) => new THREE.Vector3(0, 0, 1).transformDirection(matrixOf(id)).toArray().map(Math.round)
  expect(back('stairs')).toEqual([0, 0, 1])
  expect(back('stairs_1')).toEqual([1, 0, 0])
  // はんぶんの たかさで、じめんに つく
  const slab = new THREE.Vector3(), scale = new THREE.Vector3()
  matrixOf('slab').decompose(slab, new THREE.Quaternion(), scale)
  expect(scale.y).toBeCloseTo(0.5)
  expect(slab.y - BLOCK_WIDTH / 4).toBeCloseTo(1 - BLOCK_WIDTH / 2)
  terrain.dispose()
  geometries.dispose()
  for (const material of materials) material.dispose()
})
