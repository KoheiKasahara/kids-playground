/**
 * 車体GLB（Quaternius由来）の読み込みと、1台ぶんのインスタンス管理。
 *
 * 設計上の約束：
 * - 取得したバイト列だけをURL単位でキャッシュし、GLTFのパースは車体1台ごとに行う。
 *   こうするとGeometryもMaterialもそのインスタンスの専有物になり、
 *   「車種を替えたら別の車の色まで変わった」「disposeしたら別の車が消えた」を
 *   構造的に起こせなくなる。パース対象は1,000〜1,600三角形なので毎回で問題ない。
 * - マテリアルの役割はGLB内の名前（Body / Glass / PoliceLight… ）で判別する。
 *   名前はビルドスクリプトが付けており、carVehicles.ts の定義と一致する。
 */
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import {
  CAR_BODY_LOWER_MATERIAL,
  CAR_BODY_MATERIAL,
  CAR_HEADLIGHT_MATERIAL,
  carVehicleModelUrl,
  isPoliceLightMaterial,
  type CarVehicleId,
} from './carVehicles'

/** 下部パネルはボディカラーをそのまま使うと2トーンに見えないので、暗くして敷く。 */
const BODY_LOWER_SHADE = 0.55

export type CarVehicleBody = {
  /** シーンへ追加するオブジェクト。 */
  object: THREE.Object3D
  /** ボディ塗装（Body / BodyLower）だけを塗り替える。 */
  setBodyColor: (hex: string) => void
  /**
   * 車体内蔵のパトランプの表示切替。持たない車種では何もしない。
   * Phase 3 で「やね＝パトランプ」と二重にならないようにするための口。
   */
  setPoliceLightVisible: (visible: boolean) => void
  /**
   * 車体内蔵のヘッドライトの表示切替。
   * ゲーム側の「フロント」カテゴリが自前のライトを必ず1組置くため、
   * 既定では隠して二重にならないようにしている。
   */
  setHeadlightVisible: (visible: boolean) => void
  /** このインスタンスが持つGeometry / Materialをすべて解放する。 */
  dispose: () => void
}

/**
 * GLBのバイト列をURL単位でキャッシュする。中身は不変なので共有してよい。
 * three.jsのオブジェクトはここに入れない（共有すると独立性が壊れる）。
 */
const bytesCache = new Map<string, Promise<ArrayBuffer>>()

async function fetchModelBytes(url: string): Promise<ArrayBuffer> {
  const cached = bytesCache.get(url)
  if (cached !== undefined) return cached
  const request = fetch(url).then(async (response) => {
    if (!response.ok) throw new Error(`車体モデルを取得できません: ${url} (${response.status})`)
    return response.arrayBuffer()
  })
  // 失敗はキャッシュへ残さない。次に車種を選び直したときに再試行できるようにする。
  request.catch(() => bytesCache.delete(url))
  bytesCache.set(url, request)
  return request
}

/** テストや、シーンを畳んだあとに取得済みバイト列を捨てる。 */
export function clearCarVehicleModelCache(): void {
  bytesCache.clear()
}

function materialsOf(object: THREE.Object3D): THREE.Material[] {
  const materials: THREE.Material[] = []
  object.traverse((child) => {
    const mesh = child as Partial<THREE.Mesh>
    if (Array.isArray(mesh.material)) materials.push(...mesh.material)
    else if (mesh.material !== undefined) materials.push(mesh.material)
  })
  return materials
}

function isColorMaterial(material: THREE.Material): material is THREE.Material & { color: THREE.Color } {
  return 'color' in material && (material as { color?: unknown }).color instanceof THREE.Color
}

function buildBody(scene: THREE.Object3D): CarVehicleBody {
  const bodyMaterials: THREE.Material[] = []
  const bodyLowerMaterials: THREE.Material[] = []
  const policeLightMeshes: THREE.Object3D[] = []
  const headlightMeshes: THREE.Object3D[] = []

  scene.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (mesh.isMesh !== true) return
    mesh.castShadow = true
    mesh.receiveShadow = true
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const material of materials) {
      if (material.name === CAR_BODY_MATERIAL) bodyMaterials.push(material)
      else if (material.name === CAR_BODY_LOWER_MATERIAL) bodyLowerMaterials.push(material)
      else if (isPoliceLightMaterial(material.name)) policeLightMeshes.push(mesh)
      else if (material.name === CAR_HEADLIGHT_MATERIAL) headlightMeshes.push(mesh)
    }
  })

  return {
    object: scene,
    setBodyColor: (hex: string) => {
      for (const material of bodyMaterials) {
        if (isColorMaterial(material)) material.color.set(hex)
      }
      for (const material of bodyLowerMaterials) {
        if (isColorMaterial(material)) material.color.set(hex).multiplyScalar(BODY_LOWER_SHADE)
      }
    },
    setPoliceLightVisible: (visible: boolean) => {
      for (const mesh of policeLightMeshes) mesh.visible = visible
    },
    setHeadlightVisible: (visible: boolean) => {
      for (const mesh of headlightMeshes) mesh.visible = visible
    },
    dispose: () => {
      const geometries = new Set<THREE.BufferGeometry>()
      scene.traverse((child) => {
        const mesh = child as Partial<THREE.Mesh>
        if (mesh.geometry !== undefined) geometries.add(mesh.geometry)
      })
      geometries.forEach((geometry) => geometry.dispose())
      new Set(materialsOf(scene)).forEach((material) => material.dispose())
      scene.removeFromParent()
    },
  }
}

/**
 * 車種のGLBを読み込み、そのインスタンス専用のGeometry / Materialを持つ車体を返す。
 * 失敗時はrejectする。呼び出し側は車体なしでも画面が成立するよう扱うこと。
 */
export async function loadCarVehicleBody(id: CarVehicleId): Promise<CarVehicleBody> {
  const bytes = await fetchModelBytes(carVehicleModelUrl(id))
  const loader = new GLTFLoader()
  // slice() でこのインスタンス専用のバッファにする。GLTFLoaderは渡されたArrayBufferを
  // そのまま参照するため、キャッシュ側の実体を直接渡すと使い回しで壊れうる。
  const gltf = await loader.parseAsync(bytes.slice(0), '')
  const scene = gltf.scene
  scene.name = `car-body-${id}`
  return buildBody(scene)
}
