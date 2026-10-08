import * as THREE from 'three'
import { describe, expect, test } from 'vitest'
import { createPotGeometry, floorHeight, potRows, POT_VERTEX_COUNT, updatePotGeometry } from './potGeometry'
import { createLump, RING_COUNT, WALL } from './pottery'
import { TARGETS } from './targets'

describe('うつわの 3Dメッシュ', () => {
  test('どの かたちでも 頂点の 数は おなじで、ぜんぶ 有限の 値', () => {
    const geometry = createPotGeometry(createLump())
    expect(geometry.getAttribute('position').count).toBe(POT_VERTEX_COUNT)
    for (const target of TARGETS) {
      updatePotGeometry(geometry, target.profile)
      expect(geometry.getAttribute('position').count).toBe(POT_VERTEX_COUNT)
      expect(Array.from(geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true)
      expect(Array.from(geometry.getAttribute('normal').array).every(Number.isFinite)).toBe(true)
      expect(geometry.boundingSphere!.radius).toBeGreaterThan(0)
    }
    geometry.dispose()
  })

  test('そとがわ（もよう）と うちがわ（いろだけ）の 2グループ', () => {
    const geometry = createPotGeometry(createLump())
    expect(geometry.groups.map(group => group.materialIndex)).toEqual([0, 1])
    expect(geometry.groups[0]!.start).toBe(0)
    expect(geometry.groups[1]!.start).toBe(geometry.groups[0]!.count)
    geometry.dispose()
  })

  test('うちがわは そとがわより あつみの ぶん うちに あり、そこは ういている', () => {
    for (const target of TARGETS) {
      const rows = potRows(target.profile)
      const outerTop = rows[RING_COUNT - 1]!
      const floor = floorHeight(target.profile.height)
      const inner = rows.slice(RING_COUNT + 5, rows.length - 4)
      expect(inner[0]![0]).toBeCloseTo(outerTop[0] - WALL, 5)
      expect(inner.at(-1)![1]).toBeCloseTo(floor, 5)
      for (const [radius] of inner) expect(radius).toBeGreaterThan(0)
      expect(rows.at(-4)).toEqual([inner.at(-1)![0], floor])
      expect(rows.at(-1)).toEqual([target.profile.radii[0], 0])
    }
  })

  test('そとがわの おもては そとむき（光が ただしく あたる）', () => {
    const geometry = createPotGeometry(createLump())
    const position = geometry.getAttribute('position')
    const normal = geometry.getAttribute('normal')
    const columns = position.count / (potRows(createLump()).length)
    const vertex = 10 * columns + 5
    const outward = new THREE.Vector3(position.getX(vertex), 0, position.getZ(vertex)).normalize()
    const facing = new THREE.Vector3(normal.getX(vertex), normal.getY(vertex), normal.getZ(vertex))
    expect(facing.dot(outward)).toBeGreaterThan(0.9)
    geometry.dispose()
  })
})
