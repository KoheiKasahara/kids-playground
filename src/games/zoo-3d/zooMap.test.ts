import { describe, expect, test } from 'vitest'
import { SPECIES_ORDER } from './species'
import {
  AREAS, AREA_ORDER, PATH_HALF, areaById, clampToEnclosure, distance, homeOf, obstaclesOf, onPath, pondShore, pushOutOfObstacles,
  roamRadius, segmentHitsCircle, speciesOfArea,
} from './zooMap'

describe('どうぶつえんの マップ', () => {
  test('すべての動物が、どこか1つのエリアの1つの展示場で暮らしている', () => {
    const placed = AREAS.flatMap(speciesOfArea)
    expect([...placed].sort()).toEqual([...SPECIES_ORDER].sort())
    for (const id of SPECIES_ORDER) expect(homeOf(id).enclosure.species).toContain(id)
  })

  test('エリアは輪になってつながり、出入口は隣のエリアへ通じる', () => {
    expect(AREA_ORDER.length).toBeGreaterThanOrEqual(4)
    AREA_ORDER.forEach((id, i) => {
      const area = areaById(id)
      const next = AREA_ORDER[(i + 1) % AREA_ORDER.length]
      const prev = AREA_ORDER[(i + AREA_ORDER.length - 1) % AREA_ORDER.length]
      expect(area.exits.map(x => x.to).sort()).toEqual([next, prev].sort())
      for (const exit of area.exits) {
        // 門は園路の上（まっすぐな道の先）にある
        expect(onPath(area, { x: exit.at.x, z: exit.at.z * 0.97 })).toBe(true)
        expect(Math.hypot(exit.at.x, exit.at.z)).toBeLessThan(area.radius)
      }
    })
  })

  test.each(AREAS)('$name: 展示場どうし・広場・園路が重ならない', area => {
    const list = area.enclosures
    for (let i = 0; i < list.length; i++) {
      const e = list[i]
      expect(distance(e.center, area.plaza), `${e.id} と広場`).toBeGreaterThan(e.radius + area.plaza.r + 0.5)
      // 園路の輪は、展示場の外を通る
      const fromCenter = Math.hypot(e.center.x, e.center.z)
      const ringGap = fromCenter < 0.5 ? area.ring - e.radius : fromCenter - e.radius - area.ring
      expect(ringGap, `${e.id} と園路の輪`).toBeGreaterThan(PATH_HALF + 0.5)
      for (let j = i + 1; j < list.length; j++) {
        // 展示場のあいだを人が歩けるすきまを残す
        expect(distance(e.center, list[j].center) - e.radius - list[j].radius, `${e.id} と ${list[j].id}`).toBeGreaterThan(1.5)
      }
      expect(Math.hypot(e.center.x, e.center.z) + e.radius).toBeLessThan(area.radius - 1.5)
    }
  })

  test.each(AREAS)('$name: 木・岩・池は展示場の内側にあり、動物が歩ける広さが残る', area => {
    for (const e of area.enclosures) {
      const roam = roamRadius(e)
      for (const o of [...e.trees.map(t => ({ ...t, r: 0.3 })), ...e.rocks, ...(e.pond ? [e.pond] : [])]) {
        expect(distance(o, e.center) + o.r, `${e.id} の (${o.x}, ${o.z})`).toBeLessThan(roam + 0.3)
      }
      const blocked = obstaclesOf(e).reduce((sum, o) => sum + Math.PI * o.r * o.r, 0)
      expect(blocked, e.id).toBeLessThan(Math.PI * roam * roam * 0.4)
    }
  })

  test.each(AREAS)('$name: 柵の外の木は、展示場・園路・出入口をふさがない', area => {
    expect(area.trees.length).toBeGreaterThan(6)
    for (const t of area.trees) {
      for (const e of area.enclosures) expect(distance(t, e.center), `${e.id} と木 (${t.x}, ${t.z})`).toBeGreaterThan(e.radius + 0.6)
      expect(onPath(area, t, 0.3)).toBe(false)
      for (const x of area.exits) expect(distance(t, x.at)).toBeGreaterThan(2)
    }
  })

  test('水浴びをする動物の展示場には池があり、ほとりは動ける範囲の内側', () => {
    for (const id of ['elephant', 'hippo', 'polar_bear', 'capybara', 'rhino'] as const) {
      const e = homeOf(id).enclosure
      expect(e.pond, id).toBeDefined()
      const shore = pondShore(e, e.center, 1)!
      expect(distance(shore, e.center)).toBeLessThan(roamRadius(e))
    }
  })

  test('柵の種類を動物に合わせて変えている（もうじゅうは おり、ペンギンは ガラス、ふれあい広場は中へ入れる）', () => {
    expect(homeOf('lion').enclosure.barrier).toBe('bars')
    expect(homeOf('penguin').enclosure.barrier).toBe('glass')
    expect(homeOf('elephant').enclosure.barrier).toBe('moat')
    expect(homeOf('rabbit').enclosure.walkIn).toBe(true)
    // サバンナには、いくつもの種類をいっしょに入れる
    expect(homeOf('giraffe').enclosure.species.length).toBeGreaterThanOrEqual(3)
    const barriers = new Set(AREAS.flatMap(a => a.enclosures.map(e => e.barrier)))
    expect(barriers.size).toBeGreaterThanOrEqual(5)
  })

  test('位置の補正と線分の判定', () => {
    const e = homeOf('lion').enclosure
    const far = clampToEnclosure({ x: e.center.x + 50, z: e.center.z }, e, 1)
    expect(distance(far, e.center)).toBeCloseTo(roamRadius(e) - 1)
    // 堀の展示場は、堀の分だけ動ける範囲がせまい
    const moat = homeOf('elephant').enclosure
    expect(roamRadius(moat)).toBeLessThan(moat.radius - 1)
    const p = pushOutOfObstacles({ x: 0, z: 0 }, [{ x: 0.1, z: 0, r: 1 }], 0.5)
    expect(Math.hypot(p.x - 0.1, p.z)).toBeCloseTo(1.5)
    expect(segmentHitsCircle({ x: -2, z: 0 }, { x: 2, z: 0 }, { x: 0, z: 0.5, r: 0.6 })).toBe(true)
    expect(segmentHitsCircle({ x: -2, z: 0 }, { x: 2, z: 0 }, { x: 0, z: 2, r: 0.6 })).toBe(false)
  })
})
