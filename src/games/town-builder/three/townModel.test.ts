import * as THREE from 'three'
import { afterEach, expect, it, vi } from 'vitest'
import { isBuilding, PARTS, type BuildingId } from '../parts'
import { applyTool, COLS, createEmptyTown, createTown, ROWS, type Town } from '../town'
import { buildTownModel } from './townModel'

afterEach(() => vi.restoreAllMocks())

const BUILDINGS = PARTS.map((part) => part.id).filter((id): id is BuildingId => isBuilding(id as BuildingId))

/** ぜんぶの たてものを みちぞいに ならべ、はし・ふみきり・つながって いない いえ も ある まち。 */
function everythingTown(): Town {
  let town = createEmptyTown()
  BUILDINGS.forEach((id, n) => {
    const row = n < COLS ? 0 : 2
    town = applyTool(town, row * COLS + (n % COLS), id)
  })
  for (let col = 0; col < COLS; col += 1) town = applyTool(town, COLS + col, 'road')
  for (let col = 0; col < COLS; col += 1) town = applyTool(town, 4 * COLS + col, 'water')
  for (let row = 1; row < 9; row += 1) town = applyTool(town, row * COLS + 12, 'road')
  for (let row = 3; row < 9; row += 1) town = applyTool(town, row * COLS + 6, 'rail')
  for (let col = 0; col < COLS; col += 1) town = applyTool(town, 6 * COLS + col, 'rail')
  for (let row = 5; row < 8; row += 1) town = applyTool(town, row * COLS + 2, 'road')
  // ちずの すみの いえは みちに つながって いない（よるも まどが くらい）。
  return applyTool(town, ROWS * COLS - 1, 'house')
}

function meshes(root: THREE.Object3D): THREE.Mesh[] {
  const found: THREE.Mesh[] = []
  root.traverse((object) => { if ((object as THREE.Mesh).isMesh) found.push(object as THREE.Mesh) })
  return found
}

it('builds every kind of part on the board, with bridges, crossings and moving parts', () => {
  const town = everythingTown()
  const model = buildTownModel(town)
  const statics = model.root.getObjectByName('town-static')!
  expect(statics.children.length).toBeGreaterThan(20)
  for (const mesh of statics.children as THREE.Mesh[]) {
    expect(mesh.geometry.getAttribute('position').count).toBeGreaterThan(0)
    expect(mesh.geometry.getAttribute('normal')).toBeDefined()
  }

  // ちずの はばに おさまり、いちばん たかい タワーマンションが そびえる。
  const box = new THREE.Box3().setFromObject(model.root)
  expect(box.min.x).toBeGreaterThanOrEqual(-COLS / 2 - 0.01)
  expect(box.max.z).toBeLessThanOrEqual(ROWS / 2 + 0.01)
  expect(box.max.y).toBeGreaterThan(2.2)
  expect(box.max.y).toBeLessThan(3)

  const crossings = town.filter((tile) => tile.part === 'crossing').length
  expect(crossings).toBeGreaterThan(1)
  expect(model.crossings).toHaveLength(crossings)
  expect(model.crossings.every((crossing) => crossing.lamps.length === 4)).toBe(true)

  // かんらんしゃ・ふうしゃ・ふんすい・こうじょうの けむりが うごく。
  expect(model.ticks).toHaveLength(4)
  const wheel = model.root.getObjectByName('ferris-motion')!.children[0]
  const blades = model.root.getObjectByName('windmill-motion')!.children[0]
  model.ticks.forEach((tick) => tick(0))
  const before = [wheel.rotation.z, blades.rotation.z]
  model.ticks.forEach((tick) => tick(2.5))
  expect([wheel.rotation.z, blades.rotation.z]).not.toEqual(before)
  model.dispose()
})

it('lights windows and street lamps at night, but not in houses without a road', () => {
  const model = buildTownModel(everythingTown())
  const materials = new Set(meshes(model.root).map((mesh) => mesh.material as THREE.Material))
  const lit = model.kit.glow('window') as THREE.MeshStandardMaterial
  const dark = model.kit.glow('windowOff') as THREE.MeshStandardMaterial
  expect(materials.has(lit)).toBe(true)
  expect(materials.has(dark)).toBe(true)
  expect(materials.has(model.pool)).toBe(true)

  model.setNight(0)
  expect(lit.emissiveIntensity).toBe(0)
  expect(model.pool.visible).toBe(false)
  model.setNight(1)
  expect(lit.emissiveIntensity).toBeGreaterThan(1)
  expect(dark.emissiveIntensity).toBe(0)
  expect(model.pool.visible).toBe(true)
  expect(model.pool.opacity).toBeGreaterThan(0.3)
  model.dispose()
})

it('frees every geometry and material when it is thrown away', () => {
  const geometryDispose = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose')
  const materialDispose = vi.spyOn(THREE.Material.prototype, 'dispose')
  const model = buildTownModel(createTown())
  const used = meshes(model.root)
  const geometries = new Set(used.map((mesh) => mesh.geometry))
  const materials = new Set(used.map((mesh) => mesh.material as THREE.Material))
  geometryDispose.mockClear()
  materialDispose.mockClear()

  model.dispose()
  const freedGeometries = new Set(geometryDispose.mock.contexts)
  const freedMaterials = new Set(materialDispose.mock.contexts)
  for (const geometry of geometries) expect(freedGeometries.has(geometry)).toBe(true)
  for (const material of materials) expect(freedMaterials.has(material)).toBe(true)
  expect(model.root.children).toHaveLength(0)
})
