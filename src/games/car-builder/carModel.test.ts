import * as THREE from 'three'
import { describe, expect, test, vi } from 'vitest'
import {
  CAR_CATEGORIES,
  CAR_CATEGORY_ORDER,
  DEFAULT_CAR_CONFIG,
  selectCarOption,
  type CarCategoryId,
} from './carConfig'
import { computeCarDimensions } from './carDimensions'
import { CAR_DERIVED_CATEGORY_IDS, CAR_PART_BUILDERS, CAR_PART_CATEGORY_IDS } from './carParts'
import { createCarModel } from './carModel'

function layerOf(root: THREE.Object3D, category: string): THREE.Object3D {
  const layer = root.children.find((child) => child.name === 'car-layer-' + category)
  if (layer === undefined) throw new Error('レイヤーが見つかりません: ' + category)
  return layer
}

function boundsOf(object: THREE.Object3D): THREE.Box3 {
  return new THREE.Box3().setFromObject(object)
}

describe('カテゴリと3D生成の対応（後続カテゴリ追加時の落とし穴を防ぐ契約）', () => {
  test('全カテゴリが「見た目を持つ」か「他パーツの入力になる」のどちらかに必ず属する', () => {
    const covered = [...CAR_PART_CATEGORY_IDS, ...CAR_DERIVED_CATEGORY_IDS] as CarCategoryId[]
    expect([...covered].sort()).toEqual([...CAR_CATEGORY_ORDER].sort())
    expect(new Set(covered).size).toBe(covered.length)
  })

  test('見た目を持つカテゴリは、全選択肢に生成関数が登録されている', () => {
    for (const category of CAR_PART_CATEGORY_IDS) {
      const builders = CAR_PART_BUILDERS[category] as Record<string, unknown>
      for (const option of CAR_CATEGORIES[category].options) {
        expect(typeof builders[option.id], category + '/' + option.id).toBe('function')
      }
    }
  })
})

describe('createCarModel（3Dモデル生成）', () => {
  test('カテゴリごとに独立したレイヤーを持つ（1つの巨大Meshにしない）', () => {
    const model = createCarModel(DEFAULT_CAR_CONFIG)
    const names = model.root.children.map((child) => child.name)
    for (const category of CAR_PART_CATEGORY_IDS) {
      expect(names).toContain('car-layer-' + category)
    }
    model.dispose()
  })

  test('初期状態でボディとタイヤが生成され、「なし」のカテゴリは空のまま', () => {
    const model = createCarModel(DEFAULT_CAR_CONFIG)
    expect(layerOf(model.root, 'body').children.length).toBeGreaterThan(0)
    expect(layerOf(model.root, 'wheel').children.length).toBeGreaterThan(0)
    expect(layerOf(model.root, 'roof').children).toHaveLength(0)
    expect(layerOf(model.root, 'decoration').children).toHaveLength(0)
    expect(layerOf(model.root, 'mark').children).toHaveLength(0)
    model.dispose()
  })

  test('ボディ5種類はそれぞれ複数の造形パーツを持ち、有限の範囲に収まる', () => {
    for (const option of CAR_CATEGORIES.body.options) {
      const config = selectCarOption(DEFAULT_CAR_CONFIG, 'body', option.id)
      const model = createCarModel(config)
      const body = layerOf(model.root, 'body').children[0]
      if (body === undefined) throw new Error('ボディが生成されていません: ' + option.id)
      const bounds = boundsOf(body)
      expect(body.children.length, option.id).toBeGreaterThanOrEqual(3)
      expect(bounds.min.y, option.id).toBeGreaterThanOrEqual(-0.01)
      expect(
        [bounds.min.x, bounds.min.y, bounds.min.z, bounds.max.x, bounds.max.y, bounds.max.z].every(Number.isFinite),
        option.id,
      ).toBe(true)
      model.dispose()
    }
  })

  test('スポーツカーは窓・前面・フェンダーの専用造形を持つ', () => {
    const model = createCarModel(DEFAULT_CAR_CONFIG)
    const body = layerOf(model.root, 'body')
    const wheel = layerOf(model.root, 'wheel')

    for (const name of [
      'car-body-hull',
      'car-body-cabin-shell',
      'car-sports-windshield',
      'car-sports-side-window-rear-left',
      'car-sports-side-window-front-left',
      'car-sports-side-window-rear-right',
      'car-sports-side-window-front-right',
      'car-sports-front-grille',
      'car-sports-front-splitter',
      'car-sports-rear-deck',
      'car-sports-wheel-arch-frontLeft',
      'car-sports-wheel-arch-frontRight',
      'car-sports-wheel-arch-rearLeft',
      'car-sports-wheel-arch-rearRight',
    ]) {
      expect(body.getObjectByName(name), name).toBeDefined()
    }

    expect(wheel.getObjectByName('car-sports-rim-ring-frontLeft')).toBeDefined()
    expect(wheel.getObjectByName('car-sports-center-cap-frontLeft')).toBeDefined()

    const suv = createCarModel(selectCarOption(DEFAULT_CAR_CONFIG, 'body', 'suv'))
    expect(layerOf(suv.root, 'body').getObjectByName('car-sports-windshield')).toBeUndefined()
    expect(layerOf(suv.root, 'wheel').getObjectByName('car-sports-rim-ring-frontLeft')).toBeUndefined()
    suv.dispose()
    model.dispose()
  })

  test('タイヤは4輪が寸法どおりの位置に生成される', () => {
    const model = createCarModel(DEFAULT_CAR_CONFIG)
    const dimensions = computeCarDimensions(DEFAULT_CAR_CONFIG)
    const tires = layerOf(model.root, 'wheel').children[0]!.children.filter(
      (child) => (child as THREE.Mesh).geometry instanceof THREE.CylinderGeometry,
    )
    // タイヤ本体とホイールで2つずつ、計8メッシュ。
    expect(tires).toHaveLength(8)
    for (const tire of tires) {
      expect(tire.position.y).toBeCloseTo(dimensions.wheelRadius, 5)
    }
    model.dispose()
  })

  test('5種類すべてで車全体が地面より上にあり、地面へ潜っていない', () => {
    for (const option of CAR_CATEGORIES.body.options) {
      const model = createCarModel(selectCarOption(DEFAULT_CAR_CONFIG, 'body', option.id))
      const bounds = boundsOf(model.root)
      expect(bounds.min.y, option.id).toBeGreaterThanOrEqual(-0.01)
      model.dispose()
    }
  })
})

describe('CarConfigの反映', () => {
  test('屋根パーツはルーフ天面に乗り、宙に浮かない（5ボディすべてで同じ）', () => {
    for (const option of CAR_CATEGORIES.body.options) {
      const config = selectCarOption(
        selectCarOption(DEFAULT_CAR_CONFIG, 'body', option.id),
        'roof',
        'carrier',
      )
      const model = createCarModel(config)
      const dimensions = computeCarDimensions(config)
      const bounds = boundsOf(layerOf(model.root, 'roof'))
      expect(bounds.min.y, option.id).toBeCloseTo(dimensions.roofTopY, 2)
      model.dispose()
    }
  })

  test('フロントパーツは車体の前端より前に出る', () => {
    const model = createCarModel(DEFAULT_CAR_CONFIG)
    const dimensions = computeCarDimensions(DEFAULT_CAR_CONFIG)
    const bounds = boundsOf(layerOf(model.root, 'front'))
    expect(bounds.max.z).toBeGreaterThan(dimensions.length / 2)
    model.dispose()
  })

  test('車高を変えると、屋根パーツも寸法に追従して持ち上がる（パーツ側の個別修正が要らない）', () => {
    const base = selectCarOption(DEFAULT_CAR_CONFIG, 'roof', 'carrier')
    const model = createCarModel(base)
    const before = boundsOf(layerOf(model.root, 'roof')).min.y
    model.update(selectCarOption(base, 'rideHeight', 'high'))
    const after = boundsOf(layerOf(model.root, 'roof')).min.y
    expect(after).toBeGreaterThan(before)
    expect(after).toBeCloseTo(computeCarDimensions(selectCarOption(base, 'rideHeight', 'high')).roofTopY, 2)
    model.dispose()
  })

  test('1カテゴリだけ変えたときは、そのレイヤーだけを作り直す', () => {
    const model = createCarModel(DEFAULT_CAR_CONFIG)
    const bodyPart = layerOf(model.root, 'body').children[0]
    const wheelPart = layerOf(model.root, 'wheel').children[0]

    model.update(selectCarOption(DEFAULT_CAR_CONFIG, 'decoration', 'star'))

    expect(layerOf(model.root, 'decoration').children.length).toBeGreaterThan(0)
    expect(layerOf(model.root, 'body').children[0]).toBe(bodyPart)
    expect(layerOf(model.root, 'wheel').children[0]).toBe(wheelPart)
    model.dispose()
  })

  test('寸法が変わるカテゴリ（タイヤ）を変えると、他のパーツも作り直して追従する', () => {
    const config = selectCarOption(DEFAULT_CAR_CONFIG, 'roof', 'carrier')
    const model = createCarModel(config)
    const bodyPart = layerOf(model.root, 'body').children[0]

    model.update(selectCarOption(config, 'wheel', 'big'))

    expect(layerOf(model.root, 'body').children[0]).not.toBe(bodyPart)
    expect(model.getDimensions().wheelRadius).toBe(computeCarDimensions(selectCarOption(config, 'wheel', 'big')).wheelRadius)
    model.dispose()
  })

  test('カラー変更がボディのmaterialへ反映される', () => {
    const model = createCarModel(DEFAULT_CAR_CONFIG)
    const colorOf = () => {
      const hull = layerOf(model.root, 'body').children[0]!.children[0] as THREE.Mesh
      return (hull.material as THREE.MeshStandardMaterial).color.getHexString()
    }
    const before = colorOf()
    model.update(selectCarOption(DEFAULT_CAR_CONFIG, 'color', 'blue'))
    expect(colorOf()).not.toBe(before)
    model.dispose()
  })

  test('「なし」へ戻すとパーツが取り除かれる', () => {
    const model = createCarModel(selectCarOption(DEFAULT_CAR_CONFIG, 'mark', 'plate'))
    expect(layerOf(model.root, 'mark').children.length).toBeGreaterThan(0)
    model.update(DEFAULT_CAR_CONFIG)
    expect(layerOf(model.root, 'mark').children).toHaveLength(0)
    model.dispose()
  })

  test('複数カテゴリの変更が同時に保たれる（CarConfig全体が反映される）', () => {
    const model = createCarModel(DEFAULT_CAR_CONFIG)
    let config = selectCarOption(DEFAULT_CAR_CONFIG, 'color', 'yellow')
    config = selectCarOption(config, 'roof', 'carrier')
    config = selectCarOption(config, 'decoration', 'star')
    model.update(config)

    expect(layerOf(model.root, 'roof').children.length).toBeGreaterThan(0)
    expect(layerOf(model.root, 'decoration').children.length).toBeGreaterThan(0)
    const hull = layerOf(model.root, 'body').children[0]!.children[0] as THREE.Mesh
    expect((hull.material as THREE.MeshStandardMaterial).color.getHexString()).toBe('ffc531')
    model.dispose()
  })
})

describe('three.jsリソースの解放', () => {
  test('レイヤーを差し替えたとき、古いgeometry/materialがdisposeされる', () => {
    const config = selectCarOption(DEFAULT_CAR_CONFIG, 'roof', 'carrier')
    const model = createCarModel(config)
    const spies = collectDisposeSpies(layerOf(model.root, 'roof'))
    expect(spies.length).toBeGreaterThan(0)

    model.update(DEFAULT_CAR_CONFIG)

    for (const spy of spies) expect(spy).toHaveBeenCalled()
    model.dispose()
  })

  test('disposeで全レイヤーのリソースが解放され、ルートが空になる', () => {
    const model = createCarModel(selectCarOption(DEFAULT_CAR_CONFIG, 'roof', 'carrier'))
    const spies = collectDisposeSpies(model.root)
    expect(spies.length).toBeGreaterThan(0)

    model.dispose()

    for (const spy of spies) expect(spy).toHaveBeenCalled()
    expect(model.root.children).toHaveLength(0)
  })
})

function collectDisposeSpies(root: THREE.Object3D) {
  const spies: ReturnType<typeof vi.spyOn>[] = []
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  root.traverse((object) => {
    const mesh = object as Partial<THREE.Mesh>
    if (mesh.geometry !== undefined) geometries.add(mesh.geometry)
    if (mesh.material !== undefined && !Array.isArray(mesh.material)) materials.add(mesh.material)
  })
  geometries.forEach((geometry) => spies.push(vi.spyOn(geometry, 'dispose')))
  materials.forEach((material) => spies.push(vi.spyOn(material, 'dispose')))
  return spies
}
