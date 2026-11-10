import * as THREE from 'three'
import { expect, it, vi } from 'vitest'
import { BLOCK_WIDTH } from './raycast'
import { createTerrainMeshes } from './terrainMeshes'
import { createWorld, editWorld, MATERIALS, undoChanges } from './world'

it('keeps one instance per occupied cell, allocates for the used meshes and updates only dirty chunks', () => {
  const grid = createWorld({ size: 64, height: 12 })
  const scene = new THREE.Scene()
  const geo = new THREE.BoxGeometry(BLOCK_WIDTH, BLOCK_WIDTH, BLOCK_WIDTH)
  const materials = MATERIALS.map(() => new THREE.MeshBasicMaterial())
  const terrain = createTerrainMeshes(scene, geo, materials)
  terrain.update(grid)
  const chunks = scene.children.map(group => group.children as THREE.InstancedMesh[])
  expect(chunks).toHaveLength(16)
  const meshes = chunks.flat()
  const count = [...grid.blocks()].length
  expect(meshes.reduce((sum, mesh) => sum + mesh.count, 0)).toBe(count)
  expect(meshes.reduce((sum, mesh) => sum + mesh.instanceMatrix.array.byteLength, 0)).toBeLessThan(2 * count * 64)
  const setMatrixAt = vi.spyOn(THREE.InstancedMesh.prototype, 'setMatrixAt')
  const oldVersions = meshes.map(mesh => mesh.instanceMatrix.version)
  const changes = editWorld(grid, { x: 15, y: 3, z: 15 }, 'glass', 'place')
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

  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 250)
  camera.position.set(8, 6, 8)
  camera.lookAt(8, 4, 60)
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
