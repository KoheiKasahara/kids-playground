import { describe, expect, test } from 'vitest'
import {
  BODY, createVisitor, exitReached, facingEnclosure, planAutoWalk, resolveVisitor, stepVisitor, viewSpot, visitorBlockers, walkable,
  walkInAt, type VisitorState,
} from './walk'
import { AREAS, areaById, distance, homeOf, type Area } from './zooMap'

function walkUntilDone(area: Area, v: VisitorState, seconds = 40) {
  let exit
  for (let t = 0; t < seconds && v.auto; t += 1 / 30) {
    exit = stepVisitor(area, v, { forward: 0, turn: 0 }, 1 / 30) ?? exit
    assertOutsideFences(area, v)
  }
  return exit
}

function assertOutsideFences(area: Area, p: { x: number; z: number }) {
  for (const e of area.enclosures) {
    if (e.walkIn) continue
    expect(distance(p, e.center), `${e.id} の柵の中に入った (${p.x.toFixed(2)}, ${p.z.toFixed(2)})`).toBeGreaterThan(e.radius)
  }
}

describe('歩くモード', () => {
  test.each(AREAS)('$name: 入口に立ち、エリアの中を向いている', area => {
    const v = createVisitor(area)
    expect(walkable(area, v)).toBe(true)
    // 入口（手前の門）の内側から、奥（エリアの中心）を向く
    expect(Math.cos(v.yaw)).toBeLessThan(-0.9)
  })

  test.each(AREAS)('$name: どの展示場にも、地図から歩いて行けて、柵の中には入らない', area => {
    for (const e of area.enclosures) {
      const v = createVisitor(area)
      v.auto = planAutoWalk(area, v, viewSpot(area, e, v), e.walkIn ? undefined : e.center)
      const target = { x: v.auto.x, z: v.auto.z }
      walkUntilDone(area, v)
      expect(distance(v, target), `${e.id} へ着かなかった (${v.x.toFixed(2)}, ${v.z.toFixed(2)})`).toBeLessThan(0.6)
      // 着いたら展示場の方を向いている
      expect(facingEnclosure(area, v)?.id, e.id).toBe(e.id)
    }
  })

  test('前へ歩き続けても、柵・木・看板をすり抜けない', () => {
    const bad: string[] = []
    for (const area of AREAS) {
      for (let k = 0; k < 12; k++) {
        const v = createVisitor(area)
        v.yaw = (k / 12) * Math.PI * 2
        for (let i = 0; i < 30 * 10; i++) {
          stepVisitor(area, v, { forward: 1, turn: i % 90 < 10 ? 1 : 0 }, 1 / 30)
          // 毎フレーム expect を呼ぶと遅いので、はみ出しを集めて最後に確かめる
          const at = `(${v.x.toFixed(2)}, ${v.z.toFixed(2)})`
          for (const e of area.enclosures) {
            if (!e.walkIn && distance(v, e.center) <= e.radius) bad.push(`${area.id}: ${e.id} の柵の中 ${at}`)
          }
          // 2つの物のあいだに押し戻されたときの、数cm のめり込みは許す
          for (const c of visitorBlockers(area)) {
            if (distance(v, c) <= c.r + BODY - 0.06) bad.push(`${area.id}: (${c.x}, ${c.z}) にめり込んだ ${at}`)
          }
          if (Math.hypot(v.x, v.z) >= area.radius + 1) bad.push(`${area.id}: エリアの外 ${at}`)
        }
      }
    }
    expect(bad.slice(0, 5)).toEqual([])
  }, 90_000)

  test('ふれあい広場は入口から中へ入れるが、柵は通りぬけられない', () => {
    const { area, enclosure: e } = homeOf('rabbit')
    expect(e.walkIn).toBe(true)
    // 入口の外から中へ
    const outside = { x: e.center.x + Math.sin(e.front) * (e.radius + 1), z: e.center.z + Math.cos(e.front) * (e.radius + 1) }
    const inside = resolveVisitor(area, outside, { x: e.center.x + Math.sin(e.front) * (e.radius - 1), z: e.center.z + Math.cos(e.front) * (e.radius - 1) })
    expect(walkInAt(area, inside)?.id).toBe(e.id)
    // 入口ではない柵は、外から中へ通れない
    const side = e.front + Math.PI / 2
    const p = resolveVisitor(area, { x: e.center.x + Math.sin(side) * (e.radius + 0.5), z: e.center.z + Math.cos(side) * (e.radius + 0.5) },
      { x: e.center.x + Math.sin(side) * (e.radius - 0.5), z: e.center.z + Math.cos(side) * (e.radius - 0.5) })
    expect(distance(p, e.center)).toBeGreaterThan(e.radius)
    // 自動で歩くときは入口を通って中へ入る
    const v = createVisitor(area)
    const target = { x: e.center.x + 1.5, z: e.center.z - 1 }
    v.auto = planAutoWalk(area, v, target)
    walkUntilDone(area, v)
    expect(distance(v, target)).toBeLessThan(0.6)
  })

  test('門をくぐると、隣のエリアへ行く', () => {
    const area = areaById('savanna')
    const v = createVisitor(area)
    // 奥の門まで歩く
    const far = area.exits.find(x => x.heading === Math.PI)!
    v.auto = planAutoWalk(area, v, { x: far.at.x, z: far.at.z - 1.0 })
    const exit = walkUntilDone(area, v, 60)
    expect(exit?.to).toBe(far.to)
    expect(exitReached(area, { x: 0, z: 0 })).toBeUndefined()
    // 来たエリアの門の内側から始まる
    const next = areaById(far.to)
    const back = next.exits.find(x => x.to === 'savanna')!
    const arrived = createVisitor(next, back)
    expect(distance(arrived, back.at)).toBeLessThan(3)
    expect(walkable(next, arrived)).toBe(true)
  })

  test('向きを変えるボタンでその場で回り、うしろへも少し歩ける', () => {
    const area = areaById('wild')
    const v = createVisitor(area)
    const yaw0 = v.yaw
    for (let i = 0; i < 15; i++) stepVisitor(area, v, { forward: 0, turn: 1 }, 1 / 30)
    expect(v.yaw).not.toBeCloseTo(yaw0)
    const before = { x: v.x, z: v.z }
    for (let i = 0; i < 30; i++) stepVisitor(area, v, { forward: -1, turn: 0 }, 1 / 30)
    expect(distance(before, v)).toBeGreaterThan(0.5)
  })
})
