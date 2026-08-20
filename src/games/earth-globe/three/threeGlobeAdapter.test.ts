import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import {
  isGlobeBodyObject,
  polygonNumericIdFromObject,
} from './threeGlobeAdapter'

type ThreeGlobeInternals = {
  __data?: unknown
  __globeObjType?: string
}

function setThreeGlobeInternals(
  object: THREE.Object3D,
  internals: ThreeGlobeInternals,
): void {
  Object.assign(object, internals)
}

describe('three-globe adapter', () => {
  it('extracts the numeric country id from a polygon parent', () => {
    // three-globe 2.45.2の内部ツリーを手作りする回帰テスト。
    // three-globe更新で__data.dataの形が変わったときは、このテストとadapterを確認する。
    const polygon = new THREE.Group()
    const renderedPart = new THREE.Mesh()
    setThreeGlobeInternals(polygon, {
      __globeObjType: 'polygon',
      __data: {
        data: {
          id: 392,
          geometry: { type: 'Polygon', coordinates: [] },
        },
      },
    })
    polygon.add(renderedPart)

    expect(polygonNumericIdFromObject(renderedPart)).toBe(392)
  })

  it('returns null for objects that are not a valid polygon', () => {
    const plainObject = new THREE.Object3D()
    const polygonWithoutCountryData = new THREE.Group()
    setThreeGlobeInternals(polygonWithoutCountryData, {
      __globeObjType: 'polygon',
      __data: { data: { geometry: { type: 'Polygon', coordinates: [] } } },
    })

    expect(polygonNumericIdFromObject(plainObject)).toBeNull()
    expect(polygonNumericIdFromObject(polygonWithoutCountryData)).toBeNull()
  })

  it('recognizes the globe body through its object tree', () => {
    const globe = new THREE.Group()
    const globeMesh = new THREE.Mesh()
    const polygon = new THREE.Group()
    setThreeGlobeInternals(globe, { __globeObjType: 'globe' })
    globe.add(globeMesh)
    setThreeGlobeInternals(polygon, { __globeObjType: 'polygon' })
    globe.add(polygon)

    expect(isGlobeBodyObject(globeMesh)).toBe(true)
    expect(isGlobeBodyObject(polygon)).toBe(false)
    expect(isGlobeBodyObject(new THREE.Object3D())).toBe(false)
  })
})
