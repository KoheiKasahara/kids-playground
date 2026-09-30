import * as THREE from 'three'

type ThreeGlobeObject = THREE.Object3D & {
  __data?: unknown
  __globeObjType?: string
}

function threeGlobeObjectOf(object: THREE.Object3D): ThreeGlobeObject {
  return object as ThreeGlobeObject
}

function numericIdOf(value: unknown): number | null {
  if (value === null || typeof value !== 'object') return null

  const id = (value as { id?: unknown }).id
  return typeof id === 'number' && Number.isInteger(id) ? id : null
}

/**
 * three-globe 2.45.2の内部表現に依存する処理はここに集約する。
 * polygonsData()へ渡した元データは、polygonオブジェクトの__data.dataに入る。
 * three-globeを更新したら、__globeObjTypeと__data.dataの形をここで確認する。
 */
export function polygonNumericIdFromObject(object: THREE.Object3D): number | null {
  let current: THREE.Object3D | null = object

  while (current !== null) {
    const candidate = threeGlobeObjectOf(current)
    if (candidate.__globeObjType === 'polygon') {
      const wrapper = candidate.__data
      if (wrapper === null || typeof wrapper !== 'object') return null
      return numericIdOf((wrapper as { data?: unknown }).data)
    }
    current = current.parent
  }

  return null
}

export function isGlobeBodyObject(object: THREE.Object3D): boolean {
  let current: THREE.Object3D | null = object

  while (current !== null) {
    const type = threeGlobeObjectOf(current).__globeObjType
    if (type !== undefined) return type === 'globe'
    current = current.parent
  }

  return false
}

/** three-globe の非同期 digest が全ての陸地 mesh を作り終えたか確認する。 */
export function hasGlobePolygons(
  globe: THREE.Object3D,
  features: readonly import('../types').GlobeFeature[],
): boolean {
  const expected = features.reduce((count, feature) => count + (
    feature.geometry.type === 'MultiPolygon'
      ? (feature.geometry.coordinates as unknown[]).length
      : 1
  ), 0)
  let actual = 0
  globe.traverse((object) => {
    if (threeGlobeObjectOf(object).__globeObjType !== 'polygon') return
    const cap = object.children[0]
    if (cap instanceof THREE.Mesh && cap.geometry.getAttribute('position')?.count > 0) actual += 1
  })
  return actual === expected
}

/**
 * 陸の側面（壁）の深度をわずかに奥へずらし、上面（cap）との境目では上面を優先する。
 * 日付変更線で東西に分割したロシア本土などは、継ぎ目の真下に壁ができる。壁はcapの辺から
 * 真下へ伸びるため本来は隠れるが、ほぼ真横から見る壁は深度の精度差で継ぎ目に細い線として
 * 透けて見える。unitsだけでは足りず、傾きに比例するfactorも使う必要があった。
 * 最大ズームで海岸線の壁（立体感）の見え方が変わらないことは実機描画で確認済み。
 */
export const POLYGON_SIDE_DEPTH_OFFSET = { factor: 1, units: 1 } as const

export function pushGlobePolygonSidesBehindCaps(globe: THREE.Object3D): void {
  globe.traverse((object) => {
    if (threeGlobeObjectOf(object).__globeObjType !== 'polygon') return

    const sideMaterial = (object as { __defaultSideMaterial?: unknown }).__defaultSideMaterial
    if (!(sideMaterial instanceof THREE.Material)) return
    sideMaterial.polygonOffset = true
    sideMaterial.polygonOffsetFactor = POLYGON_SIDE_DEPTH_OFFSET.factor
    sideMaterial.polygonOffsetUnits = POLYGON_SIDE_DEPTH_OFFSET.units
  })
}
