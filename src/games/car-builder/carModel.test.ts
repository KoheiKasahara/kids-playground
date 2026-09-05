import * as THREE from 'three'
import { describe, expect, test, vi } from 'vitest'
import {
  CAR_CATEGORIES,
  CAR_CATEGORY_ORDER,
  DEFAULT_CAR_CONFIG,
  resolveCarColor,
  selectCarOption,
  type CarCategoryId,
  type CarConfig,
} from './carConfig'
import { computeCarDimensions } from './carDimensions'
import {
  CAR_DERIVED_CATEGORY_IDS,
  CAR_MODEL_CATEGORY_IDS,
  CAR_PART_BUILDERS,
  CAR_PART_CATEGORY_IDS,
} from './carParts'
import { createCarModel, type CarModelOptions } from './carModel'
import { CAR_VEHICLES, type CarVehicleId } from './carVehicles'
import type { CarVehicleBody } from './vehicleBody'

function layerOf(root: THREE.Object3D, category: string): THREE.Object3D {
  const layer = root.children.find((child) => child.name === 'car-layer-' + category)
  if (layer === undefined) throw new Error('レイヤーが見つかりません: ' + category)
  return layer
}

function boundsOf(object: THREE.Object3D): THREE.Box3 {
  return new THREE.Box3().setFromObject(object)
}

type FakeBody = CarVehicleBody & {
  vehicleId: CarVehicleId
  disposed: boolean
  bodyColor: string | null
  policeLightVisible: boolean
  headlightVisible: boolean
  materials: THREE.MeshStandardMaterial[]
}

/**
 * 実GLBを読まずに車体の入れ替えだけを検証するためのダミー車体。
 * マテリアル名は本物のカタログと同じものを使い、名前で役割を見る実装がずれたら落ちるようにする。
 */
function createFakeBody(id: CarVehicleId): FakeBody {
  const group = new THREE.Group()
  group.name = `car-body-${id}`
  const materials = CAR_VEHICLES[id].materials.map((name) => {
    const material = new THREE.MeshStandardMaterial({ color: '#808080' })
    material.name = name
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material)
    mesh.name = `${id}-${name}`
    group.add(mesh)
    return material
  })

  const body: FakeBody = {
    vehicleId: id,
    disposed: false,
    bodyColor: null,
    policeLightVisible: true,
    headlightVisible: true,
    materials,
    object: group,
    setBodyColor: (hex) => {
      body.bodyColor = hex
      for (const material of materials) {
        if (material.name === 'Body') material.color.set(hex)
      }
    },
    setPoliceLightVisible: (visible) => {
      body.policeLightVisible = visible
    },
    setHeadlightVisible: (visible) => {
      body.headlightVisible = visible
    },
    dispose: () => {
      body.disposed = true
      group.removeFromParent()
    },
  }
  return body
}

type Harness = {
  options: CarModelOptions
  bodies: FakeBody[]
  /** 保留中の読み込みを解決する。 */
  resolveAll: () => Promise<void>
  pending: number
}

function fakeLoaderHarness(): Harness {
  const bodies: FakeBody[] = []
  const resolvers: (() => void)[] = []
  const harness: Harness = {
    bodies,
    pending: 0,
    options: {
      loadBody: (id) =>
        new Promise<CarVehicleBody>((resolve) => {
          harness.pending += 1
          resolvers.push(() => {
            const body = createFakeBody(id)
            bodies.push(body)
            resolve(body)
          })
        }),
    },
    resolveAll: async () => {
      while (resolvers.length > 0) resolvers.shift()!()
      harness.pending = 0
      await Promise.resolve()
      await Promise.resolve()
    },
  }
  return harness
}

/** 即座に解決するローダー。レイアウト系のテストで使う。 */
function immediateLoader(): CarModelOptions {
  return { loadBody: async (id) => createFakeBody(id) }
}

async function createReadyModel(config: CarConfig = DEFAULT_CAR_CONFIG) {
  const model = createCarModel(config, immediateLoader())
  await Promise.resolve()
  await Promise.resolve()
  return model
}

describe('カテゴリと3D生成の対応（後続カテゴリ追加時の落とし穴を防ぐ契約）', () => {
  test('全カテゴリが「手続き生成」「GLB」「他パーツの入力」のどれかに必ず属する', () => {
    const covered = [
      ...CAR_PART_CATEGORY_IDS,
      ...CAR_MODEL_CATEGORY_IDS,
      ...CAR_DERIVED_CATEGORY_IDS,
    ] as CarCategoryId[]
    expect([...covered].sort()).toEqual([...CAR_CATEGORY_ORDER].sort())
    expect(new Set(covered).size).toBe(covered.length)
  })

  test('手続き生成のカテゴリは、全選択肢に生成関数が登録されている', () => {
    for (const category of CAR_PART_CATEGORY_IDS) {
      const builders = CAR_PART_BUILDERS[category] as Record<string, unknown>
      for (const option of CAR_CATEGORIES[category].options) {
        expect(typeof builders[option.id], `${category}/${option.id}`).toBe('function')
      }
    }
  })

  test('GLBのカテゴリは、全選択肢が車種カタログに存在する', () => {
    for (const option of CAR_CATEGORIES.body.options) {
      expect(CAR_VEHICLES[option.id], option.id).toBeDefined()
    }
  })
})

describe('車体GLBの読み込みと入れ替え', () => {
  test('読み込み前は body レイヤーが空で、他のレイヤーは先に組み上がる', () => {
    const harness = fakeLoaderHarness()
    const model = createCarModel(DEFAULT_CAR_CONFIG, harness.options)
    expect(model.getBodyStatus()).toBe('loading')
    expect(layerOf(model.root, 'body').children).toHaveLength(0)
    expect(layerOf(model.root, 'wheel').children.length).toBeGreaterThan(0)
    model.dispose()
  })

  test('読み込みが終わると body レイヤーへ入り、状態が ready になる', async () => {
    const statuses: string[] = []
    const model = createCarModel(DEFAULT_CAR_CONFIG, {
      ...immediateLoader(),
      onBodyStatusChange: (status) => statuses.push(status),
    })
    await Promise.resolve()
    await Promise.resolve()
    expect(model.getBodyStatus()).toBe('ready')
    expect(layerOf(model.root, 'body').children).toHaveLength(1)
    expect(statuses).toContain('ready')
    model.dispose()
  })

  test('車種を切り替えると前の車体が解放され、レイヤーに残らない', async () => {
    const harness = fakeLoaderHarness()
    const model = createCarModel(DEFAULT_CAR_CONFIG, harness.options)
    await harness.resolveAll()
    expect(layerOf(model.root, 'body').children).toHaveLength(1)

    model.update(selectCarOption(DEFAULT_CAR_CONFIG, 'body', 'schoolBus'))
    await harness.resolveAll()

    expect(harness.bodies).toHaveLength(2)
    expect(harness.bodies[0]?.disposed).toBe(true)
    expect(harness.bodies[1]?.disposed).toBe(false)
    const layer = layerOf(model.root, 'body')
    expect(layer.children).toHaveLength(1)
    expect(layer.children[0]?.name).toBe('car-body-schoolBus')
    model.dispose()
  })

  test('全車種を続けて切り替えても、body レイヤーは常に1台だけ', async () => {
    const harness = fakeLoaderHarness()
    const model = createCarModel(DEFAULT_CAR_CONFIG, harness.options)
    await harness.resolveAll()

    for (const option of CAR_CATEGORIES.body.options) {
      model.update(selectCarOption(DEFAULT_CAR_CONFIG, 'body', option.id))
      await harness.resolveAll()
      const layer = layerOf(model.root, 'body')
      expect(layer.children, option.id).toHaveLength(1)
      expect(layer.children[0]?.name, option.id).toBe(`car-body-${option.id}`)
    }
    // 表示中の1台以外はすべて解放済み。
    expect(harness.bodies.filter((body) => !body.disposed)).toHaveLength(1)
    model.dispose()
  })

  test('読み込み中にさらに切り替えると、古い応答は捨てて解放する', async () => {
    const harness = fakeLoaderHarness()
    const model = createCarModel(DEFAULT_CAR_CONFIG, harness.options)
    await harness.resolveAll()

    // 立て続けに2回切り替え、あとからまとめて解決させる。
    model.update(selectCarOption(DEFAULT_CAR_CONFIG, 'body', 'taxi'))
    model.update(selectCarOption(DEFAULT_CAR_CONFIG, 'body', 'ambulance'))
    await harness.resolveAll()

    const alive = harness.bodies.filter((body) => !body.disposed)
    expect(alive).toHaveLength(1)
    expect(alive[0]?.vehicleId).toBe('ambulance')
    expect(layerOf(model.root, 'body').children).toHaveLength(1)
    model.dispose()
  })

  test('同じ車種のまま他のカテゴリを変えても、車体を読み直さない', async () => {
    let loads = 0
    const model = createCarModel(DEFAULT_CAR_CONFIG, {
      loadBody: async (id) => {
        loads += 1
        return createFakeBody(id)
      },
    })
    await Promise.resolve()
    await Promise.resolve()
    expect(loads).toBe(1)

    model.update(selectCarOption(DEFAULT_CAR_CONFIG, 'color', 'blue'))
    model.update(selectCarOption(DEFAULT_CAR_CONFIG, 'wheel', 'big'))
    await Promise.resolve()
    expect(loads).toBe(1)
    model.dispose()
  })

  test('読み込みに失敗しても他のレイヤーとUIは壊れない', async () => {
    const statuses: string[] = []
    const model = createCarModel(DEFAULT_CAR_CONFIG, {
      loadBody: async () => {
        throw new Error('取得できない')
      },
      onBodyStatusChange: (status) => statuses.push(status),
    })
    await Promise.resolve()
    await Promise.resolve()

    expect(model.getBodyStatus()).toBe('failed')
    expect(layerOf(model.root, 'body').children).toHaveLength(0)
    expect(layerOf(model.root, 'wheel').children.length).toBeGreaterThan(0)
    expect(() => model.update(selectCarOption(DEFAULT_CAR_CONFIG, 'color', 'blue'))).not.toThrow()
    expect(statuses).toContain('failed')
    model.dispose()
  })

  test('失敗した車種から別の車種へ切り替えれば復帰する', async () => {
    let shouldFail = true
    const model = createCarModel(DEFAULT_CAR_CONFIG, {
      loadBody: async (id) => {
        if (shouldFail) throw new Error('取得できない')
        return createFakeBody(id)
      },
    })
    await Promise.resolve()
    await Promise.resolve()
    expect(model.getBodyStatus()).toBe('failed')

    shouldFail = false
    model.update(selectCarOption(DEFAULT_CAR_CONFIG, 'body', 'suv'))
    await Promise.resolve()
    await Promise.resolve()
    expect(model.getBodyStatus()).toBe('ready')
    expect(layerOf(model.root, 'body').children).toHaveLength(1)
    model.dispose()
  })

  test('dispose後に届いた車体は捨てて解放する', async () => {
    const harness = fakeLoaderHarness()
    const model = createCarModel(DEFAULT_CAR_CONFIG, harness.options)
    model.dispose()
    await harness.resolveAll()
    expect(harness.bodies.every((body) => body.disposed)).toBe(true)
    expect(model.root.children).toHaveLength(0)
  })
})

describe('ボディカラーと固有装備', () => {
  test('選んだカラーが車体へ渡る', async () => {
    const harness = fakeLoaderHarness()
    const config = selectCarOption(DEFAULT_CAR_CONFIG, 'color', 'blue')
    const model = createCarModel(config, harness.options)
    await harness.resolveAll()
    expect(harness.bodies[0]?.bodyColor).toBe(resolveCarColor(config))
    model.dispose()
  })

  test('カラーだけを変えたときは車体を読み直さず、色だけ差し替える', async () => {
    const harness = fakeLoaderHarness()
    const model = createCarModel(DEFAULT_CAR_CONFIG, harness.options)
    await harness.resolveAll()
    const body = harness.bodies[0]!

    const next = selectCarOption(DEFAULT_CAR_CONFIG, 'color', 'purple')
    model.update(next)
    expect(harness.bodies).toHaveLength(1)
    expect(body.bodyColor).toBe(resolveCarColor(next))
    model.dispose()
  })

  test('車種を切り替えても選択中のカラーが新しい車体へ適用される', async () => {
    const harness = fakeLoaderHarness()
    const config = selectCarOption(DEFAULT_CAR_CONFIG, 'color', 'green')
    const model = createCarModel(config, harness.options)
    await harness.resolveAll()

    model.update(selectCarOption(config, 'body', 'taxi'))
    await harness.resolveAll()
    expect(harness.bodies[1]?.vehicleId).toBe('taxi')
    expect(harness.bodies[1]?.bodyColor).toBe(resolveCarColor(config))
    model.dispose()
  })

  test('車体内蔵のヘッドライトは常に隠す（フロントライトと二重にしない）', async () => {
    const harness = fakeLoaderHarness()
    const model = createCarModel(DEFAULT_CAR_CONFIG, harness.options)
    await harness.resolveAll()
    expect(harness.bodies[0]?.headlightVisible).toBe(false)
    model.dispose()
  })

  test('屋根にパトランプを付けたときだけ、車体内蔵のパトランプを隠す', async () => {
    const harness = fakeLoaderHarness()
    const base = selectCarOption(DEFAULT_CAR_CONFIG, 'body', 'policeCar')
    const model = createCarModel(base, harness.options)
    await harness.resolveAll()
    expect(harness.bodies[0]?.policeLightVisible).toBe(true)

    model.update(selectCarOption(base, 'roof', 'policeLight'))
    expect(harness.bodies[0]?.policeLightVisible).toBe(false)

    model.update(selectCarOption(base, 'roof', 'luggage'))
    expect(harness.bodies[0]?.policeLightVisible).toBe(true)
    model.dispose()
  })
})

describe('車体の位置合わせ', () => {
  test('body レイヤーが車高・タイヤ径ぶんだけ持ち上がる', async () => {
    const model = await createReadyModel()
    const dimensions = computeCarDimensions(DEFAULT_CAR_CONFIG)
    expect(layerOf(model.root, 'body').position.y).toBeCloseTo(dimensions.bodyLift, 6)
    model.dispose()
  })

  test('低い車高でタイヤを大きくすると、めり込まないよう車体も持ち上がる', async () => {
    const base = selectCarOption(DEFAULT_CAR_CONFIG, 'rideHeight', 'low')
    const model = await createReadyModel(base)
    const before = layerOf(model.root, 'body').position.y
    model.update(selectCarOption(base, 'wheel', 'offroad'))
    expect(layerOf(model.root, 'body').position.y).toBeGreaterThan(before)
    model.dispose()
  })

  test('車高3段階で車体が上下し、タイヤの接地位置は変わらない', async () => {
    const heights: number[] = []
    const wheelBottoms: number[] = []
    for (const ride of ['low', 'normal', 'high'] as const) {
      const model = await createReadyModel(selectCarOption(DEFAULT_CAR_CONFIG, 'rideHeight', ride))
      heights.push(layerOf(model.root, 'body').position.y)
      wheelBottoms.push(boundsOf(layerOf(model.root, 'wheel')).min.y)
      model.dispose()
    }
    expect(heights[2]).toBeGreaterThan(heights[1]!)
    expect(heights[1]).toBeGreaterThanOrEqual(heights[0]!)
    for (const bottom of wheelBottoms) expect(bottom).toBeCloseTo(wheelBottoms[0]!, 6)
  })
})

describe('カテゴリごとのレイヤー', () => {
  test('カテゴリごとに独立したレイヤーを持つ（1つの巨大Meshにしない）', () => {
    const model = createCarModel(DEFAULT_CAR_CONFIG, immediateLoader())
    for (const category of [...CAR_MODEL_CATEGORY_IDS, ...CAR_PART_CATEGORY_IDS]) {
      expect(layerOf(model.root, category)).toBeDefined()
    }
    model.dispose()
  })

  test('初期状態でタイヤが生成され、「なし」のカテゴリは空のまま', () => {
    const model = createCarModel(DEFAULT_CAR_CONFIG, immediateLoader())
    expect(layerOf(model.root, 'wheel').children.length).toBeGreaterThan(0)
    expect(layerOf(model.root, 'roof').children).toHaveLength(0)
    expect(layerOf(model.root, 'decoration').children).toHaveLength(0)
    model.dispose()
  })

  test('タイヤは4輪が寸法どおりの位置に生成される', () => {
    const model = createCarModel(DEFAULT_CAR_CONFIG, immediateLoader())
    const dimensions = computeCarDimensions(DEFAULT_CAR_CONFIG)
    const attachments = model.getAttachments()
    const wheelRoot = layerOf(model.root, 'wheel').children[0]!
    for (const attachment of attachments.wheels) {
      const tire = wheelRoot.getObjectByName(`car-wheel-tire-${attachment.id}`) as THREE.Mesh | undefined
      expect(tire, attachment.id).toBeDefined()
      expect(tire?.position.x).toBeCloseTo(attachment.position.x, 6)
      expect(tire?.position.y).toBeCloseTo(dimensions.wheelRadius, 6)
      expect(tire?.position.z).toBeCloseTo(attachment.position.z, 6)
    }
    model.dispose()
  })

  test('7ボディ×4タイヤの全組み合わせで4輪が生成され、範囲が有限', () => {
    for (const bodyOption of CAR_CATEGORIES.body.options) {
      for (const wheelOption of CAR_CATEGORIES.wheel.options) {
        const config = selectCarOption(
          selectCarOption(DEFAULT_CAR_CONFIG, 'body', bodyOption.id),
          'wheel',
          wheelOption.id,
        )
        const label = `${bodyOption.id}/${wheelOption.id}`
        const model = createCarModel(config, immediateLoader())
        const wheelRoot = layerOf(model.root, 'wheel').children[0]
        if (wheelRoot === undefined) throw new Error('タイヤが生成されていません: ' + label)
        const tires = wheelRoot.children.filter((child) => child.name.startsWith('car-wheel-tire-'))
        expect(tires, label).toHaveLength(4)

        const bounds = boundsOf(model.root)
        expect(bounds.min.y, label).toBeGreaterThanOrEqual(-0.01)
        expect(
          [bounds.min.x, bounds.min.y, bounds.min.z, bounds.max.x, bounds.max.y, bounds.max.z].every(Number.isFinite),
          label,
        ).toBe(true)
        model.dispose()
      }
    }
  })

  test('屋根3種類（なしを除く）が全車種でルーフ天面より上に置かれる', () => {
    for (const bodyOption of CAR_CATEGORIES.body.options) {
      for (const roof of ['policeLight', 'luggage', 'spoiler'] as const) {
        const config = selectCarOption(selectCarOption(DEFAULT_CAR_CONFIG, 'body', bodyOption.id), 'roof', roof)
        const label = `${bodyOption.id}/${roof}`
        const model = createCarModel(config, immediateLoader())
        const layer = layerOf(model.root, 'roof')
        expect(layer.children, label).toHaveLength(1)
        const bounds = boundsOf(layer)
        expect(bounds.max.y, label).toBeGreaterThan(computeCarDimensions(config).roofTopY)
        model.dispose()
      }
    }
  })

  test('フロント3種類が全車種で前端まわりに収まる', () => {
    for (const bodyOption of CAR_CATEGORIES.body.options) {
      for (const front of ['round', 'square', 'slim'] as const) {
        const config = selectCarOption(selectCarOption(DEFAULT_CAR_CONFIG, 'body', bodyOption.id), 'front', front)
        const label = `${bodyOption.id}/${front}`
        const model = createCarModel(config, immediateLoader())
        const dimensions = computeCarDimensions(config)
        const bounds = boundsOf(layerOf(model.root, 'front'))
        expect(bounds.max.z, label).toBeGreaterThan(0)
        expect(bounds.max.z, label).toBeLessThan(dimensions.length / 2 + 0.35)
        expect(bounds.min.y, label).toBeGreaterThan(0)
        model.dispose()
      }
    }
  })

  test('飾りとマークが全車種で生成される', () => {
    for (const bodyOption of CAR_CATEGORIES.body.options) {
      const base = selectCarOption(DEFAULT_CAR_CONFIG, 'body', bodyOption.id)
      for (const decoration of ['star', 'flame', 'stripes', 'dots'] as const) {
        const model = createCarModel(selectCarOption(base, 'decoration', decoration), immediateLoader())
        expect(layerOf(model.root, 'decoration').children, `${bodyOption.id}/${decoration}`).toHaveLength(1)
        model.dispose()
      }
      for (const mark of ['number1', 'star', 'crown'] as const) {
        const model = createCarModel(selectCarOption(base, 'mark', mark), immediateLoader())
        expect(layerOf(model.root, 'mark').children, `${bodyOption.id}/${mark}`).toHaveLength(1)
        model.dispose()
      }
    }
  })

  test('1カテゴリだけ変えたときは、そのレイヤーだけを作り直す', () => {
    const model = createCarModel(DEFAULT_CAR_CONFIG, immediateLoader())
    const wheelBefore = layerOf(model.root, 'wheel').children[0]
    model.update(selectCarOption(DEFAULT_CAR_CONFIG, 'roof', 'spoiler'))
    expect(layerOf(model.root, 'wheel').children[0]).toBe(wheelBefore)
    expect(layerOf(model.root, 'roof').children).toHaveLength(1)
    model.dispose()
  })

  test('寸法が変わるカテゴリ（タイヤ）を変えると、他のパーツも作り直して追従する', () => {
    const model = createCarModel(selectCarOption(DEFAULT_CAR_CONFIG, 'roof', 'spoiler'), immediateLoader())
    const roofBefore = layerOf(model.root, 'roof').children[0]
    model.update(
      selectCarOption(selectCarOption(DEFAULT_CAR_CONFIG, 'roof', 'spoiler'), 'wheel', 'offroad'),
    )
    expect(layerOf(model.root, 'roof').children[0]).not.toBe(roofBefore)
    model.dispose()
  })

  test('「なし」へ戻すとパーツが取り除かれる', () => {
    const model = createCarModel(selectCarOption(DEFAULT_CAR_CONFIG, 'roof', 'luggage'), immediateLoader())
    expect(layerOf(model.root, 'roof').children).toHaveLength(1)
    model.update(DEFAULT_CAR_CONFIG)
    expect(layerOf(model.root, 'roof').children).toHaveLength(0)
    model.dispose()
  })
})

describe('three.jsリソースの解放', () => {
  test('レイヤーを差し替えたとき、古いgeometry/materialがdisposeされる', () => {
    const model = createCarModel(selectCarOption(DEFAULT_CAR_CONFIG, 'roof', 'luggage'), immediateLoader())
    const roof = layerOf(model.root, 'roof').children[0]!
    const disposed: string[] = []
    roof.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (mesh.geometry === undefined) return
      vi.spyOn(mesh.geometry, 'dispose').mockImplementation(() => disposed.push('geometry'))
    })

    model.update(selectCarOption(DEFAULT_CAR_CONFIG, 'roof', 'spoiler'))
    expect(disposed.length).toBeGreaterThan(0)
    model.dispose()
  })

  test('disposeで全レイヤーのリソースが解放され、ルートが空になる', async () => {
    const harness = fakeLoaderHarness()
    const model = createCarModel(selectCarOption(DEFAULT_CAR_CONFIG, 'roof', 'spoiler'), harness.options)
    await harness.resolveAll()

    const disposed: string[] = []
    model.root.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (mesh.geometry === undefined) return
      vi.spyOn(mesh.geometry, 'dispose').mockImplementation(() => disposed.push(child.name))
    })

    model.dispose()
    expect(disposed.length).toBeGreaterThan(0)
    expect(harness.bodies[0]?.disposed).toBe(true)
    expect(model.root.children).toHaveLength(0)
  })
})
