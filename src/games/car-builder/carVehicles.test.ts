import { readFile } from 'node:fs/promises'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { beforeAll, describe, expect, test } from 'vitest'
import {
  CAR_VEHICLES,
  CAR_VEHICLE_ORDER,
  carVehicleModelUrl,
  hasBuiltInPoliceLight,
  isPoliceLightMaterial,
  type CarVehicleId,
} from './carVehicles'

/**
 * カタログの数値は「GLBから測った値」であることが前提なので、
 * 実ファイルを読んで突き合わせる。GLBを作り直したのにカタログを更新し忘れた、
 * ボディカラー用のマテリアルが消えた、といった事故をここで止める。
 */
type LoadedModel = {
  scene: THREE.Object3D
  materialNames: string[]
  meshNames: string[]
  box: THREE.Box3
  bytes: number
}

const models = new Map<CarVehicleId, LoadedModel>()

async function loadModel(id: CarVehicleId): Promise<LoadedModel> {
  const file = await readFile(`public/models/car-builder/${CAR_VEHICLES[id].modelFile}`)
  const bytes = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer
  const gltf = await new GLTFLoader().parseAsync(bytes, '')
  const materialNames: string[] = []
  const meshNames: string[] = []
  gltf.scene.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (mesh.isMesh !== true) return
    meshNames.push(mesh.name)
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const material of materials) materialNames.push(material.name)
  })
  return {
    scene: gltf.scene,
    materialNames,
    meshNames,
    box: new THREE.Box3().setFromObject(gltf.scene),
    bytes: file.byteLength,
  }
}

beforeAll(async () => {
  for (const id of CAR_VEHICLE_ORDER) models.set(id, await loadModel(id))
})

describe('採用車種カタログ', () => {
  test('Phase 1 で採用した7車種だけを持ち、IDと並び順が一致する', () => {
    expect(CAR_VEHICLE_ORDER).toHaveLength(7)
    expect([...CAR_VEHICLE_ORDER].sort()).toEqual(Object.keys(CAR_VEHICLES).sort())
    for (const id of CAR_VEHICLE_ORDER) expect(CAR_VEHICLES[id].id).toBe(id)
  })

  test('出典（Pack名・元モデル名）が全車種に残っている', () => {
    for (const id of CAR_VEHICLE_ORDER) {
      const { source } = CAR_VEHICLES[id]
      expect(source.pack, id).toMatch(/^(Cars Pack|Public Transport Pack)$/)
      expect(source.model.length, id).toBeGreaterThan(0)
    }
    // 元モデルを使い回していないこと（同じ車体の水増しをしない）。
    const sources = CAR_VEHICLE_ORDER.map((id) => CAR_VEHICLES[id].source.model)
    expect(new Set(sources).size).toBe(sources.length)
  })

  test('モデルURLがローカルの public 配下を指す（実行時に外部から取得しない）', () => {
    for (const id of CAR_VEHICLE_ORDER) {
      const url = carVehicleModelUrl(id)
      expect(url, id).toBe(`/models/car-builder/${CAR_VEHICLES[id].modelFile}`)
      expect(url, id).not.toMatch(/^https?:/)
    }
  })
})

describe('GLB実ファイルとの整合', () => {
  test.each(CAR_VEHICLE_ORDER)('%s: カタログのマテリアル一覧がGLBと一致する', (id) => {
    const model = models.get(id)!
    expect(new Set(model.materialNames)).toEqual(new Set(CAR_VEHICLES[id].materials))
  })

  test.each(CAR_VEHICLE_ORDER)('%s: ボディカラー用のマテリアルを必ず持つ', (id) => {
    expect(CAR_VEHICLES[id].materials).toContain('Body')
  })

  test.each(CAR_VEHICLE_ORDER)('%s: 元タイヤがGLBへ残っていない', (id) => {
    const model = models.get(id)!
    for (const name of model.meshNames) expect(name.toLowerCase(), id).not.toContain('wheel')
    // 元タイヤのマテリアル（Cars Pack の Grey/Black リム）も残さない。
    expect(model.materialNames).not.toContain('Wheel')
    expect(model.materialNames).not.toContain('Material')
  })

  test.each(CAR_VEHICLE_ORDER)('%s: 向き・接地・左右中心が揃っている', (id) => {
    const model = models.get(id)!
    const vehicle = CAR_VEHICLES[id]
    // 接地面 y=0 より下へ出ない。
    expect(model.box.min.y, id).toBeGreaterThanOrEqual(0)
    // 左右・前後の中心が原点。
    expect((model.box.min.x + model.box.max.x) / 2, id).toBeCloseTo(0, 2)
    expect((model.box.min.z + model.box.max.z) / 2, id).toBeCloseTo(0, 2)
    // カタログの実測値がGLBと一致する。
    expect(model.box.max.x - model.box.min.x, id).toBeCloseTo(vehicle.size.width, 2)
    expect(model.box.max.z - model.box.min.z, id).toBeCloseTo(vehicle.size.length, 2)
    expect(model.box.max.y - model.box.min.y, id).toBeCloseTo(vehicle.size.height, 2)
    expect(model.box.min.y, id).toBeCloseTo(vehicle.bodyFloor, 2)
  })

  test.each(CAR_VEHICLE_ORDER)('%s: ホイールanchorが車体の内側に収まる', (id) => {
    const { wheels, size } = CAR_VEHICLES[id]
    expect(wheels.front.z, id).toBeGreaterThan(wheels.rear.z)
    expect(wheels.front.z, id).toBeLessThan(size.length / 2)
    expect(wheels.rear.z, id).toBeGreaterThan(-size.length / 2)
    for (const axle of [wheels.front, wheels.rear]) {
      expect(axle.halfTrack, id).toBeGreaterThan(0)
      expect(axle.halfTrack, id).toBeLessThanOrEqual(size.width / 2 + 0.1)
      expect(axle.radius, id).toBeGreaterThan(0)
      expect(axle.width, id).toBeGreaterThan(0)
    }
  })

  test.each(CAR_VEHICLE_ORDER)('%s: キャビン（窓）の実測が車体の中に収まる', (id) => {
    const { cabin, size, bodyFloor } = CAR_VEHICLES[id]
    expect(cabin.length, id).toBeGreaterThan(0)
    expect(cabin.length, id).toBeLessThanOrEqual(size.length)
    expect(cabin.width, id).toBeGreaterThan(0)
    expect(cabin.width, id).toBeLessThanOrEqual(size.width)
    expect(cabin.floorY, id).toBeGreaterThan(bodyFloor)
    expect(cabin.floorY, id).toBeLessThan(bodyFloor + size.height)
  })

  test('スマホでも重くならない大きさに収まっている', () => {
    for (const id of CAR_VEHICLE_ORDER) {
      const model = models.get(id)!
      // 1台あたり150KB以下。同時に表示するのは1台だけ。
      expect(model.bytes / 1024, id).toBeLessThan(150)
    }
  })
})

describe('フロント外装の取り付け基準', () => {
  test.each(CAR_VEHICLE_ORDER)(
    '%s: frontFaceZは内蔵ヘッドライト（LightFront）前面の実測値と一致する',
    (id) => {
      const model = models.get(id)!
      const vehicle = CAR_VEHICLES[id]
      model.scene.updateMatrixWorld(true)

      // 内蔵ヘッドライトは非表示にして使うが（carModel.ts）、位置はそのまま
      // フロント外装パーツの取り付け基準として実測に使う。school-bus・ambulance
      // は前後灯が同じ `LightFront` ロールを共有するため、前側（z > 0）だけを見る。
      let measuredMaxZ = -Infinity
      const point = new THREE.Vector3()
      model.scene.traverse((object) => {
        const mesh = object as THREE.Mesh
        if (mesh.isMesh !== true) return
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        if (!materials.some((material) => material.name === 'LightFront')) return
        const position = mesh.geometry.getAttribute('position')
        for (let index = 0; index < position.count; index += 1) {
          point.fromBufferAttribute(position, index).applyMatrix4(mesh.matrixWorld)
          if (point.z > 0) measuredMaxZ = Math.max(measuredMaxZ, point.z)
        }
      })

      expect(measuredMaxZ, id).toBeGreaterThan(0)
      expect(vehicle.frontFaceZ, id).toBeCloseTo(measuredMaxZ, 2)
      // 全長の最先端（バンパー角など）より必ず内側にある。ここが最先端と同じか
      // それより前に出ていると、実測値を使う意味がない（＝浮いて見える）。
      expect(vehicle.frontFaceZ, id).toBeLessThanOrEqual(vehicle.size.length / 2)
    },
  )
})

describe('特殊装備の判別', () => {
  test('パトカーだけが内蔵パトランプを持つ', () => {
    for (const id of CAR_VEHICLE_ORDER) {
      expect(hasBuiltInPoliceLight(id), id).toBe(id === 'policeCar')
    }
  })

  test('パトランプのマテリアルは接頭辞で判別できる', () => {
    const policeMaterials = CAR_VEHICLES.policeCar.materials.filter(isPoliceLightMaterial)
    expect(policeMaterials.length).toBeGreaterThan(0)
    expect(isPoliceLightMaterial('Body')).toBe(false)
    expect(isPoliceLightMaterial('LightRear')).toBe(false)
  })

  test('塗り替えても車種が分かるよう、識別用マテリアルがボディと分かれている', () => {
    // パトカーの白い塗り分け、救急車の赤帯、タクシーのルーフサイン。
    expect(CAR_VEHICLES.policeCar.materials).toContain('Accent')
    expect(CAR_VEHICLES.ambulance.materials).toContain('Accent')
    expect(CAR_VEHICLES.taxi.materials).toContain('SignPlate')
    expect(CAR_VEHICLES.taxi.materials).toContain('SignText')
  })
})
