/**
 * CarConfig から3Dの車を組み立て、設定変更を差分で反映するモデル。
 * レンダラーやカメラを持たないため、WebGLが無い環境（vitest/jsdom）でもそのまま検証できる。
 *
 * 車体（ボディ）はQuaternius由来のGLBを非同期に読み込んで差し替える。
 * それ以外のカテゴリは carParts.ts が同期的に組み立て、変化したレイヤーだけを作り直す。
 */
import * as THREE from 'three'
import { resolveCarColor, type CarConfig } from './carConfig'
import {
  computeCarAttachments,
  computeCarDimensions,
  type CarAttachments,
  type CarDimensions,
} from './carDimensions'
import {
  CAR_PART_BUILDERS,
  CAR_PART_CATEGORY_IDS,
  disposeCarObject,
  type CarPartCategoryId,
  type CarPartContext,
} from './carParts'
import type { CarVehicleId } from './carVehicles'
import { loadCarVehicleBody, type CarVehicleBody } from './vehicleBody'

/** 車体GLBの読み込み状況。UIやテストが「まだ来ていない」を区別するために使う。 */
export type CarBodyStatus = 'loading' | 'ready' | 'failed'

export type CarModelOptions = {
  /** 車体の読み込み方。既定は実GLBを読む。テストや差し替え用に外から渡せる。 */
  loadBody?: (id: CarVehicleId) => Promise<CarVehicleBody>
  /** 車体の読み込み状況が変わったときに呼ばれる。 */
  onBodyStatusChange?: (status: CarBodyStatus) => void
  /** 車体が入れ替わってサイズが確定したときに呼ばれる（カメラの追従に使う）。 */
  onBodyReady?: () => void
}

export type CarModel = {
  /** シーンへ追加するルート。 */
  root: THREE.Group
  /** CarConfigを反映する。変化のあったレイヤーだけ作り直す。 */
  update: (config: CarConfig) => void
  /** 現在の車両寸法（カメラのフィットなどに使う）。 */
  getDimensions: () => CarDimensions
  /** 現在の取り付け基準。 */
  getAttachments: () => CarAttachments
  /** 車体GLBの読み込み状況。 */
  getBodyStatus: () => CarBodyStatus
  /** 生成済みのthree.jsリソースをすべて解放する。 */
  dispose: () => void
}

/**
 * 寸法に影響するカテゴリの署名。ここが変わると全レイヤーを作り直す
 * （どのパーツも寸法・attachmentを基準に配置しているため）。
 */
function dimensionSignature(config: CarConfig): string {
  return `${config.body}/${config.wheel}/${config.rideHeight}`
}

function layerKey(config: CarConfig, category: CarPartCategoryId): string {
  return `${config[category]}|${dimensionSignature(config)}`
}

export function createCarModel(config: CarConfig, options: CarModelOptions = {}): CarModel {
  const loadBody = options.loadBody ?? loadCarVehicleBody
  const root = new THREE.Group()
  root.name = 'car'

  // 車体GLBは非同期で届くため、先に受け皿のGroupだけ置いておく。
  // 位置合わせ（車高ぶんの持ち上げ）はこのGroupに掛ける。
  const bodyLayer = new THREE.Group()
  bodyLayer.name = 'car-layer-body'
  root.add(bodyLayer)

  const layers = {} as Record<CarPartCategoryId, THREE.Group>
  const keys = {} as Record<CarPartCategoryId, string | null>
  for (const category of CAR_PART_CATEGORY_IDS) {
    const layer = new THREE.Group()
    layer.name = `car-layer-${category}`
    layers[category] = layer
    keys[category] = null
    root.add(layer)
  }

  let dimensions = computeCarDimensions(config)
  let attachments = computeCarAttachments(dimensions)
  let body: CarVehicleBody | null = null
  let bodyVehicleId: CarVehicleId | null = null
  let bodyStatus: CarBodyStatus = 'loading'
  // 読み込みの世代。車種を素早く切り替えたとき、古い応答を捨てるために使う。
  let loadGeneration = 0
  let disposed = false

  function setBodyStatus(next: CarBodyStatus): void {
    if (bodyStatus === next) return
    bodyStatus = next
    options.onBodyStatusChange?.(next)
  }

  function releaseBody(): void {
    if (body === null) return
    bodyLayer.remove(body.object)
    body.dispose()
    body = null
  }

  /** 現在のCarConfigを、読み込み済みの車体へ反映する。 */
  function applyBodyConfig(target: CarVehicleBody, nextConfig: CarConfig): void {
    target.setBodyColor(resolveCarColor(nextConfig))
    // 「フロント」カテゴリが必ず自前のライトを置くので、車体内蔵のライトは隠す。
    target.setHeadlightVisible(false)
    // 屋根にパトランプを付けたときだけ、車体内蔵のパトランプを隠して二重を避ける。
    target.setPoliceLightVisible(nextConfig.roof !== 'policeLight')
  }

  function requestBody(nextConfig: CarConfig): void {
    const vehicleId = nextConfig.body
    loadGeneration += 1
    const generation = loadGeneration
    releaseBody()
    bodyVehicleId = vehicleId
    setBodyStatus('loading')

    loadBody(vehicleId).then(
      (loaded) => {
        // 破棄済み、または次の車種の読み込みが始まっていれば、届いた車体は捨てる。
        if (disposed || generation !== loadGeneration) {
          loaded.dispose()
          return
        }
        body = loaded
        applyBodyConfig(loaded, nextConfig)
        bodyLayer.add(loaded.object)
        setBodyStatus('ready')
        options.onBodyReady?.()
      },
      () => {
        if (disposed || generation !== loadGeneration) return
        // 車体が出せなくても、タイヤ・飾りなど他のレイヤーとUIは動かしたままにする。
        // 同じ車種のままでは再試行しない（色を変えるたびに失敗した取得を
        // 繰り返さないため）。別の車種を選び直せばその時点で読み込み直す。
        setBodyStatus('failed')
      },
    )
  }

  function update(nextConfig: CarConfig): void {
    dimensions = computeCarDimensions(nextConfig)
    attachments = computeCarAttachments(dimensions)

    if (bodyVehicleId !== nextConfig.body) requestBody(nextConfig)
    else if (body !== null) applyBodyConfig(body, nextConfig)
    // GLBは素の車高で作られているので、タイヤ径・車高ぶんだけ持ち上げる。
    bodyLayer.position.y = dimensions.bodyLift

    const context: CarPartContext = {
      config: nextConfig,
      dimensions,
      attachments,
      color: resolveCarColor(nextConfig),
    }

    for (const category of CAR_PART_CATEGORY_IDS) {
      const key = layerKey(nextConfig, category)
      if (keys[category] === key) continue
      clearLayer(category)
      const builders = CAR_PART_BUILDERS[category] as Record<string, (ctx: CarPartContext) => THREE.Object3D | null>
      const part = builders[nextConfig[category]]?.(context) ?? null
      if (part !== null) layers[category].add(part)
      keys[category] = key
    }
  }

  function clearLayer(category: CarPartCategoryId): void {
    const layer = layers[category]
    for (const child of [...layer.children]) {
      layer.remove(child)
      disposeCarObject(child)
    }
  }

  update(config)

  return {
    root,
    update,
    getDimensions: () => dimensions,
    getAttachments: () => attachments,
    getBodyStatus: () => bodyStatus,
    dispose: () => {
      disposed = true
      // 世代を進めて、飛んでいる読み込みの結果が後から差し込まれないようにする。
      loadGeneration += 1
      releaseBody()
      root.remove(bodyLayer)
      for (const category of CAR_PART_CATEGORY_IDS) {
        clearLayer(category)
        root.remove(layers[category])
        keys[category] = null
      }
    },
  }
}
