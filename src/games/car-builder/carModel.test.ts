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
import { SPORTS_GLASS_GROUP, SPORTS_PAINT_GROUP, SPORTS_TRIM_GROUP } from './sportsBodySurface'

function layerOf(root: THREE.Object3D, category: string): THREE.Object3D {
  const layer = root.children.find((child) => child.name === 'car-layer-' + category)
  if (layer === undefined) throw new Error('レイヤーが見つかりません: ' + category)
  return layer
}

function boundsOf(object: THREE.Object3D): THREE.Box3 {
  return new THREE.Box3().setFromObject(object)
}

function maxYNearZ(mesh: THREE.Mesh, targetZ: number, keepX: (x: number) => boolean): number {
  const position = mesh.geometry.getAttribute('position')
  let maxY = Number.NEGATIVE_INFINITY
  for (let index = 0; index < position.count; index += 1) {
    if (Math.abs(position.getZ(index) - targetZ) > 0.05) continue
    if (!keepX(position.getX(index))) continue
    maxY = Math.max(maxY, position.getY(index))
  }
  return maxY
}

/** スポーツカーの外殻は `[塗装, ガラス, 開口]` の配列マテリアルを持つ。 */
function paintColorOf(mesh: THREE.Mesh): string {
  const material = Array.isArray(mesh.material) ? mesh.material[SPORTS_PAINT_GROUP]! : mesh.material
  return (material as THREE.MeshStandardMaterial).color.getHexString()
}

function maxAbsXNearZ(mesh: THREE.Mesh, targetZ: number): number {
  const position = mesh.geometry.getAttribute('position')
  let maxX = 0
  for (let index = 0; index < position.count; index += 1) {
    if (Math.abs(position.getZ(index) - targetZ) > 0.05) continue
    maxX = Math.max(maxX, Math.abs(position.getX(index)))
  }
  return maxX
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

  test('スポーツカーの外殻は1枚のサーフェスで、窓と開口はそのマテリアルグループ', () => {
    const model = createCarModel(DEFAULT_CAR_CONFIG)
    const body = layerOf(model.root, 'body')
    const wheel = layerOf(model.root, 'wheel')
    const hull = body.getObjectByName('car-body-hull')

    expect(hull).toBeInstanceOf(THREE.Mesh)
    const mesh = hull as THREE.Mesh
    // 窓・ピラー・フェンダーを別Meshで貼らないことが今回の造形方式の核心。
    // ガラスは同じ BufferGeometry のマテリアルグループとして存在する。
    expect(Array.isArray(mesh.material)).toBe(true)
    const materials = mesh.material as THREE.Material[]
    expect(materials).toHaveLength(3)
    expect(materials[SPORTS_PAINT_GROUP]).toBeInstanceOf(THREE.MeshPhysicalMaterial)
    expect(materials[SPORTS_GLASS_GROUP]).toBeInstanceOf(THREE.MeshPhysicalMaterial)

    const groups = mesh.geometry.groups
    expect(groups.length).toBe(3)
    const glassGroup = groups.find((group) => group.materialIndex === SPORTS_GLASS_GROUP)
    const trimGroup = groups.find((group) => group.materialIndex === SPORTS_TRIM_GROUP)
    expect(glassGroup?.count ?? 0).toBeGreaterThan(0)
    expect(trimGroup?.count ?? 0).toBeGreaterThan(0)

    // 旧実装の「貼り付けた板・棒・バンド」は残っていない。
    for (const name of [
      'car-sports-windshield',
      'car-sports-side-window-front-left',
      'car-sports-a-pillar-left',
      'car-sports-fender-frontLeft',
      'car-sports-wheel-arch-frontLeft',
      'car-body-cabin',
    ]) {
      expect(body.getObjectByName(name), name).toBeUndefined()
    }

    expect(wheel.getObjectByName('car-sports-rim-ring-frontLeft')).toBeDefined()
    expect(wheel.getObjectByName('car-sports-center-cap-frontLeft')).toBeDefined()

    // 他車種はスポーツ専用サーフェスを使わない（単一マテリアルのまま）。
    const suv = createCarModel(selectCarOption(DEFAULT_CAR_CONFIG, 'body', 'suv'))
    const suvBody = layerOf(suv.root, 'body')
    suvBody.traverse((object) => {
      if (object instanceof THREE.Mesh) expect(Array.isArray(object.material)).toBe(false)
    })
    expect(layerOf(suv.root, 'wheel').getObjectByName('car-sports-rim-ring-frontLeft')).toBeUndefined()
    suv.dispose()
    model.dispose()
  })

  test('スポーツカーの外殻は左右対称で、全頂点が地面より上の有限座標', () => {
    const model = createCarModel(DEFAULT_CAR_CONFIG)
    const hull = layerOf(model.root, 'body').getObjectByName('car-body-hull') as THREE.Mesh
    const position = hull.geometry.getAttribute('position')

    const key = (x: number, y: number, z: number) =>
      `${(Math.abs(x) < 1e-6 ? 0 : x).toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`
    const points = new Set<string>()
    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index)
      const y = position.getY(index)
      const z = position.getZ(index)
      expect(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)).toBe(true)
      expect(y).toBeGreaterThan(0)
      points.add(key(x, y, z))
    }
    let mirrored = 0
    for (let index = 0; index < position.count; index += 1) {
      if (points.has(key(-position.getX(index), position.getY(index), position.getZ(index)))) mirrored += 1
    }
    // 半断面をミラーして組むので、丸め誤差を除けば全頂点に対の頂点がある。
    expect(mirrored / position.count).toBeGreaterThan(0.99)
    model.dispose()
  })

  test('スポーツカーの外殻はモバイル向けのポリゴン上限に収まる', () => {
    const model = createCarModel(DEFAULT_CAR_CONFIG)
    const hull = layerOf(model.root, 'body').getObjectByName('car-body-hull') as THREE.Mesh
    const index = hull.geometry.getIndex()
    expect(index).not.toBeNull()
    expect((index?.count ?? 0) / 3).toBeLessThanOrEqual(18000)
    // ボディレイヤーのMesh数も抑える（旧実装は20個以上の小物Meshを積んでいた）。
    const meshes: THREE.Mesh[] = []
    layerOf(model.root, 'body').traverse((object) => {
      if (object instanceof THREE.Mesh) meshes.push(object)
    })
    expect(meshes.length).toBeLessThanOrEqual(8)
    model.dispose()
  })

  test('スポーツカーのフェンダーは断面の膨らみとしてタイヤ外端を覆う', () => {
    for (const wheelOption of ['normal', 'big'] as const) {
      const config = selectCarOption(DEFAULT_CAR_CONFIG, 'wheel', wheelOption)
      const model = createCarModel(config)
      const dimensions = computeCarDimensions(config)
      const hull = layerOf(model.root, 'body').getObjectByName('car-body-hull') as THREE.Mesh
      const tireOuterX = dimensions.track / 2 + dimensions.wheelWidth / 2
      const frontWheelZ = dimensions.wheelbase / 2

      // 前後輪の断面はタイヤ外端より広い＝フェンダーがタイヤを覆っている。
      expect(maxAbsXNearZ(hull, frontWheelZ), wheelOption).toBeGreaterThan(tireOuterX)
      expect(maxAbsXNearZ(hull, -frontWheelZ), wheelOption).toBeGreaterThan(tireOuterX)
      // ドア中央は前後輪より細い＝くびれがある（＝タイヤ上だけの独立バンドではない）。
      expect(maxAbsXNearZ(hull, 0), wheelOption).toBeLessThan(maxAbsXNearZ(hull, frontWheelZ) - 0.05)
      model.dispose()
    }
  })

  test('スポーツカーのノーズは中央が低く、左右フェンダー側が高い', () => {
    const model = createCarModel(DEFAULT_CAR_CONFIG)
    const dimensions = computeCarDimensions(DEFAULT_CAR_CONFIG)
    const hull = layerOf(model.root, 'body').getObjectByName('car-body-hull') as THREE.Mesh
    const noseZ = dimensions.wheelbase / 2 + 0.3

    const centerTop = maxYNearZ(hull, noseZ, (x) => Math.abs(x) < dimensions.width * 0.12)
    const fenderTop = maxYNearZ(hull, noseZ, (x) => Math.abs(x) > dimensions.width * 0.3)
    // 旧実装の断面は外周のYを単調増加へクランプしていたため、この関係を作れなかった。
    expect(fenderTop).toBeGreaterThan(centerTop + 0.01)
    model.dispose()
  })

  test('スポーツカーの側面シルエットはボンネット→ルーフ→リアで連続して変化する', () => {
    const model = createCarModel(DEFAULT_CAR_CONFIG)
    const dimensions = computeCarDimensions(DEFAULT_CAR_CONFIG)
    const hull = layerOf(model.root, 'body').getObjectByName('car-body-hull') as THREE.Mesh
    const topAt = (z: number) => maxYNearZ(hull, z, () => true)

    const noseTop = topAt(dimensions.length / 2 - 0.2)
    const hoodTop = topAt(dimensions.wheelbase / 2)
    const roofTop = topAt(dimensions.cabinCenterZ)
    const deckTop = topAt(-dimensions.length / 2 + 0.4)
    const tailTop = topAt(-dimensions.length / 2 + 0.1)

    expect(noseTop).toBeLessThan(hoodTop)
    expect(hoodTop).toBeLessThan(roofTop)
    expect(roofTop).toBeCloseTo(dimensions.roofTopY, 1)
    // ルーフ→リアは単調に落ちる（箱状の終端や段差を作らない）。
    expect(deckTop).toBeLessThan(roofTop)
    expect(tailTop).toBeLessThan(deckTop)
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

  test('フロントパーツは車種ごとに前端まわりへ収まる', () => {
    // 箱形の車種は前端より前へバンパーを出す。スポーツカーは丸いノーズ面の上に
    // ライトを載せるため、前端を越えずに前輪より前にあることを契約にする。
    const boxy = createCarModel(selectCarOption(DEFAULT_CAR_CONFIG, 'body', 'suv'))
    const boxyDimensions = computeCarDimensions(selectCarOption(DEFAULT_CAR_CONFIG, 'body', 'suv'))
    expect(boundsOf(layerOf(boxy.root, 'front')).max.z).toBeGreaterThan(boxyDimensions.length / 2)
    boxy.dispose()

    const model = createCarModel(DEFAULT_CAR_CONFIG)
    const dimensions = computeCarDimensions(DEFAULT_CAR_CONFIG)
    const bounds = boundsOf(layerOf(model.root, 'front'))
    expect(bounds.max.z).toBeGreaterThan(dimensions.wheelbase / 2)
    expect(bounds.max.z).toBeLessThanOrEqual(dimensions.length / 2 + 0.02)
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
      return paintColorOf(hull)
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
    expect(paintColorOf(hull)).toBe('ffc531')
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
