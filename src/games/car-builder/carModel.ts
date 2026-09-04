/**
 * CarConfig から3Dの車を組み立て、設定変更を差分で反映するモデル。
 * レンダラーやカメラを持たないため、WebGLが無い環境（vitest/jsdom）でもそのまま検証できる。
 *
 * カテゴリごとに専用のレイヤー（Group）を1つ持ち、変化したレイヤーだけを作り直す。
 * 後続Issueでカテゴリの中身を差し替えても、この差し替え手順は変わらない。
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

export type CarModel = {
  /** シーンへ追加するルート。 */
  root: THREE.Group
  /** CarConfigを反映する。変化のあったレイヤーだけ作り直す。 */
  update: (config: CarConfig) => void
  /** 現在の車両寸法（カメラのフィットなどに使う）。 */
  getDimensions: () => CarDimensions
  /** 現在の取り付け基準。 */
  getAttachments: () => CarAttachments
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
  // カラーは塗装を持つボディ層だけに影響する。ほかのレイヤーまで再生成すると、
  // 色変更でライト・タイヤ・装飾のMaterialを不要に作り直すことになる。
  const colorKey = category === 'body' ? `|${resolveCarColor(config)}` : ''
  return `${config[category]}|${dimensionSignature(config)}${colorKey}`
}

export function createCarModel(config: CarConfig): CarModel {
  const root = new THREE.Group()
  root.name = 'car'

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

  function clearLayer(category: CarPartCategoryId): void {
    const layer = layers[category]
    for (const child of [...layer.children]) {
      layer.remove(child)
      disposeCarObject(child)
    }
  }

  function update(nextConfig: CarConfig): void {
    dimensions = computeCarDimensions(nextConfig)
    attachments = computeCarAttachments(dimensions)
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

  update(config)

  return {
    root,
    update,
    getDimensions: () => dimensions,
    getAttachments: () => attachments,
    dispose: () => {
      for (const category of CAR_PART_CATEGORY_IDS) {
        clearLayer(category)
        root.remove(layers[category])
        keys[category] = null
      }
    },
  }
}
