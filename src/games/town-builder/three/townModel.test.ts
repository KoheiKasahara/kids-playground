import * as THREE from 'three'
import { afterEach, expect, it, vi } from 'vitest'
import { isBuildingTool, isLarge, PARTS, type BuildingId } from '../parts'
import { createMapTown, MAPS } from '../maps'
import { applyTool, COLS, createEmptyTown, ROWS, type Town } from '../town'
import { buildTownModel } from './townModel'

afterEach(() => vi.restoreAllMocks())

const BUILDINGS = PARTS.map((part) => part.id).filter((id): id is BuildingId => isBuildingTool(id))

const at = (col: number, row: number) => row * COLS + col

/** ぜんぶの たてものを ならべ、はし・ふみきり・つながって いない いえ も ある まち。 */
function everythingTown(): Town {
  let town = createEmptyTown()
  const small = BUILDINGS.filter((id) => !isLarge(id))
  const squares = BUILDINGS.filter((id) => isLarge(id) && PARTS.find((part) => part.id === id)?.size?.[1] === 2)
  const wides = BUILDINGS.filter((id) => isLarge(id) && PARTS.find((part) => part.id === id)?.size?.[1] === 1)
  // 1マスの もの（0・2 ぎょうめ と 6 ぎょうめの のこり）、2×2（4〜5 ぎょうめ）、よこ 2マス（6 ぎょうめ）。
  small.forEach((id, n) => { town = applyTool(town, n < 28 ? at(n % COLS, n < COLS ? 0 : 2) : at(8 + n - 28, 6), id) })
  squares.forEach((id, n) => { town = applyTool(town, at(n * 2, 4), id) })
  wides.forEach((id, n) => { town = applyTool(town, at(n * 2, 6), id) })
  for (const row of [1, 3, 7]) for (let col = 0; col < COLS; col += 1) town = applyTool(town, at(col, row), 'road')
  for (let col = 0; col < COLS; col += 1) town = applyTool(town, at(col, 8), 'water')
  for (let col = 0; col < COLS; col += 1) town = applyTool(town, at(col, 10), 'rail')
  for (let row = 7; row < 13; row += 1) town = applyTool(town, at(12, row), 'road')
  for (let row = 8; row < 13; row += 1) town = applyTool(town, at(6, row), 'rail')
  for (let row = 9; row < 12; row += 1) town = applyTool(town, at(2, row), 'road')
  // ちずの すみの いえは みちに つながって いない（よるも まどが くらい）。
  return applyTool(town, ROWS * COLS - 1, 'house')
}

function meshCount(root: THREE.Object3D): number {
  let count = 0
  root.traverse((object) => { if ((object as THREE.Mesh).isMesh) count += 1 })
  return count
}

function meshes(root: THREE.Object3D): THREE.Mesh[] {
  const found: THREE.Mesh[] = []
  root.traverse((object) => { if ((object as THREE.Mesh).isMesh) found.push(object as THREE.Mesh) })
  return found
}

it('builds every kind of part on the board, with bridges, crossings and moving parts', () => {
  const town = everythingTown()
  for (const id of BUILDINGS) expect(town.some((tile) => tile.part === id), id).toBe(true)
  const model = buildTownModel(town)
  const statics = model.root.getObjectByName('town-static')!
  // うごかない ものは いろが ちがっても まとめるので、えがく かいすうは ざいりょうの しゅるい ぶん だけ。
  expect(statics.children.length).toBeGreaterThan(3)
  expect(statics.children.length).toBeLessThan(20)
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
  // ランプは ひだり・みぎの くみごとに 1つ（こうごに ひかる）。
  expect(model.crossings.every((crossing) => crossing.lamps.length === 2)).toBe(true)

  // かんらんしゃ・ふうしゃ・ふんすい・けむり・プロペラ・とうだい・たきび・メリーゴーランド・ロケット・ジェットコースターが うごく。
  expect(model.ticks).toHaveLength(10)
  for (const id of ['ferris', 'windmill', 'fountain', 'factory', 'heliport', 'lighthouse', 'camp', 'merry', 'rocket', 'coaster']) {
    expect(model.root.getObjectByName(`${id}-motion`), id).toBeDefined()
  }
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
  const instancedDispose = vi.spyOn(THREE.InstancedMesh.prototype, 'dispose')
  const model = buildTownModel(everythingTown())
  const used = meshes(model.root)
  const geometries = new Set(used.map((mesh) => mesh.geometry))
  const materials = new Set(used.map((mesh) => mesh.material as THREE.Material))
  const instanced = used.filter((mesh) => (mesh as THREE.InstancedMesh).isInstancedMesh)
  expect(instanced.length).toBeGreaterThan(0)
  geometryDispose.mockClear()
  materialDispose.mockClear()
  instancedDispose.mockClear()

  model.dispose()
  const freedGeometries = new Set(geometryDispose.mock.contexts)
  const freedMaterials = new Set(materialDispose.mock.contexts)
  const freedInstanced = new Set(instancedDispose.mock.contexts)
  for (const geometry of geometries) expect(freedGeometries.has(geometry)).toBe(true)
  for (const material of materials) expect(freedMaterials.has(material)).toBe(true)
  for (const mesh of instanced) expect(freedInstanced.has(mesh)).toBe(true)
  expect(model.root.children).toHaveLength(0)
})

it('draws buildings placed bigger at the bigger size, centred on their cells', () => {
  const small = buildTownModel(applyTool(createEmptyTown(), at(4, 4), 'house'))
  const big = buildTownModel(applyTool(createEmptyTown(), at(4, 4), 'house', 3))
  const height = (model: ReturnType<typeof buildTownModel>) => new THREE.Box3().setFromObject(model.root.getObjectByName('town-static')!).max.y
  expect(height(big)).toBeGreaterThan(height(small) * 2.5)
  small.dispose()
  big.dispose()
})

it.each(MAPS.map((map) => [map.id]))('keeps the %s map light to draw: few meshes for the whole town', (id) => {
  const model = buildTownModel(createMapTown(id))
  // まち ぜんぶ（うごく もの・ふみきりの ランプ を ふくむ）でも Mesh は すくない。
  expect(meshCount(model.root)).toBeLessThan(60)
  model.dispose()
})
