import { describe, expect, test } from 'vitest'
import { SPECIES_ORDER } from './species'
import { ZOO_MAP, clampToEnclosure, distance, enclosureById, obstaclesOf, pondShore, pushOutOfObstacles, segmentHitsCircle } from './zooMap'

describe('どうぶつえんの マップ', () => {
  test('すべての動物にエリアがあり、エリアどうし・広場と重ならない', () => {
    for (const id of SPECIES_ORDER) expect(enclosureById(id).radius).toBeGreaterThan(4)
    const list = ZOO_MAP.enclosures
    for (let i = 0; i < list.length; i++) {
      expect(distance(list[i].center, ZOO_MAP.plaza)).toBeGreaterThan(list[i].radius + ZOO_MAP.plaza.r - 0.6)
      for (let j = i + 1; j < list.length; j++) {
        expect(distance(list[i].center, list[j].center)).toBeGreaterThan(list[i].radius + list[j].radius - 0.3)
      }
    }
  })

  test('木・岩・池はエリアの内側にあり、動物が歩ける広さが残る', () => {
    for (const e of ZOO_MAP.enclosures) {
      // 行き先が見つからないときはエリアの中心へ向かうので、中心は池・岩・木の外にする
      for (const o of obstaclesOf(e)) expect(distance(o, e.center), `${e.id} の中心`).toBeGreaterThan(o.r + 0.3)
      for (const o of obstaclesOf(e)) expect(distance(o, e.center) + o.r).toBeLessThan(e.radius + 0.5)
      const blocked = obstaclesOf(e).reduce((sum, o) => sum + Math.PI * o.r * o.r, 0)
      expect(blocked).toBeLessThan(Math.PI * e.radius * e.radius * 0.25)
    }
  })

  test('柵の外の木はどのエリアにも入らず、すべてのエリアが園の中に収まる', () => {
    for (const t of ZOO_MAP.outerTrees) {
      for (const e of ZOO_MAP.enclosures) expect(distance(t, e.center), `${e.id} と木 (${t.x}, ${t.z})`).toBeGreaterThan(e.radius + 0.6)
    }
    for (const e of ZOO_MAP.enclosures) expect(distance(e.center, { x: 0, z: 0 }) + e.radius).toBeLessThan(ZOO_MAP.radius)
  })

  test('ゾウのエリアには水浴びの池があり、ほとりはエリアの内側', () => {
    const e = enclosureById('elephant')
    expect(e.pond).toBeDefined()
    const shore = pondShore(e, e.center, 1)!
    expect(distance(shore, e.pond!)).toBeCloseTo(e.pond!.r + 1, 1)
    expect(distance(shore, e.center)).toBeLessThan(e.radius)
  })

  test('位置の補正と線分の判定', () => {
    const e = enclosureById('lion')
    const far = clampToEnclosure({ x: e.center.x + 50, z: e.center.z }, e, 1)
    expect(distance(far, e.center)).toBeCloseTo(e.radius - 1)
    const p = pushOutOfObstacles({ x: 0, z: 0 }, [{ x: 0.1, z: 0, r: 1 }], 0.5)
    expect(Math.hypot(p.x - 0.1, p.z)).toBeCloseTo(1.5)
    expect(segmentHitsCircle({ x: -2, z: 0 }, { x: 2, z: 0 }, { x: 0, z: 0.5, r: 0.6 })).toBe(true)
    expect(segmentHitsCircle({ x: -2, z: 0 }, { x: 2, z: 0 }, { x: 0, z: 2, r: 0.6 })).toBe(false)
  })
})
