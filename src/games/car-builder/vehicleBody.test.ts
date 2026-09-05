import { readFile } from 'node:fs/promises'
import * as THREE from 'three'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { CAR_VEHICLES, CAR_VEHICLE_ORDER, type CarVehicleId } from './carVehicles'
import { clearCarVehicleModelCache, loadCarVehicleBody, type CarVehicleBody } from './vehicleBody'

/**
 * 実際に配置しているGLBを読ませる。fetchだけ差し替えて、
 * 「ファイルの中身」ではなく「読み込み〜色替え〜解放」の振る舞いを見る。
 */
function stubFetchWithRealModels(): { calls: string[] } {
  const calls: string[] = []
  vi.stubGlobal('fetch', async (input: string) => {
    calls.push(String(input))
    const file = await readFile(`public${String(input)}`)
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () => file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
    }
  })
  return { calls }
}

function materialsByName(body: CarVehicleBody): Map<string, THREE.Material> {
  const found = new Map<string, THREE.Material>()
  body.object.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (mesh.isMesh !== true) return
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const material of materials) found.set(material.name, material)
  })
  return found
}

function colorOf(body: CarVehicleBody, name: string): THREE.Color {
  const material = materialsByName(body).get(name)
  if (material === undefined) throw new Error(`マテリアルがない: ${name}`)
  return (material as THREE.MeshStandardMaterial).color
}

beforeEach(() => {
  clearCarVehicleModelCache()
})

afterEach(() => {
  vi.unstubAllGlobals()
  clearCarVehicleModelCache()
})

describe('loadCarVehicleBody', () => {
  test.each(CAR_VEHICLE_ORDER)('%s のGLBを読み込んでMeshを組み立てられる', async (id) => {
    stubFetchWithRealModels()
    const body = await loadCarVehicleBody(id)
    const meshes: THREE.Mesh[] = []
    body.object.traverse((child) => {
      if ((child as THREE.Mesh).isMesh === true) meshes.push(child as THREE.Mesh)
    })
    expect(meshes.length, id).toBeGreaterThan(0)
    expect(meshes.every((mesh) => mesh.castShadow), id).toBe(true)
    expect(new Set(materialsByName(body).keys()), id).toEqual(new Set(CAR_VEHICLES[id].materials))
    body.dispose()
  })

  test('同じ車種を2回読んでも、Material / Geometry を共有しない', async () => {
    stubFetchWithRealModels()
    const first = await loadCarVehicleBody('taxi')
    const second = await loadCarVehicleBody('taxi')

    first.setBodyColor('#ff0000')
    second.setBodyColor('#0000ff')
    expect(colorOf(first, 'Body').getHexString()).not.toBe(colorOf(second, 'Body').getHexString())

    // 片方を解放しても、もう片方のGeometryは生きている。
    const secondGeometry: THREE.BufferGeometry[] = []
    second.object.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (mesh.isMesh === true) secondGeometry.push(mesh.geometry)
    })
    first.dispose()
    expect(secondGeometry.every((geometry) => geometry.attributes.position !== undefined)).toBe(true)
    second.dispose()
  })

  test('別の車種どうしでもMaterialを共有しない', async () => {
    stubFetchWithRealModels()
    const taxi = await loadCarVehicleBody('taxi')
    const suv = await loadCarVehicleBody('suv')
    taxi.setBodyColor('#00ff00')
    expect(colorOf(suv, 'Body').getHexString()).not.toBe('00ff00')
    taxi.dispose()
    suv.dispose()
  })

  test('バイト列はURL単位でキャッシュし、同じ車種の再取得で通信しない', async () => {
    const { calls } = stubFetchWithRealModels()
    const first = await loadCarVehicleBody('car')
    const second = await loadCarVehicleBody('car')
    expect(calls).toHaveLength(1)
    first.dispose()
    second.dispose()
  })

  test('取得に失敗したらrejectし、キャッシュへ残さず再試行できる', async () => {
    let attempt = 0
    vi.stubGlobal('fetch', async (input: string) => {
      attempt += 1
      if (attempt === 1) return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) }
      const file = await readFile(`public${String(input)}`)
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
      }
    })

    await expect(loadCarVehicleBody('car')).rejects.toThrow()
    const retried = await loadCarVehicleBody('car')
    expect(attempt).toBe(2)
    retried.dispose()
  })
})

describe('ボディカラー', () => {
  test('Body だけを塗り替え、識別用の色は変えない', async () => {
    stubFetchWithRealModels()
    const police = await loadCarVehicleBody('policeCar')
    const accentBefore = colorOf(police, 'Accent').getHexString()
    const blueBefore = colorOf(police, 'PoliceLightBlue').getHexString()
    const glassBefore = colorOf(police, 'Glass').getHexString()

    police.setBodyColor('#eb5b8f')

    expect(colorOf(police, 'Body').getHexString()).not.toBe('000000')
    expect(colorOf(police, 'Accent').getHexString()).toBe(accentBefore)
    expect(colorOf(police, 'PoliceLightBlue').getHexString()).toBe(blueBefore)
    expect(colorOf(police, 'Glass').getHexString()).toBe(glassBefore)
    police.dispose()
  })

  test('タクシーのルーフサインはボディカラーに追従しない', async () => {
    stubFetchWithRealModels()
    const taxi = await loadCarVehicleBody('taxi')
    const plateBefore = colorOf(taxi, 'SignPlate').getHexString()
    const textBefore = colorOf(taxi, 'SignText').getHexString()
    taxi.setBodyColor('#252a31')
    expect(colorOf(taxi, 'SignPlate').getHexString()).toBe(plateBefore)
    expect(colorOf(taxi, 'SignText').getHexString()).toBe(textBefore)
    taxi.dispose()
  })

  test('BodyLower はボディカラーを暗くした色になる', async () => {
    stubFetchWithRealModels()
    const car = await loadCarVehicleBody('car')
    car.setBodyColor('#ffffff')
    const body = colorOf(car, 'Body')
    const lower = colorOf(car, 'BodyLower')
    expect(lower.r).toBeLessThan(body.r)
    expect(lower.r).toBeGreaterThan(0)
    car.dispose()
  })

  test('塗り替えを繰り返しても最後の色だけが残る', async () => {
    stubFetchWithRealModels()
    const suv = await loadCarVehicleBody('suv')
    suv.setBodyColor('#ff0000')
    suv.setBodyColor('#3d7bf5')
    const expected = new THREE.Color('#3d7bf5')
    expect(colorOf(suv, 'Body').getHexString()).toBe(expected.getHexString())
    suv.dispose()
  })
})

describe('固有装備の表示切替', () => {
  test('パトランプをまとめて隠せる', async () => {
    stubFetchWithRealModels()
    const police = await loadCarVehicleBody('policeCar')
    const lightMeshes: THREE.Mesh[] = []
    police.object.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (mesh.isMesh !== true) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      if (materials.some((material) => material.name.startsWith('PoliceLight'))) lightMeshes.push(mesh)
    })
    expect(lightMeshes.length).toBeGreaterThan(0)

    police.setPoliceLightVisible(false)
    expect(lightMeshes.every((mesh) => mesh.visible)).toBe(false)
    police.setPoliceLightVisible(true)
    expect(lightMeshes.every((mesh) => mesh.visible)).toBe(true)
    police.dispose()
  })

  test('パトランプを持たない車種でも表示切替が例外にならない', async () => {
    stubFetchWithRealModels()
    const bus = await loadCarVehicleBody('schoolBus')
    expect(() => bus.setPoliceLightVisible(false)).not.toThrow()
    bus.dispose()
  })

  test('車体内蔵ヘッドライトを隠せる（ゲーム側フロントライトとの二重を避ける）', async () => {
    stubFetchWithRealModels()
    const suv = await loadCarVehicleBody('suv')
    const headlights: THREE.Mesh[] = []
    suv.object.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (mesh.isMesh !== true) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      if (materials.some((material) => material.name === 'LightFront')) headlights.push(mesh)
    })
    expect(headlights.length).toBeGreaterThan(0)
    suv.setHeadlightVisible(false)
    expect(headlights.every((mesh) => mesh.visible)).toBe(false)
    suv.dispose()
  })
})

describe('解放', () => {
  test('disposeでGeometryとMaterialを解放し、親から外れる', async () => {
    stubFetchWithRealModels()
    const body = await loadCarVehicleBody('ambulance')
    const parent = new THREE.Group()
    parent.add(body.object)

    const geometryDisposals: string[] = []
    const materialDisposals: string[] = []
    body.object.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (mesh.isMesh !== true) return
      vi.spyOn(mesh.geometry, 'dispose').mockImplementation(() => geometryDisposals.push(mesh.name))
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const material of materials) {
        vi.spyOn(material, 'dispose').mockImplementation(() => materialDisposals.push(material.name))
      }
    })

    body.dispose()

    expect(geometryDisposals.length).toBeGreaterThan(0)
    expect(new Set(materialDisposals)).toEqual(new Set(CAR_VEHICLES.ambulance.materials))
    expect(parent.children).toHaveLength(0)
  })
})

describe('モデルの取得先', () => {
  test('取得するURLはカタログのファイル名と一致する', async () => {
    const { calls } = stubFetchWithRealModels()
    const ids: CarVehicleId[] = ['sportsCar', 'schoolBus']
    for (const id of ids) (await loadCarVehicleBody(id)).dispose()
    expect(calls).toEqual(ids.map((id) => `/models/car-builder/${CAR_VEHICLES[id].modelFile}`))
  })
})
