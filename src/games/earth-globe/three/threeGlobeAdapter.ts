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
