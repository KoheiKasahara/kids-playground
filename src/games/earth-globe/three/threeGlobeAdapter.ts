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
